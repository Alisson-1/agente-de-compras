# Copiloto de Compras de Peças

Demo didática de **padrões de design agêntico** (livro *Agentic Design Patterns*, Antonio Gulli, 2025) aplicada à compra de peças de reposição de uma locadora de carros.

O app tem duas partes:

- **Tela de Compras** (esquerda): o sistema do comprador, em duas telas: a **lista de pedidos** (`#/pedidos`, com urgência, dias de carro parado, itens de segurança e cotações) e o **detalhe do pedido** (`#/pedidos/PED-...`, com veículo, OS, diagnóstico, itens, cotações e ações). Funciona sozinha, sem o agente, e o validador em código barra compras fora da política.
- **Arquitetura do agente** (`#/arquitetura`, botão no topo): diagrama em alto nível do grafo que acende ao vivo: o nó rodando agora pulsa e o caminho do último turno fica destacado. O Copiloto continua ao lado, usando o último pedido aberto como contexto, então dá para pedir uma recomendação e ver o grafo percorrido.
- **Copiloto de Compras** (direita): um agente que observa a tela, responde, recomenda e propõe ações. **Nunca altera nada sem aprovação humana.** Uma faixa com os 9 padrões mostra, em tempo real, qual padrão está rodando e por quê.

> Todos os dados são fictícios: placas, oficinas, fornecedores, valores, números de OS e o Manual de Compras.

## Como rodar

Requisitos: Node 22 ou mais novo e pnpm.

```bash
pnpm install
pnpm dev
```

Abra http://localhost:5173. A API sobe em http://localhost:3333 (o Vite repassa `/api`).

O **modo simulado** já vem ligado: tudo funciona sem chave e sem internet.

| Comando | O que faz |
|---|---|
| `pnpm dev` | Sobe API (tsx watch) e web (Vite) juntas |
| `pnpm ensaio` | Ensaio geral: roda o roteiro da demo no modo simulado direto no grafo e confere os desfechos dos 4 cenários |
| `pnpm ingest` | Regera o índice do RAG (`apps/api/src/rag/index.json`) a partir do manual |
| `pnpm typecheck` / `pnpm build` | Checagem de tipos e build dos três pacotes |
| `pnpm start` | Roda a API compilada (`apps/api/dist/server.js`) |

### Antes do palco

1. Rode `pnpm ensaio`. Ele deve terminar com "Ensaio OK".
2. Abra o app uma vez **com internet**: na primeira busca, a API baixa o modelo de embeddings (`Xenova/paraphrase-multilingual-MiniLM-L12-v2`, ~120 MB) para `apps/api/.cache/`. Depois disso o RAG vetorial funciona offline. Sem o modelo, a busca cai sozinha para palavras-chave e mostra um aviso; a demo não quebra.
3. Clique em "Reiniciar demo" para voltar aos dados-semente.

### Modo LLM real (BYOK)

Na engrenagem do Copiloto, desligue "Modo simulado", escolha o provedor (Anthropic, OpenAI ou Gemini), o modelo e cole a chave. A chave fica **só no `localStorage` do navegador** e vai no header `x-llm-key` de cada turno; a API nunca grava. Se uma chamada falhar (rede, chave, cota), o painel mostra um aviso e **oferece** voltar ao modo simulado (não troca sozinho).

### Prompts dos agentes

Cada agente LLM tem seu `prompt.md` em `apps/api/src/agents/<agente>/`. Eles são lidos uma vez, no boot da API. **Depois de alterar um `.md`, reinicie a API** (o `tsx watch` só observa arquivos `.ts`).

## Padrão → arquivo → onde aparece na tela

| # | Padrão | Arquivo | Onde aparece na tela |
|---|---|---|---|
| 1 | Prompt Chaining | `apps/api/src/patterns/01-prompt-chaining.ts` | "Resuma este pedido" ou abrir um pedido (proativo): widget **Cadeia de prompts** com os 3 elos (extrair → validar → resumir) e a saída de cada um |
| 2 | Routing | `apps/api/src/patterns/02-routing.ts` | Primeiro passo de todo turno; no rastro aparece a rota e o motivo |
| 3 | Parallelization | `apps/api/src/patterns/03-parallelization.ts` | "Qual cotação você recomenda?": widget **Tarefas em paralelo** com o tempo total versus o sequencial |
| 4 | Reflection | `apps/api/src/patterns/04-reflection.ts` | Widget **Revisão do crítico**: "Rodada 1: reprovado... → Rodada 2: aprovado" |
| 5 | Tool Use | `apps/api/src/patterns/05-tool-use.ts` + `apps/api/src/tools/*.ts` | Chamadas de ferramenta no rastro expandido; "Emita a compra" monta a proposta com ferramentas |
| 6 | Planning | `apps/api/src/patterns/06-planning.ts` | Widget **Plano** (checklist marcado conforme executa); replaneja se faltar cotação válida |
| 7 | Multi-Agent | `apps/api/src/patterns/07-multi-agent.ts` | Widget **Pareceres dos especialistas** (custos, logística, qualidade lado a lado) e a decisão do comprador |
| 8 | HITL | `apps/api/src/patterns/08-hitl.ts` | Card de **Proposta** (Aprovar / Editar / Recusar), selo de alçada + "Aprovar como gestor", botões de escolha no empate |
| 9 | RAG | `apps/api/src/patterns/09-rag.ts` + `apps/api/src/rag/` | Citações "§2.2" clicáveis (abrem o trecho do manual) e buscas com scores no rastro expandido |

