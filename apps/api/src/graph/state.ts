/**
 * Estado do grafo (LangGraph Annotation). Vive só durante um turno:
 * não há checkpointer. Campos sem reducer guardam o último valor escrito;
 * `pareceres` tem reducer porque os 3 especialistas escrevem em paralelo.
 */
import { Annotation } from "@langchain/langgraph";
import type {
  ChunkRag,
  DecisaoComprador,
  Intent,
  ItemCotado,
  ParecerEspecialista,
  PassoPlano,
  PayloadProposta,
  ResultadoValidacao,
  TipoPeca,
  TipoProposta,
} from "@copiloto/shared";

/** Cotação + dados das ferramentas (fornecedor, rota, estoque). */
export type CotacaoEnriquecida = {
  cotacaoId: string;
  fornecedorId: string;
  fornecedor: string;
  notaFornecedor: number;
  entregasNoPrazoPct: number;
  taxaDevolucaoPct: number;
  total: number;
  frete: number;
  prazoHoras: number;
  garantiaMeses: number;
  tipos: TipoPeca[];
  itens: (ItemCotado & { itemDeSeguranca: boolean })[];
  transporteHoras: number;
  riscoAtraso: string;
  /** Valor dos itens que o estoque interno cobre (não precisa comprar). */
  economiaEstoque: number;
  /** total − estoque + custo do carro parado durante a espera (pedidos urgentes). */
  custoEfetivo: number;
};

export type PropostaRascunho = {
  tipo: TipoProposta;
  payload: PayloadProposta;
  resumo: string;
  justificativa: string;
  requerGestor: boolean;
};

export type TipoRascunho = "recomendacao" | "proposta" | "resumo" | "explicacao" | "alerta" | "conceitual" | "aviso";

/** O que o turno vai responder; passa por validate → critic antes de sair. */
export type Rascunho = {
  tipo: TipoRascunho;
  texto: string;
  citacoes: string[];
  cotacaoId?: string | null;
  proposta?: PropostaRascunho | null;
};

export type Especialista = "custos" | "logistica" | "qualidade";

export const EstadoGrafo = Annotation.Root({
  intent: Annotation<Intent | null>(),
  motivoRota: Annotation<string>(),
  /** Trechos do manual recuperados pelo router (perguntas conceituais). */
  ragChunks: Annotation<ChunkRag[]>(),
  plano: Annotation<PassoPlano[]>(),
  /** O planner replanejou para "propor solicitar nova cotação". */
  replanejado: Annotation<boolean>(),
  /** Cotações elegíveis listadas pelo planner. */
  idsCandidatas: Annotation<string[]>(),
  candidatas: Annotation<CotacaoEnriquecida[]>(),
  pareceres: Annotation<Partial<Record<Especialista, ParecerEspecialista>>>({
    reducer: (a, b) => ({ ...a, ...b }),
    default: () => ({}),
  }),
  decisao: Annotation<DecisaoComprador | null>(),
  rascunho: Annotation<Rascunho | null>(),
  /** Nó para onde o validate devolve o erro. */
  origem: Annotation<string>(),
  validacao: Annotation<ResultadoValidacao | null>(),
  tentativasValidacao: Annotation<number>(),
  rodadaCritica: Annotation<number>(),
  feedbackCritico: Annotation<string | null>(),
  /** Cotações já reprovadas pelo crítico/validador nesta recomendação. */
  reprovadas: Annotation<string[]>(),
  notasCritico: Annotation<string[]>(),
  aprovadoPeloCritico: Annotation<boolean>(),
  escalonamento: Annotation<{ texto: string; opcoes: string[] } | null>(),
  /** Validação falhou além do limite de tentativas. */
  bloqueado: Annotation<boolean>(),
});

export type Estado = typeof EstadoGrafo.State;
export type Atualizacao = typeof EstadoGrafo.Update;
