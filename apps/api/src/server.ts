/**
 * API do Copiloto de Compras (Fastify).
 *
 * - GETs de leitura (pedidos, cotações, fornecedores, estado completo, manual).
 * - Ações manuais da Tela de Compras (passam pelo validador em código).
 * - Endpoints de ação das propostas do agente: SÓ humanos chamam (Aprovar/Editar/Recusar).
 * - POST /api/agente/turno: roda o grafo e responde em SSE (AgentEvent).
 */
import cors from "@fastify/cors";
import Fastify, { type FastifyReply } from "fastify";
import { HEADER_CHAVE_LLM, TurnoRequest, type AgentEvent } from "@copiloto/shared";
import {
  aprovarComoGestor,
  aprovarProposta,
  editarProposta,
  emitirOrdemDeCompra,
  ErroDeAcao,
  recusarProposta,
  selecionarCotacao,
  simularChegadaDeCotacao,
  solicitarNovaCotacao,
} from "./data/acoes.js";
import { store } from "./data/store.js";
import { Emissor } from "./events/emitter.js";
import { buildGraph, estadoInicial } from "./graph/buildGraph.js";
import { FalhaLlm, type Contexto } from "./graph/contexto.js";
import { criarModelo } from "./llm/provider.js";
import { aquecerRag, secoesDoManual } from "./rag/search.js";
import { validarCotacao } from "./validator/rules.js";

const PORTA = Number(process.env.PORT ?? 3333);
const app = Fastify({ logger: { level: "warn" } });
await app.register(cors, { origin: true });

const grafo = buildGraph();

function estadoCompleto() {
  return {
    pedidos: [...store.pedidos.values()],
    cotacoes: [...store.cotacoes.values()],
    fornecedores: [...store.fornecedores.values()],
    oficinas: [...store.oficinas.values()],
    ordens: [...store.ordens.values()],
    propostas: [...store.propostas.values()],
    politica: store.politica,
  };
}

app.setErrorHandler((erro, _req, reply) => {
  if (erro instanceof ErroDeAcao) {
    return reply.status(erro.status).send({ erro: erro.message, validacao: erro.validacao ?? null });
  }
  app.log.error(erro);
  return reply.status(500).send({ erro: (erro as Error).message });
});

/* ---------- Leitura ---------- */

app.get("/api/estado", async () => estadoCompleto());
app.get("/api/pedidos", async () => [...store.pedidos.values()]);
app.get<{ Params: { id: string } }>("/api/pedidos/:id", async (req, reply) => {
  const pedido = store.pedidos.get(req.params.id);
  if (!pedido) return reply.status(404).send({ erro: "Pedido não encontrado." });
  return { pedido, cotacoes: store.cotacoesDoPedido(pedido.numero), ordem: store.ordemDoPedido(pedido.numero) ?? null };
});
app.get<{ Querystring: { pedidoId?: string } }>("/api/cotacoes", async (req) =>
  req.query.pedidoId ? store.cotacoesDoPedido(req.query.pedidoId) : [...store.cotacoes.values()],
);
app.get("/api/fornecedores", async () => [...store.fornecedores.values()]);
app.get("/api/manual", async () => secoesDoManual());

/** Pré-checagem da política (a web usa para avisar antes de emitir). */
app.post<{ Body: { pedidoId: string; cotacaoId: string } }>("/api/validar", async (req) => {
  const pedido = store.pedidos.get(req.body.pedidoId);
  const cotacao = store.cotacoes.get(req.body.cotacaoId);
  if (!pedido || !cotacao) throw new ErroDeAcao("Pedido ou cotação não encontrados.", 404);
  return validarCotacao({ pedido, cotacao, modo: "compra" });
});

/* ---------- Ações manuais (Tela de Compras) ---------- */

app.post<{ Params: { id: string }; Body: { cotacaoId: string } }>("/api/pedidos/:id/selecionar", async (req) => ({
  validacao: selecionarCotacao(req.params.id, req.body.cotacaoId),
  estado: estadoCompleto(),
}));

app.post<{ Params: { id: string }; Body: { fornecedorId?: string | null } }>("/api/pedidos/:id/nova-cotacao", async (req) => ({
  cotacao: solicitarNovaCotacao(req.params.id, req.body?.fornecedorId),
  estado: estadoCompleto(),
}));

