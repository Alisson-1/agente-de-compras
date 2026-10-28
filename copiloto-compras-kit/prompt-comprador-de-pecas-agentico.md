# Prompt: Copiloto de Compras de Peças (demo didática de padrões agênticos)

> Cole este prompt inteiro num agente de código (Claude Code, Cursor etc.) numa pasta vazia. Construa em etapas e confirme cada uma antes de seguir.

---

## 1. Objetivo

Crie um projeto **didático** em **React + Node.js** para uma palestra sobre sistemas agênticos com LLMs. O domínio é a **compra de peças de reposição automotiva de uma locadora de carros** (contexto Localiza, com dados fictícios).

O projeto tem duas partes no mesmo app web:

1. **Tela de Compras:** o "sistema" que o comprador usa. Funciona **completamente sozinha**, sem o agente.
2. **Copiloto de Compras:** um painel lateral de chat com um **agente assistente**. Ele observa a tela, responde perguntas, recomenda e propõe ações, mas **nunca altera nada sem aprovação humana**.

O objetivo didático é que a plateia veja, **em tempo real**, quais padrões de design agêntico (livro *Agentic Design Patterns*, Antonio Gulli, 2025) estão sendo usados em cada resposta. Os padrões que devem aparecer são:

| # | Padrão | Chip na faixa |
|---|---|---|
| 1 | Prompt Chaining | `prompt-chaining` |
| 2 | Routing | `routing` |
| 3 | Parallelization | `parallelization` |
| 4 | Reflection | `reflection` |
| 5 | Tool Use | `tool-use` |
| 6 | Planning | `planning` |
| 7 | Multi-Agent Collaboration | `multi-agent` |
| 8 | Human-in-the-Loop | `hitl` |
| 9 | Knowledge Retrieval (RAG) | `rag` |

Prioridades, em ordem:

1. Clareza didática.
2. A demo nunca quebrar no palco.
3. Código simples e legível, um padrão por arquivo.

## 2. Regra central do produto

**O agente nunca altera dados sem aprovação explícita do usuário.** Toda ação do agente que muda algo vira uma `Proposta`, mostrada no chat com **Aprovar / Editar / Recusar**. São ações que mudam algo: selecionar cotação, solicitar nova cotação e emitir compra. Nenhuma feature nova pode criar um caminho que pule essa aprovação.

## 3. Restrições gerais

- Todos os dados são **fictícios**: placas, oficinas, fornecedores, valores, números de OS e o manual de compras. Não use logos nem nomes de empresas reais. Rodapé: "Dados fictícios para fins didáticos".
- TypeScript em tudo. Textos de interface, prompts e comentários em **português do Brasil**.
- Cada padrão em **um arquivo próprio** em `apps/api/src/patterns/`, com um comentário de cabeçalho explicando:
  - o que é o padrão;
  - que problema resolve;
  - onde aparece no fluxo e na tela.
- Cada agente LLM tem seu **`prompt.md`** ao lado do código, carregado com `readFileSync` no boot. Documente no README que alterar um `.md` exige reiniciar a API.
- Saídas de LLM sempre **estruturadas** (`withStructuredOutput` com schemas Zod e `{ includeRaw: true }` para capturar `usage_metadata`). Nunca parsear texto livre.
- Rode `typecheck` e `build` em todos os pacotes antes de considerar uma etapa pronta.

## 4. Stack

**Monorepo pnpm** (Node ≥ 22):

| Pacote | Conteúdo |
|---|---|
| `apps/web` | Vite + React + TypeScript. CSS simples ou CSS Modules, sem biblioteca de UI pesada. |
| `apps/api` | Fastify + **LangGraph.js** (`@langchain/langgraph`, `@langchain/core`, `@langchain/anthropic`, `@langchain/openai`, `@langchain/google-genai`) + `@huggingface/transformers` (embeddings locais para o RAG). |
| `packages/shared` | Schemas **Zod** e tipos: o contrato único web ↔ api. Exporta o código-fonte (`main`/`types` apontando para `./src/index.ts`). |

