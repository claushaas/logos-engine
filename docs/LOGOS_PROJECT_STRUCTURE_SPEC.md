# LOGOS Project Structure Spec

**Status:** Rascunho 1
**Escopo:** Repositório LOGOS Engine + projetos gerados pelo LOGOS
**Público:** engenharia, implementação
**Propósito canônico:** Definir layouts de diretórios, contratos de arquivos, níveis de canonicidade, fronteiras de escrita, regras de versionamento e segurança de caminhos para o ecossistema LOGOS.

---

## 1. Propósito

Esta especificação define os contratos estruturais para dois domínios distintos:

1. **Repositório LOGOS Engine** (`logos-engine/`) — a ferramenta em si, um único pacote TypeScript.
2. **Projetos gerados pelo LOGOS** — a saída de `logos init`, uma árvore de documentação nativa em Git.

Cada arquivo em um projeto LOGOS pertence a exatamente um nível de canonicidade. Misturar níveis silenciosamente é a principal fonte de estado corrompido, rastreabilidade quebrada e builds não reproduzíveis. Esta spec torna as fronteiras explícitas e verificáveis por máquina.

---

## 2. Estrutura do Repositório (`logos-engine/`)

O LOGOS Engine é um **single package** — sem monorepo, sem `packages/`, sem `apps/`, sem `pnpm-workspace.yaml` além da declaração do pacote raiz.

```
logos-engine/
├── src/
│   ├── cli/                     # Entrypoint CLI Commander + comandos
│   │   ├── main.ts
│   │   ├── command-registry.ts
│   │   └── commands/
│   │       ├── init.ts
│   │       ├── status.ts
│   │       ├── validate.ts
│   │       ├── interview.ts
│   │       ├── generate.ts
│   │       └── compile.ts
│   │
│   ├── tui/                     # UI de terminal Ink + React
│   │   └── state/
│   │       ├── tui-state.ts
│   │       └── tui-actions.ts
│   │
│   ├── core/                    # Engine determinístico (sem LLM)
│   │   ├── project/             #   load, manifest, graph, status
│   │   ├── schema/              #   Schemas Zod para docs, fases, executive
│   │   ├── documents/           #   parse, extract, validate, completeness, patch
│   │   ├── phases/              #   registry, completeness, dependencies
│   │   ├── diagnostics/         #   Diagnostic, severity, format
│   │   └── index.ts
│   │
│   ├── interview/               # Máquina de estados da entrevista
│   │   ├── transcript/          #   TranscriptMessage, TranscriptStore
│   │   ├── questions/           #   InterviewQuestion, load, queue
│   │   ├── answers/             #   AnswerAssessment, CanonicalAnswerRecord, synthesize, finalize
│   │   ├── decisions/           #   DocumentationDecision, record, trace
│   │   ├── state-machine/       #   states, events, transitions, guards
│   │   ├── trace/               #   build trace, verify completeness
│   │   ├── generation-readiness/
│   │   └── index.ts
│   │
│   ├── llm/                     # Transporte LLM + saída estruturada
│   │   ├── client.ts            #   Interface LlmClient + factory createLlmClient
│   │   ├── config.ts            #   loadLlmConfig, validateLlmConfig, carregamento .env
│   │   ├── types.ts
│   │   ├── generate-text.ts           # texto bruto (exceção, não regra)
│   │   ├── generate-json.ts           # JSON baseado em prompt (legado)
│   │   ├── generate-structured-output.ts  # ★ primitivo central
│   │   ├── retry-policy.ts            # withRetry, isRetryable, backoff
│   │   ├── response-validation.ts     # ValidationOutcome, tryParseJson, validateAgainstSchema
│   │   └── index.ts                   # barrel público
│   │
│   ├── prompts/                 # Construtores de prompts semânticos
│   │   ├── assess-answer.prompt.ts
│   │   ├── synthesize-canonical-answer.prompt.ts
│   │   ├── detect-conflict.prompt.ts
│   │   ├── resolve-conflict.prompt.ts
│   │   ├── generate-document.prompt.ts
│   │   ├── review-document.prompt.ts
│   │   ├── compile-executive.prompt.ts
│   │   └── index.ts
│   │
│   ├── renderers/               # Transformadores Modelo → Artefato
│   │   ├── markdown/
│   │   ├── html/
│   │   ├── agent-pack/
│   │   └── index.ts
│   │
│   ├── executive/               # Compilador do eixo executivo + adapters
│   │   ├── compiler/
│   │   ├── adapters/
│   │   ├── schema/
│   │   └── index.ts
│   │
│   ├── fs/                      # Acesso seguro ao sistema de arquivos
│   │   ├── project-fs.ts
│   │   ├── safe-path.ts
│   │   ├── atomic-write.ts
│   │   ├── read-yaml.ts
│   │   └── write-jsonl.ts
│   │
│   └── shared/                  # Utilitários transversais
│       ├── errors/
│       │   ├── LogosError.ts
│       │   └── invariant.ts
│       ├── types/
│       │   ├── Brand.ts
│       │   └── Result.ts
│       └── utils/
│           ├── id.ts
│           ├── date.ts
│           └── json.ts
│
├── templates/                   # Templates de documentos e fases distribuídos com a engine
├── profiles/                    # Perfis de projeto
├── examples/                    # Projetos LOGOS de exemplo
├── docs/                        # Documentação da engine (este arquivo, arquitetura, spec de ciclo de vida)
├── tests/                       # Suite de testes Vitest
├── package.json                 # Single package — "type": "module"
├── tsconfig.json
├── vitest.config.ts
├── biome.json
├── .env.example                 # Placeholders seguros para vars LOGOS_LLM_*
└── README.md
```

