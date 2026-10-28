/**
 * Nós do grafo que não são o "coração" de um padrão específico:
 * respostas diretas (conceitual, explicar, alertas, avisos) e o validador.
 * Os nós dos padrões ficam em patterns/0X-*.ts.
 */
import type { RunnableConfig } from "@langchain/core/runnables";
import type { ResultadoValidacao } from "@copiloto/shared";
import { formatarBRL, totalCotacao } from "@copiloto/shared";
import { agenteAlerta } from "../agents/alerta/index.js";
import { agenteConceitual } from "../agents/conceitual/index.js";
import { agenteExplicar } from "../agents/explicar/index.js";
import { agentePriorizar } from "../agents/priorizar/index.js";
import { store } from "../data/store.js";
import { comPadrao } from "../events/emitter.js";
import { filtrarCitacoes, recuperar } from "../patterns/09-rag.js";
import { secoesDoManual } from "../rag/search.js";
import { chamarFerramenta } from "../tools/executar.js";
import type { consultarFornecedorDados } from "../tools/consultarFornecedor.js";
import { ordenarPorPrioridade, type ResumoPedido } from "../tools/listarPedidos.js";
import { validarCotacao } from "../validator/rules.js";
import { ctxDe } from "./contexto.js";
import type { Atualizacao, Estado } from "./state.js";

const CONSULTA_POR_REGRA: Record<string, string> = {
  "item-seguranca-tipo": "peça paralela em item de segurança é proibida",
  "prazo-urgente": "pedido urgente exige entrega em até 24 horas",
  "fornecedor-vetado": "fornecedor com nota abaixo de 3 está vetado",
  "cotacao-expirada": "cotação expirada não pode ser usada",
  "cotacao-pendente": "cotação pendente não pode ser escolhida",
  "minimo-cotacoes": "mínimo de 3 cotações respondidas",
};

export async function noSemPedido(): Promise<Atualizacao> {
  return {
    rascunho: { tipo: "aviso", texto: "Abra um pedido na lista à esquerda para eu poder ajudar com isso.", citacoes: [] },
  };
}

export async function noForaDoEscopo(_e: Estado, config: RunnableConfig): Promise<Atualizacao> {
  const ctx = ctxDe(config);
  const texto = ctx.simulado
    ? "No modo simulado eu só respondo aos cenários preparados. Experimente as sugestões abaixo do chat ou ligue um LLM real nas configurações."
    : "Essa pergunta foge do que eu sei fazer. Posso priorizar a fila de pedidos, resumir um pedido, recomendar uma cotação, explicar uma escolha, preparar uma compra para você aprovar ou responder sobre o Manual de Compras.";
  return { rascunho: { tipo: "aviso", texto, citacoes: [] } };
}

/** Pergunta conceitual: responde só com os trechos que o router recuperou. */
export async function noConceitual(estado: Estado, config: RunnableConfig): Promise<Atualizacao> {
  const ctx = ctxDe(config);
  return comPadrao(
    ctx.emissor,
    "rag",
    "conceitual",
    "Pergunta conceitual: respondo só com o que está no manual e cito a fonte. Nenhum especialista é acionado.",
    async () => {
      const saida = await agenteConceitual(ctx, ctx.req.mensagem ?? "", estado.ragChunks ?? []);
      return {
        rascunho: { tipo: "conceitual" as const, texto: saida.resposta, citacoes: filtrarCitacoes(saida.citacoes, estado.ragChunks ?? []) },
      };
    },
    (r) => `resposta citando ${r.rascunho.citacoes.join(", ") || "nenhuma seção"}`,
  );
}

