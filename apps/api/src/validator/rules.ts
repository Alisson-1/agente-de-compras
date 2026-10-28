/**
 * Validador determinístico da Política de Compras. SEM LLM.
 *
 * As regras críticas vivem aqui, em código, e nunca dependem só de prompt.
 * São usadas por:
 *  - ações manuais da Tela de Compras (o sistema barra compra fora da política, com ou sem agente);
 *  - aprovação de propostas do agente (o humano aprova, o código ainda confere);
 *  - nó `validate` do grafo (confere recomendações e propostas antes do crítico).
 *
 * Cada regra aponta a seção do Manual de Compras correspondente, para o agente poder citar.
 */
import type { Cotacao, PedidoDeCompra, ResultadoValidacao } from "@copiloto/shared";
import { totalCotacao } from "@copiloto/shared";
import { store } from "../data/store.js";

export const SECAO = {
  alcada: "1.2",
  seguranca: "2.2",
  prazoUrgente: "3.1",
  minimoCotacoes: "4.1",
  expirada: "4.3",
  pendente: "4.2",
  vetoFornecedor: "5.2",
  pedidoFechado: "1.4",
} as const;

/** Total da cotação, opcionalmente com quantidades editadas pelo humano. */
export function totalComQuantidades(cotacao: Cotacao, quantidades?: Record<string, number> | null): number {
  if (!quantidades) return totalCotacao(cotacao);
  const itens = cotacao.itens.map((i) => ({ ...i, quantidade: quantidades[i.descricao] ?? i.quantidade }));
  return totalCotacao({ itens, frete: cotacao.frete });
}

type Entrada = {
  pedido: PedidoDeCompra;
  cotacao: Cotacao;
  quantidades?: Record<string, number> | null;
  /** "compra" confere tudo; "selecao" ignora o estado do pedido (selecionar não compra). */
  modo: "compra" | "selecao";
};

export function validarCotacao({ pedido, cotacao, quantidades, modo }: Entrada): ResultadoValidacao {
  const politica = store.politica;
  const erros: string[] = [];
  const regras: ResultadoValidacao["regras"] = [];
  const falha = (msg: string, regra: string, secaoManual: string) => {
    erros.push(`${msg} (Manual §${secaoManual})`);
    regras.push({ regra, secaoManual });
  };

  if (cotacao.pedidoId !== pedido.numero) {
    falha(`A cotação ${cotacao.numero} não pertence ao pedido ${pedido.numero}.`, "cotacao-do-pedido", SECAO.minimoCotacoes);
  }

  if (modo === "compra" && ["comprado", "aguardando aprovação do gestor", "cancelado"].includes(pedido.status)) {
    falha(`O pedido ${pedido.numero} está "${pedido.status}" e não aceita nova compra.`, "pedido-fechado", SECAO.pedidoFechado);
  }

  if (cotacao.status === "expirada" && politica.vetarCotacaoExpirada) {
    falha(`A cotação ${cotacao.numero} está expirada. Peça uma nova cotação a esse fornecedor.`, "cotacao-expirada", SECAO.expirada);
  }
  if (cotacao.status === "pendente") {
    falha(`A cotação ${cotacao.numero} ainda não foi respondida.`, "cotacao-pendente", SECAO.pendente);
  }

  const fornecedor = store.fornecedores.get(cotacao.fornecedorId);
  if (fornecedor && fornecedor.notaQualidade < politica.notaMinimaFornecedor) {
    falha(
      `O fornecedor ${fornecedor.nome} tem nota ${fornecedor.notaQualidade.toFixed(1)}, abaixo de ${politica.notaMinimaFornecedor}: está vetado.`,
      "fornecedor-vetado",
      SECAO.vetoFornecedor,
    );
  }

  const itensSeguranca = new Set(pedido.itens.filter((i) => i.itemDeSeguranca).map((i) => i.descricao));
  const proibidos = cotacao.itens.filter(
    (i) => itensSeguranca.has(i.descricao) && !politica.tiposPermitidosItemSeguranca.includes(i.tipo),
  );
  if (proibidos.length > 0) {
    falha(
      `Item de segurança cotado como peça ${proibidos[0].tipo}: ${proibidos.map((i) => i.descricao).join(", ")}. Só original ou homologada.`,
      "item-seguranca-tipo",
      SECAO.seguranca,
    );
  }

  if (pedido.urgencia === "urgente" && cotacao.prazoEntregaHoras > politica.prazoMaximoUrgenteHoras) {
    falha(
      `Pedido urgente (carro parado) exige entrega em até ${politica.prazoMaximoUrgenteHoras}h; esta cotação leva ${cotacao.prazoEntregaHoras}h.`,
      "prazo-urgente",
      SECAO.prazoUrgente,
    );
  }

  const total = totalComQuantidades(cotacao, quantidades);
  const respondidas = store.cotacoesDoPedido(pedido.numero).filter((c) => c.status === "respondida").length;
  if (total > politica.valorExigeMinimoCotacoes && respondidas < politica.minimoCotacoesRespondidas) {
    falha(
      `Compras acima de R$ ${politica.valorExigeMinimoCotacoes.toLocaleString("pt-BR")} exigem ${politica.minimoCotacoesRespondidas} cotações respondidas; este pedido tem ${respondidas}.`,
      "minimo-cotacoes",
      SECAO.minimoCotacoes,
    );
  }

  return { ok: erros.length === 0, erros, regras, requerGestor: total > politica.limiteAlcadaComprador };
}

/** Cotação elegível para análise: respondida e de fornecedor não vetado. */
export function cotacaoElegivel(cotacao: Cotacao): boolean {
  const fornecedor = store.fornecedores.get(cotacao.fornecedorId);
  return cotacao.status === "respondida" && !!fornecedor && fornecedor.notaQualidade >= store.politica.notaMinimaFornecedor;
}
