# 07 — Contracts and Schemas

## 1. Purpose

This document indexes the core contracts and schemas required by the LOGOS Engine architecture.

It does not replace formal JSON Schemas or TypeScript types. It defines ownership, producers, consumers, and invariants.

---

## 2. Contract Thesis

```txt
Contracts are the boundary between deterministic state, conversational generation, rendering, persistence, and materialization.
```

---

## 3. Core Contracts

```txt
LogosProfile
LogosRuntimeState
NodeRuntimeState
NodeMessage
CanonicalAnswer
AgentTurnOutput
PromptDefinition
DocumentMaterializationRule
DocumentRuntimeState
SessionEvent
TuiRenderSnapshot
GeneratedArtifact
RuntimeDiagnostic
```

---

## 4. LogosProfile

Owner:

```txt
profiles module
```

Consumers:

```txt
state engine, prompt orchestration, TUI sidebar, materializer
```

Defines:

```txt
- phases;
- documents;
- nodes;
- canonical questions;
- coverage topics;
- sufficiency criteria;
- prompt refs;
- materialization rules.
```

Invariant:

```txt
Profile defines structure, not runtime progress.
```

---

## 5. LogosRuntimeState

Owner:

```txt
state engine
```

Consumers:

```txt
application layer, TUI render snapshot builder, persistence
```

Defines:

```txt
- selectedProfileId;
- activeNodeId;
- session mode;
- nodeStates;
- documentStates;
- export state;
- global context.
```

Invariant:

```txt
activeNodeId controls whether the TUI is structural or node-focused.
```

---

## 6. NodeRuntimeState

Owner:

```txt
state engine / conversation runtime
```

Defines:

```txt
- lifecycle;
- conversation;
- canonical answer;
- completeness;
- extracted data;
- prompt state;
- allowed actions.
```

Invariant:

```txt
A node's conversation and canonical answer are scoped to that node.
```

---

## 7. AgentTurnOutput

Owner:

```txt
LLM integration contract
```

Producer:

```txt
LLM provider through prompt orchestrator
```

Consumer:

```txt
structured output validator and state engine
```

Invariant:

```txt
The LLM output is only a proposal until validated and applied by the state engine.
```

---

## 8. PromptDefinition

Owner:

```txt
prompt orchestration module
```

Defines:

```txt
- prompt id;
- prompt state;
- scope;
- content;
- version;
- output schema ref.
```

Invariant:

```txt
Prompt selection must derive from node state.
```

---

## 9. DocumentMaterializationRule

Owner:

```txt
profiles/materialization modules
```

Defines:

```txt
- document id;
- required node ids;
- optional node ids;
- sections;
- output path;
- output formats.
```

Invariant:

```txt
Documents are generated from accepted canonical answers, not raw conversation.
```

---

## 10. SessionEvent

Owner:

```txt
persistence module
```

Producers:

```txt
application use cases
```

Consumers:

```txt
audit tools, future replay, diagnostics
```

Invariant:

```txt
Important state transitions must be evented.
```

---

## 11. TuiRenderSnapshot

Owner:

```txt
application layer / render model builder
```

Consumer:

```txt
TUI module
```

Invariant:

```txt
The TUI must be renderable from snapshot alone.
```

---

## 12. Contract Storage

Recommended structure:

```txt
src/contracts/
  profile.ts
  runtime-state.ts
  node-state.ts
  conversation.ts
  agent-turn.ts
  prompts.ts
  materialization.ts
  persistence.ts
  render-snapshot.ts
```

JSON Schemas, if used:

```txt
schemas/
  agent-turn-output.schema.json
  profile.schema.json
  runtime-state.schema.json
  document-materialization-rule.schema.json
```

---

## 13. Contract Testing

Must validate:

```txt
- example profiles match profile schema;
- mock LLM outputs match AgentTurnOutput schema;
- persisted snapshots match runtime schema;
- materialization rules reference valid nodes;
- render snapshots contain no impossible actions.
```

---

## 14. Non-Negotiable Rules

```txt
- Contracts must be explicit.
- Cross-module communication must use contracts.
- Provider-specific response shapes must not leak into state engine.
- TUI-specific render shapes must not leak into domain state.
- Profile schema must not include runtime progress.
```
