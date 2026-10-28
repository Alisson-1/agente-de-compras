/**
 * MODO SIMULADO: respostas roteirizadas e determinísticas para os nós LLM.
 *
 * Reserva para o palco: sem chave e sem internet, a demo continua igual.
 * Só os nós LLM são simulados; ferramentas, validador, RAG, paralelismo e
 * eventos continuam reais. Toda resposta é montada a partir dos dados-semente
 * e dos trechos do manual recuperados (nada de números inventados).
 */
import type {
  ChunkRag,
  Intent,
  ParecerEspecialista,
  PedidoDeCompra,
  RecomendacaoResumo,
  ResultadoValidacao,
  TipoProposta,
  Urgencia,
} from "@copiloto/shared";
import { formatarBRL } from "@copiloto/shared";
import type { CotacaoEnriquecida, Especialista, Rascunho } from "../graph/state.js";
import { normalizar } from "../rag/search.js";
import type { ResumoPedido } from "../tools/listarPedidos.js";

const um = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function primeiraFrase(texto: string, n = 1): string {
  const frases = texto.replace(/\s+/g, " ").match(/[^.!?]+[.!?]/g) ?? [texto];
  return frases.slice(0, n).join(" ").trim();
}

/** Frase do trecho que mais combina com as palavras dadas. */
function fraseRelevante(texto: string, palavras: string[]): string {
  const frases = texto.replace(/\s+/g, " ").match(/[^.!?]+[.!?]/g) ?? [texto];
  let melhor = frases[0];
  let pontos = -1;
  for (const f of frases) {
    const fn = normalizar(f);
    const p = palavras.filter((w) => fn.includes(normalizar(w))).length;
    if (p > pontos) {
      melhor = f;
      pontos = p;
    }
  }
  return melhor.trim();
}

/* ---------------- Router ---------------- */

export function router(mensagem: string): { intent: Exclude<Intent, "avaliarSelecao" | "avisarCotacao">; reason: string } {
  const m = normalizar(mensagem);
  const tem = (...ps: string[]) => ps.some((p) => m.includes(p));
  if (tem("prioriz", "qual pedido", "mais urgente", "por onde comec", "primeiro", "fila de pedidos", "quais pedidos"))
    return { intent: "priorizarPedidos", reason: "Pergunta sobre a fila de pedidos: ordeno todos pela política de urgência." };
  if (tem("por que", "porque", "por q ", "explique", "explica", "motivo"))
    return { intent: "explicar", reason: "A pergunta pede o porquê de uma decisão: vou explicar com o manual." };
  if (tem("emit", "compre", "comprar", "fechar a compra", "nova cotacao", "solicit", "escolho", "prefiro", "selecion", "fico com"))
    return { intent: "proporAcao", reason: "Pedido de ação que muda dados: vira proposta para você aprovar." };
  if (tem("recomend", "qual cotacao", "melhor cotacao", "reavali", "sugere", "indica", "qual devo"))
    return { intent: "recomendar", reason: "Pedido de recomendação: precisa de plano, ferramentas e especialistas." };
  if (tem("manual", "o que diz", "o que e ", "politica", "regra", "alcada", "permitid", "pode usar"))
    return { intent: "conceitual", reason: "Pergunta conceitual sobre o processo: respondo direto com o manual." };
  if (tem("resum", "analis", "pedido", "itens", "diagnost"))
    return { intent: "analisarPedido", reason: "Pedido de leitura do pedido: cadeia extrair → validar → resumir." };
  return { intent: "foraDoEscopo", reason: "Fora dos cenários preparados do modo simulado." };
}

/* ---------------- Prompt Chaining ---------------- */

const ABREVIACOES: [RegExp, string, string][] = [
  [/\bsusp\./gi, "suspensão", "susp. → suspensão"],
  [/\bdir\./gi, "direito", "dir. → direito"],
  [/\besq\./gi, "esquerdo", "esq. → esquerdo"],
  [/\bdiant\./gi, "dianteiro", "diant. → dianteiro"],
  [/\btras\./gi, "traseiro", "tras. → traseiro"],
];