app.post<{ Params: { id: string }; Body: { cotacaoId: string; justificativa?: string } }>("/api/pedidos/:id/emitir", async (req) => ({
  ordem: emitirOrdemDeCompra({
    pedidoId: req.params.id,
    cotacaoId: req.body.cotacaoId,
    origem: "manual",
    justificativa: req.body.justificativa?.trim() || "Emitida manualmente pelo comprador.",
    padroesUsados: [],
  }),
  estado: estadoCompleto(),
}));

app.post<{ Params: { id: string } }>("/api/compras/:id/aprovar-gestor", async (req) => ({
  ordem: aprovarComoGestor(req.params.id),
  estado: estadoCompleto(),
}));

/* ---------- Propostas do agente: só humanos chamam ---------- */

app.post<{ Params: { id: string } }>("/api/propostas/:id/aprovar", async (req) => ({
  ...aprovarProposta(req.params.id),
  estado: estadoCompleto(),
}));
app.post<{ Params: { id: string } }>("/api/propostas/:id/recusar", async (req) => ({
  ...recusarProposta(req.params.id),
  estado: estadoCompleto(),
}));
app.post<{ Params: { id: string }; Body: { cotacaoId?: string | null; quantidades?: Record<string, number> | null } }>(
  "/api/propostas/:id/editar",
  async (req) => ({ ...editarProposta(req.params.id, req.body ?? {}), estado: estadoCompleto() }),
);

/* ---------- Demo ---------- */

app.post("/api/demo/reiniciar", async () => {
  store.reset();
  return estadoCompleto();
});
app.post<{ Body: { pedidoId: string } }>("/api/demo/simular-cotacao", async (req) => ({
  cotacao: simularChegadaDeCotacao(req.body.pedidoId),
  estado: estadoCompleto(),
}));

/* ---------- Turno do agente (SSE) ---------- */

function abrirSse(reply: FastifyReply) {
  reply.hijack();
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  return (evento: AgentEvent) => {
    if (!reply.raw.writableEnded) reply.raw.write(`data: ${JSON.stringify(evento)}\n\n`);
  };
}

app.post("/api/agente/turno", async (req, reply) => {
  const corpo = TurnoRequest.safeParse(req.body);
  if (!corpo.success) return reply.status(400).send({ erro: "Requisição inválida.", detalhes: corpo.error.issues });
  const turno = corpo.data;

  const escrever = abrirSse(reply);
  const emissor = new Emissor(escrever, turno.config.velocidadeMs);
  reply.raw.on("close", () => emissor.fechar());

  const finalizar = async () => {
    await emissor.emit({ type: "done" });
    await emissor.drenar();
    reply.raw.end();
  };

  const chave = String(req.headers[HEADER_CHAVE_LLM] ?? "").trim();
  if (!turno.config.simulado && !chave) {
    await emissor.emit({
      type: "warning",
      code: "llm_falhou",
      message: "Informe a chave do provedor nas configurações ou ligue o modo simulado.",
    });
    return finalizar();
  }

  const pedidoId = turno.evento?.pedidoId ?? turno.tela.pedidoId;
  const ctx: Contexto = {
    req: turno,
    emissor,
    simulado: turno.config.simulado,
    modelo: turno.config.simulado ? null : criarModelo(turno.config, chave),
    pedido: pedidoId ? (store.pedidos.get(pedidoId) ?? null) : null,
  };

  try {
    await grafo.invoke(estadoInicial(), { configurable: { ctx }, recursionLimit: 50 });
  } catch (e) {
    if (e instanceof FalhaLlm) {
      await emissor.emit({
        type: "warning",
        code: "llm_falhou",
        message: `${e.message.slice(0, 300)} Quer trocar para o modo simulado?`,
      });
    } else {
      app.log.error(e);
      await emissor.emit({ type: "error", message: `Erro no turno: ${(e as Error).message}` });
    }
  }
  return finalizar();
});

aquecerRag();
await app.listen({ port: PORTA, host: "0.0.0.0" });
console.log(`API do Copiloto de Compras em http://localhost:${PORTA}`);