### 2.1 Regras de ownership dentro da engine

| Diretório | Pode chamar LLM? | Pode escrever arquivos? | Pode importar de |
|---|---|---|---|
| `src/core`       | ❌ Não | ❌ Não (usa `src/fs`) | `src/shared`, `src/fs` |
| `src/interview`  | ❌ Não (delega para `src/prompts`) | ❌ Não (usa `src/fs`) | `src/core`, `src/prompts`, `src/shared` |
| `src/llm`        | ✅ Sim (transporte) | ❌ Não | `src/shared` |
| `src/prompts`    | ✅ Sim (via `src/llm`) | ❌ Não | `src/llm`, `src/shared` |
| `src/renderers`  | ❌ Não | ❌ Não (usa `src/fs`) | `src/core`, `src/executive`, `src/shared` |
| `src/executive`  | ❌ Não (delega para `src/prompts`) | ❌ Não (usa `src/fs`) | `src/core`, `src/prompts`, `src/shared` |
| `src/fs`         | ❌ Não | ✅ Sim (o único escritor) | `src/shared` |
| `src/tui`        | ❌ Não | ❌ Não | `src/core`, `src/interview`, `src/executive` |
| `src/cli`        | ❌ Não | ❌ Não | `src/core`, `src/interview`, `src/executive` |

---

## 3. Estrutura do Projeto Gerado (`logos init`)

Quando o usuário executa `logos init` dentro de um diretório de projeto, o seguinte layout é criado:

