/**
 * Executa uma ferramenta do catálogo pelo nome (o mesmo caminho que o LLM usa
 * via bindTools) e emite o evento `tool_call` com um resumo do resultado.
 */
import type { Contexto } from "../graph/contexto.js";
import { resumirCalcularPrazo } from "./calcularPrazoEntrega.js";
import { resumirEstoque } from "./consultarEstoqueInterno.js";
import { resumirConsultarFornecedor } from "./consultarFornecedor.js";
import { resumirPolitica } from "./consultarPolitica.js";
import { FERRAMENTAS } from "./index.js";
import { resumirListarCotacoes } from "./listarCotacoes.js";
import { resumirListarPedidos } from "./listarPedidos.js";

type Invocavel = { name: string; invoke: (args: unknown) => Promise<unknown> };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RESUMOS: Record<string, (r: any) => string> = {
  listarPedidos: resumirListarPedidos,
  listarCotacoes: resumirListarCotacoes,
  consultarFornecedor: resumirConsultarFornecedor,
  calcularPrazoEntrega: resumirCalcularPrazo,
  consultarEstoqueInterno: resumirEstoque,
  consultarPolitica: resumirPolitica,
  buscarNoManual: (r: { secao: string }[]) => `trechos ${r.map((c) => c.secao).join(", ")}`,
};

export async function chamarFerramenta<T = unknown>(ctx: Contexto, nome: string, args: Record<string, unknown>): Promise<T> {
  const ferramenta = (FERRAMENTAS as unknown as Invocavel[]).find((f) => f.name === nome);
  if (!ferramenta) {
    await ctx.emissor.emit({ type: "tool_call", tool: nome, args, resultSummary: "ferramenta inexistente" });
    return { erro: `Ferramenta ${nome} não existe.` } as T;
  }
  const bruto = await ferramenta.invoke(args);
  const texto = typeof bruto === "string" ? bruto : String((bruto as { content?: unknown }).content ?? "");
  const resultado = JSON.parse(texto) as T;
  const resumir = RESUMOS[nome];
  await ctx.emissor.emit({ type: "tool_call", tool: nome, args, resultSummary: resumir ? resumir(resultado) : "ok" });
  return resultado;
}
