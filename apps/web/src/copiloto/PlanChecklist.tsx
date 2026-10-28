/** Planning: o plano do agente como checklist, marcado conforme o grafo executa. */
import { Check, Circle, Loader2, X } from "lucide-react";
import type { PassoPlano } from "@copiloto/shared";

const ICONE = {
  pendente: <Circle size={16} aria-hidden="true" />,
  executando: <Loader2 size={16} aria-hidden="true" className="girando" />,
  feito: <Check size={16} aria-hidden="true" />,
  falhou: <X size={16} aria-hidden="true" />,
};

export function PlanChecklist({ passos }: { passos: PassoPlano[] }) {
  return (
    <div className="widget">
      <p className="widget__titulo">Plano</p>
      <ol className="plano">
        {passos.map((p) => (
          <li key={p.id} className={`plano__passo plano__passo--${p.status}`}>
            {ICONE[p.status]}
            <span>{p.label}</span>
            <span className="sr-only">({p.status})</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
