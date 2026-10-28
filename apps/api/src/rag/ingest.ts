/**
 * `pnpm ingest`: lê o Manual de Compras, divide por seção, gera embeddings
 * LOCAIS (@huggingface/transformers, modelo multilíngue) e grava rag/index.json.
 *
 * Embeddings locais por design: com BYOK não há garantia de que o provedor
 * escolhido tenha API de embeddings. O index.json vai commitado no repositório.
 */
import { writeFileSync } from "node:fs";
import { caminho } from "../paths.js";
import { lerChunksDoManual, MODELO_EMBEDDINGS } from "./chunks.js";
import { obterExtrator } from "./search.js";

async function main() {
  const chunks = lerChunksDoManual();
  console.log(`Manual: ${chunks.length} seções. Carregando o modelo ${MODELO_EMBEDDINGS}...`);
  const extrator = await obterExtrator(10 * 60_000);
  if (!extrator) throw new Error("Não consegui carregar o modelo de embeddings (precisa de internet na primeira vez).");

  for (const chunk of chunks) {
    const tensor = await extrator(`${chunk.title}. ${chunk.text}`, { pooling: "mean", normalize: true });
    chunk.embedding = Array.from(tensor.data as Float32Array).map((v) => Math.round(v * 1e5) / 1e5);
    console.log(`  §${chunk.section} ${chunk.title}`);
  }

  const indice = { modelo: MODELO_EMBEDDINGS, geradoEm: new Date().toISOString(), chunks };
  const destino = caminho("src", "rag", "index.json");
  writeFileSync(destino, JSON.stringify(indice));
  console.log(`Índice gravado em ${destino}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