```
my-project/                         # Raiz do Git
│
├── logos.yml                       # Manifesto do projeto
├── docs.yml                        # Registro de documentos
│
├── phases/                         # Descritores de fase (YAML)
│   ├── 01-foundation.yml
│   ├── 02-validation.yml
│   ├── 03-product.yml
│   ├── 04-engineering.yml
│   ├── 05-go-to-market.yml
│   └── 06-operations.yml
│
├── docs/                           # ★ DOCUMENTOS CANÔNICOS (Markdown)
│   ├── 01-foundation/
│   │   ├── README.md
│   │   ├── 01-thesis.md
│   │   ├── 02-problem.md
│   │   ├── 03-audience.md
│   │   ├── 04-tensegrity.md
│   │   ├── 05-anti-scope.md
│   │   └── 06-success-metrics.md
│   ├── 02-validation/
│   │   └── ...
│   ├── 03-product/
│   │   └── ...
│   ├── 04-engineering/
│   │   └── ...
│   ├── 05-go-to-market/
│   │   └── ...
│   └── 06-operations/
│       └── ...
│
├── executive/                      # ★ MODELO EXECUTIVO (portável)
│   ├── executive-plan.json         #   Modelo de execução compilado
│   ├── executive-plan.schema.json  #   Schema para validação
│   └── exports/                    #   Alvos de exportação derivados
│       ├── markdown/
│       ├── html/
│       ├── github/
│       ├── notion/
│       └── agent-packs/
│
├── outcomes/                       # Artefatos derivados e regeneráveis
│   ├── html/
│   │   ├── project-dashboard.html
│   │   ├── phase-map.html
│   │   └── executive-overview.html
│   ├── reports/
│   └── snapshots/
│
└── .logos/                         # ★ ESTADO LOCAL (nunca commitado)
    ├── interviews/
    │   └── <interview-id>/         #   ex.: interview_2026-05-25_143000
    │       ├── state.json                    # InterviewRunState
    │       ├── transcript.jsonl             # ★ log literal append-only
    │       ├── transcript.md                #   export legível por humanos
    │       ├── canonical-answers.json       #   CanonicalAnswerRecord[]
    │       ├── answer-revisions.json        #   histórico de revisões
    │       ├── conflicts.json               #   ConflictRecord[]
    │       ├── decisions.json               #   DocumentationDecision[]
    │       ├── generation-readiness.json
    │       └── generated-drafts/
    │           ├── 01-thesis.draft-001.md
    │           └── 01-thesis.draft-001.trace.json
    ├── sessions/
    ├── cache/
    ├── runs/
    ├── logs/
    └── config.local.json
```

---

## 4. Arquivos Canônicos

Arquivos canônicos são a **fonte da verdade**. São escritos por humanos (ou aceitos por humanos), versionados e nunca sobrescritos automaticamente sem aprovação explícita do usuário e versionamento.

### 4.1 Definição

Um arquivo é canônico se:

1. Está sob `docs/**/*.md`, `phases/*.yml`, `logos.yml` ou `docs.yml`.
2. É a fonte autoritativa para seu domínio.
3. É versionado no Git.
4. Passa na validação de schema.
5. Mudanças nele são rastreáveis (via patch, revisão ou commit).

### 4.2 Inventário de arquivos canônicos

| Caminho | Formato | Schema | Descrição |
|---|---|---|---|
| `logos.yml` | YAML | `logos.schema` | Identidade do projeto, metadados, fases |
| `docs.yml` | YAML | `docs.schema` | Registro de documentos, ordenação, flags obrigatórios |
| `phases/*.yml` | YAML | `phase.schema` | Descritores de fase, listas de documentos, dependências |
| `docs/**/*.md` | Markdown | `document.schema` | ★ Conteúdo canônico dos documentos |

### 4.3 Regras

- Arquivos canônicos **não devem ser editados pelo LLM diretamente**. O LLM propõe patches; o usuário aceita ou rejeita.
- Arquivos canônicos **devem passar na validação de schema** antes de poderem ser salvos.
- Escrever em um local canônico sem um `DocumentPatch` + aprovação do usuário é uma violação.
- `docs/**/*.md` é a **forma final renderizada**. Não é um rascunho, não é uma transcrição, não é uma representação intermediária. É o artefato que todas as saídas derivadas consomem.

---

## 5. Arquivos de Estado Operacional

Arquivos de estado operacional são a memória de trabalho da engine de entrevista. Residem sob `.logos/interviews/<id>/` e **nunca são commitados no Git**.

### 5.1 `transcript.jsonl`

```
Propósito:  Log de conversa literal e somente de acréscimo.
Formato:    JSONL (um objeto JSON por linha).
Schema:     TranscriptMessage
Ownership:  Máquina de estados da entrevista (estado TRANSCRIBING_MESSAGE)
Escritas:   Somente acréscimo. Nunca atualizar, nunca excluir.
```

**Contrato:**

