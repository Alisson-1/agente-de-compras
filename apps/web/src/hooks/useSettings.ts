/**
 * Configurações do Copiloto, guardadas só no localStorage do navegador.
 * A chave BYOK (Anthropic, OpenAI, Gemini) nunca é gravada na API: vai no header de cada turno.
 * ChatGPT usa a chave do LLM Gate, só no ambiente da API.
 */
import { useEffect, useState } from "react";
import type { Provedor } from "@copiloto/shared";

export type Configuracoes = {
  provedor: Provedor;
  modelo: string;
  chave: string;
  simulado: boolean;
  proativo: boolean;
  velocidadeMs: number;
};

export const MODELOS_SUGERIDOS: Record<Provedor, string[]> = {
  anthropic: ["claude-sonnet-5", "claude-opus-5-5", "claude-haiku-4-5-20251001"],
  openai: ["gpt-5-mini", "gpt-5"],
  gemini: ["gemini-2.5-flash", "gemini-2.5-pro"],
  chatgpt: ["gpt-4o", "gpt-4o-mini"],
};

const PADRAO: Configuracoes = {
  provedor: "anthropic",
  modelo: MODELOS_SUGERIDOS.anthropic[0],
  chave: "",
  simulado: true,
  proativo: true,
  velocidadeMs: 400,
};

const CHAVE_STORAGE = "copiloto-compras:config";

function ler(): Configuracoes {
  try {
    const salvo = localStorage.getItem(CHAVE_STORAGE);
    return salvo ? { ...PADRAO, ...(JSON.parse(salvo) as Partial<Configuracoes>) } : PADRAO;
  } catch {
    return PADRAO;
  }
}

export function useSettings() {
  const [config, setConfig] = useState<Configuracoes>(ler);
  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_STORAGE, JSON.stringify(config));
    } catch {
      // sem localStorage (aba privada): segue só em memória
    }
  }, [config]);
  const atualizar = (parcial: Partial<Configuracoes>) => setConfig((c) => ({ ...c, ...parcial }));
  return { config, atualizar };
}
