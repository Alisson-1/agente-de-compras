/**
 * PADRÃO 9 — Knowledge Retrieval (RAG)
 *
 * O que é: antes de responder, o agente busca trechos relevantes numa base de
 * conhecimento e responde com base neles, citando a fonte.
 *
 * Que problema resolve: o LLM não conhece o Manual de Compras da empresa e, sem
 * grounding, inventaria regras plausíveis. Com RAG, a regra vem do documento.
 *
 * Onde aparece: no router (perguntas conceituais), nos 3 especialistas, no
 * planner, no crítico, no `explicar` e no alerta de seleção. Na tela, cada busca
 * mostra os trechos e scores; as citações "§2.2" são clicáveis e abrem o trecho.
 *
 * Busca: embeddings locais + palavras-chave, com fallback que nunca quebra (rag/search.ts).
 */
import type { ChunkRag } from "@copiloto/shared";
import { comPadrao } from "../events/emitter.js";
import type { Contexto } from "../graph/contexto.js";
import { searchManual } from "../rag/search.js";

export async function recuperar(ctx: Contexto, consulta: string, node: string, k = 3): Promise<ChunkRag[]> {
  return comPadrao(
    ctx.emissor,
    "rag",
    node,
    `Busco no Manual de Compras: "${consulta}". Respondo com o documento, não de memória.`,
    async () => {
      const r = await searchManual(consulta, k);
      await ctx.emissor.emit({ type: "rag_retrieval", query: consulta, chunks: r.chunks });
      if (r.aviso && !ctx.avisouFallbackRag) {
        ctx.avisouFallbackRag = true;
        await ctx.emissor.emit({ type: "warning", message: r.aviso });
      }
      return r.chunks;
    },
    (chunks) => `${chunks.length} trechos: ${chunks.map((c) => `§${c.section}`).join(", ")}`,
  );
}

/** Mantém só citações de seções que foram de fato recuperadas (o LLM não inventa fonte). */
export function filtrarCitacoes(citacoes: string[], chunks: ChunkRag[]): string[] {
  const validas = new Set(chunks.map((c) => `§${c.section}`));
  return [...new Set(citacoes.map((c) => (c.startsWith("§") ? c : `§${c}`)).filter((c) => validas.has(c)))];
}
