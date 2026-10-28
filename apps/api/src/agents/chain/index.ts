import { z } from "zod";
import type { PedidoDeCompra } from "@copiloto/shared";
import type { Contexto } from "../../graph/contexto.js";
import * as simulado from "../../llm/simulated.js";
import { executarAgente } from "../../llm/withStructuredRetry.js";
import { carregarPrompt, secaoDoPrompt } from "../carregarPrompt.js";

const PROMPT = carregarPrompt("chain");
const PROMPT_EXTRAIR = secaoDoPrompt(PROMPT, "Elo 1: extrair");
const PROMPT_RESUMIR = secaoDoPrompt(PROMPT, "Elo 3: resumir");

export const SaidaExtracao = z.object({
  itens: z.array(
    z.object({
      descricao: z.string(),
      quantidade: z.number(),
      condicional: z.boolean().describe("true se a peça só foi citada para inspeção (ver/verificar)"),
      trechoOrigem: z.string(),
    }),
  ),
  abreviacoesExpandidas: z.array(z.string()),
});
export type SaidaExtracao = z.infer<typeof SaidaExtracao>;

export const SaidaResumo = z.object({ resumo: z.string() });

export function agenteExtrair(ctx: Contexto, pedido: PedidoDeCompra) {
  return executarAgente(ctx, {
    node: "chain:extrair",
    nome: "extrair_itens",
    schema: SaidaExtracao,
    system: PROMPT_EXTRAIR,
    user: `Itens do pedido ${pedido.numero}:\n${pedido.itens
      .map((i) => `- ${i.quantidade}× ${i.descricao} (código ${i.codigoPeca ?? "sem código"})`)
      .join("\n")}\n\nDiagnóstico da oficina: """${pedido.os.diagnostico}"""`,
    simular: () => simulado.chainExtrair(pedido),
  });
}

export function agenteResumir(ctx: Contexto, entrada: Parameters<typeof simulado.chainResumir>[0]) {
  return executarAgente(ctx, {
    node: "chain:resumir",
    nome: "resumir_pedido",
    schema: SaidaResumo,
    system: PROMPT_RESUMIR,
    user: JSON.stringify(
      {
        pedido: entrada.pedido.numero,
        os: entrada.pedido.os.numero,
        veiculo: entrada.pedido.os.veiculo,
        localizacao: entrada.pedido.os.localizacao,
        oficina: entrada.oficina,
        diasParado: entrada.pedido.os.diasParado,
        urgencia: entrada.pedido.urgencia,
        itens: entrada.pedido.itens,
        cotacoes: entrada.cotacoes,
        divergencias: entrada.divergencias,
      },
      null,
      2,
    ),
    simular: () => simulado.chainResumir(entrada),
  });
}
