# LOGOS LLM Integration Spec

**Status:** Rascunho 1
**Escopo:** LOGOS Engine MVP — integração com LLM via API OpenAI-compatible
**Público:** engenharia, implementação
**Propósito canônico:** Definir o protocolo, o primitivo central, as regras de validação, o tratamento de erros e as fronteiras entre LLM e Core no LOGOS Engine.

---

## 1. Propósito

Esta especificação define como o LOGOS Engine se integra com provedores LLM OpenAI-compatible. Ela estabelece:

- O primitivo central de chamada LLM (`generateStructuredOutput()`)
- O protocolo de transporte (`/v1/chat/completions` + `response_format: json_schema`)
- As regras de validação local obrigatória pós-LLM
- O contrato das funções semânticas que consomem LLM
- A estratégia de erros, retry, logging e segurança

O LOGOS **não é um agent runtime genérico**. A LLM é uma ferramenta que retorna estruturas validadas. O Core governa as transições.

---

## 2. Papel da LLM no LOGOS

### 2.1 O que a LLM faz

- **Avaliar** semanticamente respostas do usuário (`assessAnswer`)
- **Sintetizar** respostas canônicas a partir de múltiplas mensagens (`synthesizeCanonicalAnswer`)
- **Detectar** conflitos entre respostas (`detectConflict`)
- **Gerar** rascunhos de documentos a partir de CanonicalAnswerRecords (`generateDocumentDraft`)
- **Revisar** documentos e propor patches (`reviewDocument`)
- **Compilar** o Executive Plan a partir dos docs canônicos (`compileExecutivePlanDraft`)

### 2.2 O que a LLM NÃO faz

- ❌ Decidir transições de estado da entrevista
- ❌ Escrever arquivos diretamente
- ❌ Modificar documentos canônicos sem o pipeline de patch → validação → diff → aceitação
- ❌ Gerar documentação final diretamente do chat bruto
- ❌ Tratar sua própria inferência como decisão do usuário

### 2.3 Regra arquitetural

```txt
Toda chamada LLM no LOGOS que afete estado da entrevista, respostas canônicas,
documentos gerados, diagnósticos, rastreabilidade ou planos executivos DEVE usar
generateStructuredOutput().

Geração de texto livre (generateText) é permitida apenas para conteúdo auxiliar
não-decisório ou como campo string dentro de um envelope estruturado validado.
```

---

## 3. Protocolo Primário

### 3.1 API

```
POST /v1/chat/completions
```

O LOGOS usa exclusivamente a API OpenAI-compatible de chat completions. Não usa completions legadas, embeddings, fine-tuning ou qualquer outro endpoint.

### 3.2 Request shape

```json
{
  "model": "gpt-4.1-mini",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "temperature": 0,
  "max_tokens": 4096,
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "answer_assessment",
      "strict": true,
      "schema": {
        "type": "object",
        "properties": { "...": "..." },
        "required": ["..."],
        "additionalProperties": false
      }
    }
  }
}
```

### 3.3 Headers

```
Content-Type: application/json
Authorization: Bearer <LOGOS_LLM_API_KEY>
```

### 3.4 Response shape esperado

```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "{\"status\":\"sufficient\",\"confidence\":\"high\",...}"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 80,
    "total_tokens": 230
  }
}
```

### 3.5 Transport implementation

O transporte é implementado em `src/llm/generate-text.ts`, que:

1. Monta o request body com `model`, `messages`, `temperature`, `max_tokens`, `response_format`
2. Chama `fetch()` diretamente (Node ≥22)
3. Aplica `withRetry()` do `src/llm/retry-policy.ts` na camada de rede
4. Extrai `choices[0].message.content` e `finish_reason`
5. Retorna `GenerateTextOutput`

`generateStructuredOutput()` constrói sobre `generateText()`, adicionando o envelope `response_format: { type: "json_schema" }` e a validação pós-chamada.

---

## 4. Primitivo Existente: `generateStructuredOutput()`

### 4.1 Localização

```
src/llm/generate-structured-output.ts
```

