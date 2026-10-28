/**
 * PADRÃO 5 — Tool Use
 *
 * O que é: o agente chama funções externas (com descrição e schema) para
 * consultar dados reais, em vez de responder de memória.
 *
 * Que problema resolve: o LLM não sabe preços, prazos, estoque nem a política
 * atual. Com ferramentas, ele consulta os sistemas; sem elas, inventaria.
 *
 * Onde aparece: catálogo em tools/*.ts (listarPedidos, listarCotacoes, consultarFornecedor,
 * calcularPrazoEntrega, consultarEstoqueInterno, consultarPolitica,
 * buscarNoManual), todas SOMENTE LEITURA. No nó `proporAcao`, o LLM escolhe as
 * ferramentas via bindTools (modo real); planner, enriquecer e a cadeia também
 * as chamam. Na tela: eventos `tool_call` com argumentos e resumo do resultado.
 *
 * Regra de ouro: nenhuma ferramenta altera dados. Ações de escrita existem só
 * como endpoints chamados depois que um humano aprova a Proposta (08-hitl.ts).
 */
import type { RunnableConfig } from "@langchain/core/runnables";
import type { TipoProposta } from "@copiloto/shared";
import { formatarBRL, totalCotacao } from "@copiloto/shared";
import { agenteProporAcao } from "../agents/proporAcao/index.js";
import { store } from "../data/store.js";
import { comPadrao } from "../events/emitter.js";
import { ctxDe } from "../graph/contexto.js";
import type { Atualizacao, Estado, PropostaRascunho } from "../graph/state.js";
import { validarCotacao } from "../validator/rules.js";

function resumoDaProposta(tipo: TipoProposta, pedidoId: string, cotacaoId: string | null): string {
  const c = cotacaoId ? store.cotacoes.get(cotacaoId) : undefined;
  const f = c ? store.fornecedores.get(c.fornecedorId)?.nome : undefined;
  switch (tipo) {
    case "selecionarCotacao":
      return `Selecionar ${cotacaoId} (${f}, ${formatarBRL(totalCotacao(c!))})`;
    case "emitirOrdemDeCompra":
      return `Emitir ordem de compra de ${formatarBRL(totalCotacao(c!))}: ${cotacaoId} (${f})`;
    case "solicitarNovaCotacao":
      return `Solicitar nova cotação para o ${pedidoId}`;
  }
}

export async function noProporAcao(estado: Estado, config: RunnableConfig): Promise<Atualizacao> {
  const ctx = ctxDe(config);
  const pedido = ctx.pedido!;
  const { tela, mensagem } = ctx.req;
  const recomendada = tela.ultimaRecomendacao?.pedidoId === pedido.numero ? tela.ultimaRecomendacao.cotacaoId : null;

  return comPadrao(
    ctx.emissor,
    "tool-use",
    "proporAcao",
    "Confirmo os fatos com ferramentas (somente leitura) e monto uma proposta. Eu não altero nada.",
    async () => {
      const saida = await agenteProporAcao(ctx, {
        pedidoId: pedido.numero,
        mensagem: mensagem ?? "",
        cotacoesDoPedido: store.cotacoesDoPedido(pedido.numero).map((c) => ({
          numero: c.numero,
          fornecedor: store.fornecedores.get(c.fornecedorId)?.nome ?? "",
        })),
        cotacaoTela: tela.pedidoId === pedido.numero ? tela.cotacaoSelecionadaId : null,
        cotacaoRecomendada: recomendada,
        forcarNovaCotacao: !!estado.replanejado,
        erroAnterior:
          estado.validacao && !estado.validacao.ok ? estado.validacao.erros.join(" ") : (estado.feedbackCritico ?? null),
      });

      const cotacao = saida.cotacaoId ? store.cotacoes.get(saida.cotacaoId) : undefined;
      const cotacaoId = cotacao && cotacao.pedidoId === pedido.numero ? cotacao.numero : null;

      if (saida.tipo !== "solicitarNovaCotacao" && !cotacaoId) {
        return {
          origem: "proporAcao",
          rascunho: {
            tipo: "aviso" as const,
            texto: "Para isso preciso de uma cotação escolhida. Selecione uma na tabela ou peça minha recomendação: \"Qual cotação você recomenda?\"",
            citacoes: [],
          },
        };
      }

      const valorTotal = cotacao ? totalCotacao(cotacao) : null;
      const requerGestor = cotacao ? validarCotacao({ pedido, cotacao, modo: "compra" }).requerGestor : false;
      const proposta: PropostaRascunho = {
        tipo: saida.tipo,
        resumo: resumoDaProposta(saida.tipo, pedido.numero, cotacaoId),
        justificativa: saida.justificativa,
        requerGestor: saida.tipo === "emitirOrdemDeCompra" && requerGestor,
        payload: { pedidoId: pedido.numero, cotacaoId, fornecedorId: null, quantidades: null, valorTotal },
      };
      return {
        origem: "proporAcao",
        rascunho: { tipo: "proposta" as const, texto: saida.justificativa, citacoes: [], cotacaoId, proposta },
      };
    },
    (r) => (r.rascunho?.proposta ? `proposta: ${r.rascunho.proposta.resumo}` : "faltou escolher a cotação"),
  );
}
