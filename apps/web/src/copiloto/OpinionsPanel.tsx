/** Multi-Agent: os 3 pareceres lado a lado e a decisão do comprador (coordenador). */
import { Gauge, ShieldCheck, Truck, Wallet } from "lucide-react";
import type { AgentEvent, DecisaoComprador, ParecerEspecialista } from "@copiloto/shared";
import { Citacao } from "./RagCitations";

type EventoOpiniao = Extract<AgentEvent, { type: "agent_opinion" }>;

const ESPECIALISTAS = [
  { id: "custos", nome: "Custos", icone: <Wallet size={16} aria-hidden="true" /> },
  { id: "logistica", nome: "Logística", icone: <Truck size={16} aria-hidden="true" /> },
  { id: "qualidade", nome: "Qualidade", icone: <ShieldCheck size={16} aria-hidden="true" /> },
] as const;

const um = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function OpinionsPanel({ eventos }: { eventos: EventoOpiniao[] }) {
  const parecer = (id: string) => eventos.find((e) => e.agent === id)?.content as ParecerEspecialista | undefined;
  const decisoes = eventos.filter((e) => e.agent === "comprador").map((e) => e.content as DecisaoComprador);
  return (
    <div className="widget">
      <p className="widget__titulo">Pareceres dos especialistas</p>
      <div className="pareceres">
        {ESPECIALISTAS.map((esp) => {
          const p = parecer(esp.id);
          return (
            <div key={esp.id} className="parecer">
              <p className="parecer__nome">
                {esp.icone} {esp.nome}
              </p>
              {p ? (
                <ul>
                  {[...p.avaliacoes]
                    .sort((a, b) => b.nota - a.nota)
                    .map((a) => (
                      <li key={a.cotacaoId}>
                        <span className="parecer__linha">
                          <span className="parecer__cot">{a.cotacaoId.replace(/^COT-\d{4}-/, "")}</span>
                          <span className="nota-barra" aria-hidden="true">
                            <span style={{ width: `${a.nota * 10}%` }} />
                          </span>
                          <span className="parecer__nota">{um(a.nota)}</span>
                        </span>
                        <span className="parecer__texto">
                          {a.parecer} {a.citacao ? <Citacao secao={a.citacao} /> : null}
                        </span>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="parecer__aguardando">analisando…</p>
              )}
            </div>
          );
        })}
      </div>
      {decisoes.map((d) => (
        <p key={d.rodada} className="decisao">
          <Gauge size={16} aria-hidden="true" />
          <span>
            <strong>Comprador, rodada {d.rodada}:</strong>{" "}
            {d.escolhida ? `escolheu ${d.escolhida}.` : "não decidiu (baixa confiança)."} Pesos: custos {Math.round(d.pesos.custos * 100)}%,
            logística {Math.round(d.pesos.logistica * 100)}%, qualidade {Math.round(d.pesos.qualidade * 100)}%.
          </span>
        </p>
      ))}
    </div>
  );
}
