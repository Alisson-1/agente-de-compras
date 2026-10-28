/** Prompt Chaining: os 3 elos (extrair → validar → resumir), cada um com sua saída. */
import type { AgentEvent } from "@copiloto/shared";

type EventoElo = Extract<AgentEvent, { type: "chain_step" }>;

type Extracao = { itens: { descricao: string; quantidade: number; condicional: boolean; trechoOrigem: string }[]; abreviacoesExpandidas: string[] };
type Verificacao = { veiculo: string; itensConferidos: string; divergencias: string[]; observacoes: string[] };

function SaidaElo({ e }: { e: EventoElo }) {
  if (e.step === 1) {
    const o = e.output as Extracao;
    return (
      <ul>
        {o.abreviacoesExpandidas.length ? <li className="elo__nota">Abreviações: {o.abreviacoesExpandidas.join("; ")}</li> : null}
        {o.itens.map((i) => (
          <li key={i.descricao}>
            {i.quantidade}× {i.descricao}
            {i.condicional ? <span className="elo__condicional">condicional</span> : null}
            <span className="elo__origem"> ← “{i.trechoOrigem}”</span>
          </li>
        ))}
      </ul>
    );
  }
  if (e.step === 2) {
    const o = e.output as Verificacao;
    return (
      <ul>
        <li>
          {o.veiculo} · itens conferidos: {o.itensConferidos}
        </li>
        {o.divergencias.map((d) => (
          <li key={d} className="elo__divergencia">
            {d}
          </li>
        ))}
        {o.observacoes.map((d) => (
          <li key={d} className="elo__nota">
            {d}
          </li>
        ))}
        {!o.divergencias.length ? <li>Sem divergências.</li> : null}
      </ul>
    );
  }
  return <p>{(e.output as { resumo: string }).resumo}</p>;
}

export function ChainSteps({ elos }: { elos: EventoElo[] }) {
  return (
    <div className="widget">
      <p className="widget__titulo">Cadeia de prompts</p>
      <ol className="elos">
        {elos.map((e) => (
          <li key={e.step} className="elo">
            <span className="elo__numero" aria-hidden="true">
              {e.step}
            </span>
            <div>
              <p className="elo__nome">{e.name}</p>
              <SaidaElo e={e} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
