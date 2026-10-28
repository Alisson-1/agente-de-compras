/**
 * PADRÃO 4 — Reflection
 *
 * O que é: um agente crítico revisa a resposta antes de ela sair e, se
 * reprovar, devolve o rascunho ao autor com feedback para uma nova rodada.
 *
 * Que problema resolve: a primeira resposta de um LLM costuma ser plausível,
 * não necessariamente certa. Uma segunda leitura, com o manual na mão, pega
 * escolhas incoerentes com as regras ou com os números.
 *
 * Onde aparece: nó `critic`, depois do `validate`. Em recomendações e
 * propostas, reprovar devolve ao comprador (ou ao proporAcao), no máximo 2
 * rodadas. Na tela: "Rodada 1: reprovado porque... → Rodada 2: aprovado".
 *
 * Crítico ≠ validador: as regras duras da política vivem em código
 * (validator/rules.ts). Se o validador reprovou, o crítico é obrigado a
 * reprovar (guarda em código); o papel dele é explicar com o manual e cuidar
 * do qualitativo (coerência da justificativa).
 */
import type { RunnableConfig } from "@langchain/core/runnables";
import type { ChunkRag } from "@copiloto/shared";
import { agenteCritico } from "../agents/critic/index.js";
import { store } from "../data/store.js";
import { comPadrao } from "../events/emitter.js";
import { ctxDe } from "../graph/contexto.js";
import type { Atualizacao, Estado } from "../graph/state.js";
import { secoesDoManual } from "../rag/search.js";
import { marcarPasso } from "./06-planning.js";
import { recuperar } from "./09-rag.js";

const CONSULTA_POR_REGRA: Record<string, string> = {
  "item-seguranca-tipo": "peça paralela em item de segurança é proibida",
  "prazo-urgente": "pedido urgente com carro parado exige entrega em até 24 horas",
  "fornecedor-vetado": "veto de fornecedor com nota abaixo de 3",
  "cotacao-expirada": "cotação expirada é vetada",
  "minimo-cotacoes": "mínimo de cotações respondidas",
};

function consultaDoCritico(estado: Estado): string {
  const r = estado.rascunho!;
  const regra = estado.validacao && !estado.validacao.ok ? estado.validacao.regras[0]?.regra : null;
  if (regra && CONSULTA_POR_REGRA[regra]) return CONSULTA_POR_REGRA[regra];
  if (r.tipo === "recomendacao") {
    const c = estado.candidatas?.find((x) => x.cotacaoId === r.cotacaoId);
    return `regras para peça ${c?.tipos.join(" e ") ?? ""} em item de segurança e prazo de pedido urgente`;
  }
  if (r.tipo === "proposta") return "limite de alçada do comprador e aprovação do gestor";
  return r.texto.slice(0, 160);
}

export async function noCritico(estado: Estado, config: RunnableConfig): Promise<Atualizacao> {
  const ctx = ctxDe(config);
  const rascunho = estado.rascunho!;
  const rodada = (estado.rodadaCritica ?? 0) + 1;
  const ehRecomendacao = rascunho.tipo === "recomendacao";
  let plano = ehRecomendacao ? await marcarPasso(ctx, estado.plano, "revisar", "executando") : estado.plano;

  return comPadrao(
    ctx.emissor,
    "reflection",
    "critic",
    rodada === 1
      ? "Antes de responder, um crítico revisa: a resposta segue o manual e bate com os números?"
      : `Rodada ${rodada}: o crítico revisa a nova versão.`,
    async () => {
      const chunks: ChunkRag[] = await recuperar(ctx, consultaDoCritico(estado), "critic", 3);
      // Garante que a seção da regra violada esteja entre os trechos (vem do manual, não do LLM).
      for (const regra of estado.validacao?.regras ?? []) {
        if (!chunks.some((c) => c.section === regra.secaoManual)) {
          const s = secoesDoManual().find((x) => x.section === regra.secaoManual);
          if (s) chunks.unshift({ source: s.source, section: s.section, text: `${s.title}. ${s.text}`, score: 1 });
        }
      }

      const escolhida = estado.decisao?.ranking.find((r) => r.cotacaoId === rascunho.cotacaoId);
      const cotacao = rascunho.cotacaoId ? store.cotacoes.get(rascunho.cotacaoId) : undefined;
      const saida = await agenteCritico(ctx, {
        rascunho,
        validacao: estado.validacao ?? null,
        chunks,
        notaEscolhida: escolhida?.nota,
        dados: { cotacao, decisao: estado.decisao, proposta: rascunho.proposta },
      });

      // Guarda em código: validador reprovado ⇒ crítico reprovado.
      const validadorReprovou = !!estado.validacao && !estado.validacao.ok;
      const aprovado = saida.aprovado && !validadorReprovou;
      const feedback =
        validadorReprovou && saida.aprovado
          ? `Reprovado pelo validador em código: ${estado.validacao!.erros.join(" ")}`
          : saida.feedback;

      await ctx.emissor.emit({ type: "reflection", round: rodada, approved: aprovado, feedback });

      if (ehRecomendacao) plano = await marcarPasso(ctx, plano, "revisar", aprovado ? "feito" : "falhou");
      if (!aprovado && ehRecomendacao) plano = await marcarPasso(ctx, plano, "consolidar", "executando");

      const reprovadas = !aprovado && rascunho.cotacaoId ? [...(estado.reprovadas ?? []), rascunho.cotacaoId] : (estado.reprovadas ?? []);
      return {
        plano,
        rodadaCritica: rodada,
        aprovadoPeloCritico: aprovado,
        feedbackCritico: aprovado ? null : feedback,
        reprovadas,
        notasCritico: [...(estado.notasCritico ?? []), `Rodada ${rodada}: ${feedback}`],
        rascunho: { ...rascunho, citacoes: [...new Set([...rascunho.citacoes, ...saida.citacoes])] },
      };
    },
    (r) => (r.aprovadoPeloCritico ? `rodada ${rodada}: aprovado` : `rodada ${rodada}: reprovado`),
  );
}
