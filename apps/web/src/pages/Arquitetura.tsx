/**
 * Tela "Arquitetura do agente" (#/arquitetura): diagrama estrutural do grafo
 * (apps/api/src/graph/buildGraph.ts), só nós e arestas. Acende ao vivo:
 * "rodando agora" vem dos padrões ativos; "último caminho" vem dos eventos do último turno.
 */

type Props = {
  /** Nós rodando agora (campo `node` dos eventos pattern_start ativos). */
  ativos: Set<string>;
  /** Nós percorridos no último turno, mais os marcadores "critico-reprovou", "validador-reprovou" e "escalonou". */
  percorridos: Set<string>;
};

type Caixa = {
  id: string;
  /** Nomes de nó (eventos) que acendem esta caixa. */
  apelidos?: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  rotulo: string;
  sub?: string;
  tipo?: "terminal" | "humano";
};

/* Coordenadas no viewBox 960 × 790. Ramos à esquerda (barramento do router em x=60),
   validate → critic → finalize na coluna da direita, atalhos para finalize em x=930. */
const RAMO = { x: 90, w: 160, h: 40 };
const ramo = (id: string, y: number, rotulo: string, sub?: string, apelidos?: string[]): Caixa => ({
  id,
  apelidos,
  x: RAMO.x,
  y,
  w: RAMO.w,
  h: RAMO.h,
  rotulo,
  sub,
});

const CAIXAS: Caixa[] = [
  { id: "entrada", x: 30, y: 10, w: 180, h: 44, rotulo: "START", sub: "chat ou evento da tela", tipo: "terminal" },
  { id: "router", x: 30, y: 86, w: 180, h: 50, rotulo: "router", sub: "Routing · RAG" },
  ramo("conceitual", 180, "conceitual", "RAG"),
  ramo("analisarPedido", 232, "analisarPedido", "Prompt Chaining"),
  ramo("explicar", 284, "explicar", "RAG"),
  ramo("proporAcao", 336, "proporAcao", "Tool Use"),
  ramo("priorizar", 388, "priorizarPedidos", "Tool Use · RAG"),
  ramo("eventos", 440, "eventos da tela", "RAG · Tool Use", ["avaliarSelecao", "alerta", "avisarCotacao"]),
  ramo("foraDoEscopo", 492, "foraDoEscopo", undefined, ["semPedido"]),
  ramo("planner", 620, "planner", "Planning"),
  { id: "enriquecer", x: 280, y: 620, w: 150, h: 40, rotulo: "enriquecer", sub: "Parallelization · Tool Use" },
  { id: "custos", x: 455, y: 584, w: 105, h: 32, rotulo: "custos" },
  { id: "logistica", x: 455, y: 624, w: 105, h: 32, rotulo: "logística" },
  { id: "qualidade", x: 455, y: 664, w: 105, h: 32, rotulo: "qualidade" },
  { id: "comprador", x: 590, y: 620, w: 130, h: 40, rotulo: "comprador", sub: "Multi-Agent" },
  { id: "validate", x: 780, y: 228, w: 120, h: 50, rotulo: "validate", sub: "código, sem LLM" },
  { id: "critic", x: 780, y: 380, w: 120, h: 50, rotulo: "critic", sub: "Reflection · RAG" },
  { id: "finalize", x: 780, y: 560, w: 120, h: 48, rotulo: "finalize", sub: "HITL" },
  { id: "fim", x: 800, y: 650, w: 80, h: 30, rotulo: "END", tipo: "terminal" },
  { id: "humano", x: 770, y: 695, w: 140, h: 40, rotulo: "humano aprova", sub: "fora do grafo", tipo: "humano" },
];

type Aresta = {
  de: string;
  para: string;
  d: string;
  tipo?: "atalho" | "retorno" | "externa";
  /** Marcador que precisa estar em `percorridos` (ex.: só acende se o crítico reprovou). */
  requer?: string;
};

const cy = (id: string) => {
  const c = CAIXAS.find((x) => x.id === id)!;
  return c.y + c.h / 2;
};

const ARESTAS: Aresta[] = [
  { de: "entrada", para: "router", d: "M120,54 V86" },
  ...["conceitual", "analisarPedido", "explicar", "proporAcao", "priorizar", "eventos", "foraDoEscopo", "planner"].map((id) => ({
    de: "router",
    para: id,
    d: `M60,136 V${cy(id)} H90`,
  })),
  // Para o validate (barramento em x=750)
  { de: "analisarPedido", para: "validate", d: `M250,${cy("analisarPedido")} H780` },
  ...["explicar", "proporAcao", "priorizar", "eventos"].map((id) => ({
    de: id,
    para: "validate",
    d: `M250,${cy(id)} H750 V253 H780`,
  })),
  // Recomendar: planner → enriquecer → 3 especialistas em paralelo → comprador
  { de: "planner", para: "enriquecer", d: "M250,640 H280" },
  ...["custos", "logistica", "qualidade"].flatMap((id) => [
    { de: "enriquecer", para: id, d: `M430,640 C442,640 443,${cy(id)} 455,${cy(id)}` },
    { de: id, para: "comprador", d: `M560,${cy(id)} C575,${cy(id)} 575,640 590,640` },
  ]),
  { de: "comprador", para: "validate", d: "M720,640 H750 V253 H780" },
  // Atalhos direto para o finalize (barramento em x=930)
  { de: "conceitual", para: "finalize", d: `M250,${cy("conceitual")} H930 V584 H900`, tipo: "atalho" },
  { de: "foraDoEscopo", para: "finalize", d: `M250,${cy("foraDoEscopo")} H930 V584 H900`, tipo: "atalho" },
  { de: "comprador", para: "finalize", d: "M655,660 V765 H930 V584 H900", tipo: "atalho", requer: "escalonou" },
  // Coluna da direita
  { de: "validate", para: "critic", d: "M840,278 V380" },
  { de: "critic", para: "finalize", d: "M840,430 V560" },
  { de: "finalize", para: "fim", d: "M840,608 V650" },
  { de: "fim", para: "humano", d: "M840,680 V695", tipo: "externa" },
  // Retornos
  { de: "critic", para: "comprador", d: "M780,405 C705,405 655,500 655,620", tipo: "retorno", requer: "critico-reprovou" },
  { de: "validate", para: "validate", d: "M780,268 C760,268 760,238 780,238", tipo: "retorno", requer: "validador-reprovou" },
];

