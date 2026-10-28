/**
 * Emissor de AgentEvent para o stream SSE de um turno.
 *
 * - Serializa os eventos numa fila (a ordem na tela é a ordem de emissão).
 * - Respeita a "velocidade da demo": depois de cada evento-marco espera o atraso
 *   configurado (0 a 3 s), para a plateia acompanhar. Eventos de detalhe
 *   (pattern_end, trace, tool_call, parallel_task...) saem sem atraso.
 * - Registra quais padrões o turno usou (vão para a Proposta / Ordem de Compra).
 */
import type { AgentEvent, PatternId } from "@copiloto/shared";

const MARCOS = new Set<AgentEvent["type"]>([
  "pattern_start",
  "route",
  "chain_step",
  "plan",
  "agent_opinion",
  "validation",
  "reflection",
  "hitl",
  "message",
]);

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Emissor {
  private fila: Promise<void> = Promise.resolve();
  private fechado = false;
  readonly padroesUsados = new Set<PatternId>();

  constructor(
    private escrever: (evento: AgentEvent) => void,
    private atrasoMs: number,
  ) {}

  /** Enfileira o evento. Aguarde o retorno para "andar no ritmo" da demo. */
  emit(evento: AgentEvent): Promise<void> {
    if (evento.type === "pattern_start") this.padroesUsados.add(evento.pattern);
    this.fila = this.fila.then(async () => {
      if (this.fechado) return;
      this.escrever(evento);
      if (this.atrasoMs > 0 && MARCOS.has(evento.type)) await dormir(this.atrasoMs);
    });
    return this.fila;
  }

  drenar(): Promise<void> {
    return this.fila;
  }

  fechar(): void {
    this.fechado = true;
  }
}

/**
 * Envolve um trecho de código num padrão: emite pattern_start (com a frase `why`
 * para a plateia), roda, e emite pattern_end com o resumo e a duração.
 */
export async function comPadrao<T>(
  emissor: Emissor,
  pattern: PatternId,
  node: string,
  why: string,
  fn: () => Promise<T>,
  resumir: (resultado: T) => string,
): Promise<T> {
  const inicio = Date.now();
  await emissor.emit({ type: "pattern_start", pattern, node, why, ts: inicio });
  const resultado = await fn();
  const fim = Date.now();
  await emissor.emit({
    type: "pattern_end",
    pattern,
    node,
    summary: resumir(resultado),
    durationMs: fim - inicio,
    ts: fim,
  });
  return resultado;
}
