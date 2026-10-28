/**
 * TOPOLOGIA DO GRAFO — fonte da verdade.
 *
 * START (mensagem do chat OU evento da tela)
 *   → router                                        [Routing + RAG]
 *       ├─ conceitual      → responde direto com RAG e cita o manual → finalize
 *       ├─ analisarPedido  → chain: extrair → validar → resumir      [Prompt Chaining]
 *       ├─ recomendar      → planner                                  [Planning]
 *       │                     → enriquecer cotações em paralelo       [Parallelization + Tool Use]
 *       │                     → especialistas custo|logística|qualidade (em paralelo) [Multi-Agent + RAG]
 *       │                     → comprador (coordenador) consolida
 *       │                     → confiança baixa? → escalar ao humano  [HITL]
 *       ├─ explicar        → explica a última recomendação ("por que não a mais barata?") com RAG
 *       ├─ proporAcao      → monta Proposta (emitir compra / nova cotação / selecionar) [Tool Use]
 *       ├─ priorizarPedidos→ ordena a fila de pedidos pela política (código) e explica com o manual [Tool Use + RAG]
 *       └─ foraDoEscopo    → recusa educada → finalize
 *   → validate  (determinístico, SEM LLM, política em código)
 *        └─ reprovou → volta ao nó de origem com o erro (máx. 2 tentativas)
 *   → critic    (Reflection: revisa coerência e aderência ao manual)
 *        └─ reprovou recomendação/proposta → volta ao comprador com o feedback (máx. 2 rodadas)
 *   → finalize  (emite a resposta, a Proposta e, se houver, o pedido de escalonamento) → END
 *
 * Detalhes:
 * - Eventos da tela entram pelo mesmo router: pedido_aberto → analisarPedido,
 *   cotacao_selecionada → avaliarSelecao (alerta com validador + RAG + crítico),
 *   cotacao_recebida → avisarCotacao (oferece reavaliar) → finalize.
 * - Recomendação reprovada pelo validador segue para o crítico, que explica a
 *   regra violada com o manual e devolve ao comprador (o crítico é obrigado a
 *   reprovar quando o validador reprova).
 * - Se o planner não acha cotações válidas suficientes, replaneja e segue para
 *   proporAcao com "solicitar nova cotação".
 * - Intenções que dependem de um pedido, sem pedido aberto, vão para semPedido.
 * - Grafo stateless: sem checkpointer. Cada turno recebe histórico e estado da tela.
 */
import { END, START, StateGraph } from "@langchain/langgraph";
import { noAnalisarPedido } from "../patterns/01-prompt-chaining.js";
import { noRouter } from "../patterns/02-routing.js";
import { noEnriquecer } from "../patterns/03-parallelization.js";
import { noCritico } from "../patterns/04-reflection.js";
import { noProporAcao } from "../patterns/05-tool-use.js";
import { noPlanner } from "../patterns/06-planning.js";
import { criarNoEspecialista, noComprador } from "../patterns/07-multi-agent.js";
import { noFinalize } from "../patterns/08-hitl.js";
import {
  noAvaliarSelecao,
  noAvisarCotacao,
  noConceitual,
  noExplicar,
  noForaDoEscopo,
  noPriorizar,
  noSemPedido,
  noValidate,
} from "./nodes.js";
import { depoisDoComprador, depoisDoCritico, depoisDoPlanner, depoisDoRouter, depoisDoValidate } from "./routing.js";
import { EstadoGrafo, type Estado } from "./state.js";

export function buildGraph() {
  return (
    new StateGraph(EstadoGrafo)
      .addNode("router", noRouter)
      .addNode("semPedido", noSemPedido)
      .addNode("conceitual", noConceitual)
      .addNode("analisarPedido", noAnalisarPedido)
      .addNode("planner", noPlanner)
      .addNode("enriquecer", noEnriquecer)
      .addNode("custos", criarNoEspecialista("custos"))
      .addNode("logistica", criarNoEspecialista("logistica"))
      .addNode("qualidade", criarNoEspecialista("qualidade"))
      .addNode("comprador", noComprador)
      .addNode("explicar", noExplicar)
      .addNode("proporAcao", noProporAcao)
      .addNode("avaliarSelecao", noAvaliarSelecao)
      .addNode("avisarCotacao", noAvisarCotacao)
      .addNode("priorizar", noPriorizar)
      .addNode("foraDoEscopo", noForaDoEscopo)
      .addNode("validate", noValidate)
      .addNode("bloquear", async () => ({ bloqueado: true }))
      .addNode("critic", noCritico)
      .addNode("finalize", noFinalize)

      .addEdge(START, "router")
      .addConditionalEdges("router", depoisDoRouter, [
        "semPedido",
        "conceitual",
        "analisarPedido",
        "planner",
        "explicar",
        "proporAcao",
        "avaliarSelecao",
        "avisarCotacao",
        "priorizar",
        "foraDoEscopo",
      ])

      // Respostas diretas
      .addEdge("semPedido", "finalize")
      .addEdge("conceitual", "finalize")
      .addEdge("foraDoEscopo", "finalize")
      .addEdge("avisarCotacao", "finalize")

      // Recomendar: planner → enriquecer → 3 especialistas em paralelo → comprador
      .addConditionalEdges("planner", depoisDoPlanner, ["enriquecer", "proporAcao"])
      .addEdge("enriquecer", "custos")
      .addEdge("enriquecer", "logistica")
      .addEdge("enriquecer", "qualidade")
      .addEdge(["custos", "logistica", "qualidade"], "comprador")
      .addConditionalEdges("comprador", depoisDoComprador, ["validate", "finalize"])

      // Tudo que produz rascunho passa pelo validador
      .addEdge("analisarPedido", "validate")
      .addEdge("explicar", "validate")
      .addEdge("avaliarSelecao", "validate")
      .addEdge("proporAcao", "validate")
      .addEdge("priorizar", "validate")
      .addConditionalEdges("validate", depoisDoValidate, [
        "critic",
        "proporAcao",
        "analisarPedido",
        "explicar",
        "avaliarSelecao",
        "priorizar",
        "bloquear",
        "finalize",
      ])
      .addEdge("bloquear", "finalize")
      .addConditionalEdges("critic", depoisDoCritico, ["finalize", "comprador", "proporAcao"])
      .addEdge("finalize", END)
      .compile()
  );
}

/** Estado inicial de um turno (o grafo não guarda nada entre turnos). */
export function estadoInicial(): Partial<Estado> {
  return {
    intent: null,
    motivoRota: "",
    ragChunks: [],
    plano: [],
    replanejado: false,
    idsCandidatas: [],
    candidatas: [],
    decisao: null,
    rascunho: null,
    origem: "",
    validacao: null,
    tentativasValidacao: 0,
    rodadaCritica: 0,
    feedbackCritico: null,
    reprovadas: [],
    notasCritico: [],
    aprovadoPeloCritico: false,
    escalonamento: null,
    bloqueado: false,
  };
}