```txt
Toda mensagem do usuário e do agente DEVE ser escrita em transcript.jsonl
ANTES que qualquer avaliação semântica ocorra.

Ordem:
  receber → anexar ao transcript.jsonl → avaliar

Nunca:
  receber → avaliar → salvar apenas resumo
```

### 5.2 `canonical-answers.json`

```
Propósito:  Respostas finais estruturadas por pergunta de documentação.
Formato:    Array JSON de CanonicalAnswerRecord.
Schema:     CanonicalAnswerRecord
Ownership:  Máquina de estados da entrevista (estado RECORDING_CANONICAL_ANSWER)
Escritas:   Acrescentar novos registros. Revisões criam novos registros com
            versão incrementada + previousAnswerId.
```

**Contrato:**

```txt
Todo CanonicalAnswerRecord DEVE referenciar:
  - sourceMessageIds (entradas da transcrição)
  - derivation (IDs de mensagens do usuário, agente, complemento, resolução de conflito)
  - confidence (low | medium | high)
  - answerStatus (final | provisional | hypothesis | skipped | not_applicable | conflicted)

Documentos são gerados A PARTIR de canonical-answers.json, NÃO de transcript.jsonl.
```

### 5.3 `decisions.json`

```
Propósito:  Log de auditoria estruturado de decisões de documentação.
Formato:    Array JSON de DocumentationDecision.
Ownership:  Máquina de estados da entrevista + handlers de sobreposição do usuário
Escritas:   Somente acréscimo.
```

### 5.4 `conflicts.json`

```
Propósito:  Contradições detectadas entre respostas.
Formato:    Array JSON de ConflictRecord.
Ownership:  Estado RECONCILING_CONFLICT
Escritas:   Acréscimo. Conflitos resolvidos marcados com resolução.
```

### 5.5 `state.json`

```
Propósito:  Estado atual da execução da entrevista para retomada.
Formato:    JSON → InterviewRunState
Ownership:  Máquina de estados (toda transição atualiza este arquivo)
Escritas:   Sobrescrever (último estado bom conhecido).
```

### 5.6 `generation-readiness.json`

```
Propósito:  Avaliação de completude pré-geração.
Formato:    JSON → GenerationReadiness
Ownership:  Estados INTERVIEW_COMPLETE / OFFER_GENERATION
Escritas:   Sobrescrever.
```

### 5.7 `generated-drafts/`

```
Propósito:  Rascunhos produzidos antes da aceitação canônica.
Formato:    Markdown (.md) + JSON de rastreamento (.trace.json)
Ownership:  Estado GENERATING_DOCUMENTS
Escritas:   Criar novos arquivos de rascunho. Nunca sobrescrever docs/ canônicos diretamente.
```

### 5.8 Regras de estado operacional

- Todo conteúdo de `.logos/` é **estado local**, nunca commitado.
- `transcript.jsonl` é **append-only** — a regra de integridade mais importante.
- `canonical-answers.json` é a **ponte auditável** entre a conversa bruta e os documentos gerados.
- Nenhum arquivo de estado operacional deve ser editado manualmente.

---

## 6. Artefatos Derivados

Artefatos derivados são regeneráveis a partir de fontes canônicas. Carregam timestamp e referência de origem. **Nunca são a fonte da verdade**.

### 6.1 `outcomes/html/`

```
Fonte:      docs.yml + docs/**/*.md + executive-plan.json
Gerado por: logos render html
Regenerável: ✅ Sim
Versionado:  Opcional (pode ser commitado por conveniência, mas é reconstruível)
```

Arquivos:
- `project-dashboard.html` — visão geral completa do projeto
- `phase-map.html` — visualização em nível de fase
- `executive-overview.html` — resumo do eixo executivo

### 6.2 `executive/executive-plan.json`

```
Propósito:  Modelo de execução portável.
Fonte:      docs.yml + phases/*.yml + docs/**/*.md + diagnostics + decisions
Gerado por: logos compile executive
Regenerável: ✅ Sim
Versionado:  ✅ Sim (este é o contrato de exportação para ferramentas externas)
Schema:      executive-plan.schema.json
```

