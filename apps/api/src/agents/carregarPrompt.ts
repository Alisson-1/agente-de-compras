/**
 * Carrega o prompt.md de um agente UMA vez, no boot da API.
 * Alterar um .md exige reiniciar a API.
 */
import { readFileSync } from "node:fs";
import { caminho } from "../paths.js";

export function carregarPrompt(agente: string, arquivo = "prompt.md"): string {
  return readFileSync(caminho("src", "agents", agente, arquivo), "utf8");
}

/** Pega uma seção "## Título" de um prompt.md com várias partes. */
export function secaoDoPrompt(md: string, titulo: string): string {
  const partes = md.split(/^## /m);
  const achada = partes.find((p) => p.startsWith(titulo));
  if (!achada) throw new Error(`Seção "${titulo}" não encontrada no prompt.`);
  return achada.slice(titulo.length).trim();
}
