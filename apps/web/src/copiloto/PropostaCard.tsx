/**
 * HITL: card da proposta com Aprovar / Editar / Recusar.
 * Aprovar chama o endpoint de ação (ato humano, fora do grafo).
 * Editar abre os campos; a versão editada passa de novo pelo validador.
 */
import { BadgeCheck, Hand, Pencil } from "lucide-react";
import { useState } from "react";
import type { Cotacao, Proposta } from "@copiloto/shared";
import { formatarBRL, totalCotacao } from "@copiloto/shared";
import { ErroApi } from "../api";
import { Alert, Button, Card, TextField } from "../design-system/localiza/components";
import { TextoComCitacoes } from "./RagCitations";

type Props = {
  proposta: Proposta;
  cotacoesDoPedido: Cotacao[];
  aoAprovar: (id: string) => Promise<void>;
  aoRecusar: (id: string) => Promise<void>;
  aoEditar: (id: string, mudancas: { cotacaoId?: string | null; quantidades?: Record<string, number> | null }) => Promise<void>;
};

const ROTULO_STATUS: Record<Proposta["status"], string> = {
  pendente: "Aguardando você",
  aprovada: "Aprovada por você",
  editada: "Editada e aprovada por você",
  recusada: "Recusada",
  "aguardando gestor": "Aprovada por você, aguardando gestor",
};

export function PropostaCard({ proposta, cotacoesDoPedido, aoAprovar, aoRecusar, aoEditar }: Props) {
  const [editando, setEditando] = useState(false);
  const [erros, setErros] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [cotacaoId, setCotacaoId] = useState(proposta.payload.cotacaoId ?? "");
  const cotacaoAtual = cotacoesDoPedido.find((c) => c.numero === cotacaoId);
  const [quantidades, setQuantidades] = useState<Record<string, number>>(
    () => proposta.payload.quantidades ?? Object.fromEntries((cotacaoAtual?.itens ?? []).map((i) => [i.descricao, i.quantidade])),
  );
  const pendente = proposta.status === "pendente";

  const executar = async (acao: () => Promise<void>) => {
    setOcupado(true);
    setErros([]);
    try {
      await acao();
      setEditando(false);
    } catch (e) {
      setErros(e instanceof ErroApi && e.validacao ? e.validacao.erros : [(e as Error).message]);
    } finally {
      setOcupado(false);
    }
  };

  const totalEditado = cotacaoAtual
    ? totalCotacao({ itens: cotacaoAtual.itens.map((i) => ({ ...i, quantidade: quantidades[i.descricao] ?? i.quantidade })), frete: cotacaoAtual.frete })
    : null;

  return (
    <Card variant="outlined" eyebrow={`Proposta ${proposta.id} · ${ROTULO_STATUS[proposta.status]}`} title={proposta.resumo} className="proposta">
      <p className="lz-card__text">
        <TextoComCitacoes texto={proposta.justificativa} />
      </p>
      {proposta.requerGestor ? (
        <p className="selo-alcada">
          <BadgeCheck size={16} aria-hidden="true" /> Acima da alçada de R$ 5.000: depois do seu OK, precisa do gestor.
        </p>
      ) : null}
      {proposta.notasDoCritico.length ? (
        <div className="proposta__notas">
          <p className="widget__titulo">Notas do crítico</p>
          <ul>
            {proposta.notasDoCritico.map((n) => (
              <li key={n}>
                <TextoComCitacoes texto={n} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {editando ? (
        <div className="proposta__edicao">
          {proposta.tipo !== "solicitarNovaCotacao" ? (
            <label className="lz-field">
              <span className="lz-field__label">Cotação</span>
              <select className="select" value={cotacaoId} onChange={(e) => setCotacaoId(e.target.value)}>
                {cotacoesDoPedido
                  .filter((c) => c.status === "respondida")
                  .map((c) => (
                    <option key={c.numero} value={c.numero}>
                      {c.numero} · {formatarBRL(totalCotacao(c))}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
          {proposta.tipo === "emitirOrdemDeCompra" && cotacaoAtual
            ? cotacaoAtual.itens.map((i) => (
                <TextField
                  key={i.descricao}
                  size="md"
                  type="number"
                  min={1}
                  label={`Quantidade: ${i.descricao}`}
                  value={quantidades[i.descricao] ?? i.quantidade}
                  onChange={(e) => setQuantidades((q) => ({ ...q, [i.descricao]: Math.max(1, Number(e.target.value) || 1) }))}
                />
              ))
            : null}
          {totalEditado !== null && proposta.tipo === "emitirOrdemDeCompra" ? (
            <p className="proposta__total">Novo total: {formatarBRL(totalEditado)}</p>
          ) : null}
        </div>
      ) : null}

      {erros.length ? (
        <Alert tone="critical" title="O validador barrou esta ação">
          {erros.join(" ")}
        </Alert>
      ) : null}

      {pendente ? (
        <div className="proposta__botoes">
          {editando ? (
            <>
              <Button
                variant="primary"
                size="sm"
                disabled={ocupado}
                onClick={() =>
                  executar(() =>
                    aoEditar(proposta.id, {
                      cotacaoId: cotacaoId || null,
                      quantidades: proposta.tipo === "emitirOrdemDeCompra" ? quantidades : null,
                    }),
                  )
                }
              >
                Aprovar versão editada
              </Button>
              <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => setEditando(false)}>
                Cancelar edição
              </Button>
            </>
          ) : (
            <>
              <Button variant="primary" size="sm" disabled={ocupado} onClick={() => executar(() => aoAprovar(proposta.id))}>
                <Hand size={16} aria-hidden="true" /> Aprovar
              </Button>
              {proposta.tipo !== "solicitarNovaCotacao" ? (
                <Button variant="outline" size="sm" disabled={ocupado} onClick={() => setEditando(true)}>
                  <Pencil size={16} aria-hidden="true" /> Editar
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => executar(() => aoRecusar(proposta.id))}>
                Recusar
              </Button>
            </>
          )}
        </div>
      ) : null}
    </Card>
  );
}