**Importante:** `executive-plan.json` é um **modelo compilado**, não um banco de dados de tarefas. O LOGOS não rastreia status de tarefas. Ele compila a estrutura de execução e a exporta. Ferramentas externas (GitHub, Notion, agent runtimes) são donas do ciclo de vida da execução.

### 6.3 `executive/exports/`

```
Fonte:      executive-plan.json
Gerado por: logos export <alvo>
Regenerável: ✅ Sim
Versionado:  Opcional
```

Alvos:
- `markdown/` — plano de implementação como Markdown
- `html/` — visão geral executiva renderizada
- `github/` — payload de GitHub Issues
- `notion/` — payload de banco de dados Notion
- `agent-packs/` — prompts Agent Pack para agentes externos

### 6.4 Regras de artefatos derivados

- Todo arquivo derivado deve declarar sua **fonte** e **timestamp de geração** em um cabeçalho ou metadados complementares.
- Arquivos derivados podem ser commitados por conveniência, mas devem ser **reconstruíveis** apenas a partir de fontes canônicas.
- Edições manuais em arquivos derivados são descartadas na próxima geração.

---

## 7. Alvos de Exportação

Alvos de exportação são a ponte entre o LOGOS e ferramentas externas.

| Alvo | Formato | Fonte | Comando |
|---|---|---|---|
| Plano Markdown | `.md` | `executive-plan.json` | `logos export markdown` |
| GitHub Issues | JSON (GitHub API) | `executive-plan.json` + mapping | `logos export github` |
| Páginas Notion | JSON (Notion API) | `executive-plan.json` + mapping | `logos export notion` |
| Visão HTML | `.html` | `docs.yml` + docs + executive | `logos render html` |
| Agent Packs | `.md` prompts | `executive-plan.json` + docs | `logos export agent-packs` |

---

## 8. Configuração Local e Segredos

### 8.1 `.logos/config.local.json`

```
Propósito:  Preferências locais do usuário (nunca commitado).
Exemplos:   último documento aberto, modelo selecionado, preferências de UI.
Escritas:   TUI / CLI em ação do usuário.
```

### 8.2 `.env`

```
Propósito:  Credenciais LLM (nunca commitado).
Variáveis:  LOGOS_LLM_BASE_URL, LOGOS_LLM_API_KEY, LOGOS_LLM_MODEL
Carregado:  src/llm/config.ts → loadLlmConfig()
```

A engine distribui `.env.example` com placeholders seguros. O usuário copia para `.env` e preenche com valores reais. `.env` está no `.gitignore`.

### 8.3 Regras de segredos

- **Nunca** commitar `.env` ou qualquer arquivo contendo chaves de API.
- `LOGOS_LLM_API_KEY` é o único segredo obrigatório.
- `LOGOS_ENV_FILE` pode apontar para um caminho `.env` alternativo para CI ou setups customizados.

---

## 9. Regras de Versionamento Git

### 9.1 Arquivos a commitar

| Caminho | Justificativa |
|---|---|
| `logos.yml` | Manifesto canônico do projeto |
| `docs.yml` | Registro canônico de documentos |
| `phases/*.yml` | Descritores canônicos de fase |
| `docs/**/*.md` | ★ Documentos canônicos |
| `executive/executive-plan.json` | Modelo de execução portável (reconstruível mas versionado para rastreamento de diffs) |
| `executive/executive-plan.schema.json` | Schema para validação |
| `outcomes/html/*.html` | Opcional: commitar para visualização fácil, mas regenerável |
| `templates/`, `profiles/` (repo da engine) | Distribuídos com a ferramenta |
| `.env.example` | Template de placeholder seguro |

### 9.2 Arquivos a ignorar (`.gitignore`)

```gitignore
# Segredos
.env
.env.*

# Estado local
.logos/

# Derivados (opcional — podem ser commitados se desejado)
outcomes/html/
outcomes/reports/
outcomes/snapshots/
executive/exports/github/
executive/exports/notion/

# Apenas repo da engine
node_modules/
dist/
coverage/
```