### 4.2 Assinatura

```ts
async function generateStructuredOutput<T = unknown>(
  config: LlmClientOptions,
  input: StructuredOutputInput<T>,
): Promise<T>
```

### 4.3 Parâmetros

```ts
interface StructuredOutputInput<T = unknown> {
  messages: LlmMessage[];                  // mensagens do chat
  jsonSchema: Record<string, unknown>;     // JSON Schema que a saída deve seguir
  schemaName: string;                      // nome do schema (regex: /^[a-zA-Z0-9_-]{1,64}$/)
  strict?: boolean;                        // default: true
  schema?: { parse(input: unknown): T };   // validator runtime opcional (Zod)
  temperature?: number;                    // default: 0
  maxTokens?: number;
}
```

### 4.4 Fluxo interno

```txt
1. Monta GenerateTextInput com responseFormat:
     {
       type: "json_schema",
       json_schema: { name, strict, schema }
     }

2. Chama generateText(config, textInput)
     → Faz POST /v1/chat/completions via fetch
     → withRetry aplica backoff em erros transientes

3. Recebe result.content (string JSON)

4. JSON.parse(result.content)
     → Se falhar: lança Error com detalhes

5. Se input.schema foi fornecido:
     → schema.parse(parsed)
     → Se falhar: lança ZodError com issues estruturados

6. Retorna T (validado e tipado)
```

### 4.5 Variante segura

```ts
async function generateStructuredOutputSafe<T>(
  config: LlmClientOptions,
  input: StructuredOutputInput<T>,
): Promise<ValidationOutcome<T>>
```

Retorna `{ valid, data, issues }` em vez de lançar exceção. Útil para fluxos onde falha de validação é um resultado esperado, não uma exceção.

---

## 5. Configuração

### 5.1 Variáveis de ambiente

| Variável | Default | Descrição |
|---|---|---|
| `LOGOS_LLM_BASE_URL` | `https://api.openai.com/v1` | Base URL do provider |
| `LOGOS_LLM_API_KEY` | _(obrigatório)_ | Chave de API |
| `LOGOS_LLM_MODEL` | `gpt-4.1-mini` | Modelo padrão |
| `LOGOS_ENV_FILE` | `.env` | Caminho alternativo para o arquivo `.env` |

### 5.2 Carregamento

```ts
// src/llm/config.ts
import { loadLlmConfig } from "./config.js";

const config = loadLlmConfig({
  model: "gpt-4o",           // override opcional
  retry: { maxRetries: 2 },  // override de retry
});
```

A função `loadLlmConfig()`:

1. Carrega `.env` via `process.loadEnvFile()` (nativo Node ≥22)
2. Lê `process.env` com prefixo `LOGOS_LLM_`
3. Aplica overrides passados como argumento (prioridade máxima)
4. Retorna `LlmConfigData`

### 5.3 Parâmetros por chamada

Cada chamada semântica pode sobrescrever `temperature` e `maxTokens`:

| Função | `temperature` | `maxTokens` | Justificativa |
|---|---|---|---|
| `assessAnswer` | `0` | `1024` | Avaliação determinística, saída pequena |
| `synthesizeCanonicalAnswer` | `0` | `2048` | Síntese precisa, saída média |
| `detectConflict` | `0` | `1024` | Detecção binária, saída pequena |
| `resolveConflict` | `0` | `1024` | Resolução determinística |
| `generateDocumentDraft` | `0.1` | `8192` | Geração criativa controlada, saída grande |
| `reviewDocument` | `0` | `4096` | Revisão precisa, saída média |
| `compileExecutivePlanDraft` | `0` | `16384` | Compilação complexa, saída grande |

---

## 6. Fluxo de Structured Output

### 6.1 Sequência completa de uma chamada LLM semântica

