/**
 * Contrato único entre web e api: schemas Zod e tipos do domínio,
 * da requisição de turno do agente e dos eventos SSE.
 * Todos os dados do projeto são fictícios.
 */
import { z } from "zod";

/* ============================================================
 * Domínio
 * ============================================================ */

export const StatusVeiculo = z.enum(["parado na oficina", "rodando"]);

export const Veiculo = z.object({
  placa: z.string(),
  modelo: z.string(),
  ano: z.number(),
  km: z.number(),
  status: StatusVeiculo,
});
export type Veiculo = z.infer<typeof Veiculo>;

export const Localizacao = z.object({
  cidade: z.string(),
  uf: z.string(),
  tipo: z.enum(["loja", "pátio", "oficina parceira"]),
  nome: z.string(),
});
export type Localizacao = z.infer<typeof Localizacao>;

export const Oficina = z.object({
  id: z.string(),
  nome: z.string(),
  cidade: z.string(),
  uf: z.string(),
  contato: z.string(),
});
export type Oficina = z.infer<typeof Oficina>;

export const OrdemDeServico = z.object({
  numero: z.string(),
  dataAbertura: z.string(),
  veiculo: Veiculo,
  localizacao: Localizacao,
  oficinaId: z.string(),
  diagnostico: z.string(),
  diasParado: z.number(),
});
export type OrdemDeServico = z.infer<typeof OrdemDeServico>;

export const CategoriaItem = z.enum(["freio", "suspensão", "direção", "motor", "elétrica", "funilaria", "revisão"]);
export type CategoriaItem = z.infer<typeof CategoriaItem>;

export const ItemPedido = z.object({
  codigoPeca: z.string().nullable(),
  descricao: z.string(),
  quantidade: z.number(),
  categoria: CategoriaItem,
  itemDeSeguranca: z.boolean(),
});
export type ItemPedido = z.infer<typeof ItemPedido>;

export const Urgencia = z.enum(["urgente", "normal", "rotina"]);
export type Urgencia = z.infer<typeof Urgencia>;

export const StatusPedido = z.enum([
  "aberto",
  "em cotação",
  "cotado",
  "comprado",
  "aguardando aprovação do gestor",
  "cancelado",
]);
export type StatusPedido = z.infer<typeof StatusPedido>;

export const PedidoDeCompra = z.object({
  numero: z.string(),
  os: OrdemDeServico,
  itens: z.array(ItemPedido),
  urgencia: Urgencia,
  status: StatusPedido,
  cotacaoSelecionadaId: z.string().nullable(),
});
export type PedidoDeCompra = z.infer<typeof PedidoDeCompra>;

export const TipoPeca = z.enum(["original", "homologada", "paralela"]);
export type TipoPeca = z.infer<typeof TipoPeca>;

export const ItemCotado = z.object({
  descricao: z.string(),
  quantidade: z.number(),
  precoUnitario: z.number(),
  marca: z.string(),
  tipo: TipoPeca,
});
export type ItemCotado = z.infer<typeof ItemCotado>;

export const StatusCotacao = z.enum(["respondida", "pendente", "expirada"]);
export type StatusCotacao = z.infer<typeof StatusCotacao>;

export const Cotacao = z.object({
  numero: z.string(),
  pedidoId: z.string(),
  fornecedorId: z.string(),
  dataEnvio: z.string(),
  validade: z.string(),
  status: StatusCotacao,
  itens: z.array(ItemCotado),
  frete: z.number(),
  prazoEntregaHoras: z.number(),
  garantiaMeses: z.number(),
});
export type Cotacao = z.infer<typeof Cotacao>;

export const Fornecedor = z.object({
  id: z.string(),
  nome: z.string(),
  cidade: z.string(),
  uf: z.string(),
  notaQualidade: z.number(),
  entregasNoPrazoPct: z.number(),
  taxaDevolucaoPct: z.number(),
});
export type Fornecedor = z.infer<typeof Fornecedor>;

export const PatternId = z.enum([
  "prompt-chaining",
  "routing",
  "parallelization",
  "reflection",
  "tool-use",
  "planning",
  "multi-agent",
  "hitl",
  "rag",
]);
export type PatternId = z.infer<typeof PatternId>;

export const Aprovacao = z.object({ por: z.string(), em: z.string() });
export type Aprovacao = z.infer<typeof Aprovacao>;

export const OrdemDeCompra = z.object({
  numero: z.string(),
  pedidoId: z.string(),
  cotacaoId: z.string(),
  valorTotal: z.number(),
  justificativa: z.string(),
  origem: z.enum(["manual", "agente"]),
  padroesUsados: z.array(PatternId),
  requerGestor: z.boolean(),
  aprovacoes: z.object({
    comprador: Aprovacao,
    gestor: Aprovacao.nullable(),
  }),
  data: z.string(),
});
export type OrdemDeCompra = z.infer<typeof OrdemDeCompra>;