### 9.3 Justificativa

A regra é simples:

```txt
Se um arquivo pode ser regenerado apenas de fontes canônicas → commit opcional.
Se um arquivo é canônico ou o contrato de exportação → commit obrigatório.
Se um arquivo contém segredos ou estado local → nunca commitar.
```

---

## 10. Regras de Segurança de Caminho

Toda operação de sistema de arquivos no LOGOS Engine deve passar por `src/fs/safe-path.ts`.

### 10.1 Restrições

1. **Sem path traversal.** Caminhos resolvidos devem permanecer dentro da raiz do projeto.
2. **Sem escritas fora do projeto.** A engine nunca deve escrever em caminhos acima da raiz do projeto LOGOS.
3. **Sem seguir symlinks para alvos externos.**
4. **Allowlist explícita.** Escritas são permitidas apenas em diretórios conhecidos:
   - `docs/**/*.md` (canônico, via aprovação de patch)
   - `executive/**` (saída compilada)
   - `outcomes/**` (artefatos derivados)
   - `.logos/**` (estado operacional)
   - Arquivos YAML da raiz do projeto (`logos.yml`, `docs.yml`, `phases/*.yml`)

### 10.2 Contrato `safePath`

```ts
function safePath(projectRoot: string, relativePath: string): string
```

- Resolve `relativePath` contra `projectRoot`.
- Lança `LogosError` se o caminho resolvido escapar da raiz do projeto.
- Lança `LogosError` se o caminho contiver segmentos `..` que escapem.
- Normaliza o caminho (sem barras finais, sem segmentos redundantes).

### 10.3 Allowlist de escrita

```ts
const WRITE_ALLOWLIST = [
  /^docs\//,                    // documentos canônicos
  /^phases\//,                  // descritores de fase
  /^executive\//,               // saídas compiladas
  /^outcomes\//,                // artefatos derivados
  /^\.logos\//,                 // estado operacional
  /^logos\.yml$/,               // manifesto do projeto
  /^docs\.yml$/,                // registro de documentos
];
```

Qualquer escrita em um caminho que não corresponda a um padrão da allowlist deve ser rejeitada.

---

## 11. Fronteiras de Escrita

### 11.1 Quem pode escrever onde

| Escritor | Canônico (`docs/`) | Operacional (`.logos/`) | Derivado (`outcomes/`, `executive/`) |
|---|---|---|---|
| Usuário (via TUI accept) | ✅ Sim | ❌ Não | ❌ Não |
| Engine de entrevista | ❌ Não | ✅ Sim (transcript, answers, state) | ❌ Não |
| Pipeline de geração | ❌ Não (apenas propõe) | ✅ Sim (drafts) | ❌ Não (delega ao compilador) |
| Compilador executivo | ❌ Não | ❌ Não | ✅ Sim (`executive-plan.json`, exports) |
| Renderers | ❌ Não | ❌ Não | ✅ Sim (`outcomes/html/`) |
| LLM (direto) | ❌ **NUNCA** | ❌ Não | ❌ Não |

### 11.2 Escritas canônicas baseadas em patch

O único caminho para modificar um documento canônico é:

```txt
1. Agente propõe DocumentPatch
2. Core valida patch contra document.schema
3. TUI renderiza diff
4. Usuário aceita
5. FS executa atomic write
6. Status é recalculado
```

Escritas diretas em `docs/**/*.md` que burlem esse fluxo são proibidas.

### 11.3 Escritas atômicas

Todas as escritas de arquivo devem usar `src/fs/atomic-write.ts`:

```ts
async function atomicWrite(path: string, content: string): Promise<void>
```

- Escreve em um arquivo temporário primeiro.
- Fsync no arquivo temporário.
- Renomeia temp → alvo (atômico na maioria dos filesystems).
- Cria um snapshot `.bak` antes de sobrescrever quando o alvo já existe.

---

## 12. Matriz de Ownership de Arquivos

