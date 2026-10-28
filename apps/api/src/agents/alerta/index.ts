import type { Contexto } from "../../graph/contexto.js";
import * as simulado from "../../llm/simulated.js";
import { executarAgente } from "../../llm/withStructuredRetry.js";
import { SaidaTextoCitado } from "../explicar/index.js";
import { carregarPrompt } from "../carregarPrompt.js";

const PROMPT = carregarPrompt("alerta");

export function agenteAlerta(ctx: Contexto, entrada: Parameters<typeof simulado.alerta>[0]) {
  return executarAgente(ctx, {
    node: "alerta",
    nome: "alertar_selecao",
    schema: SaidaTextoCitado,
    system: PROMPT,
    user: [
      `Cotação selecionada: ${entrada.cotacaoId}`,
      `Violações do validador: ${entrada.validacao.erros.join(" ")}`,
      "",
      "Trechos do Manual de Compras:",
      ...entrada.chunks.map((c) => `§${c.section}: ${c.text}`),
    ].join("\n"),
    simular: () => simulado.alerta(entrada),
  });
}
