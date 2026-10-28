/**
 * Rastro de padrões no fim de cada resposta, ex.:
 * "Routing → RAG → Planning → Parallelization (3) → Multi-Agent → Reflection ✓ → HITL".
 * Clicável: expande e mostra os eventos daquele turno.
 */
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { AgentEvent, PatternId } from "@copiloto/shared";
import { PADROES } from "@copiloto/shared";
import { BuscaRag } from "./RagCitations";

const nome = (p: PatternId) => PADROES.find((x) => x.id === p)?.nome ?? p;

export function textoDoRastro(eventos: AgentEvent[]): string {
  const ordem: PatternId[] = [];
  for (const e of eventos) if (e.type === "pattern_start" && !ordem.includes(e.pattern)) ordem.push(e.pattern);
  const tarefas = new Set(eventos.filter((e) => e.type === "parallel_task" && e.taskId.startsWith("enr-")).map((e) => (e as { taskId: string }).taskId));
  const reflexoes = eventos.filter((e): e is Extract<AgentEvent, { type: "reflection" }> => e.type === "reflection");
  return ordem
    .map((p) => {
      if (p === "parallelization" && tarefas.size) return `${nome(p)} (${tarefas.size})`;
      if (p === "reflection" && reflexoes.length) return `${nome(p)} ${reflexoes.map((r) => (r.approved ? "✓" : "✗")).join("→")}`;
      return nome(p);
    })
    .join(" → ");
}

function LinhaEvento({ e }: { e: AgentEvent }) {
  switch (e.type) {
    case "pattern_start":
      return (
        <>
          <strong>▶ {nome(e.pattern)}</strong> <span className="ev__no">[{e.node}]</span> {e.why}
        </>
      );
    case "pattern_end":
      return (
        <>
          <strong>■ {nome(e.pattern)}</strong> <span className="ev__no">[{e.node}]</span> {e.summary} · {e.durationMs} ms
        </>
      );
    case "route":
      return (
        <>
          <strong>Rota:</strong> {e.intent}. {e.reason}
        </>
      );
    case "rag_retrieval":
      return <BuscaRag query={e.query} chunks={e.chunks} />;
    case "tool_call":
      return (
        <>
          <strong>Ferramenta</strong> {e.tool}({JSON.stringify(e.args)}) → {e.resultSummary}
        </>
      );
    case "parallel_task":
      return (
        <>
          <strong>Tarefa</strong> {e.label}: {e.status}
          {e.durationMs ? ` em ${e.durationMs} ms` : ""}
        </>
      );
    case "validation":
      return (
        <>
          <strong>Validador em código:</strong> {e.ok ? "ok" : `reprovou: ${e.errors.join(" ")}`}
        </>
      );
    case "reflection":
      return (
        <>
          <strong>Crítico, rodada {e.round}:</strong> {e.feedback}
        </>
      );
    case "chain_step":
      return (
        <>
          <strong>Elo {e.step}:</strong> {e.name}
        </>
      );
    case "plan":
      return (
        <>
          <strong>Plano:</strong> {e.steps.map((s) => `${s.label} (${s.status})`).join(" · ")}
        </>
      );
    case "agent_opinion":
      return (
        <>
          <strong>Parecer</strong> de {e.agent}
        </>
      );
    case "hitl":
      return (
        <>
          <strong>HITL:</strong> {e.kind}
          {e.proposta ? ` · ${e.proposta.id} ${e.proposta.resumo}` : ""}
          {e.opcoes ? ` · opções: ${e.opcoes.join(" | ")}` : ""}
        </>
      );
    case "trace":
      return (
        <>
          <strong>Trace</strong> {e.node}: {e.latencyMs} ms{e.tokens ? ` · ${e.tokens.input} tokens in / ${e.tokens.output} out` : " · simulado"}
        </>
      );
    case "message":
      return (
        <>
          <strong>Mensagem</strong> ({e.text.length} caracteres)
        </>
      );
    case "warning":
    case "error":
      return (
        <>
          <strong>{e.type === "error" ? "Erro" : "Aviso"}:</strong> {e.message}
        </>
      );
    case "done":
      return <strong>Fim do turno</strong>;
  }
}

export function PatternTrail({ eventos }: { eventos: AgentEvent[] }) {
  const [aberto, setAberto] = useState(false);
  const texto = textoDoRastro(eventos);
  if (!texto) return null;
  const tokens = eventos.reduce(
    (s, e) => (e.type === "trace" && e.tokens ? { i: s.i + e.tokens.input, o: s.o + e.tokens.output } : s),
    { i: 0, o: 0 },
  );
  return (
    <div className="rastro">
      <button type="button" className="rastro__linha" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
        {aberto ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
        <span>{texto}</span>
      </button>
      {aberto ? (
        <div className="rastro__eventos">
          {tokens.i ? (
            <p className="rastro__tokens">
              Tokens do turno: {tokens.i.toLocaleString("pt-BR")} de entrada, {tokens.o.toLocaleString("pt-BR")} de saída
            </p>
          ) : null}
          <ol>
            {eventos.map((e, i) => (
              <li key={i} className={`ev ev--${e.type}`}>
                <LinhaEvento e={e} />
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
