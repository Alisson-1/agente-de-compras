/**
 * Agente que monta propostas. No modo real, o LLM escolhe as ferramentas
 * (bindTools) para confirmar os fatos antes de responder no formato estruturado.
 * No modo simulado, as mesmas ferramentas são chamadas num roteiro fixo.
 */
import type { AIMessage, BaseMessage } from "@langchain/core/messages";
import { HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { z } from "zod";
import { FalhaLlm, type Contexto } from "../../graph/contexto.js";
import * as simulado from "../../llm/simulated.js";
import { executarAgente } from "../../llm/withStructuredRetry.js";
import { chamarFerramenta } from "../../tools/executar.js";
import { FERRAMENTAS } from "../../tools/index.js";
import { carregarPrompt } from "../carregarPrompt.js";

const PROMPT = carregarPrompt("proporAcao");
const MAX_RODADAS_FERRAMENTAS = 4;

export const SaidaProposta = z.object({
  tipo: z.enum(["selecionarCotacao", "solicitarNovaCotacao", "emitirOrdemDeCompra"]),
  cotacaoId: z.string().nullable(),
  justificativa: z.string(),
});

type Entrada = Parameters<typeof simulado.proporAcao>[0] & { pedidoId: string; erroAnterior: string | null };

export async function agenteProporAcao(ctx: Contexto, entrada: Entrada) {
  const pedidoUser = [
    `Pedido aberto: ${entrada.pedidoId}.`,
    `Cotação selecionada na tela: ${entrada.cotacaoTela ?? "nenhuma"}. Última recomendada: ${entrada.cotacaoRecomendada ?? "nenhuma"}.`,
    entrada.forcarNovaCotacao ? "O planejador concluiu que faltam cotações válidas: proponha solicitar nova cotação." : "",
    entrada.erroAnterior ? `O validador reprovou sua proposta anterior: ${entrada.erroAnterior}` : "",
    `Mensagem do comprador: """${entrada.mensagem}"""`,
  ]
    .filter(Boolean)
    .join("\n");

  const resultados: string[] = [];

  if (ctx.simulado || !ctx.modelo) {
    // Roteiro fixo de ferramentas (Tool Use continua real no modo simulado).
    await chamarFerramenta(ctx, "listarCotacoes", { pedidoId: entrada.pedidoId });
    await chamarFerramenta(ctx, "consultarPolitica", {});
  } else {
    const comFerramentas = ctx.modelo.bindTools?.(FERRAMENTAS);
    if (!comFerramentas) throw new FalhaLlm("Este modelo não suporta ferramentas (bindTools).");
    const mensagens: BaseMessage[] = [new SystemMessage(PROMPT), new HumanMessage(pedidoUser)];
    for (let rodada = 0; rodada < MAX_RODADAS_FERRAMENTAS; rodada++) {
      const t0 = Date.now();
      let resposta: AIMessage;
      try {
        resposta = (await comFerramentas.invoke(mensagens)) as AIMessage;
      } catch (e) {
        throw new FalhaLlm(`Falha ao chamar o LLM no nó "proporAcao": ${(e as Error).message}`);
      }
      const uso = resposta.usage_metadata;
      await ctx.emissor.emit({
        type: "trace",
        node: "proporAcao:ferramentas",
        tokens: uso ? { input: uso.input_tokens, output: uso.output_tokens } : undefined,
        latencyMs: Date.now() - t0,
      });
      mensagens.push(resposta);
      const chamadas = resposta.tool_calls ?? [];
      if (chamadas.length === 0) break;
      for (const chamada of chamadas) {
        const r = await chamarFerramenta(ctx, chamada.name, chamada.args);
        const conteudo = JSON.stringify(r);
        resultados.push(`${chamada.name}(${JSON.stringify(chamada.args)}) → ${conteudo}`);
        mensagens.push(new ToolMessage({ tool_call_id: chamada.id ?? chamada.name, content: conteudo }));
      }
    }
  }

  return executarAgente(ctx, {
    node: "proporAcao",
    nome: "montar_proposta",
    schema: SaidaProposta,
    system: PROMPT,
    user: `${pedidoUser}\n\nResultados das ferramentas:\n${resultados.join("\n") || "(nenhum)"}`,
    simular: () => simulado.proporAcao(entrada),
  });
}