```txt
1. Prompt builder (src/prompts/*.prompt.ts)
   ├─ Monta system prompt com instruções da tarefa
   ├─ Monta user messages com contexto (transcrição, canonical answers, template)
   └─ Retorna LlmMessage[]

2. Chamada LLM
   ├─ Gera JSON Schema a partir do schema Zod (z.toJSONSchema() ou manual)
   ├─ Chama generateStructuredOutput(config, {
   │     messages,
   │     jsonSchema,
   │     schemaName,
   │     strict: true,
   │     schema: zodSchema,      // ← mesmo schema, para validação local
   │     temperature: 0,
   │     maxTokens: 1024
   │   })
   └─ Recebe T validado e tipado

3. Core processa o resultado
   ├─ Se for AnswerAssessment → decide transição de estado
   ├─ Se for CanonicalAnswerDraft → mostra para confirmação
   ├─ Se for GeneratedDocumentDraft → valida contra document.schema → mostra diff
   └─ Se for ExecutivePlan → valida contra executive-plan.schema → persiste

4. Logging
   ├─ Registra token usage
   ├─ Registra schemaName e temperatura
   └─ NUNCA loga conteúdo de mensagens contendo API key
```

### 6.2 Exemplo: `assessAnswer`

```ts
// src/prompts/assess-answer.prompt.ts
import { generateStructuredOutput } from "../llm/generate-structured-output.js";
import { AnswerAssessmentSchema } from "../interview/answers/AnswerAssessment.js";
import type { LlmClientOptions, LlmMessage } from "../llm/client.js";

export async function assessAnswer(
  config: LlmClientOptions,
  params: {
    question: string;
    requiredSignals: string[];
    userMessages: LlmMessage[];
    agentMessages: LlmMessage[];
    previousAnswers?: string[];
  },
): Promise<AnswerAssessment> {
  const messages = buildAssessmentMessages(params);

  return generateStructuredOutput(config, {
    messages,
    jsonSchema: AnswerAssessmentJsonSchema,   // JSON Schema serializado
    schemaName: "answer_assessment",
    strict: true,
    schema: AnswerAssessmentSchema,           // Zod schema para validação local
    temperature: 0,
    maxTokens: 1024,
  });
}
```

---

## 7. Validação Local Obrigatória

### 7.1 Regra

```txt
Toda resposta da LLM DEVE ser validada localmente com o mesmo schema
usado como jsonSchema na chamada.

NUNCA confie que o provider retornou o shape correto.
SEMPRE valide antes de usar o dado para transição de estado ou persistência.
```

### 7.2 O que é validado

| Após chamada | Validação | Ação em falha |
|---|---|---|
| `assessAnswer` | `AnswerAssessmentSchema.parse()` | Retornar `Diagnostic`, não transicionar |
| `synthesizeCanonicalAnswer` | `CanonicalAnswerDraftSchema.parse()` | Solicitar regeneração |
| `detectConflict` | `ConflictDetectionResultSchema.parse()` | Assumir `hasConflicts: false` |
| `generateDocumentDraft` | `GeneratedDocumentDraftSchema.parse()` + `document.schema` contra `markdown` | Mostrar diagnostics, não salvar |
| `reviewDocument` | `DocumentPatchResultSchema.parse()` | Rejeitar patch |
| `compileExecutivePlanDraft` | `ExecutivePlanSchema.parse()` | Reportar diagnostics |

### 7.3 Dupla validação

`generateStructuredOutput()` já faz uma primeira validação via `schema.parse()` internamente. O Core deve fazer uma **segunda validação** com o schema completo de domínio. Isso protege contra:

- Schemas parciais passados para a LLM (campos opcionais omitidos do jsonSchema para reduzir tokens)
- LLM que retornou JSON válido mas semânticamente inválido
- Race conditions ou corrupção de memória entre a chamada e o uso

### 7.4 Exemplo de validação dupla

```ts
// 1. generateStructuredOutput valida o shape básico
const draft = await generateStructuredOutput(config, {
  messages,
  jsonSchema: DocumentDraftJsonSchema,  // schema simplificado para LLM
  schemaName: "document_draft",
  strict: true,
  schema: DocumentDraftSchema,          // Zod — validação #1
});

// 2. Core valida semanticamente
const markdownAst = parseMarkdown(draft.markdown);
const sections = extractSections(markdownAst);
const docValidation = validateDocument(sections, documentSchema);
if (!docValidation.valid) {
  return { ok: false, diagnostics: docValidation.issues };
}
```

