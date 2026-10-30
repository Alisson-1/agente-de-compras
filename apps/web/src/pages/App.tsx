/**
 * App: Tela de Compras (esquerda, ~60%) + Copiloto de Compras (direita, ~40%).
 * A Tela de Compras tem duas telas: a lista de pedidos (#/pedidos) e o detalhe
 * de um pedido (#/pedidos/PED-...). #/arquitetura mostra o diagrama do agente,
 * aceso ao vivo. O hash permite usar o "voltar" do navegador.
 * A Tela funciona sozinha; o Copiloto observa, responde e propõe, mas nada
 * muda sem um clique humano.
 */
import { ArrowLeft, Network, RotateCcw, Settings as IconeConfig } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { DecisaoComprador, EstadoTela, Intent, RecomendacaoResumo } from "@copiloto/shared";
import { api, ErroApi, type EstadoServidor, type SecaoManual } from "../api";
import { AcoesManuais } from "../compras/AcoesManuais";
import { CotacoesTable } from "../compras/CotacoesTable";
import { OrdemDeCompraCard } from "../compras/OrdemDeCompraCard";
import { PedidoDetalhe, PedidoItens } from "../compras/PedidoDetalhe";
import { PedidoList } from "../compras/PedidoList";
import { Chat } from "../copiloto/Chat";
import { PatternNow } from "../copiloto/PatternNow";
import { PatternStrip } from "../copiloto/PatternStrip";
import { AvatarClaudio } from "../copiloto/AvatarClaudio";
import { AbrirPedidoContext, ManualContext } from "../copiloto/RagCitations";
import { Settings } from "../copiloto/Settings";
import { SuggestionChips } from "../copiloto/SuggestionChips";
import { Alert, Button, IconButton } from "../design-system/localiza/components";
import { useAgentStream, type MensagemUI } from "../hooks/useAgentStream";
import { useLarguraChat } from "../hooks/useLarguraChat";
import { useScreenEvents } from "../hooks/useScreenEvents";
import { useSettings } from "../hooks/useSettings";
import { Arquitetura } from "./Arquitetura";

type AvisoTela = { tone: "info" | "success" | "warning" | "critical"; title: string; texto: string } | null;

const naArquiteturaPeloHash = () => window.location.hash === "#/arquitetura";

/** Nó do grafo que trata cada intenção (para acender o diagrama). */
const NO_DA_INTENCAO: Record<Intent, string> = {
  conceitual: "conceitual",
  analisarPedido: "analisarPedido",
  recomendar: "planner",
  explicar: "explicar",
  proporAcao: "proporAcao",
  avaliarSelecao: "avaliarSelecao",
  avisarCotacao: "avisarCotacao",
  priorizarPedidos: "priorizar",
  foraDoEscopo: "foraDoEscopo",
};

