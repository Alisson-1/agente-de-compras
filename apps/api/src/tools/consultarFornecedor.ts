import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { store } from "../data/store.js";
import { latenciaDeSistema } from "./latencia.js";

export async function consultarFornecedorDados(fornecedorId: string) {
  await latenciaDeSistema(`forn-${fornecedorId}`);
  const f = store.fornecedores.get(fornecedorId);
  if (!f) return { encontrado: false as const, fornecedorId };
  return {
    encontrado: true as const,
    ...f,
    vetado: f.notaQualidade < store.politica.notaMinimaFornecedor,
    preferencial: f.notaQualidade >= 4,
  };
}

export const consultarFornecedor = tool(async ({ fornecedorId }) => JSON.stringify(await consultarFornecedorDados(fornecedorId)), {
  name: "consultarFornecedor",
  description:
    "Consulta o cadastro de um fornecedor: nota de qualidade (0-5), % de entregas no prazo, taxa de devolução e se está vetado. Somente leitura.",
  schema: z.object({ fornecedorId: z.string().describe("Id do fornecedor, ex.: FOR-03") }),
});

export function resumirConsultarFornecedor(r: Awaited<ReturnType<typeof consultarFornecedorDados>>): string {
  if (!r.encontrado) return `fornecedor ${r.fornecedorId} não encontrado`;
  return `${r.nome}: nota ${r.notaQualidade.toFixed(1)}, ${r.entregasNoPrazoPct}% no prazo${r.vetado ? ", VETADO" : ""}`;
}