---

## 8. Compatibilidade com Providers e Fallback

### 8.1 Providers suportados

Qualquer provider que implemente:

- `POST /v1/chat/completions`
- `response_format: { type: "json_schema" }` com `strict: true`

Exemplos: OpenAI, Azure OpenAI, OpenCode, DeepSeek, LiteLLM proxy, etc.

### 8.2 Detecção de capacidade

O LOGOS não implementa detecção automática de capacidade do provider. A configuração é explícita:

```bash
# Provider que suporta json_schema (recomendado)
LOGOS_LLM_BASE_URL=https://api.openai.com/v1

# Provider sem suporte a json_schema (usar fallback)
LOGOS_LLM_BASE_URL=https://provider-sem-json-schema.com/v1
LOGOS_LLM_JSON_MODE=prompt_only   # força fallback
```

### 8.3 Fallback: prompt-based JSON

Se o provider não suporta `response_format: json_schema`, o LOGOS pode usar `generate-json.ts` (legado) que:

1. Remove `response_format` do request
2. Adiciona instrução no system prompt: "Respond with valid JSON only. No markdown fences."
3. Faz strip de ```json fences no post-processing
4. Valida com o schema localmente

Este fallback é **menos confiável** e deve ser tratado como modo de compatibilidade, não como default. A recomendação é usar providers com suporte nativo a structured outputs.

### 8.4 Implementação do fallback

```ts
// Em src/prompts/*.prompt.ts
async function callWithFallback<T>(config, input): Promise<T> {
  try {
    return await generateStructuredOutput(config, input);
  } catch (error) {
    if (isJsonSchemaNotSupported(error) && config.fallbackToPromptJson) {
      console.warn("Provider does not support json_schema. Falling back to prompt-based JSON.");
      return await generateJson(config, {
        messages: input.messages,
        schema: input.schema,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
      });
    }
    throw error;
  }
}
```

---

## 9. Funções Semânticas LLM

### 9.1 Contrato comum

Toda função semântica segue este contrato:

```ts
type SemanticFunction<TInput, TOutput> = (
  config: LlmClientOptions,
  input: TInput,
) => Promise<TOutput>;
```

Onde:
- `config` é obtido de `loadLlmConfig()` no ponto de chamada
- `TInput` contém todo o contexto necessário (messages, schemas, parâmetros)
- `TOutput` é o tipo validado retornado por `generateStructuredOutput()`

### 9.2 `assessAnswer`

```
Arquivo:     src/prompts/assess-answer.prompt.ts
Schema LLM:  AnswerAssessment (discriminated union)
SchemaName:  "answer_assessment"
Temperatura: 0
MaxTokens:   1024
```

**Entrada:**

```ts
{
  question: string;                         // pergunta ativa
  requiredSignals: string[];                // sinais obrigatórios
  userMessages: LlmMessage[];               // mensagens do usuário (transcrição)
  agentMessages: LlmMessage[];              // mensagens do agente
  previousAnswers?: string[];               // respostas canônicas anteriores (sumarizadas)
}
```

**Saída:** `AnswerAssessment` — determina a próxima transição da máquina de estados.

### 9.3 `synthesizeCanonicalAnswer`

```
Arquivo:     src/prompts/synthesize-canonical-answer.prompt.ts
Schema LLM:  CanonicalAnswerDraft
SchemaName:  "canonical_answer_draft"
Temperatura: 0
MaxTokens:   2048
```

**Entrada:**

```ts
{
  question: string;
  userMessages: LlmMessage[];               // todas as mensagens relevantes do usuário
  complementMessages: LlmMessage[];         // follow-ups e complementos
  assessment: AnswerAssessment;             // resultado da avaliação
  documentContext?: string;                 // template ou seção alvo
}
```

**Saída:** `CanonicalAnswerDraft` — rascunho para confirmação do usuário.

### 9.4 `detectConflict`

```
Arquivo:     src/prompts/detect-conflict.prompt.ts
Schema LLM:  ConflictDetectionResult
SchemaName:  "conflict_detection"
Temperatura: 0
MaxTokens:   1024
```

**Entrada:**

```ts
{
  newAnswerDraft: CanonicalAnswerDraft;
  previousAnswers: { id: string; summary: string }[];
}
```

**Saída:** `ConflictDetectionResult` — lista de conflitos ou vazio.

### 9.5 `resolveConflict`

```
Arquivo:     src/prompts/resolve-conflict.prompt.ts
Schema LLM:  ConflictResolutionResult
SchemaName:  "conflict_resolution"
Temperatura: 0
MaxTokens:   1024
```

### 9.6 `generateDocumentDraft`

```
Arquivo:     src/prompts/generate-document.prompt.ts
Schema LLM:  GeneratedDocumentDraft
SchemaName:  "document_draft"
Temperatura: 0.1
MaxTokens:   8192
```

**Entrada:**

```ts
{
  documentId: string;
  title: string;
  template: string;                         // template Markdown do documento
  canonicalAnswers: CanonicalAnswerRecord[];
  schema: DocumentDescriptor;               // schema do documento
}
```

**Saída:** `GeneratedDocumentDraft` — rascunho completo com traceabilidade por seção.

### 9.7 `reviewDocument`

```
Arquivo:     src/prompts/review-document.prompt.ts
Schema LLM:  DocumentPatchResult
SchemaName:  "document_patch"
Temperatura: 0
MaxTokens:   4096
```

**Entrada:**

```ts
{
  markdown: string;                         // conteúdo atual do documento
  schema: DocumentDescriptor;
  diagnostics: Diagnostic[];                // diagnósticos existentes
}
```

**Saída:** `DocumentPatchResult` — lista de patches propostos.

### 9.8 `compileExecutivePlanDraft`

```
Arquivo:     src/prompts/compile-executive.prompt.ts
Schema LLM:  ExecutivePlan
SchemaName:  "executive_plan"
Temperatura: 0
MaxTokens:   16384
```

**Entrada:**

```ts
{
  projectName: string;
  docs: { path: string; content: string; diagnostics: Diagnostic[] }[];
  decisions: DocumentationDecision[];
  risks: string[];
}
```

**Saída:** `ExecutivePlan` — modelo executivo compilado.

---

## 10. Tratamento de Erros

### 10.1 Hierarquia de erros

```txt
1. Erros de rede (fetch failure, timeout, DNS)
   → Retryable. withRetry() aplica backoff.

