/**
 * Carrega apps/api/.env sem sobrescrever variáveis já definidas no processo.
 * O Node não lê .env sozinho; a chave do LLM Gate fica só aqui, nunca no navegador.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CANDIDATOS = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "apps/api/.env"),
  fileURLToPath(new URL("../../.env", import.meta.url)),
];

export function carregarEnvLocal(): void {
  const arquivo = CANDIDATOS.find((c) => existsSync(c));
  if (!arquivo) return;
  for (const linha of readFileSync(arquivo, "utf8").split(/\r?\n/)) {
    const texto = linha.trim();
    if (!texto || texto.startsWith("#")) continue;
    const igual = texto.indexOf("=");
    if (igual < 1) continue;
    const chave = texto.slice(0, igual).trim();
    let valor = texto.slice(igual + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (process.env[chave] === undefined) process.env[chave] = valor;
  }
}
