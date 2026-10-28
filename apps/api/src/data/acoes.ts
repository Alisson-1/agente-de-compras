/**
 * Ações que ALTERAM dados. Só são chamadas pelos endpoints que um humano aciona
 * (botões da Tela de Compras ou "Aprovar" numa proposta do agente).
 * Nenhuma ferramenta do agente chega aqui.
 */
import type { Cotacao, OrdemDeCompra, PatternId, Proposta, ResultadoValidacao } from "@copiloto/shared";

import { totalComQuantidades, validarCotacao } from "../validator/rules.js";
import { store } from "./store.js";

export class ErroDeAcao extends Error {
  constructor(
    message: string,
    public status = 400,
    public validacao?: ResultadoValidacao,
  ) {
    super(message);
  }
}

function hoje(): string {
  return new Date().toISOString();
}

function exigirPedido(pedidoId: string) {
  const pedido = store.pedidos.get(pedidoId);
  if (!pedido) throw new ErroDeAcao(`Pedido ${pedidoId} não encontrado.`, 404);
  return pedido;
}

function exigirCotacao(cotacaoId: string | null | undefined) {
  const cotacao = cotacaoId ? store.cotacoes.get(cotacaoId) : undefined;
  if (!cotacao) throw new ErroDeAcao("Escolha uma cotação válida para continuar.", 400);
  return cotacao;
}

/** Selecionar não compra nada: é permitido, mas devolve os avisos da política. */
export function selecionarCotacao(pedidoId: string, cotacaoId: string): ResultadoValidacao {
  const pedido = exigirPedido(pedidoId);
  const cotacao = exigirCotacao(cotacaoId);
  pedido.cotacaoSelecionadaId = cotacao.numero;
  return validarCotacao({ pedido, cotacao, modo: "selecao" });
}

export function solicitarNovaCotacao(pedidoId: string, fornecedorId?: string | null): Cotacao {
  const pedido = exigirPedido(pedidoId);
  if (["comprado", "cancelado", "aguardando aprovação do gestor"].includes(pedido.status)) {
    throw new ErroDeAcao(`O pedido ${pedido.numero} está "${pedido.status}" e não aceita nova cotação.`);
  }
  const existentes = store.cotacoesDoPedido(pedidoId);
  const jaCotaram = new Set(existentes.map((c) => c.fornecedorId));
  const uf = store.oficinas.get(pedido.os.oficinaId)?.uf;
  // Prioriza fornecedor bem avaliado da mesma UF da oficina que ainda não cotou (Manual §4.4).
  const fornecedor =
    (fornecedorId && store.fornecedores.get(fornecedorId)) ||
    [...store.fornecedores.values()]
      .filter((f) => !jaCotaram.has(f.id) && f.notaQualidade >= store.politica.notaMinimaFornecedor)
      .sort((a, b) => Number(b.uf === uf) - Number(a.uf === uf) || b.notaQualidade - a.notaQualidade)[0] ||
    [...store.fornecedores.values()].sort((a, b) => b.notaQualidade - a.notaQualidade)[0];

  // Preço de referência: média das cotações respondidas (resposta gerada de forma determinística).
  const respondidas = existentes.filter((c) => c.status === "respondida");
  const itens = pedido.itens.map((item) => {
    const precos = respondidas
      .flatMap((c) => c.itens)
      .filter((i) => i.descricao === item.descricao)
      .map((i) => i.precoUnitario);
    const media = precos.length ? precos.reduce((s, p) => s + p, 0) / precos.length : 100;
    return {
      descricao: item.descricao,
      quantidade: item.quantidade,
      precoUnitario: Math.round(media * 0.96),
      marca: "Marca homologada",
      tipo: "homologada" as const,
    };
  });
  const cotacao: Cotacao = {
    numero: store.proximoNumeroCotacao(pedidoId),
    pedidoId,
    fornecedorId: fornecedor.id,
    dataEnvio: hoje().slice(0, 10),
    validade: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
    status: "pendente",
    itens,
    frete: 30,
    prazoEntregaHoras: 24,
    garantiaMeses: 6,
  };
  store.cotacoes.set(cotacao.numero, cotacao);
  pedido.status = "em cotação";
  return cotacao;
}

/** Botão de demo: a primeira cotação pendente do pedido chega respondida. */
export function simularChegadaDeCotacao(pedidoId: string): Cotacao {
  const pedido = exigirPedido(pedidoId);
  const pendente = store.cotacoesDoPedido(pedidoId).find((c) => c.status === "pendente");
  if (!pendente) throw new ErroDeAcao("Não há cotação pendente neste pedido. Solicite uma nova cotação primeiro.", 409);
  pendente.status = "respondida";
  if (!store.cotacoesDoPedido(pedidoId).some((c) => c.status === "pendente") && pedido.status === "em cotação") {
    pedido.status = "cotado";
  }
  return pendente;
}

type EmitirEntrada = {
  pedidoId: string;
  cotacaoId: string | null | undefined;
  origem: "manual" | "agente";
  justificativa: string;
  padroesUsados: PatternId[];
  quantidades?: Record<string, number> | null;
};

