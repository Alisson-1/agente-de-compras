/**
 * PADRÃO 6 — Planning
 *
 * O que é: antes de agir, o agente monta um plano explícito de passos e o
 * executa, marcando o progresso. Se o mundo não colabora, ele replaneja.
 *
 * Que problema resolve: tarefas de várias etapas (recomendar uma compra) se
 * perdem quando o agente improvisa. O plano torna o raciocínio visível e
 * auditável, e o replanejamento evita insistir num caminho sem saída.
 *
 * Onde aparece: nó `planner`, no caminho "recomendar". Na tela: checklist do
 * plano (eventos `plan`) marcado conforme o grafo avança. Se não houver cotações
 * válidas suficientes, replaneja para "propor solicitar nova cotação".
 */
import type { RunnableConfig } from "@langchain/core/runnables";
import type { PassoPlano, StatusPasso } from "@copiloto/shared";
import { agentePlanner, ID_PASSOS } from "../agents/planner/index.js";
import { store } from "../data/store.js";
import { comPadrao } from "../events/emitter.js";
import { ctxDe, type Contexto } from "../graph/contexto.js";
import type { Atualizacao, Estado } from "../graph/state.js";
import { chamarFerramenta } from "../tools/executar.js";
import type { listarCotacoesDados } from "../tools/listarCotacoes.js";
import { recuperar } from "./09-rag.js";

/** Marca um passo do plano e emite o checklist atualizado. */
export async function marcarPasso(ctx: Contexto, plano: PassoPlano[] | undefined, id: string, status: StatusPasso): Promise<PassoPlano[]> {
  if (!plano?.length) return plano ?? [];
  const novo = plano.map((p) => (p.id === id ? { ...p, status } : p));
  await ctx.emissor.emit({ type: "plan", steps: novo });
  return novo;
}

const ROTULOS_PADRAO: Record<(typeof ID_PASSOS)[number], string> = {
  manual: "Consultar o manual",
  listar: "Listar as cotações válidas",
  enriquecer: "Enriquecer as cotações",
  especialistas: "Ouvir os especialistas",
  consolidar: "Consolidar os pareceres",
  revisar: "Revisar com o crítico",
};

export async function noPlanner(_estado: Estado, config: RunnableConfig): Promise<Atualizacao> {
  const ctx = ctxDe(config);
  const pedido = ctx.pedido!;
  return comPadrao(
    ctx.emissor,
    "planning",
    "planner",
    "Antes de agir, monto um plano explícito e sigo passo a passo; se algo faltar, eu replanejo.",
    async () => {
      const saida = await agentePlanner(ctx, pedido);
      // Guarda em código: o plano sempre tem os passos obrigatórios, na ordem do grafo.
      let plano: PassoPlano[] = ID_PASSOS.map((id) => ({
        id,
        label: saida.passos.find((p) => p.id === id)?.label ?? ROTULOS_PADRAO[id],
        status: "pendente" as const,
      }));
      await ctx.emissor.emit({ type: "plan", steps: plano });

      plano = await marcarPasso(ctx, plano, "manual", "executando");
      const seg = pedido.itens.some((i) => i.itemDeSeguranca);
      await recuperar(ctx, `regras de compra para pedido ${pedido.urgencia}${seg ? " com item de segurança" : ""}`, "planner", 3);
      plano = await marcarPasso(ctx, plano, "manual", "feito");

      plano = await marcarPasso(ctx, plano, "listar", "executando");
      const lista = await comPadrao(
        ctx.emissor,
        "tool-use",
        "planner",
        "Listo as cotações com uma ferramenta, em vez de supor o que existe.",
        () => chamarFerramenta<ReturnType<typeof listarCotacoesDados>>(ctx, "listarCotacoes", { pedidoId: pedido.numero }),
        (r) => `${r.length} cotações`,
      );
      const elegiveis = lista.filter((c) => c.elegivel);
      const respondidas = lista.filter((c) => c.status === "respondida").length;
      const p = store.politica;
      const menorTotal = Math.min(...elegiveis.map((c) => c.total));
      const insuficiente =
        elegiveis.length === 0 || (menorTotal > p.valorExigeMinimoCotacoes && respondidas < p.minimoCotacoesRespondidas);

      if (insuficiente) {
        plano = [
          ...plano.filter((s) => s.id === "manual"),
          { id: "listar", label: `Listar cotações válidas: só ${elegiveis.length}, insuficiente`, status: "falhou" },
          { id: "nova-cotacao", label: "Replanejado: propor solicitar nova cotação", status: "executando" },
        ];
        await ctx.emissor.emit({ type: "plan", steps: plano });
        return { plano, replanejado: true, idsCandidatas: [] };
      }

      plano = await marcarPasso(ctx, plano, "listar", "feito");
      return { plano, replanejado: false, idsCandidatas: elegiveis.map((c) => c.numero) };
    },
    (r) => (r.replanejado ? "replanejado: faltam cotações válidas" : `plano com 6 passos, ${r.idsCandidatas?.length} cotações válidas`),
  );
}