- **Sem banco de dados.** A API é a fonte da verdade dos dados: JSON-semente carregado em memória e alterado só pelos endpoints de ação. Botão "Reiniciar demo" restaura a semente.
- **Grafo stateless**, sem checkpointer. A cada turno, a web envia o histórico do chat, o **estado da tela** (pedido aberto, cotação selecionada, aba atual) e a configuração do LLM. A API reconstrói o contexto a partir disso e dos dados em memória.
- **Streaming via SSE**: cada nó do grafo emite eventos enquanto roda (seção 9).

## 5. Modelo de domínio (`packages/shared`)

**Veiculo**
- placa fictícia, modelo, ano, km;
- status: `parado na oficina` (indisponível para locação) ou `rodando`.

**Localizacao**
- cidade, UF;
- tipo: loja, pátio ou oficina parceira;
- nome.

**Oficina**
- id, nome fictício, cidade/UF, contato.

**OrdemDeServico (OS)**
- número, data de abertura, veículo, oficina;
- diagnóstico em texto livre, escrito "como a oficina escreveria";
- dias parado.

**ItemPedido**
- código da peça (quando houver), descrição, quantidade;
- categoria: freio, suspensão, direção, motor, elétrica, funilaria ou revisão;
- `itemDeSeguranca` (boolean).

**PedidoDeCompra**
- número (ex.: `PED-2026-0412`), OS vinculada, itens, urgência;
- status: `aberto` → `em cotação` → `cotado` → `comprado` | `aguardando aprovação do gestor` | `cancelado`.

**Cotacao**
- número, pedido, fornecedor, data de envio, validade;
- status: `respondida`, `pendente` ou `expirada`;
- itens cotados: preço unitário, marca e tipo (`original`, `homologada` ou `paralela`);
- frete, prazo de entrega em horas até a oficina, garantia em meses.

**Fornecedor**
- id, nome fictício, cidade/UF;
- nota de qualidade (0–5), % de entregas no prazo, taxa de devolução.

**OrdemDeCompra**
- número, pedido, cotação, valor total, justificativa;
- `origem`: `manual` ou `agente`;
- `padroesUsados`: lista de PatternId;
- aprovações (comprador e, se necessário, gestor) e data.

**Proposta**
- id;
- tipo: `selecionarCotacao`, `solicitarNovaCotacao` ou `emitirOrdemDeCompra`;
- payload, justificativa;
- notas do crítico;
- `requerGestor` (boolean);
- status: `pendente`, `aprovada`, `editada`, `recusada` ou `aguardando gestor`.

**PoliticaDeCompras** (JSON, espelha o manual; usada pelo validador em código)
- limite de alçada do comprador: **R$ [5.000]**;
- itens de segurança só com peça `original` ou `homologada`;
- urgente (carro parado) exige prazo ≤ 24h;
- fornecedor com nota < 3 é vetado;
- cotação expirada é vetada;
- mínimo de 3 cotações respondidas para compras acima de R$ [2.000];
- custo fictício de carro parado: R$ [180]/dia.

## 6. Tela de Compras (funciona sem o agente)

Layout em duas colunas, pensado para projetor (fonte grande, alto contraste). A coluna esquerda tem cerca de 60% da largura e contém:

- **Lista de pedidos:** número, status e badge de urgência.
- **Detalhe do pedido:**
  - **veículo** (modelo, placa, status);
  - **onde o carro está** (cidade/UF, oficina, dias parado);
  - **número da OS**, **nome da oficina**, diagnóstico;
  - itens pedidos.
- **Tabela de cotações:** fornecedor, status, tipo de peça, preço total, frete, prazo, garantia e nota do fornecedor.
  - O usuário pode **selecionar uma cotação manualmente**.
  - Ao fim de uma recomendação, a cotação escolhida pelo agente fica destacada e as descartadas mostram o motivo em tooltip.
- **Ações manuais:**
  - "Solicitar nova cotação";
  - "Emitir ordem de compra";
  - "Aprovar como gestor", que aparece quando a compra está acima da alçada, com um selo visual diferente.

  Ações manuais também passam pelo validador em código: o sistema barra uma compra que viola a política, com ou sem agente.
