/** Tela 1: listagem dos pedidos de compra, com o que pesa na prioridade. */
import { AlertTriangle, ChevronRight, ShieldAlert } from "lucide-react";
import type { Cotacao, PedidoDeCompra } from "@copiloto/shared";
import { formatarBRL, ROTULO_URGENCIA, tomDoStatus } from "./formatos";

type Props = {
  pedidos: PedidoDeCompra[];
  cotacoes: Cotacao[];
  custoParadoPorDia: number;
  aoAbrir: (pedidoId: string) => void;
};

export function PedidoList({ pedidos, cotacoes, custoParadoPorDia, aoAbrir }: Props) {
  const abertos = pedidos.filter((p) => !["comprado", "cancelado"].includes(p.status));
  const parados = abertos.filter((p) => p.os.veiculo.status === "parado na oficina");
  return (
    <section className="lista" aria-label="Pedidos de compra">
      <div className="lista__topo">
        <h2 className="lz-text-heading-lg lista__titulo">Pedidos de compra</h2>
        <p className="lista__resumo">
          {abertos.length} em aberto · {parados.length} com carro parado
          {parados.length ? (
            <>
              {" "}
              · {formatarBRL(parados.reduce((s, p) => s + p.os.diasParado * custoParadoPorDia, 0))} em locações perdidas até agora
            </>
          ) : null}
        </p>
      </div>
      <div className="tabela-rolagem">
        <table className="tabela tabela--pedidos">
          <caption className="sr-only">Pedidos de compra</caption>
          <thead>
            <tr>
              <th scope="col">Pedido</th>
              <th scope="col">Veículo</th>
              <th scope="col">Onde está</th>
              <th scope="col">Urgência</th>
              <th scope="col" className="num">
                Parado há
              </th>
              <th scope="col">Itens</th>
              <th scope="col">Cotações</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="sr-only">Abrir</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => {
              const doPedido = cotacoes.filter((c) => c.pedidoId === p.numero);
              const respondidas = doPedido.filter((c) => c.status === "respondida").length;
              const pendentes = doPedido.filter((c) => c.status === "pendente").length;
              const parado = p.os.veiculo.status === "parado na oficina";
              return (
                <tr key={p.numero} className="linha-pedido" onClick={() => aoAbrir(p.numero)}>
                  <td>
                    <span className="linha-pedido__numero">{p.numero}</span>
                    <span className="linha-pedido__apoio">{p.os.numero}</span>
                  </td>
                  <td>
                    <span className="linha-pedido__forte">{p.os.veiculo.modelo}</span>
                    <span className="linha-pedido__apoio">{p.os.veiculo.placa}</span>
                  </td>
                  <td>
                    <span className="linha-pedido__forte">
                      {p.os.localizacao.cidade}/{p.os.localizacao.uf}
                    </span>
                    <span className="linha-pedido__apoio">{p.os.localizacao.nome}</span>
                  </td>
                  <td>
                    {p.urgencia === "urgente" ? (
                      <span className="badge-urgente">
                        <AlertTriangle size={14} aria-hidden="true" /> {ROTULO_URGENCIA.urgente}
                      </span>
                    ) : (
                      <span className="badge-urgencia">{ROTULO_URGENCIA[p.urgencia]}</span>
                    )}
                  </td>
                  <td className="num">
                    {parado ? (
                      <>
                        <span className="linha-pedido__forte">{p.os.diasParado} dia(s)</span>
                        <span className="linha-pedido__apoio">{formatarBRL(p.os.diasParado * custoParadoPorDia)}</span>
                      </>
                    ) : (
                      <span className="linha-pedido__apoio">rodando</span>
                    )}
                  </td>
                  <td>
                    <span className="linha-pedido__forte">
                      {p.itens.length} {p.itens.length === 1 ? "item" : "itens"} · {p.itens[0].categoria}
                    </span>
                    {p.itens.some((i) => i.itemDeSeguranca) ? (
                      <span className="selo-seguranca selo-seguranca--bloco">
                        <ShieldAlert size={14} aria-hidden="true" /> Item de segurança
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <span className="linha-pedido__forte">{respondidas} respondida(s)</span>
                    {pendentes ? <span className="linha-pedido__apoio">{pendentes} pendente(s)</span> : null}
                  </td>
                  <td>
                    <span className={`status status--${tomDoStatus(p.status)}`}>{p.status}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="botao-abrir"
                      onClick={(e) => {
                        e.stopPropagation();
                        aoAbrir(p.numero);
                      }}
                    >
                      Abrir <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="lista__dica">Não sabe por onde começar? Pergunte ao Copiloto: "Qual pedido devo priorizar?"</p>
    </section>
  );
}
