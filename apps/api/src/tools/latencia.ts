/**
 * Latência simulada de "sistemas externos" (cadastro de fornecedores, roteirizador,
 * estoque). Os dados estão em memória, então sem isso as consultas levariam ~0 ms
 * e a plateia não veria a diferença entre rodar em paralelo e em sequência.
 * Determinística: depende só da chave consultada.
 */
export async function latenciaDeSistema(chave: string, minimoMs = 250, maximoMs = 750): Promise<void> {
  let h = 0;
  for (const ch of chave) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const ms = minimoMs + (h % (maximoMs - minimoMs));
  await new Promise((r) => setTimeout(r, ms));
}
