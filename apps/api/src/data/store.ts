/**
 * Estado em memória da demo. A API é a fonte da verdade: os JSON-semente são
 * carregados no boot e só os endpoints de ação (atos humanos) alteram os dados.
 * "Reiniciar demo" chama reset() e restaura a semente.
 */
import { readFileSync } from "node:fs";
import type {
  Cotacao,
  Fornecedor,
  Oficina,
  OrdemDeCompra,
  PedidoDeCompra,
  PoliticaDeCompras,
  Proposta,
} from "@copiloto/shared";
import { caminho } from "../paths.js";

export type ItemEstoque = {
  codigoPeca: string;
  descricao: string;
  quantidade: number;
  local: string;
  custoUnitario: number;
};

function lerSemente<T>(arquivo: string): T {
  return JSON.parse(readFileSync(caminho("src", "data", arquivo), "utf8")) as T;
}

class Store {
  pedidos = new Map<string, PedidoDeCompra>();
  cotacoes = new Map<string, Cotacao>();
  fornecedores = new Map<string, Fornecedor>();
  oficinas = new Map<string, Oficina>();
  estoque: ItemEstoque[] = [];
  ordens = new Map<string, OrdemDeCompra>();
  propostas = new Map<string, Proposta>();
  politica!: PoliticaDeCompras;
  private seqOrdem = 0;
  private seqProposta = 0;
  private seqCotacao = 0;

  constructor() {
    this.reset();
  }

  reset(): void {
    const porChave = <T>(lista: T[], chave: (x: T) => string) => new Map(lista.map((x) => [chave(x), x]));
    this.pedidos = porChave(lerSemente<PedidoDeCompra[]>("pedidos.json"), (p) => p.numero);
    this.cotacoes = porChave(lerSemente<Cotacao[]>("cotacoes.json"), (c) => c.numero);
    this.fornecedores = porChave(lerSemente<Fornecedor[]>("fornecedores.json"), (f) => f.id);
    this.oficinas = porChave(lerSemente<Oficina[]>("oficinas.json"), (o) => o.id);
    this.estoque = lerSemente<ItemEstoque[]>("estoque.json");
    this.politica = lerSemente<PoliticaDeCompras>("politica.json");
    this.ordens.clear();
    this.propostas.clear();
    this.seqOrdem = 0;
    this.seqProposta = 0;
    this.seqCotacao = 0;
  }

  cotacoesDoPedido(pedidoId: string): Cotacao[] {
    return [...this.cotacoes.values()].filter((c) => c.pedidoId === pedidoId);
  }

  ordemDoPedido(pedidoId: string): OrdemDeCompra | undefined {
    return [...this.ordens.values()].find((o) => o.pedidoId === pedidoId);
  }

  proximoNumeroOrdem(): string {
    this.seqOrdem += 1;
    return `OC-2026-${String(900 + this.seqOrdem).padStart(4, "0")}`;
  }

  proximoIdProposta(): string {
    this.seqProposta += 1;
    return `PROP-${String(this.seqProposta).padStart(3, "0")}`;
  }

  proximoNumeroCotacao(pedidoId: string): string {
    this.seqCotacao += 1;
    return `COT-${pedidoId.slice(-4)}-N${this.seqCotacao}`;
  }
}

export const store = new Store();
