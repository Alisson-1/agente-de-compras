/**
 * Catálogo de ferramentas do agente. TODAS são somente leitura:
 * as ações de escrita existem só como endpoints chamados depois da aprovação humana.
 */
import { buscarNoManual } from "./buscarNoManual.js";
import { calcularPrazoEntrega } from "./calcularPrazoEntrega.js";
import { consultarEstoqueInterno } from "./consultarEstoqueInterno.js";
import { consultarFornecedor } from "./consultarFornecedor.js";
import { consultarPolitica } from "./consultarPolitica.js";
import { listarCotacoes } from "./listarCotacoes.js";
import { listarPedidos } from "./listarPedidos.js";

export const FERRAMENTAS = [
  listarPedidos,
  listarCotacoes,
  consultarFornecedor,
  calcularPrazoEntrega,
  consultarEstoqueInterno,
  consultarPolitica,
  buscarNoManual,
];