export function chainExtrair(pedido: PedidoDeCompra) {
  const original = pedido.os.diagnostico;
  const abreviacoesExpandidas: string[] = [];
  let expandido = original;
  for (const [re, por, nota] of ABREVIACOES) {
    if (re.test(expandido)) abreviacoesExpandidas.push(nota);
    expandido = expandido.replace(re, por);
  }
  const clausulas = expandido.split(/[,;]/).map((c) => c.trim());
  const diag = normalizar(expandido);

  const itens = pedido.itens.map((i) => {
    const chave = normalizar(i.descricao.split(" ")[0]).slice(0, 5);
    const clausula = clausulas.find((c) => normalizar(c).includes(chave));
    return { descricao: i.descricao, quantidade: i.quantidade, condicional: false, trechoOrigem: clausula ?? "lista de itens do pedido" };
  });

  const posicao = `${diag.includes("diant") ? " dianteiro" : ""}${/lado direito|direito/.test(diag) ? " direito" : ""}`;
  for (const m of expandido.matchAll(/\b(ver|verificar|checar|avaliar)\s+(?:o |a )?([a-zà-ú]+)/gi)) {
    const peca = m[2].toLowerCase();
    if (itens.some((i) => normalizar(i.descricao).includes(normalizar(peca).slice(0, 5)))) continue;
    itens.push({
      descricao: `${peca[0].toUpperCase()}${peca.slice(1)}${posicao}`,
      quantidade: 1,
      condicional: true,
      trechoOrigem: m[0],
    });
  }
  return { itens, abreviacoesExpandidas };
}

export function chainResumir(entrada: {
  pedido: PedidoDeCompra;
  oficina: string;
  divergencias: string[];
  observacoes: string[];
  cotacoes: { respondidas: number; pendentes: number; expiradas: number };
}): { resumo: string } {
  const { pedido, oficina, divergencias, observacoes, cotacoes } = entrada;
  const v = pedido.os.veiculo;
  const onde = `${oficina} (${pedido.os.localizacao.cidade}/${pedido.os.localizacao.uf})`;
  const parado = v.status === "parado na oficina" ? `parado há ${pedido.os.diasParado} dia(s) em ${onde}` : `rodando, serviço em ${onde}`;
  const seg = pedido.itens.some((i) => i.itemDeSeguranca) ? ", com item de segurança" : "";
  const itens = pedido.itens.map((i) => `${i.quantidade}× ${i.descricao.toLowerCase()}`).join(", ");
  const partes = [
    `${pedido.numero} (${pedido.os.numero}): ${v.modelo} ${v.placa}, ${parado}.`,
    `Pedido ${pedido.urgencia}${seg}: ${itens}.`,
    `Cotações: ${cotacoes.respondidas} respondida(s), ${cotacoes.pendentes} pendente(s), ${cotacoes.expiradas} expirada(s).`,
  ];
  if (observacoes.length) partes.push(observacoes[0]);
  if (divergencias.length) partes.push(`Atenção: ${divergencias[0]}`);
  return { resumo: partes.join(" ") };
}

/* ---------------- Planning ---------------- */

export function planner(pedido: PedidoDeCompra) {
  const seg = pedido.itens.some((i) => i.itemDeSeguranca);
  return {
    passos: [
      { id: "manual" as const, label: `Consultar o manual sobre ${seg ? "itens de segurança e " : ""}pedido ${pedido.urgencia}` },
      { id: "listar" as const, label: "Listar as cotações válidas do pedido" },
      { id: "enriquecer" as const, label: "Enriquecer cada cotação (fornecedor, rota, estoque)" },
      { id: "especialistas" as const, label: "Ouvir os especialistas de custos, logística e qualidade" },
      { id: "consolidar" as const, label: "Consolidar os pareceres com pesos da urgência" },
      { id: "revisar" as const, label: "Revisar com o crítico antes de propor" },
    ],
    justificativa:
      pedido.urgencia === "urgente"
        ? "Carro parado: preciso checar prazo e segurança antes de olhar preço."
        : "Sem carro parado: posso pesar preço com mais força, sem abrir mão da política.",
  };
}