Cada arquivo de padrão começa com um comentário explicando o que é o padrão, que problema resolve e onde aparece.

## Roteiro de demo (8 minutos)

Configuração: modo simulado e agente proativo ligados, velocidade da demo em 0,3 s. Clique em "Reiniciar demo".

| Tempo | Ação | O que mostrar | Padrões que acendem |
|---|---|---|---|
| 0:00 | Na lista de pedidos, chip **"Qual pedido devo priorizar?"** | A fila em ordem (carro parado e item de segurança primeiro), com o custo de carro parado e o próximo passo de cada pedido; os números dos pedidos são links | Routing, Tool Use, RAG, Reflection |
| 0:30 | Chip **"O que diz o manual sobre peça paralela?"** | Resposta curta com citação clicável; nenhum especialista foi acionado | Routing, RAG |
| 0:45 | Abra o **PED-2026-0412** (freio, carro parado) | Insight proativo: os 3 elos da cadeia e o resumo | Prompt Chaining, Tool Use, Reflection |
| 1:30 | Chip **"Qual cotação você recomenda?"** | Plano marcado passo a passo; 4 tarefas em paralelo; 3 pareceres; o comprador escolhe a mais barata (paralela) e o **crítico reprova citando o Manual §2.2**; a rodada 2 recomenda a COT-0412-C; proposta com Aprovar / Editar / Recusar. Na tabela, a recomendada fica destacada e as outras mostram "Por que não?" | Planning, RAG, Tool Use, Parallelization, Multi-Agent, Reflection, HITL |
| 3:00 | Chip **"Por que não a mais barata?"** | Explicação com o trecho do §2.2 | RAG, Reflection |
| 3:30 | Na tabela, selecione a **COT-0412-A** (paralela) | Alerta do validador na tela e insight proativo do agente | RAG, Reflection |
| 4:00 | Chip **"Emita a compra"** | O agente não propõe: o validador em código barra a paralela. Selecione a COT-0412-C e peça de novo: proposta → **Aprovar** → card da Ordem de Compra com origem "agente" | Tool Use, Reflection, HITL |
| 5:00 | Abra o **PED-2026-0421** (caixa de direção). "Qual cotação você recomenda?" e depois "Emita a compra" | Proposta com selo de alçada; ao aprovar, o pedido fica "aguardando aprovação do gestor"; clique **"Aprovar como gestor"** | HITL (alçada) |
| 6:15 | Abra o **PED-2026-0425** (diagnóstico bagunçado) | O elo 1 expande "susp."/"dir." e marca o amortecedor como condicional. Depois "Qual cotação você recomenda?": **empate técnico**, o agente não decide e mostra 2 botões; o clique vira a próxima mensagem e gera a proposta | Prompt Chaining, HITL (escalonamento) |
| 7:15 | Abra o **PED-2026-0418** (revisão). "Qual cotação você recomenda?" (o estoque interno cobre o filtro de óleo) e clique **"Simular chegada de cotação"** | Insight: chegou cotação nova; chip **"Reavaliar a recomendação"** muda a escolha de COT-0418-A para COT-0418-D | Tool Use, Multi-Agent |
| 8:00 | Fechamento | Os 9 chips verdes com contadores; clique num rastro para mostrar todos os eventos do turno | |

## Arquitetura

Monorepo pnpm:

| Pacote | Conteúdo |
|---|---|
| `packages/shared` | Schemas Zod e tipos: domínio, requisição do turno e contrato de eventos SSE (`AgentEvent`). Exporta o código-fonte |
| `apps/api` | Fastify + LangGraph.js. Dados em memória (JSON-semente), validador, ferramentas, RAG, agentes e grafo |
| `apps/web` | Vite + React. Tela de Compras e painel do Copiloto, com o design system em `src/design-system/localiza/` |

