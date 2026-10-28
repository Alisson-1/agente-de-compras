import { tool } from "@langchain/core/tools";
import { totalCotacao } from "@copiloto/shared";
import { z } from "zod";
import { store } from "../data/store.js";
import { cotacaoElegivel } from "../validator/rules.js";

export function listarCotacoesDados(pedidoId: string) {
  return store.cotacoesDoPedido(pedidoId).map((c) => {
    const fornecedor = store.fornecedores.get(c.fornecedorId);
    return {
      numero: c.numero,
      fornecedorId: c.fornecedorId,
      fornecedor: fornecedor?.nome ?? c.fornecedorId,
      status: c.status,
      validade: c.validade,
      tipos: [...new Set(c.itens.map((i) => i.tipo))],
      itens: c.itens,
      frete: c.frete,
      total: totalCotacao(c),
      prazoEntregaHoras: c.prazoEntregaHoras,
      garantiaMeses: c.garantiaMeses,
      elegivel: cotacaoElegivel(c),
    };
  });
}

export const listarCotacoes = tool(async ({ pedidoId }) => JSON.stringify(listarCotacoesDados(pedidoId)), {
  name: "listarCotacoes",
  description:
    "Lista todas as cotações de um pedido de compra, com fornecedor, status (respondida/pendente/expirada), tipo de peça, total, prazo e garantia. Somente leitura.",
  schema: z.object({ pedidoId: z.string().describe("Número do pedido, ex.: PED-2026-0412") }),
});

export function resumirListarCotacoes(r: ReturnType<typeof listarCotacoesDados>): string {
  const elegiveis = r.filter((c) => c.elegivel).length;
  return `${r.length} cotações, ${elegiveis} elegíveis (respondidas e de fornecedor não vetado)`;
}