- **Botão de demo** "Simular chegada de cotação": adiciona uma cotação pendente como respondida e dispara um evento de tela.
- **Card da Ordem de Compra** emitida, mostrando a origem (manual ou agente).

## 7. Copiloto de Compras (painel do agente)

A coluna direita, com cerca de 40% da largura, contém:

### Chat
- Mensagens do usuário e do agente.
- **Chips de sugestão** que mudam conforme o contexto. Com um pedido aberto, por exemplo: "Resuma este pedido", "Qual cotação você recomenda?", "Por que não a mais barata?", "O que diz o manual sobre peça paralela?", "Emita a compra".

### Propostas (HITL)
- Card com resumo, justificativa, notas do crítico e os botões **Aprovar / Editar / Recusar**.
- **Editar** abre os campos da proposta (ex.: trocar a cotação ou a quantidade); a versão editada passa de novo pelo validador.
- Ao aprovar, a web chama o endpoint de ação. A ação **não** passa pelo grafo: aprovação é um ato humano.

### Rastro de padrões
Cada resposta do agente termina com uma linha clicável, por exemplo:

`Routing → RAG → Planning → Parallelization (3) → Multi-Agent → Reflection ✓ → HITL`

Ao clicar, ela se expande e mostra os eventos daquele turno.

### Faixa dos 9 padrões
Fica sempre visível no topo do painel. Cada chip tem 4 estados:

| Estado | Visual |
|---|---|
| Ainda não usado | cinza |
| **Em uso agora** | aceso e pulsando |
| Já usado | verde com ✓ |
| **Aguardando você** | destaque próprio; só HITL, quando há proposta pendente |

Cada chip mostra um contador de usos na sessão.

### Cartão "Padrão em uso agora"
Nome do padrão e uma frase `why` para a plateia. Exemplo: "Vou ouvir três especialistas antes de decidir, cada um olha um critério".

### Configurações (engrenagem)
- Provedor (Anthropic, OpenAI ou Gemini), modelo e chave (BYOK: a chave fica só no `localStorage` do navegador e vai no header de cada requisição, nunca é gravada na API).
- **Toggle Modo simulado** (seção 11).
- **Toggle Agente proativo** (seção 8.2).
- **Velocidade da demo:** atraso de 0 a 3 s entre eventos.

## 8. Como o agente é acionado

### 8.1 Pelo chat (modo livre, sem fases)
O usuário pergunta o que quiser, na ordem que quiser. O agente **nunca** fala em fases ou etapas obrigatórias.

### 8.2 Por eventos da tela
Com o "Agente proativo" ligado, a web envia eventos e o agente reage com uma mensagem curta, do tipo "insight". Para não fazer ruído, cada tipo de evento gera no máximo uma reação por pedido.

| Evento | Reação do agente |
|---|---|
| `pedido_aberto` | Resumo do pedido (Prompt Chaining) |
| `cotacao_selecionada` | Se a seleção viola a política ou contraria o manual, o agente alerta (validador + RAG + Reflection). Ex.: paralela num item de freio. |
| `cotacao_recebida` | O agente avisa que a recomendação pode mudar e oferece reavaliar |

## 9. Grafo de agentes (`apps/api/src/graph/buildGraph.ts`)

`buildGraph.ts` é a fonte da verdade da topologia. Comente no topo do arquivo o fluxo abaixo:

```
START (mensagem do chat OU evento da tela)
  → router                                        [Routing + RAG]
      ├─ conceitual      → responde direto com RAG e cita o manual → finalize
      ├─ analisarPedido  → chain: extrair → validar → resumir      [Prompt Chaining]
      ├─ recomendar      → planner                                  [Planning]
      │                     → enriquecer cotações em paralelo       [Parallelization + Tool Use]
      │                     → especialistas custo|logística|qualidade (em paralelo) [Multi-Agent + RAG]
      │                     → comprador (coordenador) consolida
      │                     → confiança baixa? → escalar ao humano  [HITL]
      ├─ explicar        → explica a última recomendação ("por que não a mais barata?") com RAG
      ├─ proporAcao      → monta Proposta (emitir compra / nova cotação / selecionar) [Tool Use]
      └─ foraDoEscopo    → recusa educada → finalize
  → validate  (determinístico, SEM LLM, política em código)
       └─ reprovou → volta ao nó de origem com o erro (máx. 2 tentativas)
  → critic    (Reflection: revisa coerência e aderência ao manual)
       └─ reprovou recomendação/proposta → volta ao comprador com o feedback (máx. 2 rodadas)
  → finalize  (emite a resposta, a Proposta e, se houver, o pedido de escalonamento) → END
```

