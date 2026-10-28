/** Reflection: "Rodada 1: reprovado porque... → Rodada 2: aprovado". */
import { CheckCircle2, XCircle } from "lucide-react";
import type { AgentEvent } from "@copiloto/shared";
import { TextoComCitacoes } from "./RagCitations";

type EventoReflexao = Extract<AgentEvent, { type: "reflection" }>;

export function ReflectionRounds({ rodadas }: { rodadas: EventoReflexao[] }) {
  return (
    <div className="widget">
      <p className="widget__titulo">Revisão do crítico</p>
      <ol className="rodadas">
        {rodadas.map((r) => (
          <li key={r.round} className={`rodada rodada--${r.approved ? "ok" : "reprovada"}`}>
            {r.approved ? <CheckCircle2 size={18} aria-hidden="true" /> : <XCircle size={18} aria-hidden="true" />}
            <span>
              <strong>
                Rodada {r.round}: {r.approved ? "aprovado" : "reprovado"}
              </strong>{" "}
              <TextoComCitacoes texto={r.feedback.replace(/^(Aprovado|Reprovado):\s*/, "")} />
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