/* ---------------- Especialistas (Multi-Agent) ---------------- */

/** Notas heurísticas de 0 a 10, por critério. Mesma régua que os prompts descrevem. */
export function notasHeuristicas(tipo: Especialista, c: CotacaoEnriquecida, todas: CotacaoEnriquecida[], urgencia: Urgencia): number {
  if (tipo === "custos") {
    const min = Math.min(...todas.map((x) => x.custoEfetivo));
    return Math.max(0, 10 * (1 - (0.8 * (c.custoEfetivo - min)) / min));
  }
  if (tipo === "logistica") {
    let n = (Math.max(0, Math.min(10, 10 - c.prazoHoras / 8)) * c.entregasNoPrazoPct) / 100;
    if (urgencia === "urgente" && c.prazoHoras > 24) n = Math.min(n, 2);
    return n;
  }
  if (c.itens.some((i) => i.itemDeSeguranca && i.tipo === "paralela")) return 0;
  const tipoNota = Math.min(...c.itens.map((i) => ({ original: 10, homologada: 8.5, paralela: 5 })[i.tipo]));
  return (
    0.4 * tipoNota +
    0.2 * ((Math.min(c.garantiaMeses, 12) / 12) * 10) +
    0.3 * c.notaFornecedor * 2 +
    0.1 * Math.max(0, 10 - c.taxaDevolucaoPct)
  );
}

export function especialista(tipo: Especialista, candidatas: CotacaoEnriquecida[], pedido: PedidoDeCompra): ParecerEspecialista {
  const urgente = pedido.urgencia === "urgente";
  return {
    avaliacoes: candidatas.map((c) => {
      const nota = Math.round(notasHeuristicas(tipo, c, candidatas, pedido.urgencia) * 10) / 10;
      let parecer = "";
      let citacao: string | null = null;
      if (tipo === "custos") {
        const parado = urgente ? c.custoEfetivo - (c.total - c.economiaEstoque) : 0;
        parecer = `Total ${formatarBRL(c.total)}`;
        if (c.economiaEstoque > 0) {
          parecer += `, menos ${formatarBRL(c.economiaEstoque)} cobertos pelo estoque interno`;
          citacao = "§6.3";
        }
        if (parado > 0) {
          parecer += `, mais ${formatarBRL(parado)} de carro parado (${c.prazoHoras}h)`;
          citacao = "§3.2";
        }
        parecer += `: custo efetivo ${formatarBRL(c.custoEfetivo)}.`;
      } else if (tipo === "logistica") {
        parecer = `Entrega em ${c.prazoHoras}h, ${c.entregasNoPrazoPct}% de entregas no prazo (risco ${c.riscoAtraso}).`;
        if (urgente && c.prazoHoras > 24) {
          parecer += " Passa das 24h exigidas para carro parado.";
          citacao = "§3.1";
        } else if (c.entregasNoPrazoPct < 90) {
          citacao = "§5.3";
        }
      } else {
        const seg = c.itens.find((i) => i.itemDeSeguranca && i.tipo === "paralela");
        if (seg) {
          parecer = `Peça paralela em item de segurança (${seg.descricao.toLowerCase()}): o manual proíbe.`;
          citacao = "§2.2";
        } else {
          parecer = `Peça ${c.tipos.join("/")}, garantia de ${c.garantiaMeses} meses, fornecedor nota ${um(c.notaFornecedor)}.`;
          if (c.taxaDevolucaoPct > 5) {
            parecer += ` Devolução alta (${um(c.taxaDevolucaoPct)}%).`;
            citacao = "§5.4";
          } else if (c.tipos.includes("paralela")) {
            citacao = "§2.3";
          }
        }
      }
      return { cotacaoId: c.cotacaoId, nota, parecer, citacao };
    }),
  };
}

/* ---------------- Comprador (coordenador) ---------------- */

type Ranqueada = { cotacaoId: string; nota: number; c: CotacaoEnriquecida };

