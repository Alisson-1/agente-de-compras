import { tool } from "@langchain/core/tools";
import { totalCotacao, type PedidoDeCompra } from "@copiloto/shared";
import { z } from "zod";
import { store } from "../data/store.js";
import { cotacaoElegivel } from "../validator/rules.js";

const ORDEM_URGENCIA = { urgente: 0, normal: 1, rotina: 2 } as const;

/** Próximo passo do comprador em cada pedido (regra fixa, sem LLM). */
function proximoPasso(p: PedidoDeCompra, pendentes: number, temOrdem: boolean): string {
  if (p.status === "comprado") return "nada a fazer: já comprado";
  if (p.status === "cancelado") return "nada a fazer: cancelado";
  if (p.status === "aguardando aprovação do gestor") return "cobrar a aprovação do gestor";
  if (!temOrdem && p.cotacaoSelecionadaId) return `emitir a ordem de compra da ${p.cotacaoSelecionadaId}`;
  if (pendentes > 0 && p.urgencia === "rotina") return "dá para esperar a cotação pendente";
  return "pedir a recomendação e emitir a compra";
}

export function listarPedidosDados() {
  const custoDia = store.politica.custoCarroParadoPorDia;
  return [...store.pedidos.values()].map((p) => {
    const cotacoes = store.cotacoesDoPedido(p.numero);
    const elegiveis = cotacoes.filter(cotacaoElegivel);
    const pendentes = cotacoes.filter((c) => c.status === "pendente").length;
    const parado = p.os.veiculo.status === "parado na oficina";
    return {
      numero: p.numero,
      veiculo: `${p.os.veiculo.modelo} ${p.os.veiculo.placa}`,
      local: `${p.os.localizacao.cidade}/${p.os.localizacao.uf}`,
      urgencia: p.urgencia,
      status: p.status,
      carroParado: parado,
      diasParado: p.os.diasParado,
      custoParadoAteAgora: parado ? p.os.diasParado * custoDia : 0,
      temItemDeSeguranca: p.itens.some((i) => i.itemDeSeguranca),
      cotacoesRespondidas: cotacoes.filter((c) => c.status === "respondida").length,
      cotacoesPendentes: pendentes,
      menorTotalElegivel: elegiveis.length ? Math.min(...elegiveis.map(totalCotacao)) : null,
      proximoPasso: proximoPasso(p, pendentes, !!store.ordemDoPedido(p.numero)),
    };
  });
}

export type ResumoPedido = ReturnType<typeof listarPedidosDados>[number];

/**
 * Ordem de prioridade pela política (Manual §3.3 e §3.2), em código:
 * pedidos abertos antes dos fechados; urgente (carro parado) antes de normal e
 * rotina; item de segurança antes; mais dias parado antes.
 */
export function ordenarPorPrioridade(pedidos: ResumoPedido[]): ResumoPedido[] {
  const fechado = (p: ResumoPedido) => (["comprado", "cancelado"].includes(p.status) ? 1 : 0);
  return [...pedidos].sort(
    (a, b) =>
      fechado(a) - fechado(b) ||
      ORDEM_URGENCIA[a.urgencia] - ORDEM_URGENCIA[b.urgencia] ||
      Number(b.temItemDeSeguranca) - Number(a.temItemDeSeguranca) ||
      b.diasParado - a.diasParado,
  );
}

export const listarPedidos = tool(async () => JSON.stringify(listarPedidosDados()), {
  name: "listarPedidos",
  description:
    "Lista todos os pedidos de compra com urgência, status, dias de carro parado, custo de carro parado até agora, item de segurança, situação das cotações e o próximo passo. Somente leitura.",
  schema: z.object({}),
});

export function resumirListarPedidos(r: ResumoPedido[]): string {
  const abertos = r.filter((p) => !["comprado", "cancelado"].includes(p.status));
  return `${r.length} pedidos, ${abertos.length} em aberto, ${abertos.filter((p) => p.carroParado).length} com carro parado`;
}