const ROTULOS_ARESTA = [
  { x: 72, y: 160, texto: "intenção", ancora: "start" as const },
  { x: 925, y: 192, texto: "direto para finalize", ancora: "end" as const },
  { x: 756, y: 226, texto: "reprovou: volta à origem (máx. 2)", ancora: "end" as const },
  { x: 700, y: 440, texto: "reprovou: nova rodada (máx. 2)", ancora: "end" as const },
  { x: 665, y: 755, texto: "baixa confiança: escala ao humano", ancora: "start" as const },
  { x: 455, y: 578, texto: "em paralelo · Multi-Agent · RAG", ancora: "start" as const },
];

export function Arquitetura({ ativos, percorridos }: Props) {
  const nomes = (c: Caixa) => [c.id, ...(c.apelidos ?? [])];
  const ativa = (c: Caixa) => nomes(c).some((n) => ativos.has(n));
  const passou = (id: string) => {
    const c = CAIXAS.find((x) => x.id === id);
    if (!c) return false;
    if (id === "fim") return percorridos.has("finalize");
    return nomes(c).some((n) => percorridos.has(n));
  };
  const arestaPercorrida = (a: Aresta) =>
    a.tipo !== "externa" && (a.requer ? percorridos.has(a.requer) : passou(a.de) && passou(a.para));
  // Percorridas por cima das demais.
  const arestas = [...ARESTAS].sort((a, b) => Number(arestaPercorrida(a)) - Number(arestaPercorrida(b)));

  return (
    <section className="arq" aria-label="Arquitetura do agente">
      <div className="arq__topo">
        <div>
          <h2 className="lz-text-heading-lg arq__titulo">Arquitetura do agente</h2>
        </div>
        <ul className="arq__legenda" aria-label="Legenda">
          <li>
            <span className="arq__amostra arq__amostra--ativo" /> Rodando agora
          </li>
          <li>
            <span className="arq__amostra arq__amostra--percorrido" /> Último caminho
          </li>
          <li>
            <span className="arq__amostra arq__amostra--tracejada" /> Atalho ou retorno
          </li>
        </ul>
      </div>

      <svg className="arq-grafo" viewBox="0 0 960 790" role="img" aria-label="Grafo do agente: router, caminhos por intenção, validate, critic e finalize">
        <defs>
          <marker id="arq-seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="arq-seta" />
          </marker>
          <marker id="arq-seta-ativa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="arq-seta arq-seta--percorrida" />
          </marker>
        </defs>

        <rect x="76" y="568" width="658" height="140" rx="16" className="arq-grupo" />
        <text x="88" y="560" className="arq-grupo__rotulo">
          recomendar
        </text>

        {arestas.map((a, i) => {
          const p = arestaPercorrida(a);
          return (
            <path
              key={i}
              d={a.d}
              className={["arq-aresta", a.tipo ? `arq-aresta--${a.tipo}` : "", p ? "arq-aresta--percorrida" : ""].join(" ")}
              markerEnd={`url(#${p ? "arq-seta-ativa" : "arq-seta"})`}
            />
          );
        })}

        {ROTULOS_ARESTA.map((r) => (
          <text key={r.texto} x={r.x} y={r.y} textAnchor={r.ancora} className="arq-aresta__rotulo">
            {r.texto}
          </text>
        ))}

        {CAIXAS.map((c) => {
          const estado = ativa(c) ? "ativa" : passou(c.id) ? "percorrida" : "";
          return (
            <g key={c.id} className={["arq-caixa", c.tipo ? `arq-caixa--${c.tipo}` : "", estado ? `arq-caixa--${estado}` : ""].join(" ")}>
              <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={c.tipo === "terminal" ? c.h / 2 : 10} />
              <text x={c.x + c.w / 2} y={c.sub ? c.y + c.h / 2 - 3 : c.y + c.h / 2 + 5} textAnchor="middle" className="arq-caixa__rotulo">
                {c.rotulo}
              </text>
              {c.sub ? (
                <text x={c.x + c.w / 2} y={c.y + c.h / 2 + 13} textAnchor="middle" className="arq-caixa__sub">
                  {c.sub}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </section>
  );
}