2. Erros HTTP 429 (rate limit)
   → Retryable. withRetry() aplica backoff.

3. Erros HTTP 5xx (server error)
   → Retryable. withRetry() aplica backoff.

4. Erros HTTP 401/403 (auth)
   → Não-retryable. Lança imediatamente.

5. Erros HTTP 400 (bad request)
   → Não-retryable. Lança com detalhes do request.

6. Erro de parse JSON (resposta da LLM não é JSON válido)
   → Não-retryable. Lança Error com conteúdo bruto truncado.

7. Erro de validação de schema (ZodError)
   → Não-retryable. Lança com ValidationIssue[] estruturados.

8. Erro de conteúdo vazio (choices[0] ausente ou content vazio)
   → Não-retryable. Lança Error.
```

### 10.2 Retry policy

```ts
// src/llm/retry-policy.ts
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,         // 1 tentativa inicial + 3 retries = 4 chamadas no total
  baseDelayMs: 1000,     // 1s entre primeira e segunda tentativa
  maxDelayMs: 30_000,    // cap em 30s
};
```

Backoff: exponencial com full jitter (`random * min(baseDelay * 2^attempt, maxDelay)`).

### 10.3 Timeouts

O LOGOS não implementa timeout próprio no MVP. O timeout depende de:

- `fetch()` com timeout padrão do Node (configurável via `AbortSignal` no futuro)
- Timeout do provider (HTTP 504 ou queda de conexão)

Para o MVP, timeouts são tratados como erros de rede → retryable.

### 10.4 Surface de erros para o usuário

| Camada | O que o usuário vê |
|---|---|
| Erro de auth | "LLM API key inválida. Verifique LOGOS_LLM_API_KEY no .env." |
| Erro de rede | "Não foi possível conectar ao provider LLM. Verifique sua conexão." |
| Erro de validação | "A resposta do modelo não passou na validação. O documento não foi salvo." + diagnostics |
| Erro 5xx | "O provider LLM está indisponível no momento. Tente novamente." |
| Rate limit | "Limite de requisições atingido. Aguardando..." (com retry automático) |

---

## 11. Logging e Observabilidade

### 11.1 O que logar

```txt
[LLM] Chamada iniciada:
  - schemaName: "answer_assessment"
  - model: "gpt-4.1-mini"
  - temperature: 0
  - maxTokens: 1024
  - timestamp: 2026-05-25T14:30:00Z

