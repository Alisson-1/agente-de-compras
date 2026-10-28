/**
 * Chamada de agente com saída SEMPRE estruturada.
 *
 * - Modo real: withStructuredOutput(schema Zod, { includeRaw: true }) para capturar
 *   usage_metadata (tokens). Se a saída não bater com o schema, tenta mais uma vez
 *   mostrando o erro ao modelo. Nunca parseia texto livre.
 * - Modo simulado: devolve a resposta roteirizada (llm/simulated.ts), com uma
 *   latência curta para a plateia ver o nó "pensando".
 *
 * Nos dois modos emite um evento `trace` com nó, tokens e latência.
 */
import type { AIMessage, BaseMessage } from "@langchain/core/messages";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { z } from "zod";
import { FalhaLlm, type Contexto } from "../graph/contexto.js";

type Opcoes<S extends z.ZodTypeAny> = {
  node: string;
  schema: S;
  /** Nome da "ferramenta" de saída estruturada (sem espaços). */
  nome: string;
  system: string;
  user: string;
  /** Resposta roteirizada para o modo simulado. */
  simular: () => z.infer<S>;
};

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function executarAgente<S extends z.ZodTypeAny>(ctx: Contexto, o: Opcoes<S>): Promise<z.infer<S>> {
  const inicio = Date.now();

  if (ctx.simulado || !ctx.modelo) {
    await dormir(250 + (o.node.length % 5) * 60);
    const saida = o.schema.parse(o.simular()) as z.infer<S>;
    await ctx.emissor.emit({ type: "trace", node: o.node, latencyMs: Date.now() - inicio });
    return saida;
  }

  const estruturado = ctx.modelo.withStructuredOutput(o.schema, { name: o.nome, includeRaw: true });
  let mensagens: BaseMessage[] = [new SystemMessage(o.system), new HumanMessage(o.user)];
  let ultimoErro = "";

  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    const t0 = Date.now();
    let resultado: { raw: BaseMessage; parsed: unknown; parsingError?: unknown };
    try {
      resultado = (await estruturado.invoke(mensagens)) as typeof resultado;
    } catch (e) {
      throw new FalhaLlm(`Falha ao chamar o LLM no nó "${o.node}": ${(e as Error).message}`);
    }
    const uso = (resultado.raw as AIMessage).usage_metadata;
    await ctx.emissor.emit({
      type: "trace",
      node: tentativa > 1 ? `${o.node} (nova tentativa)` : o.node,
      tokens: uso ? { input: uso.input_tokens, output: uso.output_tokens } : undefined,
      latencyMs: Date.now() - t0,
    });
    const validado = o.schema.safeParse(resultado.parsed);
    if (validado.success) return validado.data as z.infer<S>;
    ultimoErro = validado.error.message.slice(0, 500);
    mensagens = [
      ...mensagens,
      new HumanMessage(`Sua resposta não seguiu o formato pedido (${ultimoErro}). Responda de novo seguindo exatamente o schema.`),
    ];
  }
  throw new FalhaLlm(`O LLM devolveu saída fora do schema no nó "${o.node}": ${ultimoErro}`);
}
