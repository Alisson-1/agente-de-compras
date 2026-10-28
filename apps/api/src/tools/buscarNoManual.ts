import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { searchManual } from "../rag/search.js";

export const buscarNoManual = tool(
  async ({ consulta }) => {
    const r = await searchManual(consulta, 3);
    return JSON.stringify(r.chunks.map((c) => ({ secao: `§${c.section}`, texto: c.text })));
  },
  {
    name: "buscarNoManual",
    description: "Busca trechos do Manual de Compras relevantes para uma pergunta. Cite as seções (ex.: §2.2) na resposta. Somente leitura.",
    schema: z.object({ consulta: z.string().describe("O que procurar no manual") }),
  },
);
