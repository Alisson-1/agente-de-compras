/**
 * PADRÃO 7 — Multi-Agent Collaboration
 *
 * O que é: vários agentes com papéis e prompts próprios trabalham na mesma
 * tarefa, e um coordenador junta as contribuições numa decisão.
 *
 * Que problema resolve: um único agente avaliando custo, prazo e qualidade ao
 * mesmo tempo tende a favorecer um critério e esquecer os outros. Especialistas
 * focados dão pareceres mais claros e o coordenador decide com pesos explícitos.
 *
 * Onde aparece: nós `custos`, `logistica` e `qualidade` (rodam em paralelo,
 * cada um com seu prompt.md e sua busca no manual) e o nó `comprador`, que
 * consolida com pesos que dependem da urgência. Na tela: os 3 pareceres lado a
 * lado e a decisão do comprador. Se a decisão tem baixa confiança, o comprador
 * NÃO decide: escala para o humano (HITL, ver 08-hitl.ts).
 */
import type { RunnableConfig } from "@langchain/core/runnables";
import type { DecisaoComprador, ParecerEspecialista, Urgencia } from "@copiloto/shared";
import { formatarBRL } from "@copiloto/shared";
import { agenteComprador } from "../agents/comprador/index.js";
import { agenteCustos, CONSULTA_MANUAL_CUSTOS } from "../agents/custos/index.js";
import { agenteLogistica, CONSULTA_MANUAL_LOGISTICA } from "../agents/logistica/index.js";
import { agenteQualidade, CONSULTA_MANUAL_QUALIDADE } from "../agents/qualidade/index.js";
import { store } from "../data/store.js";
import { comPadrao } from "../events/emitter.js";
import { ctxDe } from "../graph/contexto.js";
import type { Atualizacao, CotacaoEnriquecida, Especialista, Estado } from "../graph/state.js";
import { validarCotacao } from "../validator/rules.js";
import { marcarPasso } from "./06-planning.js";
import { recuperar } from "./09-rag.js";

export const PESOS: Record<Urgencia, Record<Especialista, number>> = {
  urgente: { custos: 0.25, logistica: 0.4, qualidade: 0.35 },
  normal: { custos: 0.35, logistica: 0.3, qualidade: 0.35 },
  rotina: { custos: 0.5, logistica: 0.15, qualidade: 0.35 },
};

const NOMES: Record<Especialista, string> = { custos: "Custos", logistica: "Logística", qualidade: "Qualidade" };

const ESPECIALISTAS = {
  custos: {
    agente: agenteCustos,
    consulta: CONSULTA_MANUAL_CUSTOS,
    why: "Especialista de Custos: olho só o custo real (preço, frete, estoque e carro parado).",
  },
  logistica: {
    agente: agenteLogistica,
    consulta: CONSULTA_MANUAL_LOGISTICA,
    why: "Especialista de Logística: olho só quando a peça chega e se dá para confiar no prazo.",
  },
  qualidade: {
    agente: agenteQualidade,
    consulta: CONSULTA_MANUAL_QUALIDADE,
    why: "Especialista de Qualidade: olho só tipo de peça, garantia e histórico do fornecedor.",
  },
} as const;

/** Mantém só cotações conhecidas e notas entre 0 e 10 (o LLM não inventa cotação). */
function saneado(p: ParecerEspecialista, candidatas: CotacaoEnriquecida[]): ParecerEspecialista {
  const ids = new Set(candidatas.map((c) => c.cotacaoId));
  return {
    avaliacoes: p.avaliacoes
      .filter((a) => ids.has(a.cotacaoId))
      .map((a) => ({ ...a, nota: Math.max(0, Math.min(10, Math.round(a.nota * 10) / 10)) })),
  };
}