| Padrão de Caminho | Canonicidade | Git | Escritor | Editor |
|---|---|---|---|---|
| `logos.yml` | Canônico | ✅ commit | `logos init`, usuário | Humano |
| `docs.yml` | Canônico | ✅ commit | `logos init`, usuário | Humano |
| `phases/*.yml` | Canônico | ✅ commit | `logos init`, usuário | Humano |
| `docs/**/*.md` | **Canônico** | ✅ commit | Pipeline de patch | Humano (via TUI accept) |
| `.logos/interviews/*/transcript.jsonl` | Operacional | ❌ ignore | Engine de entrevista | **Append-only** |
| `.logos/interviews/*/canonical-answers.json` | Operacional | ❌ ignore | Engine de entrevista | Engine |
| `.logos/interviews/*/decisions.json` | Operacional | ❌ ignore | Engine de entrevista | Engine (append) |
| `.logos/interviews/*/state.json` | Operacional | ❌ ignore | Máquina de estados | Engine (overwrite) |
| `.logos/interviews/*/generated-drafts/` | Operacional | ❌ ignore | Pipeline de geração | Engine |
| `executive/executive-plan.json` | Derivado (portável) | ✅ commit | Compilador executivo | Compilador |
| `executive/exports/**` | Derivado (export) | Opcional | Adapters | Compilador |
| `outcomes/html/**` | Derivado (render) | Opcional | Renderers | Renderer |
| `.logos/config.local.json` | Config local | ❌ ignore | TUI / CLI | Humano |
| `.env` | Segredo | ❌ **NUNCA** | Humano | Humano |

---

## 13. Critérios de Aceitação

Uma implementação do LOGOS Engine satisfaz esta spec quando:

1. ✅ `logos init` cria a estrutura canônica exata (`logos.yml`, `docs.yml`, `phases/`, `docs/`, `executive/`, `outcomes/`, `.logos/`).
2. ✅ Arquivos `docs/**/*.md` passam na validação `document.schema`.
3. ✅ Toda mensagem do usuário durante uma entrevista é escrita em `transcript.jsonl` **antes** da avaliação semântica.
4. ✅ `transcript.jsonl` é append-only — nenhuma linha existente é jamais modificada.
5. ✅ Registros em `canonical-answers.json` referenciam IDs de mensagens de transcrição de origem.
6. ✅ Documentos gerados derivam de `CanonicalAnswerRecord`, não da transcrição bruta.
7. ✅ Escritas canônicas de documentos passam pelo pipeline patch → validate → diff → accept → atomic write.
8. ✅ `safePath` rejeita qualquer caminho que escape da raiz do projeto.
9. ✅ Escritas em caminhos fora da allowlist são rejeitadas.
10. ✅ `.env` e `.logos/` estão no `.gitignore` e nunca são commitados.
11. ✅ `executive-plan.json` é regenerável a partir de fontes canônicas.
12. ✅ `outcomes/html/**` é regenerável e declara sua fonte + timestamp.
13. ✅ Escritas diretas do LLM em caminhos canônicos são impossíveis por construção.

---

## 14. Resumo

```txt
Projetos LOGOS têm três camadas de arquivos:

CANÔNICO (fonte da verdade)
  docs/**/*.md, phases/*.yml, logos.yml, docs.yml
  → versionado, validado por schema, aceito por humanos

OPERACIONAL (memória de trabalho)
  .logos/interviews/*/transcript.jsonl, canonical-answers.json, state.json
  → local, append-only, cadeia de rastreabilidade

DERIVADO (artefatos regeneráveis)
  executive/executive-plan.json, outcomes/html/**, executive/exports/**
  → reconstruível a partir de fontes canônicas, timestamped

SEGREDOS / CONFIG LOCAL
  .env, .logos/config.local.json
  → nunca commitado, específico da máquina
```

A integridade estrutural do LOGOS depende de nunca misturar essas camadas. Um documento canônico nunca é um rascunho. Uma entrada de transcrição nunca é editada. Um artefato derivado nunca é a fonte da verdade. Essas fronteiras são a base da auditabilidade, reprodutibilidade e confiança na documentação gerada.
