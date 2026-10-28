import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { store } from "../data/store.js";
import { latenciaDeSistema } from "./latencia.js";

export async function consultarEstoqueInternoDados(codigoPeca: string) {
  await latenciaDeSistema(`estoque-${codigoPeca}`, 200, 450);
  const item = store.estoque.find((e) => e.codigoPeca === codigoPeca);
  return {
    codigoPeca,
    disponivel: !!item && item.quantidade > 0,
    quantidade: item?.quantidade ?? 0,
    local: item?.local ?? null,
    custoUnitario: item?.custoUnitario ?? null,
  };
}

export const consultarEstoqueInterno = tool(
  async ({ codigoPeca }) => JSON.stringify(await consultarEstoqueInternoDados(codigoPeca)),
  {
    name: "consultarEstoqueInterno",
    description: "Consulta o estoque interno da locadora para um código de peça: quantidade disponível e local. Somente leitura.",
    schema: z.object({ codigoPeca: z.string().describe("Código da peça, ex.: FO-1120") }),
  },
);

export function resumirEstoque(r: Awaited<ReturnType<typeof consultarEstoqueInternoDados>>): string {
  return r.disponivel ? `${r.codigoPeca}: ${r.quantidade} un. em ${r.local}` : `${r.codigoPeca}: sem estoque interno`;
}