export function criarNoEspecialista(tipo: Especialista) {
  return async (estado: Estado, config: RunnableConfig): Promise<Atualizacao> => {
    const ctx = ctxDe(config);
    const pedido = ctx.pedido!;
    const esp = ESPECIALISTAS[tipo];
    return comPadrao(
      ctx.emissor,
      "multi-agent",
      tipo,
      esp.why,
      async () => {
        const label = `Especialista de ${NOMES[tipo]}`;
        void ctx.emissor.emit({ type: "parallel_task", taskId: `esp-${tipo}`, label, status: "iniciada" });
        const t0 = Date.now();
        const chunks = await recuperar(ctx, esp.consulta, tipo, 2);
        const parecer = saneado(await esp.agente(ctx, pedido, estado.candidatas, chunks), estado.candidatas);
        await ctx.emissor.emit({ type: "agent_opinion", agent: tipo, content: parecer });
        void ctx.emissor.emit({ type: "parallel_task", taskId: `esp-${tipo}`, label, status: "concluida", durationMs: Date.now() - t0 });
        return { pareceres: { [tipo]: parecer } };
      },
      (r) => {
        const melhor = [...(r.pareceres?.[tipo]?.avaliacoes ?? [])].sort((a, b) => b.nota - a.nota)[0];
        return melhor ? `melhor no critério: ${melhor.cotacaoId} (${melhor.nota})` : "sem parecer";
      },
    );
  };
}

const um = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Nota consolidada (em código) = média ponderada das notas dos especialistas. */
export function consolidar(estado: Estado, urgencia: Urgencia) {
  const pesos = PESOS[urgencia];
  const nota = (tipo: Especialista, id: string) => estado.pareceres[tipo]?.avaliacoes.find((a) => a.cotacaoId === id)?.nota ?? 0;
  return estado.candidatas
    .map((c) => ({
      cotacaoId: c.cotacaoId,
      c,
      notas: { custos: nota("custos", c.cotacaoId), logistica: nota("logistica", c.cotacaoId), qualidade: nota("qualidade", c.cotacaoId) },
      nota:
        Math.round(
          (pesos.custos * nota("custos", c.cotacaoId) +
            pesos.logistica * nota("logistica", c.cotacaoId) +
            pesos.qualidade * nota("qualidade", c.cotacaoId)) *
            100,
        ) / 100,
    }))
    .sort((a, b) => b.nota - a.nota);
}

/** Baixa confiança: empate técnico (< margem) ou o 1º colocado é o pior para 2+ especialistas. */
function motivoBaixaConfianca(ranking: ReturnType<typeof consolidar>): string | null {
  if (ranking.length < 2) return null;
  const [a, b] = ranking;
  const margem = store.politica.margemEmpateConsolidado;
  if (a.nota > 0 && (a.nota - b.nota) / a.nota < margem) {
    return `${a.cotacaoId} (${um(a.nota)}) e ${b.cotacaoId} (${um(b.nota)}) ficaram a menos de ${Math.round(margem * 100)}% uma da outra na nota consolidada`;
  }
  if (ranking.length >= 3) {
    const piorPara = (Object.keys(PESOS.normal) as Especialista[]).filter((t) =>
      ranking.every((r) => r.notas[t] >= a.notas[t]) && ranking.some((r) => r.notas[t] > a.notas[t]),
    );
    if (piorPara.length >= 2) return `os especialistas de ${piorPara.map((t) => NOMES[t]).join(" e ")} colocaram ${a.cotacaoId} em último lugar`;
  }
  return null;
}