/** Emite a OC. O validador em código confere a política com ou sem agente. */
export function emitirOrdemDeCompra(e: EmitirEntrada): OrdemDeCompra {
  const pedido = exigirPedido(e.pedidoId);
  const cotacao = exigirCotacao(e.cotacaoId);
  const validacao = validarCotacao({ pedido, cotacao, quantidades: e.quantidades, modo: "compra" });
  if (!validacao.ok) {
    throw new ErroDeAcao("A compra viola a Política de Compras.", 422, validacao);
  }
  const ordem: OrdemDeCompra = {
    numero: store.proximoNumeroOrdem(),
    pedidoId: pedido.numero,
    cotacaoId: cotacao.numero,
    valorTotal: totalComQuantidades(cotacao, e.quantidades),
    justificativa: e.justificativa,
    origem: e.origem,
    padroesUsados: e.padroesUsados,
    requerGestor: validacao.requerGestor,
    aprovacoes: { comprador: { por: "Comprador(a)", em: hoje() }, gestor: null },
    data: hoje(),
  };
  store.ordens.set(ordem.numero, ordem);
  pedido.cotacaoSelecionadaId = cotacao.numero;
  pedido.status = validacao.requerGestor ? "aguardando aprovação do gestor" : "comprado";
  return ordem;
}

export function aprovarComoGestor(ordemId: string): OrdemDeCompra {
  const ordem = store.ordens.get(ordemId);
  if (!ordem) throw new ErroDeAcao(`Ordem de compra ${ordemId} não encontrada.`, 404);
  if (!ordem.requerGestor) throw new ErroDeAcao("Esta compra está dentro da alçada e não precisa de gestor.");
  if (ordem.aprovacoes.gestor) throw new ErroDeAcao("Esta compra já foi aprovada pelo gestor.", 409);
  ordem.aprovacoes.gestor = { por: "Gestor(a) de compras", em: hoje() };
  const pedido = exigirPedido(ordem.pedidoId);
  pedido.status = "comprado";
  for (const p of store.propostas.values()) {
    if (p.ordemDeCompraId === ordem.numero && p.status === "aguardando gestor") p.status = "aprovada";
  }
  return ordem;
}

/* ---------- Propostas do agente (HITL) ---------- */

function exigirPropostaPendente(id: string): Proposta {
  const proposta = store.propostas.get(id);
  if (!proposta) throw new ErroDeAcao(`Proposta ${id} não encontrada.`, 404);
  if (proposta.status !== "pendente") throw new ErroDeAcao(`A proposta ${id} já foi ${proposta.status}.`, 409);
  return proposta;
}

function executarProposta(proposta: Proposta) {
  const { payload } = proposta;
  switch (proposta.tipo) {
    case "selecionarCotacao": {
      const validacao = selecionarCotacao(payload.pedidoId, exigirCotacao(payload.cotacaoId).numero);
      return { validacao };
    }
    case "solicitarNovaCotacao": {
      const cotacao = solicitarNovaCotacao(payload.pedidoId, payload.fornecedorId);
      return { cotacao };
    }
    case "emitirOrdemDeCompra": {
      const ordem = emitirOrdemDeCompra({
        pedidoId: payload.pedidoId,
        cotacaoId: payload.cotacaoId,
        origem: "agente",
        justificativa: proposta.justificativa,
        padroesUsados: proposta.padroesUsados,
        quantidades: payload.quantidades,
      });
      proposta.ordemDeCompraId = ordem.numero;
      return { ordem };
    }
  }
}

export function aprovarProposta(id: string) {
  const proposta = exigirPropostaPendente(id);
  const resultado = executarProposta(proposta);
  proposta.status = resultado && "ordem" in resultado && resultado.ordem?.requerGestor ? "aguardando gestor" : "aprovada";
  return { proposta, ...resultado };
}

export function recusarProposta(id: string) {
  const proposta = exigirPropostaPendente(id);
  proposta.status = "recusada";
  return { proposta };
}

/** A versão editada passa de novo pelo validador; se passar, é executada (o clique é a aprovação). */
export function editarProposta(id: string, mudancas: { cotacaoId?: string | null; quantidades?: Record<string, number> | null }) {
  const proposta = exigirPropostaPendente(id);
  const payload = { ...proposta.payload };
  if (mudancas.cotacaoId !== undefined) payload.cotacaoId = mudancas.cotacaoId;
  if (mudancas.quantidades !== undefined) payload.quantidades = mudancas.quantidades;

  if (proposta.tipo !== "solicitarNovaCotacao") {
    const pedido = exigirPedido(payload.pedidoId);
    const cotacao = exigirCotacao(payload.cotacaoId);
    const validacao = validarCotacao({
      pedido,
      cotacao,
      quantidades: payload.quantidades,
      modo: proposta.tipo === "emitirOrdemDeCompra" ? "compra" : "selecao",
    });
    if (proposta.tipo === "emitirOrdemDeCompra" && !validacao.ok) {
      throw new ErroDeAcao("A versão editada viola a Política de Compras.", 422, validacao);
    }
    payload.valorTotal = totalComQuantidades(cotacao, payload.quantidades);
    proposta.requerGestor = validacao.requerGestor;
  }
  proposta.payload = payload;
  const resultado = executarProposta(proposta);
  proposta.status = resultado && "ordem" in resultado && resultado.ordem?.requerGestor ? "aguardando gestor" : "editada";
  return { proposta, ...resultado };
}

