/**
 * PADRÃO 8 — Human-in-the-Loop (HITL)
 *
 * O que é: o agente para em pontos de decisão e devolve o controle a uma
 * pessoa, que aprova, edita ou recusa.
 *
 * Que problema resolve: compras gastam dinheiro e mexem na frota. Um agente
 * que age sozinho erra sem ninguém ver. Aqui, nada muda sem clique humano.
 *
 * Onde aparece, em três níveis:
 *  1. Proposta: toda ação (selecionar, nova cotação, emitir) vira uma Proposta
 *     com Aprovar / Editar / Recusar. A aprovação chama um endpoint de ação,
 *     fora do grafo: aprovar é um ato humano.
 *  2. Alçada: acima de R$ 5.000 a proposta aprovada pelo comprador fica
 *     "aguardando gestor" até "Aprovar como gestor".
 *  3. Escalonamento por baixa confiança: empate técnico ou especialistas em
 *     desacordo → o agente não decide e devolve a pergunta com botões.
 *
 * Este arquivo implementa o nó `finalize`, que emite a resposta do turno.
 */
import type { RunnableConfig } from "@langchain/core/runnables";
import type { Proposta } from "@copiloto/shared";
import { formatarBRL } from "@copiloto/shared";
import { store } from "../data/store.js";
import { comPadrao } from "../events/emitter.js";
import { ctxDe, type Contexto } from "../graph/contexto.js";
import type { Atualizacao, Estado, PropostaRascunho } from "../graph/state.js";

function registrarProposta(ctx: Contexto, rascunho: PropostaRascunho, notasDoCritico: string[]): Proposta {
  const proposta: Proposta = {
    id: store.proximoIdProposta(),
    tipo: rascunho.tipo,
    resumo: rascunho.resumo,
    payload: rascunho.payload,
    justificativa: rascunho.justificativa,
    notasDoCritico,
    requerGestor: rascunho.requerGestor,
    status: "pendente",
    padroesUsados: [...new Set([...ctx.emissor.padroesUsados, "hitl" as const])],
    ordemDeCompraId: null,
  };
  store.propostas.set(proposta.id, proposta);
  return proposta;
}

/** Extrai citações "§2.2" do texto e junta com as já conhecidas. */
function citacoesDe(texto: string, extras: string[]): string[] {
  return [...new Set([...(texto.match(/§\d+\.\d+/g) ?? []), ...extras])];
}

export async function noFinalize(estado: Estado, config: RunnableConfig): Promise<Atualizacao> {
  const ctx = ctxDe(config);
  const r = estado.rascunho;
  const emitirMensagem = (texto: string, extras: string[] = []) =>
    ctx.emissor.emit({ type: "message", text: texto, citations: citacoesDe(texto, extras) });

  // 3. Escalonamento por baixa confiança.
  const escalar = async (texto: string, opcoes: string[]) =>
    comPadrao(
      ctx.emissor,
      "hitl",
      "finalize",
      "Baixa confiança: não decido sozinho. Devolvo a pergunta para você, com as opções em botões.",
      async () => {
        await emitirMensagem(texto);
        await ctx.emissor.emit({ type: "hitl", kind: "escalonamento", opcoes });
      },
      () => "aguardando sua escolha",
    );

  if (estado.escalonamento) {
    await escalar(estado.escalonamento.texto, estado.escalonamento.opcoes);
    return {};
  }

  if (estado.bloqueado) {
    const erros = estado.validacao?.erros ?? [];
    await emitirMensagem(
      `Não posso propor isso: a política de compras não permite. ${erros.join(" ")} Quer que eu recomende uma alternativa?`,
    );
    return {};
  }

  if (!r) {
    await emitirMensagem("Não consegui montar uma resposta para isso.");
    return {};
  }

  // Recomendação reprovada nas 2 rodadas: escala para o humano.
  if (r.tipo === "recomendacao" && !estado.aprovadoPeloCritico) {
    const opcoes = (estado.decisao?.ranking ?? [])
      .filter((x) => !(estado.reprovadas ?? []).includes(x.cotacaoId) && x.nota > 0)
      .slice(0, 2)
      .map((x) => `Escolho a cotação ${x.cotacaoId}`);
    await escalar(
      `O crítico reprovou minhas duas tentativas de recomendação. ${estado.feedbackCritico ?? ""} A decisão fica com você.`,
      opcoes,
    );
    return {};
  }

  // 1 e 2. Proposta (recomendação aprovada vira proposta de seleção).
  let proposta: PropostaRascunho | null = null;
  if (r.tipo === "proposta" && r.proposta) proposta = r.proposta;
  if (r.tipo === "recomendacao" && r.cotacaoId) {
    const c = estado.candidatas.find((x) => x.cotacaoId === r.cotacaoId);
    proposta = {
      tipo: "selecionarCotacao",
      resumo: `Selecionar ${r.cotacaoId} (${c?.fornecedor}, ${c ? formatarBRL(c.total) : ""})`,
      justificativa: r.texto,
      requerGestor: false,
      payload: { pedidoId: ctx.pedido!.numero, cotacaoId: r.cotacaoId, fornecedorId: null, quantidades: null, valorTotal: c?.total ?? null },
    };
  }

  if (!proposta) {
    await emitirMensagem(r.texto, r.citacoes);
    return {};
  }

  const p = proposta;
  await comPadrao(
    ctx.emissor,
    "hitl",
    "finalize",
    p.requerGestor
      ? "Nada muda sem você. E esta compra passa da alçada: depois do seu OK, ainda precisa do gestor."
      : "Nada muda sem você: transformo a resposta numa proposta para você aprovar, editar ou recusar.",
    async () => {
      await emitirMensagem(r.texto, r.citacoes);
      const registrada = registrarProposta(ctx, p, estado.notasCritico ?? []);
      await ctx.emissor.emit({ type: "hitl", kind: "proposta", proposta: registrada });
      if (registrada.requerGestor) await ctx.emissor.emit({ type: "hitl", kind: "alcada", proposta: registrada });
      return registrada;
    },
    (x) => `proposta ${x.id} aguardando você`,
  );
  return {};
}
