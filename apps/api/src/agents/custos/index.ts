import type { ChunkRag, PedidoDeCompra } from "@copiloto/shared";
import type { Contexto } from "../../graph/contexto.js";
import type { CotacaoEnriquecida } from "../../graph/state.js";
import { carregarPrompt } from "../carregarPrompt.js";
import { rodarEspecialista } from "../especialista.js";

const PROMPT = carregarPrompt("custos");

export const CONSULTA_MANUAL_CUSTOS = "custo de veículo parado por dia, estoque interno e preço";

export function agenteCustos(ctx: Contexto, pedido: PedidoDeCompra, candidatas: CotacaoEnriquecida[], chunks: ChunkRag[]) {
  return rodarEspecialista(ctx, "custos", PROMPT, pedido, candidatas, chunks);
}