Detalhes por padrão:

- **Routing** (`patterns/02-routing.ts`). O router classifica a intenção a partir da mensagem, do evento e do estado da tela.
  - **O router também faz retrieval.** Perguntas conceituais nunca chegam a um especialista, então quem responde precisa de grounding.
- **Prompt Chaining** (`patterns/01-prompt-chaining.ts`). São 3 elos visíveis, cada um com sua saída mostrada no rastro:
  1. extrair itens estruturados do pedido e do diagnóstico em texto livre (LLM);
  2. validar contra OS e veículo (código);
  3. resumir em 2–3 linhas (LLM).
- **Planning** (`patterns/06-planning.ts`). O planner gera um plano explícito, por exemplo:
  1. consultar manual;
  2. listar cotações válidas;
  3. enriquecer;
  4. ouvir especialistas;
  5. consolidar;
  6. revisar.

  O plano aparece como checklist no painel, marcado conforme executa. Se não houver cotações válidas suficientes, ele **replaneja** para "propor solicitar nova cotação".
- **Tool Use** (`patterns/05-tool-use.ts`). Ferramentas com descrição e schema Zod, via `bindTools`:
  - `listarCotacoes(pedidoId)`;
  - `consultarFornecedor(id)`;
  - `calcularPrazoEntrega(fornecedorId, oficinaId)`;
  - `consultarEstoqueInterno(codigoPeca)`;
  - `consultarPolitica()`;
  - `buscarNoManual(consulta)`.

  **Nenhuma ferramenta do agente altera dados**: as ações de escrita existem só como endpoints chamados depois da aprovação humana.
- **Parallelization** (`patterns/03-parallelization.ts`). Enriquece cada cotação válida em paralelo (fornecedor + prazo + estoque), com `Send` do LangGraph ou `Promise.all`. A tela mostra as N tarefas simultâneas e o tempo total comparado com o tempo sequencial. Os 3 especialistas também rodam em paralelo.
- **Multi-Agent Collaboration** (`patterns/07-multi-agent.ts`).
  - Três especialistas, cada um com seu `prompt.md`:
    - **Custos:** total, frete e custo do carro parado;
    - **Logística:** prazo até a oficina e disponibilidade da frota;
    - **Qualidade:** tipo de peça, garantia, nota do fornecedor e item de segurança.
  - Cada um devolve nota e parecer por cotação, citando o manual quando aplicável.
  - O **Comprador** consolida, usando pesos que dependem da urgência, e escolhe uma cotação com justificativa.
  - O painel mostra os 3 pareceres lado a lado.
- **HITL** (`patterns/08-hitl.ts`), em três níveis:
  1. **Proposta:** toda ação passa por Aprovar / Editar / Recusar.
  2. **Alçada:** acima do limite, a proposta aprovada pelo comprador fica `aguardando gestor` até "Aprovar como gestor".
  3. **Escalonamento por baixa confiança:** se as duas melhores cotações ficarem a menos de [5%] na nota consolidada, ou se os especialistas discordarem do vencedor, o agente **não decide**. Ele devolve a pergunta ao humano, com as opções em botões; o clique vira a próxima mensagem.
- **Reflection** (`patterns/04-reflection.ts`). O crítico confere a recomendação ou proposta contra o manual (via RAG) e verifica se a justificativa é coerente com os números. Se reprovar, devolve ao comprador com feedback, em no máximo 2 rodadas. O painel mostra "Rodada 1: reprovado porque... → Rodada 2: aprovado".
  - **Separe o crítico do validador:** regras críticas da política ficam **em código** (`validator/rules.ts`) e nunca dependem só do prompt. O crítico cuida do qualitativo.
