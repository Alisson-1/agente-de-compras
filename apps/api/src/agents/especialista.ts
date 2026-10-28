/**
 * Execução comum aos 3 especialistas (custos, logística, qualidade).
 * Cada um tem seu prompt.md; todos devolvem o mesmo formato (ParecerEspecialista).
 */
import type { ChunkRag, PedidoDeCompra } from "@copiloto/shared";
import { ParecerEspecialista } from "@copiloto/shared";
import type { Contexto } from "../graph/contexto.js";
import type { CotacaoEnriquecida, Especialista } from "../graph/state.js";
import * as simulado from "../llm/simulated.js";
import { executarAgente } from "../llm/withStructuredRetry.js";

export function rodarEspecialista(
  ctx: Contexto,
  tipo: Especialista,
  prompt: string,
  pedido: PedidoDeCompra,
  candidatas: CotacaoEnriquecida[],
  chunks: ChunkRag[],
) {
  return executarAgente(ctx, {
    node: tipo,
    nome: `parecer_${tipo}`,
    schema: ParecerEspecialista,
    system: prompt,
    user: [
      `Pedido ${pedido.numero}: urgência ${pedido.urgencia}, carro ${pedido.os.veiculo.status}, ${pedido.os.diasParado} dia(s) parado.`,
      `Itens pedidos: ${pedido.itens.map((i) => `${i.quantidade}× ${i.descricao}${i.itemDeSeguranca ? " (item de segurança)" : ""}`).join("; ")}.`,
      "",
      "Trechos do Manual de Compras:",
      ...chunks.map((c) => `§${c.section}: ${c.text}`),
      "",
      "Cotações (dados das ferramentas):",
      JSON.stringify(candidatas, null, 2),
    ].join("\n"),
    simular: () => simulado.especialista(tipo, candidatas, pedido),
  });
}