export async function noComprador(estado: Estado, config: RunnableConfig): Promise<Atualizacao> {
  const ctx = ctxDe(config);
  const pedido = ctx.pedido!;
  const rodada = (estado.rodadaCritica ?? 0) + 1;
  let plano = await marcarPasso(ctx, estado.plano, "especialistas", "feito");
  plano = await marcarPasso(ctx, plano, "consolidar", "executando");

  const pesos = PESOS[pedido.urgencia];
  const pesosTexto = `custos ${pesos.custos * 100}%, logística ${pesos.logistica * 100}%, qualidade ${pesos.qualidade * 100}% (pedido ${pedido.urgencia})`;
  const ranking = consolidar(estado, pedido.urgencia);

  // Motivo de cada cotação do pedido (para o tooltip das descartadas na tabela).
  const motivo = (id: string) => {
    const cot = store.cotacoes.get(id)!;
    const v = validarCotacao({ pedido, cotacao: cot, modo: "selecao" });
    const r = ranking.find((x) => x.cotacaoId === id);
    if (!v.ok) return v.erros[0];
    if (!r) return cot.status === "pendente" ? "Cotação ainda pendente." : "Fora da análise.";
    return `Nota consolidada ${um(r.nota)}: custos ${um(r.notas.custos)}, logística ${um(r.notas.logistica)}, qualidade ${um(r.notas.qualidade)}.`;
  };
  const rankingDecisao = [
    ...ranking.map((r) => ({ cotacaoId: r.cotacaoId, nota: r.nota, motivo: motivo(r.cotacaoId) })),
    ...store
      .cotacoesDoPedido(pedido.numero)
      .filter((c) => !ranking.some((r) => r.cotacaoId === c.numero))
      .map((c) => ({ cotacaoId: c.numero, nota: 0, motivo: motivo(c.numero) })),
  ];

  return comPadrao(
    ctx.emissor,
    "multi-agent",
    "comprador",
    rodada === 1
      ? "Sou o comprador-coordenador: junto os 3 pareceres com pesos da urgência e decido."
      : "Rodada 2: o crítico reprovou minha escolha. Releio o feedback e decido de novo.",
    async () => {
      const baixa = rodada === 1 ? motivoBaixaConfianca(ranking) : null;
      if (baixa && ranking.length >= 2) {
        const chunks = await recuperar(ctx, "empate técnico entre cotações: decisão do comprador", "comprador", 1);
        const secao = chunks[0] ? `§${chunks[0].section}` : "§4.5";
        const [a, b] = ranking;
        const opcao = (r: (typeof ranking)[number]) =>
          `Escolho a cotação ${r.cotacaoId} (${r.c.fornecedor}, ${formatarBRL(r.c.total)}, ${r.c.prazoHoras}h)`;
        const decisao: DecisaoComprador = {
          rodada,
          escolhida: "",
          justificativa: `Baixa confiança: ${baixa}. Não vou decidir sozinho.`,
          pesos,
          ranking: rankingDecisao,
        };
        await ctx.emissor.emit({ type: "agent_opinion", agent: "comprador", content: decisao });
        plano = await marcarPasso(ctx, plano, "consolidar", "falhou");
        return {
          plano,
          decisao,
          escalonamento: {
            texto: `Não vou decidir sozinho: ${baixa}. Pelo Manual de Compras ${secao}, nesse caso a escolha é sua. ${a.cotacaoId}: ${a.c.tipos.join("/")}, ${formatarBRL(a.c.total)}, ${a.c.prazoHoras}h. ${b.cotacaoId}: ${b.c.tipos.join("/")}, ${formatarBRL(b.c.total)}, ${b.c.prazoHoras}h. Qual você prefere?`,
            opcoes: [opcao(a), opcao(b)],
          },
        };
      }

      const saida = await agenteComprador(ctx, {
        pedido,
        ranking,
        feedback: estado.feedbackCritico ?? null,
        reprovadas: estado.reprovadas ?? [],
        pesosTexto,
        pareceres: estado.pareceres,
      });
      // Guarda: só vale cotação analisada; senão, a 1ª do ranking.
      const escolhida = ranking.some((r) => r.cotacaoId === saida.cotacaoId) ? saida.cotacaoId : ranking[0].cotacaoId;
      const decisao: DecisaoComprador = { rodada, escolhida, justificativa: saida.justificativa, pesos, ranking: rankingDecisao };
      await ctx.emissor.emit({ type: "agent_opinion", agent: "comprador", content: decisao });
      plano = await marcarPasso(ctx, plano, "consolidar", "feito");
      return {
        plano,
        decisao,
        escalonamento: null,
        rascunho: { tipo: "recomendacao" as const, texto: saida.justificativa, citacoes: [], cotacaoId: escolhida },
        origem: "comprador",
      };
    },
    (r) => (r.escalonamento ? "baixa confiança: escalar ao humano" : `escolheu ${r.decisao?.escolhida}`),
  );
}
