/**
 * Envia turnos ao agente (POST /api/agente/turno) e lê o stream SSE de AgentEvent.
 *
 * Cada turno vira uma mensagem do agente que acumula seus eventos (os widgets
 * do chat são derivados deles). Também mantém as estatísticas da faixa de
 * padrões: usos na sessão, padrões em uso agora e a frase "why" mais recente.
 * Os turnos entram numa fila: um evento de tela que chega durante uma resposta
 * espera a vez.
 */
import { useCallback, useRef, useState } from "react";
import type { AgentEvent, EstadoTela, EventoTela, MensagemChat, PatternId, Proposta } from "@copiloto/shared";
import { HEADER_CHAVE_LLM } from "@copiloto/shared";
import type { Configuracoes } from "./useSettings";

export type Aviso = { tipo: "warning" | "error"; texto: string; code?: string };

export type MensagemUI = {
  id: string;
  papel: "usuario" | "agente";
  texto: string;
  citacoes: string[];
  /** Reação a um evento da tela (agente proativo). */
  insight: boolean;
  eventos: AgentEvent[];
  emAndamento: boolean;
  proposta: Proposta | null;
  escalonamento: string[] | null;
  escalonamentoRespondido: boolean;
  avisos: Aviso[];
  pedidoId: string | null;
};

export type Ativo = { chave: string; pattern: PatternId; node: string; why: string };

export type EstatisticasPadroes = {
  usos: Partial<Record<PatternId, number>>;
  ativos: Ativo[];
  ultimo: Ativo | null;
};

type Entrada = { mensagem?: string; evento?: EventoTela };
type Contexto = () => { tela: EstadoTela; config: Configuracoes };

let seq = 0;
const novoId = () => `m${Date.now()}-${++seq}`;

function novaMensagem(papel: MensagemUI["papel"], parcial: Partial<MensagemUI> = {}): MensagemUI {
  return {
    id: novoId(),
    papel,
    texto: "",
    citacoes: [],
    insight: false,
    eventos: [],
    emAndamento: false,
    proposta: null,
    escalonamento: null,
    escalonamentoRespondido: false,
    avisos: [],
    pedidoId: null,
    ...parcial,
  };
}

/** Aplica um evento à mensagem do agente (imutável). */
function aplicar(m: MensagemUI, e: AgentEvent): MensagemUI {
  const eventos = [...m.eventos, e];
  switch (e.type) {
    case "message":
      return {
        ...m,
        eventos,
        texto: m.texto ? `${m.texto}\n\n${e.text}` : e.text,
        citacoes: [...new Set([...m.citacoes, ...(e.citations ?? [])])],
      };
    case "hitl":
      if (e.kind === "escalonamento") return { ...m, eventos, escalonamento: e.opcoes ?? [] };
      if (e.kind === "proposta" && e.proposta) return { ...m, eventos, proposta: e.proposta };
      return { ...m, eventos };
    case "warning":
    case "error":
      return { ...m, eventos, avisos: [...m.avisos, { tipo: e.type, texto: e.message, code: e.code }] };
    case "done":
      return { ...m, eventos, emAndamento: false };
    default:
      return { ...m, eventos };
  }
}

