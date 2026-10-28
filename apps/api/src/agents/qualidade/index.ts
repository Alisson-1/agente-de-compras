import type { ChunkRag, PedidoDeCompra } from "@copiloto/shared";
import type { Contexto } from "../../graph/contexto.js";
import type { CotacaoEnriquecida } from "../../graph/state.js";
import { carregarPrompt } from "../carregarPrompt.js";
import { rodarEspecialista } from "../especialista.js";

const PROMPT = carregarPrompt("qualidade");

export const CONSULTA_MANUAL_QUALIDADE = "item de segurança peça paralela homologada garantia nota do fornecedor";

export function agenteQualidade(ctx: Contexto, pedido: PedidoDeCompra, candidatas: CotacaoEnriquecida[], chunks: ChunkRag[]) {
  return rodarEspecialista(ctx, "qualidade", PROMPT, pedido, candidatas, chunks);
}
