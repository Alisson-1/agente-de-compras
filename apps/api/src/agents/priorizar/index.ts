import type { ChunkRag } from "@copiloto/shared";
import type { Contexto } from "../../graph/contexto.js";
import * as simulado from "../../llm/simulated.js";
import { executarAgente } from "../../llm/withStructuredRetry.js";
import type { ResumoPedido } from "../../tools/listarPedidos.js";
import { SaidaTextoCitado } from "../explicar/index.js";
import { carregarPrompt } from "../carregarPrompt.js";

const PROMPT = carregarPrompt("priorizar");

export function agentePriorizar(ctx: Contexto, pergunta: string, fila: ResumoPedido[], chunks: ChunkRag[]) {
  return executarAgente(ctx, {
    node: "priorizar",
    nome: "priorizar_pedidos",
    schema: SaidaTextoCitado,
    system: PROMPT,
    user: [
      `Pergunta: """${pergunta}"""`,
      "",
      "Pedidos, na ordem de prioridade calculada pela política:",
      JSON.stringify(fila, null, 2),
      "",
      "Trechos do Manual de Compras:",
      ...chunks.map((c) => `§${c.section}: ${c.text}`),
    ].join("\n"),
    simular: () => simulado.priorizar(fila, chunks),
  });
}
