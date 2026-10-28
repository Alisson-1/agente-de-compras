/**
 * `pnpm ensaio`: ensaio geral da demo no MODO SIMULADO, sem servidor e sem chave.
 * Roda os turnos do roteiro direto no grafo e confere os desfechos esperados dos
 * 4 cenários. Use antes de subir no palco.
 */
import type { AgentEvent, EstadoTela, EventoTela, PatternId, Proposta, RecomendacaoResumo, DecisaoComprador } from "@copiloto/shared";
import { aprovarComoGestor, aprovarProposta, selecionarCotacao, simularChegadaDeCotacao } from "../data/acoes.js";
import { store } from "../data/store.js";
import { Emissor } from "../events/emitter.js";
import { buildGraph, estadoInicial } from "../graph/buildGraph.js";
import type { Contexto } from "../graph/contexto.js";

const grafo = buildGraph();
const usados = new Set<PatternId>();
let falhas = 0;

async function turno(o: { mensagem?: string; evento?: EventoTela; tela: Partial<EstadoTela> }) {
  const eventos: AgentEvent[] = [];
  const emissor = new Emissor((e) => eventos.push(e), 0);
  const tela: EstadoTela = { pedidoId: null, cotacaoSelecionadaId: null, aba: "cotacoes", ultimaRecomendacao: null, ...o.tela };
  const pedidoId = o.evento?.pedidoId ?? tela.pedidoId;
  const ctx: Contexto = {
    req: {
      historico: [],
      mensagem: o.mensagem ?? null,
      evento: o.evento ?? null,
      tela,
      config: { provedor: "anthropic", modelo: "", simulado: true, velocidadeMs: 0 },
    },
    emissor,
    simulado: true,
    modelo: null,
    pedido: pedidoId ? (store.pedidos.get(pedidoId) ?? null) : null,
  };
  await grafo.invoke(estadoInicial(), { configurable: { ctx }, recursionLimit: 50 });
  await emissor.drenar();
  for (const e of eventos) if (e.type === "pattern_start") usados.add(e.pattern);

  const trilha: string[] = [];
  for (const e of eventos) if (e.type === "pattern_start" && trilha.at(-1) !== e.pattern) trilha.push(e.pattern);
  const msg = eventos.filter((e) => e.type === "message").map((e) => (e as { text: string }).text);
  const rotulo = o.mensagem ?? `[evento ${o.evento?.tipo}]`;
  console.log(`\n▶ ${rotulo}\n  trilha: ${trilha.join(" → ")}\n  resposta: ${msg.join(" | ")}`);
  for (const e of eventos) {
    if (e.type === "reflection") console.log(`  reflexão r${e.round}: ${e.approved ? "aprovado" : "REPROVADO"} — ${e.feedback}`);
    if (e.type === "warning" || e.type === "error") console.log(`  ${e.type}: ${e.message}`);
  }
  return eventos;
}

function confere(condicao: boolean, descricao: string) {
  console.log(`  ${condicao ? "✓" : "✗ FALHOU:"} ${descricao}`);
  if (!condicao) falhas += 1;
}

const proposta = (ev: AgentEvent[]) =>
  ev.find((e): e is Extract<AgentEvent, { type: "hitl" }> => e.type === "hitl" && e.kind === "proposta")?.proposta as Proposta | undefined;

function recomendacaoDe(ev: AgentEvent[], pedidoId: string): RecomendacaoResumo | null {
  const decisoes = ev.filter((e) => e.type === "agent_opinion" && e.agent === "comprador").map((e) => (e as { content: DecisaoComprador }).content);
  const d = decisoes.at(-1);
  return d?.escolhida ? { pedidoId, cotacaoId: d.escolhida, justificativa: d.justificativa, ranking: d.ranking } : null;
}

