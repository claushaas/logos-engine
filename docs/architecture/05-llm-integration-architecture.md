# 05 — LLM Integration Architecture

## 1. Purpose

This document defines how the LOGOS Engine integrates with LLM providers while preserving deterministic state control.

---

## 2. LLM Integration Thesis

```txt
The LLM is a reasoning and language-generation dependency.
It is not the runtime authority.
```

The LLM may propose:

```txt
- user-facing messages;
- completeness evaluations;
- extracted semantic data;
- canonical answer drafts;
- transition intent.
```

The state engine decides what becomes state.

---

## 3. Provider Interface

```ts
type LlmProvider = {
  generateStructuredOutput(input: LlmRequest): Promise<LlmResponse>
}
```

```ts
type LlmRequest = {
  systemPrompt: string
  messages: LlmMessage[]
  schema: unknown
  model?: string
  temperature?: number
  metadata?: Record<string, unknown>
}
```

---

## 4. Provider Adapter Responsibilities

```txt
- normalize provider API differences;
- send prompt and schema;
- handle timeout;
- handle provider retry where safe;
- return raw structured response;
- expose provider diagnostics;
- avoid leaking provider-specific logic into application layer.
```

---

## 5. Provider Adapter Must Not

```txt
- mutate runtime state;
- accept canonical answers;
- decide node lifecycle;
- persist sessions;
- render UI messages directly.
```

---

## 6. Structured Output Strategy

Every agent turn should request a structured output matching `AgentTurnOutput`.

```txt
LLM response
→ raw provider output
→ normalized candidate
→ schema validation
→ semantic validation
→ state engine application
```

---

## 7. Repair Loop

If structured output fails validation:

```txt
1. Capture validation errors.
2. Build repair prompt with original request and error summary.
3. Ask provider to regenerate structured output.
4. Validate again.
5. If still invalid, return recoverable runtime error.
```

Rules:

```txt
- limit repair attempts;
- do not append invalid assistant message to node conversation;
- persist diagnostics if useful;
- never apply invalid transition intent.
```

---

## 8. Prompt Registry Loading

Prompts should be loaded through a registry.

```ts
type PromptDefinition = {
  id: string
  scope: string
  promptState: PromptState
  content: string
  outputSchemaRef: string
  version: string
}
```

Prompt lookup priority:

```txt
node-specific
→ document-specific
→ phase-specific
→ profile-generic
→ global prompt-state fallback
```

---

## 9. Context Assembly

Context should be assembled deterministically.

Priority:

```txt
1. active node definition;
2. active node lifecycle and prompt state;
3. latest user message;
4. recent node conversation;
5. node summary if needed;
6. accepted dependency answers;
7. global project context;
8. profile metadata.
```

Avoid sending unrelated session data.

---

## 10. Model Selection

Model selection should be explicit and configurable.

Possible strategy:

```txt
- default conversational model;
- synthesis model;
- repair model;
- cheap mock/local provider for tests;
- fallback provider when primary fails.
```

---

## 11. Mock Provider

A mock provider is mandatory for tests and early TUI work.

```ts
type MockLlmProvider = {
  fixtures: Record<string, AgentTurnOutput>
}
```

Use it for:

```txt
- state engine flow tests;
- TUI prototype tests;
- CI without provider credentials;
- deterministic regression tests.
```

---

## 12. Cost and Token Controls

The LLM integration should track:

```txt
- prompt tokens;
- completion tokens;
- model used;
- provider latency;
- repair attempts;
- failure rate.
```

Initial implementation may log this locally.

---

## 13. Privacy Boundary

Before sending context to LLM:

```txt
- include only relevant node context;
- avoid full session dumps;
- redact likely secrets;
- preserve user control over exports;
- avoid logging raw provider payloads unless explicitly enabled.
```

---

## 14. Failure Modes

| Failure | Handling |
|---|---|
| Provider timeout | Retry if safe, then recoverable error |
| Invalid structured output | Repair loop |
| Provider unavailable | Fallback provider or manual retry |
| Token limit exceeded | Summarize node context / reduce scope |
| Schema mismatch | Block state mutation |
| Unsafe content in prompt | Redact or require user correction |

---

## 15. Non-Negotiable Rules

```txt
- The LLM never mutates state directly.
- The LLM never accepts nodes on behalf of the user.
- The LLM never exports final documents directly.
- Structured output validation is mandatory.
- Mock provider support is mandatory.
```