export function comprador(entrada: {
  pedido: PedidoDeCompra;
  ranking: Ranqueada[];
  feedback: string | null;
  reprovadas: string[];
  pesosTexto: string;
}): { cotacaoId: string; justificativa: string } {
  const { pedido, ranking, feedback, reprovadas, pesosTexto } = entrada;
  const disponiveis = ranking.filter((r) => !reprovadas.includes(r.cotacaoId));
  const lista = disponiveis.length ? disponiveis : ranking;

  // Rodada 1 em pedido urgente: o comprador "tende" ao menor custo efetivo entre as que chegam em 24h.
  if (!feedback && pedido.urgencia === "urgente") {
    const rapidas = lista.filter((r) => r.c.prazoHoras <= 24).sort((a, b) => a.c.custoEfetivo - b.c.custoEfetivo);
    const escolhida = rapidas[0] ?? lista[0];
    return {
      cotacaoId: escolhida.cotacaoId,
      justificativa: `Carro parado custa R$ 180 por dia: priorizei o menor custo efetivo entre as cotações que chegam em até 24h. ${escolhida.cotacaoId} (${escolhida.c.fornecedor}) sai por ${formatarBRL(escolhida.c.total)} e entrega em ${escolhida.c.prazoHoras}h.`,
    };
  }

  const melhor = lista[0];
  const segundo = lista[1];
  const vantagem = segundo ? ` A segunda colocada, ${segundo.cotacaoId}, ficou com ${um(segundo.nota)}.` : "";
  const acatando = feedback ? `Acatei o crítico e descartei ${reprovadas.join(", ")}. ` : "";
  return {
    cotacaoId: melhor.cotacaoId,
    justificativa: `${acatando}Recomendo ${melhor.cotacaoId} (${melhor.c.fornecedor}): peça ${melhor.c.tipos.join("/")}, ${formatarBRL(melhor.c.total)}, entrega em ${melhor.c.prazoHoras}h e garantia de ${melhor.c.garantiaMeses} meses. Teve a maior nota consolidada (${um(melhor.nota)}) com pesos ${pesosTexto}.${vantagem}`,
  };
}

/* ---------------- Crítico (Reflection) ---------------- */

export function critico(entrada: {
  rascunho: Rascunho;
  validacao: ResultadoValidacao | null;
  chunks: ChunkRag[];
  notaEscolhida?: number;
}): { aprovado: boolean; feedback: string; citacoes: string[] } {
  const { rascunho, validacao, chunks } = entrada;
  if (validacao && !validacao.ok) {
    const regra = validacao.regras[0];
    const chunk = chunks.find((c) => c.section === regra?.secaoManual);
    const erro = validacao.erros[0].replace(/\s*\(Manual §[\d.]+\)/, "");
    const trecho = chunk ? ` O Manual §${chunk.section} diz: "${fraseRelevante(chunk.text, ["paralela", "proibida", "24 horas", "vetado", "expirada", "mínimo"])}"` : "";
    return {
      aprovado: false,
      feedback: `Reprovado: ${erro}${trecho} A justificativa priorizou preço e deixou essa regra de lado. Escolha outra cotação.`,
      citacoes: regra ? [`§${regra.secaoManual}`] : [],
    };
  }
  const secao = chunks[0]?.section;
  const citacoes = secao ? [`§${secao}`] : [];
  switch (rascunho.tipo) {
    case "recomendacao":
      return {
        aprovado: true,
        feedback: `Aprovado: ${rascunho.cotacaoId} cumpre a política (validador ok) e a justificativa bate com os números${entrada.notaEscolhida ? ` (nota consolidada ${um(entrada.notaEscolhida)})` : ""}.`,
        citacoes,
      };
    case "proposta":
      return {
        aprovado: true,
        feedback: rascunho.proposta?.requerGestor
          ? "Aprovado: proposta dentro da política. Passa da alçada, então vai precisar do gestor (§1.2)."
          : "Aprovado: proposta dentro da política e da alçada do comprador.",
        citacoes: rascunho.proposta?.requerGestor ? ["§1.2"] : citacoes,
      };
    default:
      return { aprovado: true, feedback: "Aprovado: o texto só cita dados que existem no pedido, nas cotações e no manual.", citacoes: [] };
  }
}

