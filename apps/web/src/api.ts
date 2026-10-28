/**
 * Cliente HTTP da API. Leituras e ações humanas (botões da tela e das propostas).
 */
import type {
  Cotacao,
  Fornecedor,
  Oficina,
  OrdemDeCompra,
  PedidoDeCompra,
  PoliticaDeCompras,
  Proposta,
  ResultadoValidacao,
} from "@copiloto/shared";

export type EstadoServidor = {
  pedidos: PedidoDeCompra[];
  cotacoes: Cotacao[];
  fornecedores: Fornecedor[];
  oficinas: Oficina[];
  ordens: OrdemDeCompra[];
  propostas: Proposta[];
  politica: PoliticaDeCompras;
};

export type SecaoManual = { source: string; section: string; title: string; text: string };

export class ErroApi extends Error {
  constructor(
    message: string,
    public validacao: ResultadoValidacao | null,
  ) {
    super(message);
  }
}

async function chamar<T>(url: string, corpo?: unknown): Promise<T> {
  const resposta = await fetch(url, {
    method: corpo === undefined ? "GET" : "POST",
    headers: corpo === undefined ? undefined : { "Content-Type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const json = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new ErroApi(json.erro ?? `Erro ${resposta.status}`, json.validacao ?? null);
  return json as T;
}

type ComEstado<T> = T & { estado: EstadoServidor };

export const api = {
  estado: () => chamar<EstadoServidor>("/api/estado"),
  manual: () => chamar<SecaoManual[]>("/api/manual"),
  selecionar: (pedidoId: string, cotacaoId: string) =>
    chamar<ComEstado<{ validacao: ResultadoValidacao }>>(`/api/pedidos/${pedidoId}/selecionar`, { cotacaoId }),
  novaCotacao: (pedidoId: string) => chamar<ComEstado<{ cotacao: Cotacao }>>(`/api/pedidos/${pedidoId}/nova-cotacao`, {}),
  emitir: (pedidoId: string, cotacaoId: string) =>
    chamar<ComEstado<{ ordem: OrdemDeCompra }>>(`/api/pedidos/${pedidoId}/emitir`, { cotacaoId }),
  aprovarGestor: (ordemId: string) => chamar<ComEstado<{ ordem: OrdemDeCompra }>>(`/api/compras/${ordemId}/aprovar-gestor`, {}),
  aprovarProposta: (id: string) => chamar<ComEstado<{ proposta: Proposta }>>(`/api/propostas/${id}/aprovar`, {}),
  recusarProposta: (id: string) => chamar<ComEstado<{ proposta: Proposta }>>(`/api/propostas/${id}/recusar`, {}),
  editarProposta: (id: string, mudancas: { cotacaoId?: string | null; quantidades?: Record<string, number> | null }) =>
    chamar<ComEstado<{ proposta: Proposta }>>(`/api/propostas/${id}/editar`, mudancas),
  reiniciar: () => chamar<EstadoServidor>("/api/demo/reiniciar", {}),
  simularCotacao: (pedidoId: string) => chamar<ComEstado<{ cotacao: Cotacao }>>("/api/demo/simular-cotacao", { pedidoId }),
};
