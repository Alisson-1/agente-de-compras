import { z } from "zod";
import type { ChunkRag } from "@copiloto/shared";
import type { Contexto } from "../../graph/contexto.js";
import * as simulado from "../../llm/simulated.js";
import { executarAgente } from "../../llm/withStructuredRetry.js";
import { carregarPrompt } from "../carregarPrompt.js";

const PROMPT = carregarPrompt("conceitual");

export const SaidaConceitual = z.object({
  resposta: z.string(),
  citacoes: z.array(z.string()),
});

export function agenteConceitual(ctx: Contexto, pergunta: string, chunks: ChunkRag[]) {
  return executarAgente(ctx, {
    node: "conceitual",
    nome: "responder_com_manual",
    schema: SaidaConceitual,
    system: PROMPT,
    user: [`Pergunta: """${pergunta}"""`, "", "Trechos do Manual de Compras:", ...chunks.map((c) => `§${c.section}: ${c.text}`)].join("\n"),
    simular: () => simulado.conceitual(pergunta, chunks),
  });
}