/** Pedido aberto a partir da URL (#/pedidos/PED-2026-0412); null = tela de lista. */
function pedidoDoHash(): string | null {
  const m = window.location.hash.match(/^#\/pedidos\/(PED-\d{4}-\d{4})$/);
  return m ? m[1] : null;
}

export function App() {
  const { config, atualizar } = useSettings();
  const { largura: larguraChat, painelRef: painelChatRef, divisorProps, minimo: minimoChat } = useLarguraChat();
  const [estado, setEstado] = useState<EstadoServidor | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [manual, setManual] = useState<SecaoManual[]>([]);
  const [pedidoId, setPedidoId] = useState<string | null>(pedidoDoHash);
  const [naArquitetura, setNaArquitetura] = useState(naArquiteturaPeloHash);
  /** Último pedido aberto: segue como contexto do Copiloto na tela de arquitetura. */
  const [ultimoPedidoId, setUltimoPedidoId] = useState<string | null>(pedidoDoHash);
  const [recomendacoes, setRecomendacoes] = useState<Record<string, RecomendacaoResumo>>({});
  const [aviso, setAviso] = useState<AvisoTela>(null);
  const [ocupadoAcao, setOcupadoAcao] = useState(false);
  const [configAberta, setConfigAberta] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setEstado(await api.estado());
      setErroCarga(null);
    } catch (e) {
      setErroCarga(`Não consegui carregar os dados da API (${(e as Error).message}). Confira se ela está rodando na porta 3333.`);
    }
  }, []);

  useEffect(() => {
    void carregar();
    api.manual().then(setManual).catch(() => setManual([]));
  }, [carregar]);

  const pedido = estado?.pedidos.find((p) => p.numero === pedidoId) ?? null;
  const cotacoesDoPedido = useMemo(() => estado?.cotacoes.filter((c) => c.pedidoId === pedidoId) ?? [], [estado, pedidoId]);
  const ordem = estado?.ordens.find((o) => o.pedidoId === pedidoId);
  const aba = naArquitetura ? "arquitetura do agente" : pedidoId ? "detalhe do pedido" : "lista de pedidos";
  // Pedido que o Copiloto enxerga: o aberto, ou o último aberto quando se está no diagrama.
  const pedidoCopilotoId = pedidoId ?? (naArquitetura ? ultimoPedidoId : null);
  const pedidoCopiloto = estado?.pedidos.find((p) => p.numero === pedidoCopilotoId) ?? null;
  const recomendacao = pedidoCopilotoId ? (recomendacoes[pedidoCopilotoId] ?? null) : null;

  useEffect(() => {
    if (pedidoId) setUltimoPedidoId(pedidoId);
  }, [pedidoId]);

  useEffect(() => {
    const aoMudar = () => {
      setPedidoId(pedidoDoHash());
      setNaArquitetura(naArquiteturaPeloHash());
    };
    window.addEventListener("hashchange", aoMudar);
    return () => window.removeEventListener("hashchange", aoMudar);
  }, []);

  /* ---------- Copiloto ---------- */

  const contextoAtual = {
    pedidoId: pedidoCopilotoId,
    cotacaoSelecionadaId: pedidoCopiloto?.cotacaoSelecionadaId ?? null,
    aba,
    recomendacao,
    config,
  };
  const contexto = useRef(contextoAtual);
  contexto.current = contextoAtual;

  const obterContexto = useCallback(() => {
    const c = contexto.current;
    const tela: EstadoTela = {
      pedidoId: c.pedidoId,
      cotacaoSelecionadaId: c.cotacaoSelecionadaId,
      aba: c.aba,
      ultimaRecomendacao: c.recomendacao,
    };
    return { tela, config: c.config };
  }, []);

  const aoTerminar = useCallback(
    (m: MensagemUI) => {
      // Guarda a última recomendação aprovada pelo crítico (destaque na tabela + contexto dos próximos turnos).
      const decisao = m.eventos
        .filter((e) => e.type === "agent_opinion" && e.agent === "comprador")
        .map((e) => (e as { content: DecisaoComprador }).content)
        .at(-1);
      const aprovada = m.eventos.some((e) => e.type === "hitl" && e.kind === "proposta");
      if (decisao?.escolhida && aprovada && m.pedidoId) {
        const resumo: RecomendacaoResumo = {
          pedidoId: m.pedidoId,
          cotacaoId: decisao.escolhida,
          justificativa: decisao.justificativa,
          ranking: decisao.ranking,
        };
        setRecomendacoes((r) => ({ ...r, [m.pedidoId!]: resumo }));
      }
      void carregar();
    },
    [carregar],
  );

  const { mensagens, ocupado, stats, enviar, limpar } = useAgentStream(obterContexto, aoTerminar);
  const { disparar, reiniciar: reiniciarEventos } = useScreenEvents(config.proativo, enviar);

  const aguardandoVoce =
    !!estado?.propostas.some((p) => p.status === "pendente") || mensagens.some((m) => m.escalonamento && !m.escalonamentoRespondido);
  const ultimoAgente = [...mensagens].reverse().find((m) => m.papel === "agente");
  const ofereceuReavaliar = !!ultimoAgente?.eventos.some((e) => e.type === "route" && e.intent === "avisarCotacao");

  // Diagrama ao vivo: nós rodando agora e caminho do último turno (inclusive o turno em andamento).
  const nosAtivos = useMemo(() => new Set(stats.ativos.map((a) => a.node)), [stats.ativos]);
  const nosPercorridos = useMemo(() => {
    const nos = new Set<string>();
    if (!ultimoAgente) return nos;
    nos.add("entrada").add("router");
    for (const e of ultimoAgente.eventos) {
      if (e.type === "pattern_start") nos.add(e.node);
      if (e.type === "route") nos.add(NO_DA_INTENCAO[e.intent]);
      if (e.type === "validation") nos.add("validate");
      if (e.type === "validation" && !e.ok) nos.add("validador-reprovou");
      if (e.type === "reflection") nos.add("critic");
      if (e.type === "reflection" && !e.approved) nos.add("critico-reprovou");
      if (e.type === "hitl" && e.kind === "escalonamento") nos.add("escalonou");
      if (e.type === "message" || e.type === "hitl") nos.add("finalize");
    }
    return nos;
  }, [ultimoAgente]);

  /* ---------- Ações da tela (humanas) ---------- */

  const acao = async (fn: () => Promise<void>) => {
    setOcupadoAcao(true);
    try {
      await fn();
    } catch (e) {
      const erros = e instanceof ErroApi && e.validacao ? e.validacao.erros.join(" ") : "";
      setAviso({ tone: "critical", title: (e as Error).message, texto: erros || "Tente de novo." });
    } finally {
      setOcupadoAcao(false);
    }
  };

  const abrirPedido = useCallback((id: string) => {
    window.location.hash = `#/pedidos/${id}`;
  }, []);
  const voltarParaLista = () => {
    window.location.hash = "#/pedidos";
  };
  const abrirArquitetura = () => {
    window.location.hash = "#/arquitetura";
  };

  // Ao entrar no detalhe de um pedido, o agente proativo faz o resumo (uma vez por pedido).
  useEffect(() => {
    setAviso(null);
    if (pedidoId) disparar({ tipo: "pedido_aberto", pedidoId });
  }, [pedidoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selecionarCotacao = (cotacaoId: string) =>
    acao(async () => {
      if (!pedido) return;
      const r = await api.selecionar(pedido.numero, cotacaoId);
      setEstado(r.estado);
      if (r.validacao.ok) {
        setAviso(null);
      } else {
        setAviso({ tone: "warning", title: "Essa cotação fere a política de compras", texto: r.validacao.erros.join(" ") });
        disparar({ tipo: "cotacao_selecionada", pedidoId: pedido.numero, cotacaoId });
      }
    });

  const emitir = () =>
    acao(async () => {
      if (!pedido?.cotacaoSelecionadaId) return;
      const r = await api.emitir(pedido.numero, pedido.cotacaoSelecionadaId);
      setEstado(r.estado);
      setAviso({
        tone: "success",
        title: `Ordem de compra ${r.ordem.numero} emitida`,
        texto: r.ordem.requerGestor ? "Ela passa da alçada do comprador: agora precisa da aprovação do gestor." : "Pedido comprado.",
      });
    });

  const novaCotacao = () =>
    acao(async () => {
      if (!pedido) return;
      const r = await api.novaCotacao(pedido.numero);
      setEstado(r.estado);
      setAviso({ tone: "info", title: `Cotação ${r.cotacao.numero} solicitada`, texto: "Ela fica pendente até o fornecedor responder." });
    });

  const aprovarGestor = (ordemId: string) =>
    acao(async () => {
      const r = await api.aprovarGestor(ordemId);
      setEstado(r.estado);
      setAviso({ tone: "success", title: "Compra aprovada pelo gestor", texto: `${r.ordem.numero} liberada para o fornecedor.` });
    });

  const simularCotacao = () =>
    acao(async () => {
      if (!pedido) return;
      const r = await api.simularCotacao(pedido.numero);
      setEstado(r.estado);
      setAviso({ tone: "info", title: `Chegou a cotação ${r.cotacao.numero}`, texto: "A tabela foi atualizada." });
      disparar({ tipo: "cotacao_recebida", pedidoId: pedido.numero, cotacaoId: r.cotacao.numero });
    });

  const reiniciarDemo = () =>
    acao(async () => {
      setEstado(await api.reiniciar());
      voltarParaLista();
      setRecomendacoes({});
      setAviso(null);
      limpar();
      reiniciarEventos();
    });

  /* ---------- Propostas (HITL): só o clique humano chama estes endpoints ---------- */

  const aoAprovar = async (id: string) => setEstado((await api.aprovarProposta(id)).estado);
  const aoRecusar = async (id: string) => setEstado((await api.recusarProposta(id)).estado);
  const aoEditar = async (id: string, m: { cotacaoId?: string | null; quantidades?: Record<string, number> | null }) =>
    setEstado((await api.editarProposta(id, m)).estado);

  const bloqueado = !!pedido && ["comprado", "aguardando aprovação do gestor", "cancelado"].includes(pedido.status);

  return (
    <ManualContext.Provider value={manual}>
      <AbrirPedidoContext.Provider value={abrirPedido}>
      <div className="app">
        <header className="topo">
          <h1 className="topo__titulo">LocalizeAI</h1>
          <div className="topo__acoes">
            {naArquitetura ? (
              <Button variant="inverse" size="sm" onClick={voltarParaLista}>
                <ArrowLeft size={16} aria-hidden="true" /> Voltar aos pedidos
              </Button>
            ) : (
              <Button variant="inverse" size="sm" onClick={abrirArquitetura}>
                <Network size={16} aria-hidden="true" /> Arquitetura do agente
              </Button>
            )}
            <Button variant="inverse" size="sm" onClick={reiniciarDemo} disabled={ocupadoAcao || ocupado}>
              <RotateCcw size={16} aria-hidden="true" /> Reiniciar demo
            </Button>
          </div>
        </header>

        <main
          className={`colunas ${larguraChat !== null ? "colunas--ajustada" : ""}`}
          style={larguraChat !== null ? ({ "--largura-chat": `${larguraChat}px` } as CSSProperties) : undefined}
        >
          <section className="tela" aria-label="Tela de Compras">
            {erroCarga ? (
              <Alert tone="critical" title="API indisponível">
                {erroCarga}
              </Alert>
            ) : null}

            {naArquitetura ? (
              <Arquitetura ativos={nosAtivos} percorridos={nosPercorridos} />
            ) : pedido ? (
              <>
                <button type="button" className="voltar" onClick={voltarParaLista}>
                  <ArrowLeft size={18} aria-hidden="true" /> Todos os pedidos
                </button>
                <PedidoDetalhe pedido={pedido} oficina={estado?.oficinas.find((o) => o.id === pedido.os.oficinaId)} />
                <PedidoItens pedido={pedido} />

                <h3 className="secao-titulo">Cotações ({cotacoesDoPedido.length})</h3>
                <CotacoesTable
                  cotacoes={cotacoesDoPedido}
                  fornecedores={estado?.fornecedores ?? []}
                  selecionada={pedido.cotacaoSelecionadaId}
                  recomendacao={recomendacao}
                  bloqueado={bloqueado || ocupadoAcao}
                  aoSelecionar={selecionarCotacao}
                />
                {aviso ? (
                  <Alert tone={aviso.tone} title={aviso.title}>
                    {aviso.texto}
                  </Alert>
                ) : null}
                <AcoesManuais
                  pedido={pedido}
                  ordem={ordem}
                  temPendente={cotacoesDoPedido.some((c) => c.status === "pendente")}
                  ocupado={ocupadoAcao}
                  aoSolicitarCotacao={novaCotacao}
                  aoEmitir={emitir}
                  aoAprovarGestor={aprovarGestor}
                  aoSimularCotacao={simularCotacao}
                />
                {ordem ? <OrdemDeCompraCard ordem={ordem} /> : null}
              </>
            ) : pedidoId && estado ? (
              <>
                <button type="button" className="voltar" onClick={voltarParaLista}>
                  <ArrowLeft size={18} aria-hidden="true" /> Todos os pedidos
                </button>
                <Alert tone="warning" title="Pedido não encontrado">
                  Volte para a lista e escolha um pedido.
                </Alert>
              </>
            ) : (
              <PedidoList
                pedidos={estado?.pedidos ?? []}
                aoAbrir={abrirPedido}
              />
            )}
          </section>

          <aside className="copiloto" aria-label="Cláudio - Assistente de Compras" ref={painelChatRef}>
            <div
              className="divisor"
              role="separator"
              aria-orientation="vertical"
              aria-label="Redimensionar o chat (setas; duplo clique volta ao padrão)"
              aria-valuemin={minimoChat}
              aria-valuenow={larguraChat ?? undefined}
              tabIndex={0}
              {...divisorProps}
            />
            <div className="copiloto__topo">
              <div className="copiloto__identidade">
                <AvatarClaudio />
                <div>
                  <h2 className="copiloto__titulo">Cláudio - Assistente de Compras</h2>
                  <span className={`selo-modo ${config.simulado ? "selo-modo--simulado" : "selo-modo--real"}`}>
                    {config.simulado ? "Modo simulado" : `LLM real: ${config.modelo}`}
                  </span>
                </div>
              </div>
              <IconButton label="Configurações" variant="filled" size="sm" onClick={() => setConfigAberta((a) => !a)} aria-expanded={configAberta}>
                <IconeConfig aria-hidden="true" />
              </IconButton>
            </div>
            <PatternStrip stats={stats} aguardandoVoce={aguardandoVoce} />
            <PatternNow stats={stats} ocupado={ocupado} />
            {configAberta ? <Settings config={config} atualizar={atualizar} fechar={() => setConfigAberta(false)} /> : null}
            <Chat
              mensagens={mensagens}
              propostas={estado?.propostas ?? []}
              cotacoes={estado?.cotacoes ?? []}
              ocupado={ocupado}
              simulado={config.simulado}
              enviar={(texto) => enviar({ mensagem: texto })}
              usarSimulado={() => atualizar({ simulado: true })}
              aoAprovar={aoAprovar}
              aoRecusar={aoRecusar}
              aoEditar={aoEditar}
              rodape={
                <SuggestionChips
                  pedido={pedidoCopiloto}
                  temRecomendacao={!!recomendacao}
                  ofereceuReavaliar={ofereceuReavaliar}
                  desabilitado={ocupado}
                  aoEscolher={(texto) => enviar({ mensagem: texto })}
                />
              }
            />
          </aside>
        </main>
      </div>
      </AbrirPedidoContext.Provider>
    </ManualContext.Provider>
  );
}
