import { z } from "zod";
import type { Contexto } from "../../graph/contexto.js";
import * as simulado from "../../llm/simulated.js";
import { executarAgente } from "../../llm/withStructuredRetry.js";
import { carregarPrompt } from "../carregarPrompt.js";

const PROMPT = carregarPrompt("critic");

export const SaidaCritico = z.object({
  aprovado: z.boolean(),
  feedback: z.string(),
  citacoes: z.array(z.string()),
});

export function agenteCritico(ctx: Contexto, entrada: Parameters<typeof simulado.critico>[0] & { dados: unknown }) {
  return executarAgente(ctx, {
    node: "critic",
    nome: "revisar_resposta",
    schema: SaidaCritico,
    system: PROMPT,
    user: [
      `Rascunho (${entrada.rascunho.tipo}):`,
      entrada.rascunho.texto,
      "",
      `Validador em código: ${entrada.validacao ? (entrada.validacao.ok ? "aprovado" : `REPROVADO: ${entrada.validacao.erros.join(" ")}`) : "não se aplica"}`,
      "",
      "Trechos do Manual de Compras:",
      ...entrada.chunks.map((c) => `§${c.section}: ${c.text}`),
      "",
      "Dados de apoio:",
      JSON.stringify(entrada.dados, null, 2),
    ].join("\n"),
    simular: () => simulado.critico(entrada),
  });
}
