import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { store } from "../data/store.js";

export function consultarPoliticaDados() {
  return { ...store.politica };
}

export const consultarPolitica = tool(async () => JSON.stringify(consultarPoliticaDados()), {
  name: "consultarPolitica",
  description:
    "Devolve a Política de Compras em vigor (alçada, regras de item de segurança, prazo de urgência, nota mínima de fornecedor, mínimo de cotações, custo de carro parado). Somente leitura.",
  schema: z.object({}),
});

export function resumirPolitica(r: ReturnType<typeof consultarPoliticaDados>): string {
  return `alçada R$ ${r.limiteAlcadaComprador.toLocaleString("pt-BR")}, urgente ≤ ${r.prazoMaximoUrgenteHoras}h, nota mínima ${r.notaMinimaFornecedor}`;
}
