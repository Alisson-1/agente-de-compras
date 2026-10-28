/**
 * Caminhos de arquivos da API. Funciona tanto rodando de src/ (tsx) quanto do
 * bundle em dist/: sobe a árvore até achar o package.json da API.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function acharRaizDaApi(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(dir, "package.json"))) {
    const pai = dirname(dir);
    if (pai === dir) throw new Error("Não achei a raiz da API (package.json).");
    dir = pai;
  }
  return dir;
}

export const API_ROOT = acharRaizDaApi();

/** Caminho absoluto a partir da raiz da API (ex.: caminho("src", "data", "pedidos.json")). */
export function caminho(...partes: string[]): string {
  return join(API_ROOT, ...partes);
}
