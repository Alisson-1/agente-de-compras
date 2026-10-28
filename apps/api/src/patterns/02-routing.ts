/**
 * PADRÃO 2 — Routing
 *
 * O que é: um classificador decide, no início do turno, qual caminho
 * especializado deve tratar a entrada.
 *
 * Que problema resolve: um único prompt "faz-tudo" fica caro, lento e confuso.
 * Rotear permite que uma pergunta conceitual seja respondida em 1 passo e que
 * só uma recomendação acione planner, ferramentas e especialistas.
 *
 * Onde aparece: nó `router`, primeiro de todo turno. Mensagens do chat são
 * classificadas pelo LLM; eventos da tela (pedido aberto, cotação selecionada,
 * cotação recebida) têm rota fixa em código. Perguntas conceituais nunca chegam
 * a um especialista, então o próprio router faz o retrieval (RAG) para dar
 * grounding a quem responde. Na tela: evento `route` com a intenção e o motivo.
 */
import type { RunnableConfig } from "@langchain/core/runnables";
import type { Intent, TipoEventoTela } from "@copiloto/shared";
import { agenteRouter } from "../agents/router/index.js";
import { comPadrao } from "../events/emitter.js";
import { ctxDe } from "../graph/contexto.js";
import type { Atualizacao, Estado } from "../graph/state.js";
import { recuperar } from "./09-rag.js";

const ROTA_DE_EVENTO: Record<TipoEventoTela, { intent: Intent; reason: string }> = {
  pedido_aberto: { intent: "analisarPedido", reason: "Você abriu um pedido: faço um resumo rápido." },
  cotacao_selecionada: { intent: "avaliarSelecao", reason: "A cotação selecionada fere a política: vou alertar com o manual." },
  cotacao_recebida: { intent: "avisarCotacao", reason: "Chegou uma cotação nova: aviso que a recomendação pode mudar." },
};

export async function noRouter(_estado: Estado, config: RunnableConfig): Promise<Atualizacao> {
  const ctx = ctxDe(config);
  const { evento, mensagem, tela } = ctx.req;
  return comPadrao(
    ctx.emissor,
    "routing",
    "router",
    "Leio a mensagem e o estado da tela para escolher o caminho certo, sem acionar o que não precisa.",
    async () => {
      const rota = evento ? ROTA_DE_EVENTO[evento.tipo] : await agenteRouter(ctx, mensagem ?? "", tela);
      await ctx.emissor.emit({ type: "route", intent: rota.intent, reason: rota.reason });
      const ragChunks = rota.intent === "conceitual" ? await recuperar(ctx, mensagem ?? "", "router", 3) : [];
      return { intent: rota.intent, motivoRota: rota.reason, ragChunks };
    },
    (r) => `intenção: ${r.intent}`,
  );
}