/** "Qual pedido devo priorizar?": ferramenta + ordem da política em código + manual. */
export async function noPriorizar(_e: Estado, config: RunnableConfig): Promise<Atualizacao> {
  const ctx = ctxDe(config);
  return comPadrao(
    ctx.emissor,
    "tool-use",
    "priorizar",
    "Pergunta sobre a fila inteira: consulto todos os pedidos com uma ferramenta e ordeno pela política de urgência.",
    async () => {
      const pedidos = await chamarFerramenta<ResumoPedido[]>(ctx, "listarPedidos", {});
      const fila = ordenarPorPrioridade(pedidos);
      const chunks = await recuperar(ctx, "prioridades por urgência e custo de veículo parado", "priorizar", 3);
      const saida = await agentePriorizar(ctx, ctx.req.mensagem ?? "", fila, chunks);
      return {
        origem: "priorizar",
        rascunho: { tipo: "explicacao" as const, texto: saida.texto, citacoes: filtrarCitacoes(saida.citacoes, chunks) },
      };
    },
    () => "fila ordenada",
  );
}

/** "Por que não a mais barata?" */
export async function noExplicar(_e: Estado, config: RunnableConfig): Promise<Atualizacao> {
  const ctx = ctxDe(config);
  const pedido = ctx.pedido!;
  const recomendacao = ctx.req.tela.ultimaRecomendacao?.pedidoId === pedido.numero ? ctx.req.tela.ultimaRecomendacao : null;
  const cotacoes = store.cotacoesDoPedido(pedido.numero).filter((c) => c.status !== "pendente");
  const maisBarata = [...cotacoes].sort((a, b) => totalCotacao(a) - totalCotacao(b))[0];
  const validacao = validarCotacao({ pedido, cotacao: maisBarata, modo: "selecao" });
  const regra = validacao.regras[0]?.regra;
  const consulta = regra ? CONSULTA_POR_REGRA[regra] ?? validacao.erros[0] : "prioridades de preço, prazo e qualidade por urgência";

  const chunks = await recuperar(ctx, consulta, "explicar", 2);
  const saida = await agenteExplicar(ctx, ctx.req.mensagem ?? "", {
    maisBarata: {
      cotacaoId: maisBarata.numero,
      fornecedor: store.fornecedores.get(maisBarata.fornecedorId)?.nome ?? "",
      total: totalCotacao(maisBarata),
      validacao,
    },
    recomendacao,
    chunks,
  });
  return {
    origem: "explicar",
    rascunho: { tipo: "explicacao", texto: saida.texto, citacoes: filtrarCitacoes(saida.citacoes, chunks) },
  };
}

/** Evento cotacao_selecionada: alerta proativo quando a seleção fere a política. */
export async function noAvaliarSelecao(_e: Estado, config: RunnableConfig): Promise<Atualizacao> {
  const ctx = ctxDe(config);
  const pedido = ctx.pedido!;
  const cotacao = store.cotacoes.get(ctx.req.evento?.cotacaoId ?? pedido.cotacaoSelecionadaId ?? "");
  if (!cotacao) return { rascunho: { tipo: "aviso", texto: "Não achei a cotação selecionada.", citacoes: [] } };
  const validacao = validarCotacao({ pedido, cotacao, modo: "selecao" });
  if (validacao.ok) {
    return { rascunho: { tipo: "aviso", texto: `A seleção de ${cotacao.numero} está dentro da política.`, citacoes: [] } };
  }
  await ctx.emissor.emit({ type: "validation", ok: false, errors: validacao.erros });
  const chunks = await recuperar(ctx, CONSULTA_POR_REGRA[validacao.regras[0].regra] ?? validacao.erros[0], "alerta", 2);
  const saida = await agenteAlerta(ctx, { cotacaoId: cotacao.numero, validacao, chunks });
  return {
    origem: "avaliarSelecao",
    rascunho: { tipo: "alerta", texto: saida.texto, citacoes: filtrarCitacoes(saida.citacoes, chunks), cotacaoId: cotacao.numero },
  };
}

