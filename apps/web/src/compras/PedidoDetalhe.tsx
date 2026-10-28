import { Car, ClipboardList, MapPin, ShieldAlert, Wrench } from "lucide-react";
import type { Oficina, PedidoDeCompra } from "@copiloto/shared";
import { ROTULO_URGENCIA } from "./formatos";

type Props = { pedido: PedidoDeCompra; oficina: Oficina | undefined };

export function PedidoDetalhe({ pedido, oficina }: Props) {
  const { os } = pedido;
  const parado = os.veiculo.status === "parado na oficina";
  return (
    <section className="detalhe" aria-label={`Detalhe do pedido ${pedido.numero}`}>
      <div className="detalhe__topo">
        <h2 className="lz-text-heading-lg detalhe__titulo">{pedido.numero}</h2>
        <span className={pedido.urgencia === "urgente" ? "badge-urgente" : "badge-urgencia"}>{ROTULO_URGENCIA[pedido.urgencia]}</span>
      </div>

      <div className="detalhe__grade">
        <div className="info-bloco">
          <p className="info-bloco__rotulo">
            <Car size={16} aria-hidden="true" /> Veículo
          </p>
          <p className="info-bloco__valor">
            {os.veiculo.modelo} · {os.veiculo.ano}
          </p>
          <p className="info-bloco__apoio">
            Placa {os.veiculo.placa} · {os.veiculo.km.toLocaleString("pt-BR")} km
          </p>
          <span className={`status status--${parado ? "critical" : "success"}`}>{os.veiculo.status}</span>
        </div>

        <div className="info-bloco">
          <p className="info-bloco__rotulo">
            <MapPin size={16} aria-hidden="true" /> Onde o carro está
          </p>
          <p className="info-bloco__valor">
            {os.localizacao.cidade}/{os.localizacao.uf}
          </p>
          <p className="info-bloco__apoio">
            {os.localizacao.tipo}: {os.localizacao.nome}
          </p>
          <p className="info-bloco__apoio">{parado ? `Parado há ${os.diasParado} dia(s)` : "Em operação"}</p>
        </div>

        <div className="info-bloco">
          <p className="info-bloco__rotulo">
            <ClipboardList size={16} aria-hidden="true" /> Ordem de serviço
          </p>
          <p className="info-bloco__valor">{os.numero}</p>
          <p className="info-bloco__apoio">Aberta em {new Date(`${os.dataAbertura}T12:00:00`).toLocaleDateString("pt-BR")}</p>
          <p className="info-bloco__apoio">
            <Wrench size={14} aria-hidden="true" /> {oficina?.nome ?? os.oficinaId}
          </p>
        </div>
      </div>

    </section>
  );
}

/** Diagnóstico da oficina (texto livre) e itens pedidos. */
export function PedidoItens({ pedido }: { pedido: PedidoDeCompra }) {
  const { os } = pedido;
  return (
    <section className="detalhe-itens" aria-label="Itens e diagnóstico">
      <div className="diagnostico">
        <p className="info-bloco__rotulo">Diagnóstico da oficina</p>
        <p className="diagnostico__texto">“{os.diagnostico}”</p>
      </div>

      <table className="tabela tabela--itens">
        <caption className="sr-only">Itens pedidos</caption>
        <thead>
          <tr>
            <th scope="col">Item pedido</th>
            <th scope="col">Código</th>
            <th scope="col">Categoria</th>
            <th scope="col" className="num">
              Qtd.
            </th>
          </tr>
        </thead>
        <tbody>
          {pedido.itens.map((i) => (
            <tr key={i.descricao}>
              <td>
                {i.descricao}
                {i.itemDeSeguranca ? (
                  <span className="selo-seguranca">
                    <ShieldAlert size={14} aria-hidden="true" /> Item de segurança
                  </span>
                ) : null}
              </td>
              <td>{i.codigoPeca ?? "sem código"}</td>
              <td>{i.categoria}</td>
              <td className="num">{i.quantidade}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
