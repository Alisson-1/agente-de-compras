/**
 * Fábrica do modelo de chat.
 * Anthropic, OpenAI e Gemini são BYOK: a chave chega no header e vive só no turno.
 * ChatGPT usa o LLM Gate da API (URL_LLM_GATE + LLM_GATE_API_KEY), sem chave no navegador.
 */
import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import type { ConfigLlm } from "@copiloto/shared";
import { criarModeloLlmGate } from "./llmGate.js";

export const MODELOS_PADRAO: Record<ConfigLlm["provedor"], string> = {
  anthropic: "claude-sonnet-5",
  openai: "gpt-5-mini",
  gemini: "gemini-2.5-flash",
  chatgpt: "gpt-4o",
};

export function criarModelo(config: ConfigLlm, chave: string): BaseChatModel {
  const model = config.modelo.trim() || MODELOS_PADRAO[config.provedor];
  switch (config.provedor) {
    case "anthropic":
      return new ChatAnthropic({ model, apiKey: chave, maxRetries: 1, maxTokens: 2048 });
    case "openai":
      return new ChatOpenAI({ model, apiKey: chave, maxRetries: 1 });
    case "gemini":
      return new ChatGoogleGenerativeAI({ model, apiKey: chave, maxRetries: 1 });
    case "chatgpt":
      return criarModeloLlmGate(model);
  }
}