export function useAgentStream(obterContexto: Contexto, aoTerminar: (m: MensagemUI) => void) {
  const [mensagens, setMensagens] = useState<MensagemUI[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [stats, setStats] = useState<EstatisticasPadroes>({ usos: {}, ativos: [], ultimo: null });
  const fila = useRef<Entrada[]>([]);
  const processando = useRef(false);
  const historico = useRef<MensagemChat[]>([]);
  const refs = useRef({ obterContexto, aoTerminar });
  refs.current = { obterContexto, aoTerminar };

  const rodarTurno = useCallback(async (entrada: Entrada) => {
    const { tela, config } = refs.current.obterContexto();
    if (entrada.mensagem) {
      const doUsuario = novaMensagem("usuario", { texto: entrada.mensagem });
      setMensagens((ms) => [...ms.map((m) => (m.escalonamento ? { ...m, escalonamentoRespondido: true } : m)), doUsuario]);
    }
    let atual = novaMensagem("agente", {
      emAndamento: true,
      insight: !!entrada.evento,
      pedidoId: entrada.evento?.pedidoId ?? tela.pedidoId,
    });
    setMensagens((ms) => [...ms, atual]);
    const atualizar = (e: AgentEvent) => {
      atual = aplicar(atual, e);
      const snapshot = atual;
      setMensagens((ms) => ms.map((m) => (m.id === snapshot.id ? snapshot : m)));
    };

    const usadosNoTurno = new Set<PatternId>();
    const processarEvento = (e: AgentEvent) => {
      atualizar(e);
      if (e.type === "pattern_start") {
        const ativo: Ativo = { chave: `${e.pattern}:${e.node}:${e.ts}`, pattern: e.pattern, node: e.node, why: e.why };
        const primeiraVez = !usadosNoTurno.has(e.pattern);
        usadosNoTurno.add(e.pattern);
        setStats((s) => ({
          usos: primeiraVez ? { ...s.usos, [e.pattern]: (s.usos[e.pattern] ?? 0) + 1 } : s.usos,
          ativos: [...s.ativos, ativo],
          ultimo: ativo,
        }));
      } else if (e.type === "pattern_end") {
        setStats((s) => {
          const idx = s.ativos.map((a) => `${a.pattern}:${a.node}`).lastIndexOf(`${e.pattern}:${e.node}`);
          return idx < 0 ? s : { ...s, ativos: s.ativos.filter((_, i) => i !== idx) };
        });
      }
    };

    try {
      const resposta = await fetch("/api/agente/turno", {
        method: "POST",
        headers: { "Content-Type": "application/json", [HEADER_CHAVE_LLM]: config.simulado ? "" : config.chave },
        body: JSON.stringify({
          historico: historico.current.slice(-10),
          mensagem: entrada.mensagem ?? null,
          evento: entrada.evento ?? null,
          tela,
          config: { provedor: config.provedor, modelo: config.modelo, simulado: config.simulado, velocidadeMs: config.velocidadeMs },
        }),
      });
      if (!resposta.ok || !resposta.body) throw new Error(`A API respondeu ${resposta.status}.`);
      const leitor = resposta.body.getReader();
      const decodificador = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await leitor.read();
        if (done) break;
        buffer += decodificador.decode(value, { stream: true });
        const blocos = buffer.split("\n\n");
        buffer = blocos.pop() ?? "";
        for (const bloco of blocos) {
          const linha = bloco.split("\n").find((l) => l.startsWith("data: "));
          if (linha) processarEvento(JSON.parse(linha.slice(6)) as AgentEvent);
        }
      }
    } catch (erro) {
      atualizar({ type: "error", message: `Não consegui falar com a API: ${(erro as Error).message}. Ela está rodando?` });
    } finally {
      if (atual.emAndamento) atualizar({ type: "done" });
      setStats((s) => ({ ...s, ativos: [] }));
      if (entrada.mensagem) historico.current.push({ papel: "usuario", texto: entrada.mensagem });
      if (atual.texto) historico.current.push({ papel: "agente", texto: atual.texto });
      refs.current.aoTerminar(atual);
    }
  }, []);

  const processarFila = useCallback(async () => {
    if (processando.current) return;
    processando.current = true;
    setOcupado(true);
    while (fila.current.length) {
      await rodarTurno(fila.current.shift()!);
    }
    processando.current = false;
    setOcupado(false);
  }, [rodarTurno]);

  const enviar = useCallback(
    (entrada: Entrada) => {
      fila.current.push(entrada);
      void processarFila();
    },
    [processarFila],
  );

  const limpar = useCallback(() => {
    setMensagens([]);
    setStats({ usos: {}, ativos: [], ultimo: null });
    historico.current = [];
  }, []);

  return { mensagens, ocupado, stats, enviar, limpar };
}