- **RAG** (`patterns/09-rag.ts`). Ver seção 10.

## 10. RAG: o Manual de Compras

### Corpus
Crie em `apps/api/docs/manual-de-compras/` um **manual fictício** em Markdown, com 6 a 8 arquivos curtos e seções numeradas, para que as citações fiquem claras. Por exemplo:

1. Alçadas e aprovações;
2. Itens de segurança e tipos de peça (original, homologada, paralela);
3. Prazos por urgência e custo de veículo parado;
4. Processo de cotação (mínimo de cotações, validade, como solicitar nova);
5. Avaliação de fornecedores (nota, entregas no prazo, devoluções, veto);
6. Garantia e devolução de peças;
7. Glossário (OS, cotação, pedido, ordem de compra, homologada).

O conteúdo deve ser **coerente com a `PoliticaDeCompras` em JSON**.

### Ingestão
`pnpm ingest` divide os arquivos em chunks por seção, gera embeddings **locais** com `@huggingface/transformers` e grava `apps/api/src/rag/index.json`, que vai **commitado** no repositório.
- Use um modelo multilíngue, para lidar com o português (ex.: `Xenova/paraphrase-multilingual-MiniLM-L12-v2`).
- Embeddings locais por design: BYOK não garante um provedor com API de embeddings.

### Busca
`searchManual(consulta, k)` usa similaridade de cosseno e **nunca lança erro**. Se o índice faltar, o modelo não carregar ou ocorrer qualquer outra falha, a função cai para uma **busca por palavras-chave** sobre os mesmos chunks e emite um `warning`. O turno nunca quebra. O índice é carregado uma vez e cacheado.

### Quem usa
- o router, nas perguntas conceituais;
- os especialistas;
- o crítico;
- o nó `explicar`.

### Na tela
Cada busca emite um evento `rag_retrieval` com os trechos e os scores. As respostas citam a fonte (ex.: "Manual de Compras §2.3"), e a citação é clicável: abre o trecho num popover.

## 11. Modo simulado (reserva para o palco)

- Liga e desliga por um toggle no painel. O painel mostra um selo **"Modo simulado"** ou **"LLM real: <modelo>"**.
- No modo simulado, os nós LLM devolvem respostas **roteirizadas e determinísticas** (`llm/simulated.ts`), montadas a partir dos dados-semente para os 4 cenários e para os chips de sugestão.
  - O resto continua real: ferramentas, validador, RAG, paralelismo e eventos.
  - O grafo, os eventos e a faixa de padrões se comportam **igual** aos do modo real.
- No modo real, se uma chamada ao LLM falhar (rede, chave ou cota), o painel emite um `warning` e **oferece** trocar para o modo simulado. Não troca sozinho.
- Uma pergunta livre fora dos roteiros, no modo simulado, recebe uma resposta genérica honesta ("No modo simulado eu só respondo aos cenários preparados").

## 12. Contrato de eventos (SSE)

`POST /api/agente/turno` responde um stream SSE. Defina o contrato em `packages/shared`:

```ts
type PatternId = "prompt-chaining" | "routing" | "parallelization" | "reflection"
  | "tool-use" | "planning" | "multi-agent" | "hitl" | "rag";

type AgentEvent =
  | { type: "pattern_start"; pattern: PatternId; node: string; why: string; ts: number }
  | { type: "pattern_end"; pattern: PatternId; node: string; summary: string; durationMs: number; ts: number }
  | { type: "route"; intent: Intent; reason: string }
  | { type: "rag_retrieval"; query: string; chunks: { source: string; section: string; text: string; score: number }[] }
  | { type: "chain_step"; step: 1 | 2 | 3; name: string; output: unknown }
  | { type: "plan"; steps: { id: string; label: string; status: "pendente" | "executando" | "feito" | "falhou" }[] }
  | { type: "tool_call"; tool: string; args: unknown; resultSummary: string }
  | { type: "parallel_task"; taskId: string; label: string; status: "iniciada" | "concluida"; durationMs?: number }
  | { type: "agent_opinion"; agent: "custos" | "logistica" | "qualidade" | "comprador"; content: unknown }
  | { type: "validation"; ok: boolean; errors: string[] }
  | { type: "reflection"; round: number; approved: boolean; feedback: string }
  | { type: "hitl"; kind: "proposta" | "alcada" | "escalonamento"; proposta?: Proposta; opcoes?: string[] }
  | { type: "message"; text: string; citations?: string[] }
  | { type: "trace"; node: string; tokens?: { input: number; output: number }; latencyMs: number }
  | { type: "warning" | "error"; message: string }
  | { type: "done" };
```

