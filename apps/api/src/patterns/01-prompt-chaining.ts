/**
 * PADRÃO 1 — Prompt Chaining
 *
 * O que é: dividir uma tarefa em elos sequenciais, em que a saída de um elo é a
 * entrada do próximo. Elos podem ser LLM ou código.
 *
 * Que problema resolve: pedir "leia o diagnóstico bagunçado, confira com a OS e
 * resuma" num prompt só gera erro silencioso. Em elos, cada saída é estruturada
 * e verificável, e o código confere o que o LLM extraiu.
 *
 * Onde aparece: nó `analisarPedido` (chip "Resuma este pedido" ou evento
 * pedido_aberto). Elos: 1) extrair itens do texto livre (LLM) → 2) validar
 * contra pedido, OS, veículo e estoque (código + ferramentas) → 3) resumir em
 * 2–3 linhas (LLM). Na tela: os 3 eventos `chain_step`, cada um com sua saída.
 */
import type { RunnableConfig } from "@langchain/core/runnables";
import type { PedidoDeCompra } from "@copiloto/shared";
import { agenteExtrair, agenteResumir, type SaidaExtracao } from "../agents/chain/index.js";
import { store } from "../data/store.js";
import { comPadrao } from "../events/emitter.js";
import { ctxDe, type Contexto } from "../graph/contexto.js";
import type { Atualizacao, Estado } from "../graph/state.js";
import { normalizar } from "../rag/search.js";
import { chamarFerramenta } from "../tools/executar.js";

const chave = (s: string) => normalizar(s.split(" ")[0]).slice(0, 5);

/** Elo 2 (código): confere a extração contra o pedido, a OS, o veículo e o estoque. */
async function validarExtracao(ctx: Contexto, pedido: PedidoDeCompra, extracao: SaidaExtracao) {
  const divergencias: string[] = [];
  const observacoes: string[] = [];
  let conferidos = 0;

  for (const item of extracao.itens) {
    const doPedido = pedido.itens.find((i) => chave(i.descricao) === chave(item.descricao));
    if (doPedido) {
      conferidos += 1;
      if (doPedido.quantidade !== item.quantidade) {
        divergencias.push(`${doPedido.descricao}: pedido tem ${doPedido.quantidade}, diagnóstico indica ${item.quantidade}.`);
      }
    } else if (item.condicional) {
      divergencias.push(`${item.descricao} foi citado como "${item.trechoOrigem}": inspecionar antes de comprar (não está no pedido).`);
    } else {
      divergencias.push(`${item.descricao} aparece no diagnóstico mas não está no pedido.`);
    }
  }
  for (const i of pedido.itens) {
    if (!extracao.itens.some((x) => chave(x.descricao) === chave(i.descricao))) {
      divergencias.push(`${i.descricao} está no pedido mas não aparece no diagnóstico.`);
    }
  }

  const v = pedido.os.veiculo;
  if (v.status === "parado na oficina" && pedido.urgencia !== "urgente") {
    divergencias.push(`O carro está parado, mas o pedido não está marcado como urgente.`);
  }

  for (const item of pedido.itens.filter((i) => i.codigoPeca)) {
    const r = await chamarFerramenta<{ disponivel: boolean; quantidade: number; local: string | null }>(ctx, "consultarEstoqueInterno", {
      codigoPeca: item.codigoPeca,
    });
    if (r.disponivel && r.quantidade >= item.quantidade) {
      observacoes.push(`Estoque interno cobre ${item.descricao.toLowerCase()} (${r.quantidade} un. em ${r.local}, Manual §6.3).`);
    }
  }

  return {
    ok: divergencias.length === 0,
    veiculo: `${v.modelo} ${v.placa} (${v.status})`,
    itensConferidos: `${conferidos} de ${pedido.itens.length}`,
    divergencias,
    observacoes,
  };
}

export async function noAnalisarPedido(_estado: Estado, config: RunnableConfig): Promise<Atualizacao> {
  const ctx = ctxDe(config);
  const pedido = ctx.pedido!;
  return comPadrao(
    ctx.emissor,
    "prompt-chaining",
    "analisarPedido",
    "Divido a análise em 3 elos: extrair os itens do texto livre, validar em código e só então resumir.",
    async () => {
      const extracao = await agenteExtrair(ctx, pedido);
      await ctx.emissor.emit({ type: "chain_step", step: 1, name: "Extrair itens do diagnóstico (LLM)", output: extracao });

      const verificacao = await comPadrao(
        ctx.emissor,
        "tool-use",
        "analisarPedido",
        "Confiro o que foi extraído contra o pedido, a OS e o estoque interno, com ferramentas.",
        () => validarExtracao(ctx, pedido, extracao),
        (r) => (r.ok ? "sem divergências" : `${r.divergencias.length} divergência(s)`),
      );
      await ctx.emissor.emit({ type: "chain_step", step: 2, name: "Validar contra pedido, OS e veículo (código)", output: verificacao });

      const cotacoes = store.cotacoesDoPedido(pedido.numero);
      const { resumo } = await agenteResumir(ctx, {
        pedido,
        oficina: store.oficinas.get(pedido.os.oficinaId)?.nome ?? pedido.os.localizacao.nome,
        divergencias: verificacao.divergencias,
        observacoes: verificacao.observacoes,
        cotacoes: {
          respondidas: cotacoes.filter((c) => c.status === "respondida").length,
          pendentes: cotacoes.filter((c) => c.status === "pendente").length,
          expiradas: cotacoes.filter((c) => c.status === "expirada").length,
        },
      });
      await ctx.emissor.emit({ type: "chain_step", step: 3, name: "Resumir em 2–3 linhas (LLM)", output: { resumo } });

      return {
        rascunho: { tipo: "resumo" as const, texto: resumo, citacoes: verificacao.observacoes.length ? ["§6.3"] : [] },
        origem: "analisarPedido",
      };
    },
    () => "3 elos concluídos",
  );
}
