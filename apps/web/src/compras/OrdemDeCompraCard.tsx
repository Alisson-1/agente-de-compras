import { Bot, CheckCircle2, Clock, User } from "lucide-react";
import type { OrdemDeCompra } from "@copiloto/shared";
import { PADROES } from "@copiloto/shared";
import { Card } from "../design-system/localiza/components";
import { formatarBRL } from "./formatos";

export function OrdemDeCompraCard({ ordem }: { ordem: OrdemDeCompra }) {
  const gestorPendente = ordem.requerGestor && !ordem.aprovacoes.gestor;
  const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  return (
    <Card eyebrow="Ordem de compra emitida" title={`${ordem.numero} · ${formatarBRL(ordem.valorTotal)}`} className="oc-card">
      <p className="lz-card__text">
        Cotação {ordem.cotacaoId} ·{" "}
        <span className={`origem origem--${ordem.origem}`}>
          {ordem.origem === "agente" ? <Bot size={14} aria-hidden="true" /> : <User size={14} aria-hidden="true" />}
          Origem: {ordem.origem === "agente" ? "agente (aprovada por você)" : "manual"}
        </span>
      </p>
      <p className="lz-card__text oc-card__just">{ordem.justificativa}</p>
      <ul className="oc-card__aprovacoes">
        <li>
          <CheckCircle2 size={16} aria-hidden="true" /> Comprador: aprovado em {quando(ordem.aprovacoes.comprador.em)}
        </li>
        {ordem.requerGestor ? (
          <li className={gestorPendente ? "pendente" : ""}>
            {gestorPendente ? <Clock size={16} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
            Gestor: {gestorPendente ? "aguardando aprovação (acima da alçada de R$ 5.000)" : `aprovado em ${quando(ordem.aprovacoes.gestor!.em)}`}
          </li>
        ) : null}
      </ul>
      {ordem.padroesUsados.length ? (
        <p className="oc-card__padroes">
          Padrões usados:{" "}
          {ordem.padroesUsados.map((p) => (
            <span key={p} className="mini-chip">
              {PADROES.find((x) => x.id === p)?.nome ?? p}
            </span>
          ))}
        </p>
      ) : null}
    </Card>
  );
}
