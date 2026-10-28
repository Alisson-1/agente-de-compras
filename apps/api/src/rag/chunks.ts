/**
 * Divide o Manual de Compras em chunks por seção numerada ("## 2.2 Título").
 * Usado pela ingestão e pelo fallback de busca quando o índice falta.
 */
import { readdirSync, readFileSync } from "node:fs";
import { caminho } from "../paths.js";

export type ChunkManual = {
  id: string;
  /** Arquivo de origem, ex.: "02-itens-de-seguranca-e-tipos-de-peca.md". */
  source: string;
  /** Número da seção, ex.: "2.2". */
  section: string;
  title: string;
  text: string;
  embedding?: number[];
};

export const PASTA_MANUAL = caminho("docs", "manual-de-compras");
export const MODELO_EMBEDDINGS = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";

export function lerChunksDoManual(): ChunkManual[] {
  const arquivos = readdirSync(PASTA_MANUAL).filter((f) => f.endsWith(".md")).sort();
  const chunks: ChunkManual[] = [];
  for (const arquivo of arquivos) {
    const md = readFileSync(`${PASTA_MANUAL}/${arquivo}`, "utf8").replace(/\r\n/g, "\n");
    const partes = md.split(/^## /m).slice(1);
    for (const parte of partes) {
      const [cabecalho, ...corpo] = parte.split("\n");
      const m = cabecalho.match(/^(\d+\.\d+)\s+(.*)$/);
      if (!m) continue;
      chunks.push({
        id: `${arquivo}#${m[1]}`,
        source: arquivo,
        section: m[1],
        title: m[2].trim(),
        text: corpo.join("\n").trim(),
      });
    }
  }
  return chunks;
}