### Grafo (`apps/api/src/graph/buildGraph.ts`)

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
      ├─ explicar        → explica a última recomendação com RAG
      ├─ proporAcao      → monta Proposta                            [Tool Use]
      ├─ priorizarPedidos→ ordena a fila pela política (código) e explica com o manual [Tool Use + RAG]
      └─ foraDoEscopo    → recusa educada → finalize
  → validate  (determinístico, SEM LLM, política em código)
  → critic    (Reflection: coerência e aderência ao manual, máx. 2 rodadas)
  → finalize  (resposta, Proposta, escalonamento) → END
```

- **Stateless**: sem checkpointer. A cada turno a web envia histórico, estado da tela (pedido aberto, cotação selecionada, aba, última recomendação) e configuração do LLM.
- **Streaming via SSE**: `POST /api/agente/turno` devolve `AgentEvent` conforme cada nó roda. A velocidade da demo (0 a 3 s) é aplicada aos eventos-marco.
- **Saídas estruturadas**: todo nó LLM usa `withStructuredOutput(schemaZod, { includeRaw: true })` (`llm/withStructuredRetry.ts`), com uma nova tentativa se a saída fugir do schema. O `proporAcao` usa `bindTools` para o LLM escolher as ferramentas.

### Validador × crítico

- As **regras duras** da Política de Compras vivem em código (`apps/api/src/validator/rules.ts`): item de segurança só original ou homologada, carro parado exige entrega em 24h, fornecedor com nota abaixo de 3 vetado, cotação expirada vetada, mínimo de 3 cotações acima de R$ 2.000, alçada de R$ 5.000. Elas valem para a tela manual, para as propostas aprovadas e para o nó `validate`.
- O **crítico** (Reflection) cuida do qualitativo e explica a regra com o manual. Se o validador reprovou, o crítico é obrigado a reprovar (guarda em código). Por isso, no cenário 1, a recomendação da paralela é barrada pelo validador e o crítico devolve ao comprador citando o §2.2.

### Humano no circuito

Nenhuma ferramenta do agente escreve dados. Toda ação que muda algo (selecionar cotação, solicitar nova cotação, emitir compra) vira uma **Proposta**. Só os endpoints abaixo alteram dados, e só um clique humano os chama:

- `POST /api/propostas/:id/aprovar`, `/recusar`, `/editar` (a versão editada passa de novo pelo validador)
- `POST /api/compras/:id/aprovar-gestor`
- `POST /api/pedidos/:id/selecionar`, `/nova-cotacao`, `/emitir` (ações manuais da tela)
- `POST /api/demo/reiniciar`, `POST /api/demo/simular-cotacao`

Leitura: `GET /api/estado`, `/api/pedidos`, `/api/pedidos/:id`, `/api/cotacoes?pedidoId=`, `/api/fornecedores`, `/api/manual`.

### RAG

- Corpus: `apps/api/docs/manual-de-compras/*.md` (7 arquivos, seções numeradas), coerente com `apps/api/src/data/politica.json`.
- Ingestão: `pnpm ingest` divide por seção, gera embeddings **locais** com `@huggingface/transformers` e grava `apps/api/src/rag/index.json` (commitado). Embeddings locais por design: com BYOK não há garantia de API de embeddings no provedor.
- Busca: `searchManual(consulta, k)` combina cosseno e palavras-chave, **nunca lança erro** e cai para palavras-chave se o índice ou o modelo faltarem.

### Modo simulado

`apps/api/src/llm/simulated.ts` devolve respostas roteirizadas e determinísticas, montadas a partir dos dados-semente e dos trechos recuperados do manual. Só os nós LLM são simulados: ferramentas, validador, RAG, paralelismo e eventos continuam reais. Perguntas fora dos roteiros recebem uma resposta honesta ("No modo simulado eu só respondo aos cenários preparados").

## Os 4 cenários (dados-semente)

| Pedido | Cenário | O que demonstra |
|---|---|---|
| PED-2026-0412 | Freio, carro parado em Recife/PE há 2 dias. 4 cotações: paralela mais barata, rápida e cara, equilibrada (homologada, 16h) e expirada | Crítico reprova a mais barata citando §2.2; recomenda a equilibrada; alerta proativo ao selecionar a paralela |
| PED-2026-0418 | Revisão de 40 mil km, carro rodando. 3 respondidas e 1 pendente; estoque interno cobre o filtro de óleo | Tool Use (estoque), decisão por custo, "Simular chegada de cotação" muda a recomendação |
| PED-2026-0421 | Caixa de direção, alto valor | Melhor cotação passa da alçada: "aguardando gestor" até "Aprovar como gestor" |
| PED-2026-0425 | Diagnóstico "barulho na susp. dianteira lado dir., trocar bieleta e bucha, ver amortecedor" | 3 elos do Prompt Chaining; empate técnico → escalonamento com botões |
