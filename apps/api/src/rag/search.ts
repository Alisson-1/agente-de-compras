/**
 * searchManual(consulta, k): busca no Manual de Compras. NUNCA lança erro.
 *
 * - Caminho principal: similaridade de cosseno entre o embedding da consulta
 *   (modelo local) e os embeddings do index.json, combinada com um pouco de
 *   sobreposição de palavras (busca híbrida, mais estável em português).
 * - Fallback: se o índice faltar, o modelo não carregar ou qualquer coisa falhar,
 *   cai para busca por palavras-chave sobre os mesmos chunks e devolve um aviso.
 *
 * O índice e o modelo são carregados uma vez e cacheados.
 */
import { existsSync, readFileSync } from "node:fs";
import type { ChunkRag } from "@copiloto/shared";
import { caminho } from "../paths.js";
import { lerChunksDoManual, MODELO_EMBEDDINGS, type ChunkManual } from "./chunks.js";

type Extrator = (texto: string, opcoes: { pooling: "mean"; normalize: boolean }) => Promise<{ data: ArrayLike<number> }>;

export type ResultadoBusca = {
  chunks: ChunkRag[];
  modo: "embeddings" | "palavras-chave";
  aviso?: string;
};

const TEMPO_MAXIMO_MODELO_MS = 20_000;

let chunksCache: ChunkManual[] | null = null;
let indiceTemEmbeddings = false;
let extratorPromise: Promise<Extrator | null> | null = null;
let motivoSemModelo = "";

function carregarChunks(): ChunkManual[] {
  if (chunksCache) return chunksCache;
  const arquivo = caminho("src", "rag", "index.json");
  try {
    if (existsSync(arquivo)) {
      const indice = JSON.parse(readFileSync(arquivo, "utf8")) as { chunks: ChunkManual[] };
      chunksCache = indice.chunks;
      indiceTemEmbeddings = indice.chunks.every((c) => Array.isArray(c.embedding) && c.embedding.length > 0);
      return chunksCache;
    }
  } catch {
    // índice corrompido: cai para os chunks lidos direto do Markdown
  }
  chunksCache = lerChunksDoManual();
  indiceTemEmbeddings = false;
  return chunksCache;
}

/** Carrega o modelo de embeddings uma vez (com tempo máximo). Devolve null se falhar. */
export function obterExtrator(tempoMaximoMs = TEMPO_MAXIMO_MODELO_MS): Promise<Extrator | null> {
  if (extratorPromise) return extratorPromise;
  extratorPromise = (async () => {
    try {
      const { pipeline, env } = await import("@huggingface/transformers");
      env.cacheDir = caminho(".cache", "transformers");
      const carregar = pipeline("feature-extraction", MODELO_EMBEDDINGS, { dtype: "q8" }) as unknown as Promise<Extrator>;
      const tempo = new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("tempo esgotado ao carregar o modelo")), tempoMaximoMs),
      );
      return await Promise.race([carregar, tempo]);
    } catch (e) {
      motivoSemModelo = (e as Error).message;
      return null;
    }
  })();
  return extratorPromise;
}

/* ---------- busca por palavras-chave ---------- */

const STOPWORDS = new Set(
  "a o as os de da do das dos e em no na nos nas um uma uns umas para por com sem que qual quais como sobre ao aos se ser sao é é ou mais menos pode posso diz dizer manual".split(" "),
);

export function normalizar(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function tokens(texto: string): string[] {
  return normalizar(texto)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
    .map((t) => (t.length > 5 ? t.slice(0, 6) : t)); // radical simples: "paralela" ~ "parale"
}

function pontuarPalavras(consulta: string, chunk: ChunkManual): number {
  const q = new Set(tokens(consulta));
  if (q.size === 0) return 0;
  const titulo = tokens(chunk.title);
  const corpo = tokens(chunk.text);
  let s = 0;
  for (const t of q) {
    if (titulo.includes(t)) s += 2;
    s += Math.min(3, corpo.filter((c) => c === t).length);
  }
  return s / (q.size * 5);
}

function paraChunkRag(c: ChunkManual, score: number): ChunkRag {
  return { source: c.source, section: c.section, text: `${c.title}. ${c.text}`, score: Math.round(score * 1000) / 1000 };
}

function buscaPorPalavras(consulta: string, k: number, aviso: string): ResultadoBusca {
  const chunks = carregarChunks()
    .map((c) => ({ c, s: pontuarPalavras(consulta, c) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map(({ c, s }) => paraChunkRag(c, Math.min(1, s)));
  return { chunks, modo: "palavras-chave", aviso };
}

/* ---------- API pública ---------- */

export async function searchManual(consulta: string, k = 3): Promise<ResultadoBusca> {
  try {
    const chunks = carregarChunks();
    if (!indiceTemEmbeddings) {
      return buscaPorPalavras(consulta, k, "Índice do RAG sem embeddings: usando busca por palavras-chave. Rode `pnpm ingest`.");
    }
    const extrator = await obterExtrator();
    if (!extrator) {
      return buscaPorPalavras(consulta, k, `Modelo de embeddings indisponível (${motivoSemModelo}): usando busca por palavras-chave.`);
    }
    const tensor = await extrator(consulta, { pooling: "mean", normalize: true });
    const q = Array.from(tensor.data);
    const pontuados = chunks.map((c) => {
      const cos = c.embedding!.reduce((s, v, i) => s + v * q[i], 0);
      return { c, s: 0.75 * cos + 0.25 * Math.min(1, pontuarPalavras(consulta, c)) };
    });
    pontuados.sort((a, b) => b.s - a.s);
    return { chunks: pontuados.slice(0, k).map(({ c, s }) => paraChunkRag(c, s)), modo: "embeddings" };
  } catch (e) {
    return buscaPorPalavras(consulta, k, `Falha na busca vetorial (${(e as Error).message}): usando palavras-chave.`);
  }
}

/** Todas as seções do manual (para o popover de citação na web). */
export function secoesDoManual(): { source: string; section: string; title: string; text: string }[] {
  return carregarChunks().map(({ source, section, title, text }) => ({ source, section, title, text }));
}

/** Aquece índice e modelo no boot, sem bloquear. */
export function aquecerRag(): void {
  carregarChunks();
  void searchManual("aquecimento do índice", 1);
}
