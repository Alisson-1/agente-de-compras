/**
 * Fábrica do modelo de chat (BYOK). A chave chega no header de cada requisição
 * e vive só durante o turno: nunca é gravada na API.
 */
import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import type { ConfigLlm } from "@copiloto/shared";

export const MODELOS_PADRAO: Record<ConfigLlm["provedor"], string> = {
  anthropic: "claude-sonnet-5",
  openai: "gpt-5-mini",
  gemini: "gemini-2.5-flash",
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
  }
}
