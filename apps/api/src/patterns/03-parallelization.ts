/**
 * PADRÃO 3 — Parallelization
 *
 * O que é: rodar ao mesmo tempo tarefas que não dependem umas das outras e
 * juntar os resultados no fim.
 *
 * Que problema resolve: enriquecer N cotações uma a uma (fornecedor, rota,
 * estoque) soma as latências de cada sistema. Em paralelo, o tempo total é o da
 * tarefa mais lenta.
 *
 * Onde aparece: nó `enriquecer` (Promise.all sobre as cotações válidas + o
 * estoque interno) e, no grafo, os 3 especialistas, que o LangGraph executa no
 * mesmo passo (fan-out enriquecer → custos|logística|qualidade → comprador).
 * Na tela: as N tarefas simultâneas e o tempo total comparado com o sequencial.
 */
import type { RunnableConfig } from "@langchain/core/runnables";
import { totalCotacao } from "@copiloto/shared";
import { store } from "../data/store.js";
import { comPadrao } from "../events/emitter.js";
import { ctxDe, type Contexto } from "../graph/contexto.js";
import type { Atualizacao, CotacaoEnriquecida, Estado } from "../graph/state.js";
import type { calcularPrazoEntregaDados } from "../tools/calcularPrazoEntrega.js";
import type { consultarEstoqueInternoDados } from "../tools/consultarEstoqueInterno.js";
import type { consultarFornecedorDados } from "../tools/consultarFornecedor.js";
import { chamarFerramenta } from "../tools/executar.js";
import { marcarPasso } from "./06-planning.js";

type Tarefa<T> = { id: string; label: string; rodar: () => Promise<T> };

/** Roda as tarefas em paralelo, emitindo início/fim de cada uma, e mede o ganho. */
export async function emParalelo<T>(ctx: Contexto, tarefas: Tarefa<T>[]) {
  const inicio = Date.now();
  const medidas = await Promise.all(
    tarefas.map(async (t) => {
      void ctx.emissor.emit({ type: "parallel_task", taskId: t.id, label: t.label, status: "iniciada" });
      const t0 = Date.now();
      const resultado = await t.rodar();
      const durationMs = Date.now() - t0;
      void ctx.emissor.emit({ type: "parallel_task", taskId: t.id, label: t.label, status: "concluida", durationMs });
      return { resultado, durationMs };
    }),
  );
  return {
    resultados: medidas.map((m) => m.resultado),
    paraleloMs: Date.now() - inicio,
    sequencialMs: medidas.reduce((s, m) => s + m.durationMs, 0),
  };
}

type Fornecedor = Awaited<ReturnType<typeof consultarFornecedorDados>>;
type Prazo = Awaited<ReturnType<typeof calcularPrazoEntregaDados>>;
type Estoque = Awaited<ReturnType<typeof consultarEstoqueInternoDados>>;

export async function noEnriquecer(estado: Estado, config: RunnableConfig): Promise<Atualizacao> {
  const ctx = ctxDe(config);
  const pedido = ctx.pedido!;
  const cotacoes = (estado.idsCandidatas ?? []).map((id) => store.cotacoes.get(id)!).filter(Boolean);
  let plano = await marcarPasso(ctx, estado.plano, "enriquecer", "executando");

  const r = await comPadrao(
    ctx.emissor,
    "parallelization",
    "enriquecer",
    `Consulto ${cotacoes.length} cotações e o estoque ao mesmo tempo: cada consulta é independente, então ninguém espera ninguém.`,
    () =>
      comPadrao(
        ctx.emissor,
        "tool-use",
        "enriquecer",
        "Cada tarefa usa ferramentas: cadastro do fornecedor, rota até a oficina e estoque interno.",
        () =>
          emParalelo<{ tipo: "cotacao"; id: string; f: Fornecedor; p: Prazo } | { tipo: "estoque"; itens: Estoque[] }>(ctx, [
            ...cotacoes.map((c) => ({
              id: `enr-${c.numero}`,
              label: `${c.numero}: fornecedor + rota`,
              rodar: async () => {
                const [f, p] = await Promise.all([
                  chamarFerramenta<Fornecedor>(ctx, "consultarFornecedor", { fornecedorId: c.fornecedorId }),
                  chamarFerramenta<Prazo>(ctx, "calcularPrazoEntrega", { fornecedorId: c.fornecedorId, oficinaId: pedido.os.oficinaId }),
                ]);
                return { tipo: "cotacao" as const, id: c.numero, f, p };
              },
            })),
            {
              id: "enr-estoque",
              label: "Estoque interno dos itens",
              rodar: async () => {
                const itens: Estoque[] = [];
                for (const i of pedido.itens.filter((x) => x.codigoPeca)) {
                  itens.push(await chamarFerramenta<Estoque>(ctx, "consultarEstoqueInterno", { codigoPeca: i.codigoPeca }));
                }
                return { tipo: "estoque" as const, itens };
              },
            },
          ]),
        (x) => `${x.resultados.length} tarefas com ferramentas`,
      ),
    (x) =>
      `${x.resultados.length} tarefas em ${x.paraleloMs.toLocaleString("pt-BR")} ms (em sequência levaria ${x.sequencialMs.toLocaleString("pt-BR")} ms)`,
  );

  const estoque = r.resultados.find((x) => x.tipo === "estoque");
  const emEstoque = new Set(
    pedido.itens
      .filter((i) => estoque?.tipo === "estoque" && estoque.itens.some((e) => e.codigoPeca === i.codigoPeca && e.quantidade >= i.quantidade))
      .map((i) => i.descricao),
  );
  const custoDia = store.politica.custoCarroParadoPorDia;

  const candidatas: CotacaoEnriquecida[] = cotacoes.map((c) => {
    const dados = r.resultados.find((x) => x.tipo === "cotacao" && x.id === c.numero);
    const f = dados?.tipo === "cotacao" && dados.f.encontrado ? dados.f : null;
    const p = dados?.tipo === "cotacao" && dados.p.encontrado ? dados.p : null;
    const total = totalCotacao(c);
    const economiaEstoque = c.itens.filter((i) => emEstoque.has(i.descricao)).reduce((s, i) => s + i.precoUnitario * i.quantidade, 0);
    const parado = pedido.urgencia === "urgente" ? (c.prazoEntregaHoras / 24) * custoDia : 0;
    return {
      cotacaoId: c.numero,
      fornecedorId: c.fornecedorId,
      fornecedor: f?.nome ?? c.fornecedorId,
      notaFornecedor: f?.notaQualidade ?? 0,
      entregasNoPrazoPct: f?.entregasNoPrazoPct ?? 0,
      taxaDevolucaoPct: f?.taxaDevolucaoPct ?? 0,
      total,
      frete: c.frete,
      prazoHoras: c.prazoEntregaHoras,
      garantiaMeses: c.garantiaMeses,
      tipos: [...new Set(c.itens.map((i) => i.tipo))],
      itens: c.itens.map((i) => ({
        ...i,
        itemDeSeguranca: pedido.itens.find((x) => x.descricao === i.descricao)?.itemDeSeguranca ?? false,
      })),
      transporteHoras: p?.transporteHoras ?? 0,
      riscoAtraso: p?.riscoDeAtraso ?? "desconhecido",
      economiaEstoque,
      custoEfetivo: Math.round((total - economiaEstoque + parado) * 100) / 100,
    };
  });

  plano = await marcarPasso(ctx, plano, "enriquecer", "feito");
  plano = await marcarPasso(ctx, plano, "especialistas", "executando");
  return { candidatas, plano };
}
