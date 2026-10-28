import type { ChunkRag, PedidoDeCompra } from "@copiloto/shared";
import type { Contexto } from "../../graph/contexto.js";
import type { CotacaoEnriquecida } from "../../graph/state.js";
import { carregarPrompt } from "../carregarPrompt.js";
import { rodarEspecialista } from "../especialista.js";

const PROMPT = carregarPrompt("logistica");

export const CONSULTA_MANUAL_LOGISTICA = "prazo de entrega em pedido urgente com carro parado e entregas no prazo";

export function agenteLogistica(ctx: Contexto, pedido: PedidoDeCompra, candidatas: CotacaoEnriquecida[], chunks: ChunkRag[]) {
  return rodarEspecialista(ctx, "logistica", PROMPT, pedido, candidatas, chunks);
}