[LLM] Chamada concluída:
  - schemaName: "answer_assessment"
  - duração: 1.2s
  - tokens: { input: 150, output: 80, total: 230 }
  - finishReason: "stop"
  - retryCount: 0
  - status: "success"

[LLM] Erro:
  - schemaName: "answer_assessment"
  - erro: "LLM request failed (401 Unauthorized)"
  - retryable: false
  - duração: 0.3s
```

### 11.2 O que NUNCA logar

- ❌ API key ou qualquer credencial
- ❌ Conteúdo completo de mensagens do usuário (logar apenas resumo ou length)
- ❌ Conteúdo completo de respostas da LLM (logar apenas schemaName e tamanho)
- ❌ Headers HTTP completos (contêm Authorization)

### 11.3 Redaction

```ts
function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const redacted = { ...headers };
  if (redacted.Authorization) {
    redacted.Authorization = "Bearer sk-...";
  }
  return redacted;
}
```

### 11.4 Níveis de log

| Nível | Quando |
|---|---|
| `error` | Falha irrecuperável (auth, rede após retries, validação) |
| `warn` | Retry acionado, fallback para prompt-based JSON |
| `info` | Chamada concluída com sucesso (schemaName + tokens + duração) |
| `debug` | Request body (com conteúdo truncado), response headers |

---

## 12. Segurança

### 12.1 API key

- Carregada exclusivamente de `process.env.LOGOS_LLM_API_KEY` ou `.env`
- **Nunca** hardcoded no código
- **Nunca** commitada no Git (`.env` está no `.gitignore`)
- **Nunca** logada ou exibida em mensagens de erro
- **Nunca** enviada para outro endpoint que não o `LOGOS_LLM_BASE_URL` configurado

### 12.2 Path safety

A LLM **nunca** recebe paths absolutos do sistema de arquivos do usuário. Paths de documentos são passados como relativos ao projeto:

```ts
// ✅ Correto
{ path: "docs/01-foundation/01-thesis.md" }

// ❌ Errado — vaza estrutura do filesystem
{ path: "/Users/claus/projects/my-app/docs/01-foundation/01-thesis.md" }
```

### 12.3 Conteúdo de mensagens

- O LOGOS envia para a LLM: transcrições, respostas canônicas, templates de documento
- O LOGOS **não** envia: `.env`, `.logos/config.local.json`, arquivos fora do escopo do projeto
- O provider LLM é responsável pela privacidade dos dados enviados (verificar política do provider)

---

## 13. Estratégia de Testes

### 13.1 Testes unitários (sem rede)

```txt
src/llm/config.test.ts           → loadLlmConfig com env vars mockadas
src/llm/retry-policy.test.ts     → withRetry com funções que falham/recuperam
src/llm/response-validation.test.ts → tryParseJson, validateAgainstSchema com fixtures
```

### 13.2 Testes de integração (mock de fetch)

```txt
Mock fetch global para retornar respostas conhecidas

