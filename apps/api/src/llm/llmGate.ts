/**
 * ChatGPT via LLM Gate (mesmo contrato de integracaopecaincorreta-api):
 * POST {URL_LLM_GATE}chat/completions
 * headers API_KEY e X-Correlation-Id
 * corpo OpenAI + campo `provider` (padrão "openai", env LLM_GATE_PROVIDER).
 *
 * O fetch reescreve a URL se o cliente OpenAI descartar o prefixo /llm-gate/v2
 * e injeta `provider` no JSON, para ferramentas e saída estruturada seguirem no corpo.
 */
import { randomUUID } from "node:crypto";
import { ChatOpenAI } from "@langchain/openai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

export const URL_LLM_GATE_PADRAO = "https://llm-gate-np.localiza.dev/llm-gate/v2/";

export function urlLlmGate(): string {
  const url = process.env.URL_LLM_GATE?.trim() || URL_LLM_GATE_PADRAO;
  return url.endsWith("/") ? url : `${url}/`;
}

export function chaveLlmGate(): string {
  return process.env.LLM_GATE_API_KEY?.trim() ?? "";
}

export function chatgptConfigurado(): boolean {
  return chaveLlmGate().length > 0;
}

function textoDoCorpo(body: BodyInit): string | undefined {
  if (typeof body === "string") return body;
  if (body instanceof Uint8Array) return new TextDecoder().decode(body);
  return undefined;
}

function injetarProvider(corpo: string, provider: string): string {
  try {
    const json = JSON.parse(corpo) as Record<string, unknown>;
    if (json && typeof json === "object" && !Array.isArray(json) && json.provider == null) {
      json.provider = provider;
      return JSON.stringify(json);
    }
  } catch {
    return corpo;
  }
  return corpo;
}

function reescreverUrl(href: string, base: string): string {
  const destino = new URL(href);
  const baseUrl = new URL(base);
  const prefixo = baseUrl.pathname.replace(/\/$/, "");
  if (prefixo && !destino.pathname.startsWith(`${prefixo}/`) && destino.pathname !== prefixo) {
    destino.pathname = `${prefixo}${destino.pathname.startsWith("/") ? destino.pathname : `/${destino.pathname}`}`;
  }
  return destino.toString();
}

export function fetchLlmGate(base: string, apiKey: string, provider: string): typeof fetch {
  return async (input, init) => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((valor, nome) => headers.set(nome, valor));
    headers.set("API_KEY", apiKey);
    headers.set("X-Correlation-Id", randomUUID());
    headers.delete("authorization");

    let body = init?.body;
    if (body === undefined && input instanceof Request && (init?.method ?? input.method) !== "GET") {
      body = await input.clone().text();
    }
    if (body !== undefined && body !== null) {
      const texto = textoDoCorpo(body);
      if (texto !== undefined) {
        const comProvider = injetarProvider(texto, provider);
        if (comProvider !== texto) {
          body = comProvider;
          headers.delete("content-length");
        }
      }
    }

    return fetch(reescreverUrl(href, base), { ...init, headers, body });
  };
}

export function criarModeloLlmGate(model: string): BaseChatModel {
  const apiKey = chaveLlmGate();
  if (!apiKey) {
    throw new Error("Chave da LLM Gate não configurada (LLM_GATE_API_KEY).");
  }
  const base = urlLlmGate();
  const provider = process.env.LLM_GATE_PROVIDER?.trim() || "openai";
  return new ChatOpenAI({
    model,
    apiKey,
    maxRetries: 1,
    useResponsesApi: false,
    modelKwargs: { provider },
    configuration: {
      baseURL: base,
      fetch: fetchLlmGate(base, apiKey, provider),
    },
  });
}
