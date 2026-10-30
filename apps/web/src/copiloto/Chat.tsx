/**
 * Chat do Copiloto. Cada resposta do agente mostra, a partir dos seus eventos:
 * cadeia de prompts, plano, tarefas em paralelo, pareceres, revisão do crítico,
 * o texto com citações, a proposta (HITL), as opções de escalonamento e o rastro.
 */
import { Bot, Loader2, Lightbulb, SendHorizonal, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AgentEvent, Cotacao, Proposta } from "@copiloto/shared";
import { Alert, Button, IconButton } from "../design-system/localiza/components";
import type { MensagemUI } from "../hooks/useAgentStream";
import { ChainSteps } from "./ChainSteps";
import { OpinionsPanel } from "./OpinionsPanel";
import { ParallelTasks } from "./ParallelTasks";
import { PatternTrail } from "./PatternTrail";
import { PlanChecklist } from "./PlanChecklist";
import { PropostaCard } from "./PropostaCard";
import { TextoComCitacoes } from "./RagCitations";
import { ReflectionRounds } from "./ReflectionRounds";

type Props = {
  mensagens: MensagemUI[];
  propostas: Proposta[];
  cotacoes: Cotacao[];
  ocupado: boolean;
  simulado: boolean;
  enviar: (texto: string) => void;
  usarSimulado: () => void;
  aoAprovar: (id: string) => Promise<void>;
  aoRecusar: (id: string) => Promise<void>;
  aoEditar: (id: string, m: { cotacaoId?: string | null; quantidades?: Record<string, number> | null }) => Promise<void>;
  rodape: React.ReactNode;
};

function filtrar<T extends AgentEvent["type"]>(eventos: AgentEvent[], tipo: T) {
  return eventos.filter((e): e is Extract<AgentEvent, { type: T }> => e.type === tipo);
}

function RespostaAgente({ m, props }: { m: MensagemUI; props: Props }) {
  const elos = filtrar(m.eventos, "chain_step");
  const planos = filtrar(m.eventos, "plan");
  const tarefas = filtrar(m.eventos, "parallel_task");
  const opinioes = filtrar(m.eventos, "agent_opinion");
  const reflexoes = filtrar(m.eventos, "reflection");
  const resumoParalelo = filtrar(m.eventos, "pattern_end").find((e) => e.pattern === "parallelization")?.summary ?? null;
  const proposta = m.proposta ? (props.propostas.find((p) => p.id === m.proposta!.id) ?? m.proposta) : null;
  const ultimoWhy = filtrar(m.eventos, "pattern_start").at(-1);

  return (
    <div className={`msg msg--agente ${m.insight ? "msg--insight" : ""}`}>
      <span className="msg__avatar" aria-hidden="true">
        {m.insight ? <Lightbulb size={18} /> : <Bot size={18} />}
      </span>
      <div className="msg__corpo">
        {m.insight ? <p className="msg__selo">Insight do agente proativo</p> : null}
        {elos.length ? <ChainSteps elos={elos} /> : null}
        {planos.length ? <PlanChecklist passos={planos.at(-1)!.steps} /> : null}
        {tarefas.length ? <ParallelTasks eventos={tarefas} resumo={resumoParalelo} /> : null}
        {opinioes.length ? <OpinionsPanel eventos={opinioes} /> : null}
        {reflexoes.length ? <ReflectionRounds rodadas={reflexoes} /> : null}

        {m.texto ? (
          <div className="msg__texto">
            {m.texto.split("\n\n").map((p, i) => (
              <p key={i}>
                <TextoComCitacoes texto={p} />
              </p>
            ))}
          </div>
        ) : m.emAndamento ? (
          <p className="msg__pensando">
            <Loader2 size={16} className="girando" aria-hidden="true" /> {ultimoWhy ? ultimoWhy.why : "Pensando…"}
          </p>
        ) : null}

        {m.avisos.map((a, i) => (
          <Alert key={i} tone={a.tipo === "error" ? "critical" : "warning"}>
            {a.texto}
            {a.code === "llm_falhou" && !props.simulado ? (
              <>
                {" "}
                <Button variant="outline" size="sm" onClick={props.usarSimulado}>
                  Usar modo simulado
                </Button>
              </>
            ) : null}
          </Alert>
        ))}

        {proposta ? (
          <PropostaCard
            proposta={proposta}
            cotacoesDoPedido={props.cotacoes.filter((c) => c.pedidoId === proposta.payload.pedidoId)}
            aoAprovar={props.aoAprovar}
            aoRecusar={props.aoRecusar}
            aoEditar={props.aoEditar}
          />
        ) : null}

        {m.escalonamento ? (
          <div className="escalonamento" role="group" aria-label="Escolha do comprador">
            <p className="widget__titulo">A decisão é sua</p>
            {m.escalonamento.map((op) => (
              <Button key={op} variant="outline" size="sm" disabled={m.escalonamentoRespondido || props.ocupado} onClick={() => props.enviar(op)}>
                {op}
              </Button>
            ))}
          </div>
        ) : null}

        {!m.emAndamento ? <PatternTrail eventos={m.eventos} /> : null}
      </div>
    </div>
  );
}

export function Chat(props: Props) {
  const [texto, setTexto] = useState("");
  const fim = useRef<HTMLDivElement>(null);
  const ultimo = props.mensagens.at(-1);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [props.mensagens.length, ultimo?.eventos.length, ultimo?.texto]);

  const enviar = () => {
    const t = texto.trim();
    if (!t) return;
    props.enviar(t);
    setTexto("");
  };

  return (
    <div className="chat">
      <div className="chat__mensagens" aria-live="polite">
        {props.mensagens.length === 0 ? (
          <div className="chat__vazio">
            <Bot size={32} aria-hidden="true" />
            <p className="lz-text-heading-sm">Oi! Sou o Cláudio, seu Assistente de Compras.</p>
            <p>Abra um pedido e me pergunte o que quiser. Eu recomendo e preparo propostas, mas nada muda sem a sua aprovação.</p>
          </div>
        ) : null}
        {props.mensagens.map((m) =>
          m.papel === "usuario" ? (
            <div key={m.id} className="msg msg--usuario">
              <span className="msg__avatar" aria-hidden="true">
                <User size={18} />
              </span>
              <div className="msg__corpo">
                <p className="msg__texto">{m.texto}</p>
              </div>
            </div>
          ) : (
            <RespostaAgente key={m.id} m={m} props={props} />
          ),
        )}
        <div ref={fim} />
      </div>
      {props.rodape}
      <form
        className="chat__entrada"
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <label htmlFor="pergunta" className="sr-only">
          Sua pergunta ao Cláudio
        </label>
        <input
          id="pergunta"
          className="chat__campo"
          placeholder="Pergunte ao Cláudio…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoComplete="off"
        />
        <IconButton label="Enviar pergunta" variant="filled" size="sm" type="submit" disabled={!texto.trim()}>
          <SendHorizonal aria-hidden="true" />
        </IconButton>
      </form>
    </div>
  );
}
