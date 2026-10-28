import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { store } from "../data/store.js";
import { latenciaDeSistema } from "./latencia.js";

/** Distâncias fictícias entre cidades (km). */
const DISTANCIAS: Record<string, number> = {
  "Caruaru|Recife": 135,
  "Jaboatão|Recife": 18,
  "Sumaré|Campinas": 28,
  "Betim|Belo Horizonte": 32,
  "Contagem|Belo Horizonte": 21,
  "Araucária|Curitiba": 27,
  "Pinhais|Curitiba": 14,
};

function distanciaKm(origem: string, ufOrigem: string, destino: string, ufDestino: string): number {
  if (origem === destino) return 12;
  const chave = DISTANCIAS[`${origem}|${destino}`] ?? DISTANCIAS[`${destino}|${origem}`];
  if (chave) return chave;
  return ufOrigem === ufDestino ? 120 : 900;
}

export async function calcularPrazoEntregaDados(fornecedorId: string, oficinaId: string) {
  await latenciaDeSistema(`prazo-${fornecedorId}-${oficinaId}`);
  const f = store.fornecedores.get(fornecedorId);
  const o = store.oficinas.get(oficinaId);
  if (!f || !o) return { encontrado: false as const, fornecedorId, oficinaId };
  const km = distanciaKm(f.cidade, f.uf, o.cidade, o.uf);
  const transporteHoras = Math.round((km / 60 + 2) * 10) / 10;
  const risco = f.entregasNoPrazoPct >= 93 ? "baixo" : f.entregasNoPrazoPct >= 85 ? "médio" : "alto";
  return {
    encontrado: true as const,
    origem: `${f.cidade}/${f.uf}`,
    destino: `${o.nome} (${o.cidade}/${o.uf})`,
    distanciaKm: km,
    transporteHoras,
    riscoDeAtraso: risco,
  };
}

export const calcularPrazoEntrega = tool(
  async ({ fornecedorId, oficinaId }) => JSON.stringify(await calcularPrazoEntregaDados(fornecedorId, oficinaId)),
  {
    name: "calcularPrazoEntrega",
    description:
      "Calcula a distância e o tempo de transporte do fornecedor até a oficina, com o risco de atraso pelo histórico de pontualidade. Somente leitura.",
    schema: z.object({
      fornecedorId: z.string().describe("Id do fornecedor, ex.: FOR-03"),
      oficinaId: z.string().describe("Id da oficina, ex.: OF-REC-01"),
    }),
  },
);

export function resumirCalcularPrazo(r: Awaited<ReturnType<typeof calcularPrazoEntregaDados>>): string {
  if (!r.encontrado) return "rota não encontrada";
  return `${r.origem} → ${r.destino}: ${r.distanciaKm} km, ~${r.transporteHoras}h de transporte, risco ${r.riscoDeAtraso}`;
}