export const TipoProposta = z.enum(["selecionarCotacao", "solicitarNovaCotacao", "emitirOrdemDeCompra"]);
export type TipoProposta = z.infer<typeof TipoProposta>;

export const PayloadProposta = z.object({
  pedidoId: z.string(),
  /** Cotação escolhida (selecionar / emitir). */
  cotacaoId: z.string().nullable(),
  /** Fornecedor para nova cotação (opcional). */
  fornecedorId: z.string().nullable(),
  /** Quantidades por descrição do item (editável). */
  quantidades: z.record(z.string(), z.number()).nullable(),
  valorTotal: z.number().nullable(),
});
export type PayloadProposta = z.infer<typeof PayloadProposta>;

export const StatusProposta = z.enum(["pendente", "aprovada", "editada", "recusada", "aguardando gestor"]);
export type StatusProposta = z.infer<typeof StatusProposta>;

export const Proposta = z.object({
  id: z.string(),
  tipo: TipoProposta,
  resumo: z.string(),
  payload: PayloadProposta,
  justificativa: z.string(),
  notasDoCritico: z.array(z.string()),
  requerGestor: z.boolean(),
  status: StatusProposta,
  padroesUsados: z.array(PatternId),
  ordemDeCompraId: z.string().nullable(),
});
export type Proposta = z.infer<typeof Proposta>;

export const PoliticaDeCompras = z.object({
  limiteAlcadaComprador: z.number(),
  tiposPermitidosItemSeguranca: z.array(TipoPeca),
  prazoMaximoUrgenteHoras: z.number(),
  notaMinimaFornecedor: z.number(),
  vetarCotacaoExpirada: z.boolean(),
  minimoCotacoesRespondidas: z.number(),
  valorExigeMinimoCotacoes: z.number(),
  custoCarroParadoPorDia: z.number(),
  margemEmpateConsolidado: z.number(),
});
export type PoliticaDeCompras = z.infer<typeof PoliticaDeCompras>;

/* ============================================================
 * Resultado do validador (política em código)
 * ============================================================ */

export const ResultadoValidacao = z.object({
  ok: z.boolean(),
  erros: z.array(z.string()),
  /** Regras violadas, com a seção do manual correspondente (ex.: "2.2"). */
  regras: z.array(z.object({ regra: z.string(), secaoManual: z.string() })),
  requerGestor: z.boolean(),
});
export type ResultadoValidacao = z.infer<typeof ResultadoValidacao>;

/* ============================================================
 * Turno do agente (web → api)
 * ============================================================ */

export const Intent = z.enum([
  "conceitual",
  "analisarPedido",
  "recomendar",
  "explicar",
  "proporAcao",
  "avaliarSelecao",
  "avisarCotacao",
  "priorizarPedidos",
  "foraDoEscopo",
]);
export type Intent = z.infer<typeof Intent>;

export const TipoEventoTela = z.enum(["pedido_aberto", "cotacao_selecionada", "cotacao_recebida"]);
export type TipoEventoTela = z.infer<typeof TipoEventoTela>;

export const EventoTela = z.object({
  tipo: TipoEventoTela,
  pedidoId: z.string(),
  cotacaoId: z.string().nullable().optional(),
});
export type EventoTela = z.infer<typeof EventoTela>;

/** Resumo da última recomendação, guardado pela web e reenviado a cada turno (grafo stateless). */
export const RecomendacaoResumo = z.object({
  pedidoId: z.string(),
  cotacaoId: z.string(),
  justificativa: z.string(),
  ranking: z.array(z.object({ cotacaoId: z.string(), nota: z.number(), motivo: z.string() })),
});
export type RecomendacaoResumo = z.infer<typeof RecomendacaoResumo>;

export const EstadoTela = z.object({
  pedidoId: z.string().nullable(),
  cotacaoSelecionadaId: z.string().nullable(),
  aba: z.string(),
  ultimaRecomendacao: RecomendacaoResumo.nullable(),
});
export type EstadoTela = z.infer<typeof EstadoTela>;

export const Provedor = z.enum(["anthropic", "openai", "gemini"]);
export type Provedor = z.infer<typeof Provedor>;

export const ConfigLlm = z.object({
  provedor: Provedor,
  modelo: z.string(),
  simulado: z.boolean(),
  /** Atraso entre eventos, em ms (0 a 3000). */
  velocidadeMs: z.number().min(0).max(3000),
});
export type ConfigLlm = z.infer<typeof ConfigLlm>;

export const MensagemChat = z.object({
  papel: z.enum(["usuario", "agente"]),
  texto: z.string(),
});
export type MensagemChat = z.infer<typeof MensagemChat>;

