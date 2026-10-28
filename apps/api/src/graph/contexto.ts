/**
 * Contexto de um turno, passado aos nós via config.configurable.ctx.
 * O grafo é stateless: tudo o que o turno precisa vem da requisição da web
 * (histórico, estado da tela, configuração) e dos dados em memória.
 */
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { PedidoDeCompra, TurnoRequest } from "@copiloto/shared";
import type { Emissor } from "../events/emitter.js";

export type Contexto = {
  req: TurnoRequest;
  emissor: Emissor;
  /** null no modo simulado. */
  modelo: BaseChatModel | null;
  simulado: boolean;
  pedido: PedidoDeCompra | null;
  /** Para avisar só uma vez por turno quando o RAG cai para palavras-chave. */
  avisouFallbackRag?: boolean;
};

export function ctxDe(config: RunnableConfig | undefined): Contexto {
  const ctx = config?.configurable?.ctx as Contexto | undefined;
  if (!ctx) throw new Error("Contexto do turno ausente em config.configurable.ctx");
  return ctx;
}

/** Erro de chamada ao LLM real (rede, chave, cota, formato). A web oferece o modo simulado. */
export class FalhaLlm extends Error {}
