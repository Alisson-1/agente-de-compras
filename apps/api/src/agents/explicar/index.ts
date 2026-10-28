import { z } from "zod";
import type { Contexto } from "../../graph/contexto.js";
import * as simulado from "../../llm/simulated.js";
import { executarAgente } from "../../llm/withStructuredRetry.js";
import { carregarPrompt } from "../carregarPrompt.js";

const PROMPT = carregarPrompt("explicar");

export const SaidaTextoCitado = z.object({
  texto: z.string(),
  citacoes: z.array(z.string()).describe('Seções do manual citadas, ex.: ["§2.2"]'),
});

export function agenteExplicar(ctx: Contexto, pergunta: string, entrada: Parameters<typeof simulado.explicar>[0]) {
  return executarAgente(ctx, {
    node: "explicar",
    nome: "explicar_decisao",
    schema: SaidaTextoCitado,
    system: PROMPT,
    user: [
      `Pergunta: """${pergunta}"""`,
      "",
      `Mais barata: ${JSON.stringify(entrada.maisBarata)}`,
      `Última recomendação: ${JSON.stringify(entrada.recomendacao)}`,
      "",
      "Trechos do Manual de Compras:",
      ...entrada.chunks.map((c) => `§${c.section}: ${c.text}`),
    ].join("\n"),
    simular: () => simulado.explicar(entrada),
  });
}