export const TurnoRequest = z.object({
  historico: z.array(MensagemChat),
  mensagem: z.string().nullable(),
  evento: EventoTela.nullable(),
  tela: EstadoTela,
  config: ConfigLlm,
});
export type TurnoRequest = z.infer<typeof TurnoRequest>;

/** Header HTTP que leva a chave do provedor (BYOK). Nunca é gravada na API. */
export const HEADER_CHAVE_LLM = "x-llm-key";

/* ============================================================
 * Eventos SSE (api → web)
 * ============================================================ */

export type StatusPasso = "pendente" | "executando" | "feito" | "falhou";
export type PassoPlano = { id: string; label: string; status: StatusPasso };
export type ChunkRag = { source: string; section: string; text: string; score: number };
export type AgenteEspecialista = "custos" | "logistica" | "qualidade" | "comprador";

export type AgentEvent =
  | { type: "pattern_start"; pattern: PatternId; node: string; why: string; ts: number }
  | { type: "pattern_end"; pattern: PatternId; node: string; summary: string; durationMs: number; ts: number }
  | { type: "route"; intent: Intent; reason: string }
  | { type: "rag_retrieval"; query: string; chunks: ChunkRag[] }
  | { type: "chain_step"; step: 1 | 2 | 3; name: string; output: unknown }
  | { type: "plan"; steps: PassoPlano[] }
  | { type: "tool_call"; tool: string; args: unknown; resultSummary: string }
  | { type: "parallel_task"; taskId: string; label: string; status: "iniciada" | "concluida"; durationMs?: number }
  | { type: "agent_opinion"; agent: AgenteEspecialista; content: unknown }
  | { type: "validation"; ok: boolean; errors: string[] }
  | { type: "reflection"; round: number; approved: boolean; feedback: string }
  | { type: "hitl"; kind: "proposta" | "alcada" | "escalonamento"; proposta?: Proposta; opcoes?: string[] }
  | { type: "message"; text: string; citations?: string[] }
  | { type: "trace"; node: string; tokens?: { input: number; output: number }; latencyMs: number }
  /** `code: "llm_falhou"` faz a web oferecer a troca para o modo simulado. */
  | { type: "warning" | "error"; message: string; code?: "llm_falhou" }
  | { type: "done" };

/** Parecer de um especialista sobre cada cotação (conteúdo de agent_opinion). */
export const ParecerEspecialista = z.object({
  avaliacoes: z.array(
    z.object({
      cotacaoId: z.string(),
      nota: z.number().describe("Nota de 0 a 10 para esta cotação no seu critério"),
      parecer: z.string().describe("Uma frase curta explicando a nota"),
      citacao: z.string().nullable().describe("Seção do manual citada, ex.: §2.2, ou null"),
    }),
  ),
});
export type ParecerEspecialista = z.infer<typeof ParecerEspecialista>;

/** Decisão consolidada do comprador (conteúdo de agent_opinion com agent = "comprador"). */
export type DecisaoComprador = {
  rodada: number;
  escolhida: string;
  justificativa: string;
  pesos: { custos: number; logistica: number; qualidade: number };
  ranking: { cotacaoId: string; nota: number; motivo: string }[];
};

/* ============================================================
 * Metadados didáticos dos padrões (faixa da web)
 * ============================================================ */

export const PADROES: { id: PatternId; nome: string; descricao: string }[] = [
  { id: "prompt-chaining", nome: "Prompt Chaining", descricao: "Encadeamento de prompts: cada elo resolve uma parte e passa a saída adiante" },
  { id: "routing", nome: "Routing", descricao: "Roteamento: classifica a intenção e escolhe o caminho certo" },
  { id: "parallelization", nome: "Parallelization", descricao: "Paralelização: tarefas independentes rodam ao mesmo tempo" },
  { id: "reflection", nome: "Reflection", descricao: "Reflexão: um crítico revisa a resposta antes de ela sair" },
  { id: "tool-use", nome: "Tool Use", descricao: "Uso de ferramentas: o agente consulta sistemas em vez de inventar dados" },
  { id: "planning", nome: "Planning", descricao: "Planejamento: monta um plano explícito e o executa passo a passo" },
  { id: "multi-agent", nome: "Multi-Agent", descricao: "Colaboração multiagente: especialistas opinam e um coordenador decide" },
  { id: "hitl", nome: "HITL", descricao: "Humano no circuito: nada muda sem a sua aprovação" },
  { id: "rag", nome: "RAG", descricao: "Recuperação de conhecimento: busca no Manual de Compras e cita a fonte" },
];

export function formatarBRL(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function totalCotacao(c: Pick<Cotacao, "itens" | "frete">): number {
  const itens = c.itens.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0);
  return Math.round((itens + c.frete) * 100) / 100;
}