/* ---------------- Conceitual (RAG) ---------------- */

export function conceitual(pergunta: string, chunks: ChunkRag[]): { resposta: string; citacoes: string[] } {
  if (chunks.length === 0) return { resposta: "Não achei nada sobre isso no Manual de Compras.", citacoes: [] };
  const palavras = normalizar(pergunta).split(/\W+/).filter((w) => w.length > 3);
  const [a, b] = chunks;
  const partes = [`Segundo o Manual de Compras §${a.section}: ${fraseRelevante(a.text.replace(/^[^.]+\.\s*/, ""), palavras)}`];
  const citacoes = [`§${a.section}`];
  if (b && b.score > a.score * 0.7) {
    partes.push(`E o §${b.section} complementa: ${fraseRelevante(b.text.replace(/^[^.]+\.\s*/, ""), palavras)}`);
    citacoes.push(`§${b.section}`);
  }
  return { resposta: partes.join(" "), citacoes };
}

/* ---------------- Explicar ---------------- */

export function explicar(entrada: {
  maisBarata: { cotacaoId: string; fornecedor: string; total: number; validacao: ResultadoValidacao };
  recomendacao: RecomendacaoResumo | null;
  chunks: ChunkRag[];
}): { texto: string; citacoes: string[] } {
  const { maisBarata, recomendacao, chunks } = entrada;
  const citacoes: string[] = [];
  let texto = `A mais barata é ${maisBarata.cotacaoId} (${maisBarata.fornecedor}, ${formatarBRL(maisBarata.total)}).`;
  if (!maisBarata.validacao.ok) {
    const regra = maisBarata.validacao.regras[0];
    const chunk = chunks.find((c) => c.section === regra.secaoManual) ?? chunks[0];
    texto += ` Mas ela não pode ser comprada: ${maisBarata.validacao.erros[0].replace(/\s*\(Manual §[\d.]+\)/, "")}`;
    if (chunk) {
      texto += ` O Manual §${chunk.section} é claro: "${fraseRelevante(chunk.text, ["paralela", "proibida", "24 horas", "vetado", "expirada"])}"`;
      citacoes.push(`§${chunk.section}`);
    }
  } else {
    const linha = recomendacao?.ranking.find((r) => r.cotacaoId === maisBarata.cotacaoId);
    texto += ` Ela está dentro da política, mas perdeu na soma dos critérios${linha ? `: ${linha.motivo}` : ""}.`;
    if (chunks[0]) {
      texto += ` O Manual §${chunks[0].section} lembra: "${primeiraFrase(chunks[0].text.replace(/^[^.]+\.\s*/, ""))}"`;
      citacoes.push(`§${chunks[0].section}`);
    }
  }
  if (recomendacao && recomendacao.cotacaoId !== maisBarata.cotacaoId) {
    texto += ` Por isso recomendei ${recomendacao.cotacaoId}.`;
  } else if (!recomendacao) {
    texto += " Quer que eu faça a recomendação completa?";
  }
  return { texto, citacoes };
}

/* ---------------- Priorizar a fila de pedidos ---------------- */

