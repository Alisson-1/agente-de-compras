import { BadgeCheck, FilePlus2, Inbox, ShoppingCart } from "lucide-react";
import type { OrdemDeCompra, PedidoDeCompra } from "@copiloto/shared";
import { Button } from "../design-system/localiza/components";

type Props = {
  pedido: PedidoDeCompra;
  ordem: OrdemDeCompra | undefined;
  temPendente: boolean;
  ocupado: boolean;
  aoSolicitarCotacao: () => void;
  aoEmitir: () => void;
  aoAprovarGestor: (ordemId: string) => void;
  aoSimularCotacao: () => void;
};

export function AcoesManuais(p: Props) {
  const fechado = ["comprado", "cancelado", "aguardando aprovação do gestor"].includes(p.pedido.status);
  const precisaGestor = p.ordem?.requerGestor && !p.ordem.aprovacoes.gestor;
  return (
    <div className="acoes" role="group" aria-label="Ações manuais">
      <Button variant="primary" disabled={fechado || !p.pedido.cotacaoSelecionadaId || p.ocupado} onClick={p.aoEmitir}>
        <ShoppingCart size={18} aria-hidden="true" /> Emitir ordem de compra
      </Button>
      <Button variant="outline" disabled={fechado || p.ocupado} onClick={p.aoSolicitarCotacao}>
        <FilePlus2 size={18} aria-hidden="true" /> Solicitar nova cotação
      </Button>
      {precisaGestor && p.ordem ? (
        <Button variant="secondary" onClick={() => p.aoAprovarGestor(p.ordem!.numero)} disabled={p.ocupado}>
          <BadgeCheck size={18} aria-hidden="true" /> Aprovar como gestor
          <span className="selo-gestor">Gestor</span>
        </Button>
      ) : null}
      <span className="acoes__separador" aria-hidden="true" />
      <Button variant="ghost" size="sm" disabled={!p.temPendente || p.ocupado} onClick={p.aoSimularCotacao} title="Botão de demo">
        <Inbox size={16} aria-hidden="true" /> Simular chegada de cotação
      </Button>
    </div>
  );
}
