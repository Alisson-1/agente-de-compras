/**
 * Arestas condicionais do grafo: para onde ir depois de cada nó de decisão.
 */
import type { RunnableConfig } from "@langchain/core/runnables";
import type { Intent } from "@copiloto/shared";
import { ctxDe } from "./contexto.js";
import type { Estado } from "./state.js";

export const MAX_TENTATIVAS_VALIDACAO = 2;
export const MAX_RODADAS_CRITICO = 2;

const NO_DA_INTENCAO = {
  conceitual: "conceitual",
  analisarPedido: "analisarPedido",
  recomendar: "planner",
  explicar: "explicar",
  proporAcao: "proporAcao",
  avaliarSelecao: "avaliarSelecao",
  avisarCotacao: "avisarCotacao",
  priorizarPedidos: "priorizar",
  foraDoEscopo: "foraDoEscopo",
} as const satisfies Record<Intent, string>;

const PRECISA_DE_PEDIDO: Intent[] = ["analisarPedido", "recomendar", "explicar", "proporAcao", "avaliarSelecao", "avisarCotacao"];

export function depoisDoRouter(estado: Estado, config: RunnableConfig) {
  const intent = estado.intent ?? "foraDoEscopo";
  if (PRECISA_DE_PEDIDO.includes(intent) && !ctxDe(config).pedido) return "semPedido" as const;
  return NO_DA_INTENCAO[intent];
}

export function depoisDoPlanner(estado: Estado) {
  return estado.replanejado ? ("proporAcao" as const) : ("enriquecer" as const);
}

export function depoisDoComprador(estado: Estado) {
  return estado.escalonamento ? ("finalize" as const) : ("validate" as const);
}

export function depoisDoValidate(estado: Estado) {
  if (estado.validacao?.ok) return "critic" as const;
  // Recomendação reprovada vai ao crítico, que explica a regra com o manual e devolve ao comprador.
  if (estado.rascunho?.tipo === "recomendacao") return "critic" as const;
  if ((estado.tentativasValidacao ?? 0) < MAX_TENTATIVAS_VALIDACAO) {
    return (estado.origem || "finalize") as "proporAcao" | "analisarPedido" | "explicar" | "avaliarSelecao" | "priorizar" | "finalize";
  }
  return "bloquear" as const;
}

export function depoisDoCritico(estado: Estado) {
  if (estado.aprovadoPeloCritico) return "finalize" as const;
  const rodada = estado.rodadaCritica ?? 0;
  if (rodada < MAX_RODADAS_CRITICO && estado.rascunho?.tipo === "recomendacao") return "comprador" as const;
  if (rodada < MAX_RODADAS_CRITICO && estado.rascunho?.tipo === "proposta") return "proporAcao" as const;
  return "finalize" as const;
}