Testes:
  - generateText monta request body correto
  - generateText extrai content e finish_reason
  - generateStructuredOutput aplica response_format
  - generateStructuredOutput valida com schema após parse
  - generateStructuredOutputSafe retorna ValidationOutcome em vez de lançar
  - withRetry é aplicado em erros 429 e 5xx
  - Erros 401 NÃO são retentados
```

### 13.3 Testes de contrato (mock de LLM)

```txt
Para cada função semântica (assessAnswer, synthesizeCanonicalAnswer, etc.):

1. Mock generateStructuredOutput para retornar fixture conhecida
2. Chamar a função semântica com entrada controlada
3. Assert que:
   - O schemaName está correto
   - O jsonSchema passado é válido
   - O resultado é processado corretamente
   - Erros de validação são propagados
```

### 13.4 Testes end-to-end (com LLM real, opcional)

```txt
Testes manuais ou em CI com flag --e2e:

1. Configurar LOGOS_LLM_BASE_URL e LOGOS_LLM_API_KEY reais
2. Executar fluxo completo de entrevista
3. Verificar que AnswerAssessment transita estados corretamente
4. Verificar que documento gerado passa em document.schema
```

---

## 14. Critérios de Aceitação

Uma implementação LOGOS satisfaz esta spec quando:

1. ✅ `generateStructuredOutput()` é o **único** primitivo usado para chamadas LLM que afetam estado, respostas, documentos ou executive plan.
2. ✅ Toda chamada `generateStructuredOutput()` recebe `jsonSchema`, `schemaName`, `strict: true` e um `schema` Zod correspondente.
3. ✅ Toda resposta da LLM é validada com `schema.parse()` antes de transitar estado ou persistir.
4. ✅ `loadLlmConfig()` carrega `LOGOS_LLM_BASE_URL`, `LOGOS_LLM_API_KEY` e `LOGOS_LLM_MODEL` do ambiente.
5. ✅ `withRetry()` é aplicado em todas as chamadas de rede com backoff exponencial + jitter.
6. ✅ Erros 401 e 400 **não** são retentados.
7. ✅ Erros de validação de schema retornam `ValidationIssue[]` estruturados, não mensagens genéricas.
8. ✅ Nenhum log contém a API key.
9. ✅ As 7 funções semânticas (`assessAnswer`, `synthesizeCanonicalAnswer`, `detectConflict`, `resolveConflict`, `generateDocumentDraft`, `reviewDocument`, `compileExecutivePlanDraft`) existem e chamam `generateStructuredOutput()`.
10. ✅ `generateText()` é usado apenas para conteúdo auxiliar não-decisório ou como transporte interno de `generateStructuredOutput()`.
11. ✅ Schemas passados para a LLM têm `additionalProperties: false` e usam discriminated unions (não `oneOf`/`anyOf` ambíguos).
12. ✅ A API key nunca é hardcoded, commitada ou logada.

---

## 15. Resumo

```txt
LOGOS LLM Integration:

PRIMITIVO CENTRAL
  generateStructuredOutput(config, input) → T
  Arquivo: src/llm/generate-structured-output.ts
  Status: ✅ JÁ EXISTE

PROTOCOLO
  POST /v1/chat/completions
  response_format: { type: "json_schema", json_schema: { name, strict, schema } }

REGRAS
  ✅ Structured output para tudo que afeta estado
  ✅ Validação local obrigatória (schema.parse())
  ✅ Retry automático para erros transientes
  ✅ Nunca confiar no provider
  ❌ generateText() só para conteúdo auxiliar
  ❌ Nunca logar API key
  ❌ Nunca hardcodar credenciais

FUNÇÕES SEMÂNTICAS (7)
  assessAnswer()               → AnswerAssessment
  synthesizeCanonicalAnswer()  → CanonicalAnswerDraft
  detectConflict()             → ConflictDetectionResult
  resolveConflict()            → ConflictResolutionResult
  generateDocumentDraft()      → GeneratedDocumentDraft
  reviewDocument()             → DocumentPatchResult
  compileExecutivePlanDraft()  → ExecutivePlan

FLUXO
  Prompt builder → generateStructuredOutput() → schema.parse() → Core aplica transição
```