**Endpoints de ação** (só humanos chamam):

- `POST /api/propostas/:id/aprovar`
- `POST /api/propostas/:id/recusar`
- `POST /api/propostas/:id/editar`
- `POST /api/compras/:id/aprovar-gestor`
- `POST /api/demo/reiniciar`
- `POST /api/demo/simular-cotacao`

Também ficam disponíveis os `GET` de pedidos, cotações e fornecedores.

## 13. Dados-semente: 4 cenários

Faça os números serem coerentes, para que a decisão "certa" seja defensável.

1. **Freio, carro parado (urgente, item de segurança)**
   - Pastilha e disco dianteiros; oficina parceira em Recife/PE; carro parado há 2 dias.
   - 4 cotações:
     - a mais barata é **paralela**;
     - uma é rápida e cara;
     - uma é equilibrada (homologada, ≤ 24h);
     - uma está expirada.
   - **Objetivo:** na 1ª rodada, o comprador tende à mais barata e o **crítico reprova** com base no manual §2. Na 2ª rodada, ele recomenda a equilibrada. Se o usuário selecionar a paralela manualmente, o agente proativo alerta.
2. **Kit de revisão 40 mil km (rotina)**
   - Filtros, óleo e velas; carro rodando.
   - 3 cotações respondidas e 1 pendente; o **estoque interno** cobre o filtro de óleo.
   - **Objetivo:** Tool Use relevante, decisão por custo e o "Simular chegada de cotação" mudando a recomendação.
3. **Caixa de direção (alto valor)**
   - A melhor cotação passa da alçada.
   - **Objetivo:** proposta aprovada pelo comprador vai para `aguardando gestor` → botão "Aprovar como gestor".
4. **Diagnóstico bagunçado + empate**
   - Diagnóstico: "barulho na susp. dianteira lado dir., trocar bieleta e bucha, ver amortecedor".
   - **Objetivo:**
     - o **Prompt Chaining** extrai os itens do texto livre, mostrando cada elo;
     - duas cotações ficam empatadas;
     - o agente **escala para o humano** com botões de escolha.

## 14. Identidade visual: design system da Localiza

A pasta `design-system/localiza/`, na raiz deste projeto, contém o design system que **toda** a interface deve usar. A regra `.cursor/rules/localiza-design-system.mdc` detalha como.

- **Etapa 1:** copie `design-system/localiza/` para `apps/web/src/design-system/localiza/` e importe `tokens.css` e `components.css` uma vez no `main.tsx`.
- **Leia `design-system/localiza/README.md` antes de criar qualquer tela.** Ele define cor, tipografia, voz dos textos, formas e estados.
- **Use os componentes prontos** de `components.tsx` (`Button`, `IconButton`, `TextField`, `Checkbox`, `Chip`, `Alert`, `Tabs`, `Card`, `Tooltip`, `Accordion`), lendo o guia de cada um em `components/<Nome>.md`.
- Componentes novos usam **só as variáveis CSS** de `tokens.css` (`var(--tertiary-default)`, `var(--spacing-2)`, `var(--radius-main)`...). Nada de hex soltos.
- A tabela "Mapeamento para o Copiloto de Compras" da regra define as cores dos chips de padrão, do card de proposta, do botão de gestor e da cotação recomendada.
- Ícones: Lucide (`lucide-react`), linha arredondada de 2px. Sem logo.
- Os chips de padrão mostram o nome em inglês, com tooltip em português.

