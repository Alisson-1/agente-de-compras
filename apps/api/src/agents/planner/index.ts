import { z } from "zod";
import type { PedidoDeCompra } from "@copiloto/shared";
import type { Contexto } from "../../graph/contexto.js";
import * as simulado from "../../llm/simulated.js";
import { executarAgente } from "../../llm/withStructuredRetry.js";
import { carregarPrompt } from "../carregarPrompt.js";

const PROMPT = carregarPrompt("planner");

export const ID_PASSOS = ["manual", "listar", "enriquecer", "especialistas", "consolidar", "revisar"] as const;
export type IdPasso = (typeof ID_PASSOS)[number];

export const SaidaPlanner = z.object({
  passos: z.array(z.object({ id: z.enum(ID_PASSOS), label: z.string() })),
  justificativa: z.string(),
});

export function agentePlanner(ctx: Contexto, pedido: PedidoDeCompra) {
  return executarAgente(ctx, {
    node: "planner",
    nome: "montar_plano",
    schema: SaidaPlanner,
    system: PROMPT,
    user: `Objetivo: recomendar a melhor cotação para o pedido ${pedido.numero}.\nUrgência: ${pedido.urgencia}. Veículo ${pedido.os.veiculo.status}, ${pedido.os.diasParado} dia(s) parado.\nItens: ${pedido.itens
      .map((i) => `${i.quantidade}× ${i.descricao} (${i.categoria}${i.itemDeSeguranca ? ", item de segurança" : ""})`)
      .join("; ")}.`,
    simular: () => simulado.planner(pedido),
  });
}
