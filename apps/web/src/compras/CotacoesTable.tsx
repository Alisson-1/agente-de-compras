import { Info, Sparkles } from "lucide-react";
import type { Cotacao, Fornecedor, RecomendacaoResumo } from "@copiloto/shared";
import { Tooltip } from "../design-system/localiza/components";
import { formatarBRL, totalCotacao, um } from "./formatos";

type Props = {
  cotacoes: Cotacao[];
  fornecedores: Fornecedor[];
  selecionada: string | null;
  recomendacao: RecomendacaoResumo | null;
  bloqueado: boolean;
  aoSelecionar: (cotacaoId: string) => void;
};

export function CotacoesTable({ cotacoes, fornecedores, selecionada, recomendacao, bloqueado, aoSelecionar }: Props) {
  const fornecedor = (id: string) => fornecedores.find((f) => f.id === id);
  return (
    <div className="tabela-rolagem">
      <table className="tabela tabela--cotacoes">
        <caption className="sr-only">Cotações do pedido</caption>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Selecionar</span>
            </th>
            <th scope="col">Fornecedor</th>
            <th scope="col">Status</th>
            <th scope="col">Tipo de peça</th>
            <th scope="col" className="num">
              Total
            </th>
            <th scope="col" className="num">
              Frete
            </th>
            <th scope="col" className="num">
              Prazo
            </th>
            <th scope="col" className="num">
              Garantia
            </th>
            <th scope="col" className="num">
              Nota
            </th>
          </tr>
        </thead>
        <tbody>
          {cotacoes.map((c) => {
            const f = fornecedor(c.fornecedorId);
            const recomendada = recomendacao?.cotacaoId === c.numero;
            const motivo = recomendacao && !recomendada ? recomendacao.ranking.find((r) => r.cotacaoId === c.numero)?.motivo : undefined;
            const tipos = [...new Set(c.itens.map((i) => i.tipo))];
            const selecionavel = c.status !== "pendente" && !bloqueado;
            return (
              <tr
                key={c.numero}
                className={[
                  "linha-cotacao",
                  recomendada ? "linha-cotacao--recomendada" : "",
                  selecionada === c.numero ? "linha-cotacao--selecionada" : "",
                  c.status !== "respondida" ? "linha-cotacao--inativa" : "",
                ].join(" ")}
              >
                <td>
                  <input
                    type="radio"
                    name="cotacao"
                    className="radio"
                    aria-label={`Selecionar ${c.numero}`}
                    checked={selecionada === c.numero}
                    disabled={!selecionavel}
                    onChange={() => aoSelecionar(c.numero)}
                  />
                </td>
                <td>
                  <span className="cotacao-forn">{f?.nome ?? c.fornecedorId}</span>
                  <span className="cotacao-num">
                    {c.numero}
                    {recomendada ? (
                      <span className="selo-recomendada">
                        <Sparkles size={14} aria-hidden="true" /> Recomendada pelo Cláudio
                      </span>
                    ) : null}
                    {motivo ? (
                      <Tooltip content={motivo} className="dica-larga">
                        <button type="button" className="botao-dica" aria-label={`Por que ${c.numero} foi descartada`}>
                          <Info size={16} aria-hidden="true" /> Por que não?
                        </button>
                      </Tooltip>
                    ) : null}
                  </span>
                </td>
                <td>
                  <span className={`status status--${c.status === "respondida" ? "success" : c.status === "pendente" ? "info" : "critical"}`}>
                    {c.status}
                  </span>
                </td>
                <td>
                  {tipos.map((t) => (
                    <span key={t} className={`tipo-peca tipo-peca--${t}`}>
                      {t}
                    </span>
                  ))}
                </td>
                <td className="num forte">{c.status === "pendente" ? "aguardando" : formatarBRL(totalCotacao(c))}</td>
                <td className="num">{c.status === "pendente" ? "-" : formatarBRL(c.frete)}</td>
                <td className="num">{c.status === "pendente" ? "-" : `${c.prazoEntregaHoras}h`}</td>
                <td className="num">{c.status === "pendente" ? "-" : `${c.garantiaMeses} meses`}</td>
                <td className={`num ${f && f.notaQualidade < 3 ? "nota-vetada" : ""}`}>{f ? um(f.notaQualidade) : "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