## 15. Estrutura de pastas esperada

```
apps/
  api/
    docs/manual-de-compras/*.md
    src/
      server.ts
      graph/buildGraph.ts  graph/state.ts  graph/routing.ts
      patterns/01-prompt-chaining.ts ... 09-rag.ts
      agents/<agente>/index.ts + prompt.md   (router, chain, planner, custos, logistica, qualidade, comprador, critic, explicar)
      tools/*.ts
      validator/rules.ts
      rag/ingest.ts  rag/search.ts  rag/index.json
      llm/provider.ts  llm/simulated.ts  llm/withStructuredRetry.ts
      events/emitter.ts          (emite AgentEvent respeitando a velocidade da demo)
      data/*.json  store.ts      (estado em memória + reset)
  web/
    src/
      pages/App.tsx
      compras/   PedidoList, PedidoDetalhe, CotacoesTable, OrdemDeCompraCard, AcoesManuais
      copiloto/  Chat, SuggestionChips, PropostaCard, PatternStrip, PatternNow,
                 PatternTrail, PlanChecklist, ParallelTasks, OpinionsPanel,
                 ReflectionRounds, RagCitations, Settings
      hooks/useAgentStream.ts  hooks/useScreenEvents.ts
packages/
  shared/src/index.ts
README.md
```

## 16. Entrega em etapas

1. Monorepo, schemas, semente, store em memória, `GET`s e endpoints de ação. **Tela de Compras completa funcionando sem agente**, incluindo validador e "Aprovar como gestor".
2. Contrato SSE, `useAgentStream` e painel do Copiloto com chat, faixa de padrões e rastro, recebendo eventos fake.
3. Manual de compras, ingestão, `searchManual` com fallback e citações na tela.
4. Grafo completo no **modo simulado**, cobrindo os 4 cenários, propostas (HITL), escalonamento, eventos de tela e agente proativo.
5. Modo LLM real (BYOK, 3 provedores), structured output com `includeRaw`, `bindTools` e oferta de troca para o modo simulado em caso de falha.
6. Polimento didático (cartão "padrão em uso agora", velocidade da demo) e `README.md` com:
   - como rodar;
   - **tabela "padrão → arquivo → onde aparece na tela"**;
   - **roteiro de demo de 8 minutos** usando os chips de sugestão, garantindo que os 9 padrões acendam.

## 17. Critérios de aceite

- [ ] `pnpm install && pnpm dev` sobe API e web; com o **modo simulado** ligado, tudo funciona **sem chave e sem internet** (índice RAG commitado; fallback por palavra-chave se o modelo de embeddings não carregar).
- [ ] A Tela de Compras emite uma compra **sem usar o agente**, e o validador barra compras que violam a política.
- [ ] Nenhuma ação do agente altera dados sem clique humano em Aprovar.
- [ ] Cenário 1: o crítico reprova a 1ª escolha citando o manual; a 2ª é aprovada; selecionar a paralela manualmente gera um alerta proativo.
- [ ] Cenário 2: o estoque interno é consultado; "Simular chegada de cotação" muda a recomendação.
- [ ] Cenário 3: a compra fica `aguardando gestor` até "Aprovar como gestor".
- [ ] Cenário 4: os 3 elos do Prompt Chaining aparecem; o empate gera escalonamento com botões.
- [ ] "O que diz o manual sobre peça paralela?" responde com citação clicável do manual, sem passar por especialista.
- [ ] Em qualquer momento, quem olha a tela sabe **qual padrão está rodando e por quê**; ao fim do roteiro, os 9 chips estão verdes.
- [ ] `typecheck` e `build` passam nos três pacotes.

## 18. O que NÃO fazer

- Não criar modo guiado nem fases: o agente é livre e reativo.
- Não dar ao agente ferramentas que escrevem dados.
- Não colocar regras críticas da política só no prompt.
- Não deixar o LLM inventar cotações, preços ou trechos do manual: tudo vem das ferramentas, da semente ou do RAG.
- Não adicionar autenticação, banco de dados, Docker, testes E2E ou extensão de navegador.
