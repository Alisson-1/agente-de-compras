/**
 * Tela "Arquitetura do agente" (#/arquitetura): diagrama em alto nível do grafo
 * (apps/api/src/graph/buildGraph.ts). Os nós acendem ao vivo: "rodando agora"
 * vem dos padrões ativos e "último caminho" vem dos eventos do último turno.
 */
import { ArrowDown, Bot, CornerUpLeft, Database, FileText, Hand, ShieldCheck, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import type { PatternId } from "@copiloto/shared";
import { PADROES } from "@copiloto/shared";

type Props = {
  /** Nós rodando agora (campo `node` dos eventos pattern_start ativos). */
  ativos: Set<string>;
  /** Nós percorridos no último turno. */
  percorridos: Set<string>;
  pedidoContexto: string | null;
  aoAbrirPedidos: () => void;
};

const nomePadrao = (p: PatternId) => PADROES.find((x) => x.id === p)?.nome ?? p;

function No(props: {
  ids: string[];
  titulo: string;
  descricao: ReactNode;
  padroes?: PatternId[];
  arquivo?: string;
  nota?: ReactNode;
  ativos: Set<string>;
  percorridos: Set<string>;
  className?: string;
  children?: ReactNode;
}) {
  const ativo = props.ids.some((id) => props.ativos.has(id));
  const percorrido = props.ids.some((id) => props.percorridos.has(id));
  return (
    <div
      className={["arq-no", ativo ? "arq-no--ativo" : percorrido ? "arq-no--percorrido" : "", props.className ?? ""].join(" ")}
      aria-current={ativo ? "step" : undefined}
    >
      <p className="arq-no__titulo">
        {props.titulo}
        {ativo ? <span className="arq-no__estado">rodando agora</span> : null}
      </p>
      <p className="arq-no__desc">{props.descricao}</p>
      {props.padroes?.length ? (
        <p className="arq-no__padroes">
          {props.padroes.map((p) => (
            <span key={p} className="mini-chip">
              {nomePadrao(p)}
            </span>
          ))}
        </p>
      ) : null}
      {props.children}
      {props.nota ? <p className="arq-no__nota">{props.nota}</p> : null}
      {props.arquivo ? <p className="arq-no__arquivo">{props.arquivo}</p> : null}
    </div>
  );
}

function Seta({ rotulo }: { rotulo?: string }) {
  return (
    <div className="arq-seta" aria-hidden="true">
      <ArrowDown size={20} />
      {rotulo ? <span>{rotulo}</span> : null}
    </div>
  );
}

export function Arquitetura({ ativos, percorridos, pedidoContexto, aoAbrirPedidos }: Props) {
  const n = { ativos, percorridos };
  return (
    <section className="arq" aria-label="Arquitetura do agente">
      <div className="arq__topo">
        <div>
          <h2 className="lz-text-heading-lg arq__titulo">Arquitetura do agente</h2>
          <p className="arq__sub">
            Grafo LangGraph, stateless: cada turno recebe o histórico, o estado da tela e a configuração do LLM. Fonte da verdade:{" "}
            <code>apps/api/src/graph/buildGraph.ts</code>.
          </p>
        </div>
        <ul className="arq__legenda" aria-label="Legenda">
          <li>
            <span className="arq__amostra arq__amostra--ativo" /> Rodando agora
          </li>
          <li>
            <span className="arq__amostra arq__amostra--percorrido" /> Último caminho percorrido
          </li>
        </ul>
      </div>

      <p className="arq__contexto">
        Contexto do Copiloto nesta tela:{" "}
        {pedidoContexto ? (
          <strong>{pedidoContexto} (último pedido aberto)</strong>
        ) : (
          <>
            nenhum pedido.{" "}
            <button type="button" className="link-pedido" onClick={aoAbrirPedidos}>
              Abra um pedido
            </button>{" "}
            para ver o caminho de recomendação acender.
          </>
        )}
      </p>

      <div className="arq__corpo">
        <div className="arq__fluxo">
          <No
            {...n}
            ids={["entrada"]}
            className="arq-no--entrada"
            titulo="Entrada do turno"
            descricao="Mensagem do chat ou evento da tela: pedido aberto, cotação selecionada, cotação recebida (agente proativo)."
          />
          <Seta />
          <No
            {...n}
            ids={["router"]}
            titulo="router"
            descricao="Classifica a intenção (LLM para mensagens, regra fixa para eventos). Em perguntas conceituais, já busca no manual."
            padroes={["routing", "rag"]}
            arquivo="patterns/02-routing.ts"
          />
          <Seta rotulo="um caminho por intenção" />

          <div className="arq-caminhos">
            <No
              {...n}
              ids={["conceitual"]}
              titulo="conceitual"
              descricao="Responde só com os trechos do manual e cita a fonte. Nenhum especialista."
              padroes={["rag"]}
              nota="direto para finalize"
            />
            <No
              {...n}
              ids={["analisarPedido"]}
              titulo="analisarPedido"
              descricao="Cadeia: extrair (LLM) → validar contra pedido, OS e estoque (código) → resumir (LLM)."
              padroes={["prompt-chaining", "tool-use"]}
              arquivo="patterns/01-prompt-chaining.ts"
            />

            <div className="arq-recomendar">
              <p className="arq-recomendar__titulo">recomendar</p>
              <No {...n} ids={["planner"]} titulo="planner" descricao="Plano explícito; replaneja se faltar cotação válida." padroes={["planning", "rag"]} arquivo="patterns/06-planning.ts" />
              <Seta />
              <No
                {...n}
                ids={["enriquecer"]}
                titulo="enriquecer"
                descricao="Cada cotação ao mesmo tempo: fornecedor, rota até a oficina, estoque interno."
                padroes={["parallelization", "tool-use"]}
                arquivo="patterns/03-parallelization.ts"
              />
              <Seta rotulo="em paralelo" />
              <div className="arq-especialistas">
                <No {...n} ids={["custos"]} titulo="custos" descricao="Preço, frete, estoque, carro parado." />
                <No {...n} ids={["logistica"]} titulo="logística" descricao="Prazo até a oficina e pontualidade." />
                <No {...n} ids={["qualidade"]} titulo="qualidade" descricao="Tipo de peça, garantia, fornecedor." />
              </div>
              <p className="arq-recomendar__padroes">
                <span className="mini-chip">{nomePadrao("multi-agent")}</span>
                <span className="mini-chip">{nomePadrao("rag")}</span>
              </p>
              <Seta />
              <No
                {...n}
                ids={["comprador"]}
                titulo="comprador (coordenador)"
                descricao="Consolida com pesos da urgência e escolhe uma cotação."
                padroes={["multi-agent"]}
                nota={
                  <>
                    <Hand size={14} aria-hidden="true" /> Empate ou especialistas contra o vencedor: não decide e escala ao humano.
                  </>
                }
                arquivo="patterns/07-multi-agent.ts"
              />
            </div>

            <No
              {...n}
              ids={["explicar"]}
              titulo="explicar"
              descricao='"Por que não a mais barata?": validador + manual explicam a escolha.'
              padroes={["rag"]}
            />
            <No
              {...n}
              ids={["proporAcao"]}
              titulo="proporAcao"
              descricao="Monta uma Proposta (selecionar, nova cotação, emitir). O LLM escolhe ferramentas via bindTools."
              padroes={["tool-use"]}
              arquivo="patterns/05-tool-use.ts"
            />
            <No
              {...n}
              ids={["priorizar"]}
              titulo="priorizarPedidos"
              descricao="Ordena a fila de pedidos pela política (em código) e explica com o manual."
              padroes={["tool-use", "rag"]}
            />
            <No
              {...n}
              ids={["alerta", "avaliarSelecao", "avisarCotacao"]}
              titulo="eventos da tela"
              descricao="Alerta se a cotação selecionada fere a política; avisa quando chega cotação nova."
              padroes={["rag", "tool-use"]}
              nota="aviso de cotação: direto para finalize"
            />
            <No {...n} ids={["foraDoEscopo", "semPedido"]} titulo="foraDoEscopo" descricao="Recusa educada, dizendo o que o Copiloto sabe fazer." nota="direto para finalize" />
          </div>

          <Seta rotulo="rascunho da resposta" />
          <No
            {...n}
            ids={["validate"]}
            titulo="validate"
            descricao="Determinístico, SEM LLM: política em código (segurança, prazo, veto, validade, mínimo de cotações, alçada) e anti-alucinação (só cita o que existe)."
            arquivo="validator/rules.ts"
            nota={
              <>
                <CornerUpLeft size={14} aria-hidden="true" /> Reprovou: volta ao nó de origem com o erro (máx. 2 tentativas).
              </>
            }
          />
          <Seta />
          <No
            {...n}
            ids={["critic"]}
            titulo="critic"
            descricao="Revisa aderência ao manual e coerência com os números. Se o validador reprovou, o crítico é obrigado a reprovar."
            padroes={["reflection", "rag"]}
            arquivo="patterns/04-reflection.ts"
            nota={
              <>
                <CornerUpLeft size={14} aria-hidden="true" /> Reprovou: volta ao comprador ou ao proporAcao com o feedback (máx. 2 rodadas).
              </>
            }
          />
          <Seta />
          <No
            {...n}
            ids={["finalize"]}
            titulo="finalize"
            descricao="Emite a resposta com citações, registra a Proposta ou devolve a escolha ao humano (escalonamento)."
            padroes={["hitl"]}
            arquivo="patterns/08-hitl.ts"
          />
          <Seta rotulo="stream SSE de AgentEvent" />

          <div className="arq-humano">
            <p className="arq-humano__titulo">
              <Hand size={18} aria-hidden="true" /> Fora do grafo: só um humano altera dados
            </p>
            <ol className="arq-humano__passos">
              <li>Proposta no chat: Aprovar, Editar ou Recusar</li>
              <li>Endpoint de ação (POST /api/propostas/:id/aprovar…) passa de novo pelo validador</li>
              <li>Acima de R$ 5.000: fica "aguardando gestor" até "Aprovar como gestor"</li>
            </ol>
          </div>
        </div>

        <aside className="arq__recursos" aria-label="Recursos usados pelos nós">
          <div className="arq-recurso">
            <p className="arq-recurso__titulo">
              <Wrench size={16} aria-hidden="true" /> Ferramentas (somente leitura)
            </p>
            <ul>
              <li>listarPedidos</li>
              <li>listarCotacoes</li>
              <li>consultarFornecedor</li>
              <li>calcularPrazoEntrega</li>
              <li>consultarEstoqueInterno</li>
              <li>consultarPolitica</li>
              <li>buscarNoManual</li>
            </ul>
            <p className="arq-recurso__arquivo">tools/*.ts</p>
          </div>
          <div className="arq-recurso">
            <p className="arq-recurso__titulo">
              <FileText size={16} aria-hidden="true" /> Manual de Compras (RAG)
            </p>
            <p>7 arquivos, 30 seções. Embeddings locais + palavras-chave; nunca quebra o turno.</p>
            <p className="arq-recurso__arquivo">rag/search.ts</p>
          </div>
          <div className="arq-recurso">
            <p className="arq-recurso__titulo">
              <ShieldCheck size={16} aria-hidden="true" /> Política em código
            </p>
            <p>Regras duras que não dependem de prompt. Valem para o agente e para a tela manual.</p>
            <p className="arq-recurso__arquivo">validator/rules.ts</p>
          </div>
          <div className="arq-recurso">
            <p className="arq-recurso__titulo">
              <Bot size={16} aria-hidden="true" /> LLM
            </p>
            <p>Anthropic, OpenAI ou Gemini (BYOK), sempre com saída estruturada. Ou modo simulado, roteirizado.</p>
            <p className="arq-recurso__arquivo">llm/*.ts · agents/*/prompt.md</p>
          </div>
          <div className="arq-recurso">
            <p className="arq-recurso__titulo">
              <Database size={16} aria-hidden="true" /> Dados em memória
            </p>
            <p>JSON-semente: pedidos, cotações, fornecedores. "Reiniciar demo" restaura.</p>
            <p className="arq-recurso__arquivo">data/store.ts</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
