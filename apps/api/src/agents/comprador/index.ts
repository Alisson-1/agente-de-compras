import { z } from "zod";
import type { ParecerEspecialista } from "@copiloto/shared";
import type { Contexto } from "../../graph/contexto.js";
import * as simulado from "../../llm/simulated.js";
import { executarAgente } from "../../llm/withStructuredRetry.js";
import { carregarPrompt } from "../carregarPrompt.js";

const PROMPT = carregarPrompt("comprador");

export const SaidaComprador = z.object({
  cotacaoId: z.string(),
  justificativa: z.string(),
});

export function agenteComprador(
  ctx: Contexto,
  entrada: Parameters<typeof simulado.comprador>[0] & { pareceres: Record<string, ParecerEspecialista | undefined> },
) {
  return executarAgente(ctx, {
    node: "comprador",
    nome: "decidir_cotacao",
    schema: SaidaComprador,
    system: PROMPT,
    user: JSON.stringify(
      {
        pedido: entrada.pedido.numero,
        urgencia: entrada.pedido.urgencia,
        pesos: entrada.pesosTexto,
        ranking: entrada.ranking.map((r) => ({
          cotacaoId: r.cotacaoId,
          notaConsolidada: r.nota,
          fornecedor: r.c.fornecedor,
          total: r.c.total,
          prazoHoras: r.c.prazoHoras,
          garantiaMeses: r.c.garantiaMeses,
          tipos: r.c.tipos,
        })),
        pareceres: entrada.pareceres,
        feedbackDoCritico: entrada.feedback,
        cotacoesReprovadas: entrada.reprovadas,
      },
      null,
      2,
    ),
    simular: () => simulado.comprador(entrada),
  });
}
