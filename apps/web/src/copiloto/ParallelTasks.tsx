/** Parallelization: as tarefas simultâneas e o tempo total versus o sequencial. */
import { Check, Loader2 } from "lucide-react";
import type { AgentEvent } from "@copiloto/shared";

type EventoTarefa = Extract<AgentEvent, { type: "parallel_task" }>;

export function ParallelTasks({ eventos, resumo }: { eventos: EventoTarefa[]; resumo: string | null }) {
  const tarefas = new Map<string, { label: string; concluida: boolean; durationMs?: number }>();
  for (const e of eventos) {
    tarefas.set(e.taskId, { label: e.label, concluida: e.status === "concluida", durationMs: e.durationMs });
  }
  const max = Math.max(1, ...[...tarefas.values()].map((t) => t.durationMs ?? 0));
  return (
    <div className="widget">
      <p className="widget__titulo">Tarefas em paralelo ({tarefas.size})</p>
      <ul className="tarefas">
        {[...tarefas.entries()].map(([id, t]) => (
          <li key={id} className="tarefa">
            {t.concluida ? <Check size={16} aria-hidden="true" /> : <Loader2 size={16} aria-hidden="true" className="girando" />}
            <span className="tarefa__label">{t.label}</span>
            <span className="tarefa__barra" aria-hidden="true">
              <span style={{ width: `${t.concluida ? ((t.durationMs ?? 0) / max) * 100 : 100}%` }} className={t.concluida ? "" : "pulsando"} />
            </span>
            <span className="tarefa__ms">{t.concluida ? `${t.durationMs} ms` : "rodando"}</span>
          </li>
        ))}
      </ul>
      {resumo ? <p className="widget__rodape">{resumo}</p> : null}
    </div>
  );
}
