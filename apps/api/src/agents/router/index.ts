import { z } from "zod";
import type { EstadoTela } from "@copiloto/shared";
import type { Contexto } from "../../graph/contexto.js";
import * as simulado from "../../llm/simulated.js";
import { executarAgente } from "../../llm/withStructuredRetry.js";
import { carregarPrompt } from "../carregarPrompt.js";

const PROMPT = carregarPrompt("router");

export const SaidaRouter = z.object({
  intent: z.enum(["conceitual", "analisarPedido", "recomendar", "explicar", "proporAcao", "priorizarPedidos", "foraDoEscopo"]),
  reason: z.string().describe("Frase curta explicando a classificação"),
});

export function agenteRouter(ctx: Contexto, mensagem: string, tela: EstadoTela) {
  return executarAgente(ctx, {
    node: "router",
    nome: "classificar_intencao",
    schema: SaidaRouter,
    system: PROMPT,
    user: `Estado da tela: pedido aberto = ${tela.pedidoId ?? "nenhum"}; cotação selecionada = ${tela.cotacaoSelecionadaId ?? "nenhuma"}; já existe recomendação = ${tela.ultimaRecomendacao ? "sim" : "não"}.\n\nMensagem do comprador: """${mensagem}"""`,
    simular: () => simulado.router(mensagem),
  });
}