export function priorizar(fila: ResumoPedido[], chunks: ChunkRag[]): { texto: string; citacoes: string[] } {
  const abertos = fila.filter((p) => !["comprado", "cancelado"].includes(p.status));
  if (abertos.length === 0) return { texto: "Todos os pedidos já foram comprados. Nada a priorizar agora.", citacoes: [] };

  const motivo = (p: ResumoPedido) => {
    const partes: string[] = [];
    if (p.carroParado) partes.push(`carro parado há ${p.diasParado} dia(s) (${formatarBRL(p.custoParadoAteAgora)} em locações perdidas até agora)`);
    else partes.push(p.urgencia === "rotina" ? "rotina, carro rodando" : "carro rodando");
    if (p.temItemDeSeguranca) partes.push("item de segurança");
    if (p.status === "aguardando aprovação do gestor") partes.push("compra parada no gestor");
    return partes.join(", ");
  };
  const primeiro = abertos[0];
  const linhas = fila.map((p, i) =>
    ["comprado", "cancelado"].includes(p.status)
      ? `${i + 1}. ${p.numero}: ${p.status}. Nada a fazer.`
      : `${i + 1}. ${p.numero} (${p.veiculo}, ${p.local}): ${motivo(p)}. Próximo passo: ${p.proximoPasso}.`,
  );
  const citacoes: string[] = [];
  let regra = "";
  const c33 = chunks.find((c) => c.section === "3.3");
  const c32 = chunks.find((c) => c.section === "3.2");
  if (c33) {
    regra += ` O Manual §3.3 diz: "${fraseRelevante(c33.text, ["urgente", "prioridade"])}"`;
    citacoes.push("§3.3");
  }
  if (c32) {
    regra += ` E cada dia parado custa caro (§3.2).`;
    citacoes.push("§3.2");
  }
  return {
    texto: [`Comece pelo ${primeiro.numero}: ${motivo(primeiro)}.${regra}`, ...linhas].join("\n\n"),
    citacoes,
  };
}

/* ---------------- Alerta de seleção ---------------- */

export function alerta(entrada: { cotacaoId: string; validacao: ResultadoValidacao; chunks: ChunkRag[] }): {
  texto: string;
  citacoes: string[];
} {
  const { cotacaoId, validacao, chunks } = entrada;
  const regra = validacao.regras[0];
  const chunk = chunks.find((c) => c.section === regra.secaoManual) ?? chunks[0];
  const erros = validacao.erros.map((e) => e.replace(/\s*\(Manual §[\d.]+\)/, ""));
  let texto = `Atenção: a cotação ${cotacaoId} que você selecionou fere a política. ${erros.join(" ")}`;
  const citacoes: string[] = [];
  if (chunk) {
    texto += ` Manual §${chunk.section}: "${fraseRelevante(chunk.text, ["paralela", "proibida", "24 horas", "vetado", "expirada"])}"`;
    citacoes.push(`§${chunk.section}`);
  }
  texto += " Posso recomendar uma alternativa?";
  return { texto, citacoes };
}

/* ---------------- Propor ação ---------------- */

export function proporAcao(entrada: {
  mensagem: string;
  cotacoesDoPedido: { numero: string; fornecedor: string }[];
  cotacaoTela: string | null;
  cotacaoRecomendada: string | null;
  forcarNovaCotacao: boolean;
}): { tipo: TipoProposta; cotacaoId: string | null; justificativa: string } {
  const m = normalizar(entrada.mensagem);
  const citada =
    entrada.cotacoesDoPedido.find((c) => m.includes(normalizar(c.numero))) ??
    entrada.cotacoesDoPedido.find((c) => m.includes(normalizar(c.fornecedor)));
  if (entrada.forcarNovaCotacao || m.includes("nova cotacao") || m.includes("solicit")) {
    return {
      tipo: "solicitarNovaCotacao",
      cotacaoId: null,
      justificativa: entrada.forcarNovaCotacao
        ? "Não há cotações válidas suficientes para decidir (Manual §4.4): o próximo passo é pedir uma nova cotação."
        : "Você pediu mais uma cotação para comparar (Manual §4.4).",
    };
  }
  if (m.includes("emit") || m.includes("compr") || m.includes("fechar")) {
    const cotacaoId = citada?.numero ?? entrada.cotacaoTela ?? entrada.cotacaoRecomendada;
    return {
      tipo: "emitirOrdemDeCompra",
      cotacaoId,
      justificativa: cotacaoId
        ? `Emitir a ordem de compra da cotação ${cotacaoId}${cotacaoId === entrada.cotacaoRecomendada ? ", a recomendada e aprovada pelo crítico" : ", a selecionada na tela"}.`
        : "Falta escolher a cotação.",
    };
  }
  const cotacaoId = citada?.numero ?? entrada.cotacaoRecomendada ?? entrada.cotacaoTela;
  return {
    tipo: "selecionarCotacao",
    cotacaoId,
    justificativa: cotacaoId ? `Selecionar ${cotacaoId}, como você indicou.` : "Falta escolher a cotação.",
  };
}