/** Evento cotacao_recebida: avisa que a recomendação pode mudar e oferece reavaliar. */
export async function noAvisarCotacao(_e: Estado, config: RunnableConfig): Promise<Atualizacao> {
  const ctx = ctxDe(config);
  const cotacao = store.cotacoes.get(ctx.req.evento?.cotacaoId ?? "");
  if (!cotacao) return { rascunho: { tipo: "aviso", texto: "Chegou uma cotação nova. Quer que eu reavalie a recomendação?", citacoes: [] } };
  return comPadrao(
    ctx.emissor,
    "tool-use",
    "avisarCotacao",
    "Chegou cotação nova: confiro o fornecedor com uma ferramenta antes de avisar você.",
    async () => {
      const f = await chamarFerramenta<Awaited<ReturnType<typeof consultarFornecedorDados>>>(ctx, "consultarFornecedor", {
        fornecedorId: cotacao.fornecedorId,
      });
      const nome = f.encontrado ? `${f.nome} (nota ${f.notaQualidade.toLocaleString("pt-BR", { minimumFractionDigits: 1 })})` : cotacao.fornecedorId;
      const tipos = [...new Set(cotacao.itens.map((i) => i.tipo))].join("/");
      return {
        rascunho: {
          tipo: "aviso" as const,
          texto: `Chegou a cotação ${cotacao.numero} de ${nome}: ${formatarBRL(totalCotacao(cotacao))}, peça ${tipos}, entrega em ${cotacao.prazoEntregaHoras}h, garantia de ${cotacao.garantiaMeses} meses. Isso pode mudar a recomendação. Quer que eu reavalie?`,
          citacoes: [],
        },
      };
    },
    () => "aviso pronto",
  );
}

/**
 * VALIDATE: determinístico, SEM LLM. Confere o rascunho contra a política em
 * código (validator/rules.ts) e contra os dados (anti-alucinação: toda cotação
 * e seção do manual citada precisa existir).
 */
export async function noValidate(estado: Estado, config: RunnableConfig): Promise<Atualizacao> {
  const ctx = ctxDe(config);
  const r = estado.rascunho!;
  const pedido = ctx.pedido;
  let validacao: ResultadoValidacao = { ok: true, erros: [], regras: [], requerGestor: false };

  if (pedido && r.cotacaoId && (r.tipo === "recomendacao" || r.tipo === "proposta")) {
    const cotacao = store.cotacoes.get(r.cotacaoId);
    if (cotacao) {
      const modo = r.proposta?.tipo === "emitirOrdemDeCompra" ? "compra" : "selecao";
      validacao = validarCotacao({ pedido, cotacao, modo, quantidades: r.proposta?.payload.quantidades });
    }
  }
  if (pedido && r.proposta?.tipo === "solicitarNovaCotacao" && ["comprado", "cancelado"].includes(pedido.status)) {
    validacao.erros.push(`O pedido ${pedido.numero} está "${pedido.status}" e não aceita nova cotação.`);
  }

  // Anti-alucinação: só vale citar o que existe.
  const secoes = new Set(secoesDoManual().map((s) => s.section));
  for (const id of new Set(r.texto.match(/COT-\d{4}-[A-Z0-9]+/g) ?? [])) {
    if (!store.cotacoes.has(id)) validacao.erros.push(`A resposta cita a cotação ${id}, que não existe.`);
  }
  for (const id of new Set(r.texto.match(/PED-d{4}-d{4}/g) ?? [])) {
    if (!store.pedidos.has(id)) validacao.erros.push(`A resposta cita o pedido ${id}, que não existe.`);
  }
  for (const s of new Set([...(r.texto.match(/§(\d+\.\d+)/g) ?? []), ...r.citacoes].map((x) => x.replace("§", "")))) {
    if (!secoes.has(s)) validacao.erros.push(`A resposta cita o §${s}, que não existe no manual.`);
  }
  validacao.ok = validacao.erros.length === 0;


  await ctx.emissor.emit({ type: "validation", ok: validacao.ok, errors: validacao.erros });
  return { validacao, tentativasValidacao: (estado.tentativasValidacao ?? 0) + 1 };
}