async function main() {
  store.reset();

  console.log("\n===== Conceitual =====");
  let ev = await turno({ mensagem: "O que diz o manual sobre peça paralela?", tela: {} });
  confere(ev.some((e) => e.type === "message" && (e.citations ?? []).length > 0), "resposta cita o manual");
  confere(!ev.some((e) => e.type === "agent_opinion"), "nenhum especialista acionado");

  console.log("\n===== Priorizar a fila =====");
  for (const pergunta of ["Qual pedido devo priorizar?", "qual priorizar"]) {
    ev = await turno({ mensagem: pergunta, tela: { pedidoId: "PED-2026-0412" } });
    const texto = ev.filter((e) => e.type === "message").map((e) => (e as { text: string }).text).join(" ");
    confere(ev.some((e) => e.type === "route" && e.intent === "priorizarPedidos"), `"${pergunta}" vai para priorizarPedidos`);
    confere(texto.startsWith("Comece pelo PED-2026-0412") && texto.indexOf("PED-2026-0418") > texto.indexOf("PED-2026-0425"), "fila na ordem da política");
  }

  console.log("\n===== Cenário 1: freio urgente =====");
  const p1 = "PED-2026-0412";
  ev = await turno({ evento: { tipo: "pedido_aberto", pedidoId: p1 }, tela: { pedidoId: p1 } });
  confere(ev.filter((e) => e.type === "chain_step").length === 3, "3 elos do prompt chaining");
  ev = await turno({ mensagem: "Qual cotação você recomenda?", tela: { pedidoId: p1 } });
  const refl = ev.filter((e) => e.type === "reflection") as Extract<AgentEvent, { type: "reflection" }>[];
  confere(refl[0] && !refl[0].approved && refl[0].feedback.includes("§2.2"), "crítico reprova a 1ª escolha citando §2.2");
  confere(refl[1]?.approved === true, "2ª rodada aprovada");
  const rec1 = recomendacaoDe(ev, p1);
  confere(rec1?.cotacaoId === "COT-0412-C", `recomenda a equilibrada COT-0412-C (veio ${rec1?.cotacaoId})`);
  ev = await turno({ mensagem: "Por que não a mais barata?", tela: { pedidoId: p1, ultimaRecomendacao: rec1 } });
  confere(ev.some((e) => e.type === "message" && e.text.includes("§2.2")), "explica com §2.2");
  const v = selecionarCotacao(p1, "COT-0412-A");
  confere(!v.ok, "selecionar a paralela gera violação no validador");
  ev = await turno({ evento: { tipo: "cotacao_selecionada", pedidoId: p1, cotacaoId: "COT-0412-A" }, tela: { pedidoId: p1, cotacaoSelecionadaId: "COT-0412-A" } });
  confere(ev.some((e) => e.type === "message" && e.text.startsWith("Atenção")), "alerta proativo sobre a paralela");
  ev = await turno({ mensagem: "Emita a compra", tela: { pedidoId: p1, cotacaoSelecionadaId: "COT-0412-A", ultimaRecomendacao: rec1 } });
  confere(!proposta(ev), "não propõe emitir a paralela (validador bloqueia)");
  ev = await turno({ mensagem: "Emita a compra da COT-0412-C", tela: { pedidoId: p1, ultimaRecomendacao: rec1 } });
  const prop1 = proposta(ev);
  confere(prop1?.tipo === "emitirOrdemDeCompra", "proposta de emitir a COT-0412-C");
  if (prop1) {
    confere(store.pedidos.get(p1)!.status === "cotado", "nada muda antes da aprovação humana");
    aprovarProposta(prop1.id);
    confere(store.pedidos.get(p1)!.status === "comprado", "aprovada pelo humano: pedido comprado");
  }

  console.log("\n===== Cenário 2: revisão de rotina =====");
  const p2 = "PED-2026-0418";
  ev = await turno({ mensagem: "Qual cotação você recomenda?", tela: { pedidoId: p2 } });
  confere(ev.some((e) => e.type === "tool_call" && e.tool === "consultarEstoqueInterno"), "consulta o estoque interno");
  const antes = recomendacaoDe(ev, p2)?.cotacaoId;
  const nova = simularChegadaDeCotacao(p2);
  ev = await turno({ evento: { tipo: "cotacao_recebida", pedidoId: p2, cotacaoId: nova.numero }, tela: { pedidoId: p2 } });
  ev = await turno({ mensagem: "Reavaliar a recomendação", tela: { pedidoId: p2 } });
  const depois = recomendacaoDe(ev, p2)?.cotacaoId;
  confere(!!antes && !!depois && antes !== depois, `recomendação muda com a cotação nova (${antes} → ${depois})`);

  console.log("\n===== Cenário 3: alto valor =====");
  const p3 = "PED-2026-0421";
  ev = await turno({ mensagem: "Qual cotação você recomenda?", tela: { pedidoId: p3 } });
  const rec3 = recomendacaoDe(ev, p3);
  ev = await turno({ mensagem: "Emita a compra", tela: { pedidoId: p3, ultimaRecomendacao: rec3 } });
  const prop3 = proposta(ev);
  confere(!!prop3?.requerGestor, "proposta acima da alçada exige gestor");
  confere(ev.some((e) => e.type === "hitl" && e.kind === "alcada"), "evento hitl de alçada");
  if (prop3) {
    const r = aprovarProposta(prop3.id);
    confere(r.proposta.status === "aguardando gestor" && store.pedidos.get(p3)!.status === "aguardando aprovação do gestor", "fica aguardando gestor");
    if ("ordem" in r && r.ordem) aprovarComoGestor(r.ordem.numero);
    confere(store.pedidos.get(p3)!.status === "comprado", "gestor aprova: comprado");
  }

  console.log("\n===== Cenário 4: diagnóstico bagunçado + empate =====");
  const p4 = "PED-2026-0425";
  ev = await turno({ mensagem: "Resuma este pedido", tela: { pedidoId: p4 } });
  const elo1 = ev.find((e) => e.type === "chain_step" && e.step === 1) as Extract<AgentEvent, { type: "chain_step" }> | undefined;
  console.log("  elo 1:", JSON.stringify(elo1?.output));
  confere(ev.filter((e) => e.type === "chain_step").length === 3, "3 elos visíveis");
  ev = await turno({ mensagem: "Qual cotação você recomenda?", tela: { pedidoId: p4 } });
  const esc = ev.find((e) => e.type === "hitl" && e.kind === "escalonamento") as Extract<AgentEvent, { type: "hitl" }> | undefined;
  confere((esc?.opcoes?.length ?? 0) === 2, "empate escala com 2 botões");
  if (esc?.opcoes) {
    ev = await turno({ mensagem: esc.opcoes[0], tela: { pedidoId: p4 } });
    confere(proposta(ev)?.tipo === "selecionarCotacao", "clique vira proposta de seleção");
  }

  console.log("\n===== Fora do escopo =====");
  await turno({ mensagem: "Qual a previsão do tempo amanhã?", tela: {} });

  const faltando = (["prompt-chaining", "routing", "parallelization", "reflection", "tool-use", "planning", "multi-agent", "hitl", "rag"] as PatternId[]).filter(
    (p) => !usados.has(p),
  );
  confere(faltando.length === 0, `os 9 padrões acenderam${faltando.length ? ` (faltou: ${faltando.join(", ")})` : ""}`);
  console.log(falhas === 0 ? "\nEnsaio OK: tudo certo para o palco." : `\nEnsaio com ${falhas} falha(s).`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
