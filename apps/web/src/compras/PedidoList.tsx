/** Tela 1: listagem dos pedidos de compra, com o que pesa na prioridade. */
import { AlertTriangle, ChevronRight, ShieldAlert } from "lucide-react";
import type { PedidoDeCompra } from "@copiloto/shared";
import { ROTULO_URGENCIA, tomDoStatus } from "./formatos";

type Props = {
  pedidos: PedidoDeCompra[];
  aoAbrir: (pedidoId: string) => void;
};

export function PedidoList({ pedidos, aoAbrir }: Props) {
  return (
    <section className="lista" aria-label="Pedidos de compra">
      <h2 className="lz-text-heading-lg lista__titulo">Pedidos de compra</h2>
      <div className="tabela-rolagem">
        <table className="tabela tabela--pedidos">
          <caption className="sr-only">Pedidos de compra</caption>
          <thead>
            <tr>
              <th scope="col">Pedido</th>
              <th scope="col">Veículo e local</th>
              <th scope="col">Urgência</th>
              <th scope="col">Itens</th>
              <th scope="col">Situação</th>
              <th scope="col">
                <span className="sr-only">Abrir</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => {
              const parado = p.os.veiculo.status === "parado na oficina";
              return (
                <tr key={p.numero} className="linha-pedido" onClick={() => aoAbrir(p.numero)}>
                  <td>
                    <span className="linha-pedido__numero">{p.numero}</span>
                    <span className="linha-pedido__apoio">{p.os.numero}</span>
                  </td>
                  <td>
                    <span className="linha-pedido__forte">{p.os.veiculo.modelo}</span>
                    <span className="linha-pedido__apoio">
                      {p.os.veiculo.placa} · {p.os.localizacao.cidade}/{p.os.localizacao.uf}
                    </span>
                    <span className="linha-pedido__apoio">{p.os.localizacao.nome}</span>
                  </td>
                  <td>
                    {p.urgencia === "urgente" ? (
                      <span className="badge-urgente" title={ROTULO_URGENCIA.urgente}>
                        <AlertTriangle size={14} aria-hidden="true" /> Urgente
                      </span>
                    ) : (
                      <span className="badge-urgencia">{ROTULO_URGENCIA[p.urgencia]}</span>
                    )}
                    {parado ? <span className="linha-pedido__forte">parado há {p.os.diasParado} dia(s)</span> : null}
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
    </section>
  );
}
