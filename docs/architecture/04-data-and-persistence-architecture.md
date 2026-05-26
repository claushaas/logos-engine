# 04 — Data and Persistence Architecture

## 1. Purpose

This document defines how LOGOS Engine runtime data should be stored, versioned, resumed, migrated, and audited.

---

## 2. Persistence Thesis

```txt
The system needs both fast resume and auditability.
Snapshots provide fast resume.
Events explain how state changed.
```

---

## 3. Storage Strategy

Initial strategy:

```txt
Local-first file or SQLite persistence.
```

Recommended MVP option:

```txt
SQLite for structured session data + filesystem for generated artifacts.
```

Alternative early option:

```txt
JSON files for prototype speed, migrated to SQLite when runtime stabilizes.
```

---

## 4. Persisted Data Classes

```txt
- profiles loaded into session;
- session metadata;
- runtime snapshots;
- session events;
- node messages;
- canonical answers;
- document drafts;
- generated output metadata;
- settings;
- diagnostics.
```

---

## 5. Snapshot Model

```ts
type SessionSnapshot = {
  sessionId: string
  schemaVersion: string
  runtimeState: LogosRuntimeState
  savedAt: string
}
```

Purpose:

```txt
- resume quickly;
- avoid replaying every event on normal startup;
- preserve activeNodeId, nodeStates, documentStates and export state.
```

---

## 6. Event Log Model

```ts
type SessionEvent = {
  id: string
  sessionId: string
  type: SessionEventType
  payload: unknown
  createdAt: string
}
```

Purpose:

```txt
- audit state changes;
- support future replay;
- diagnose corruption;
- inspect accepted decisions;
- preserve historical trace.
```

---

## 7. Message Persistence

Node messages should be persisted with stable IDs.

```ts
type PersistedNodeMessage = {
  id: string
  sessionId: string
  nodeId: string
  role: "user" | "assistant" | "system"
  content: string
  metadata: Record<string, unknown>
  createdAt: string
}
```

Rules:

```txt
- user messages must never be overwritten;
- assistant messages must record prompt state and structured output reference;
- canonical answer sourceMessageIds must point to persisted messages.
```

---

## 8. Canonical Answer Persistence

```ts
type PersistedCanonicalAnswer = {
  id: string
  sessionId: string
  nodeId: string
  content: string
  format: "markdown" | "structured"
  sourceMessageIds: string[]
  confidence: "low" | "medium" | "high"
  accepted: boolean
  stale: boolean
  generatedAt: string
  acceptedAt?: string
}
```

Rules:

```txt
- accepted answers are document source material;
- stale accepted answers must block final export;
- history of previous drafts may be retained.
```

---

## 9. Artifact Persistence

Generated artifacts should be stored as files plus metadata.

```ts
type GeneratedArtifact = {
  id: string
  sessionId: string
  type: "markdown" | "html" | "agent_pack"
  path: string
  sourceDocumentIds: string[]
  sourceNodeIds: string[]
  generatedAt: string
  stale: boolean
}
```

---

## 10. Schema Versioning

Every persisted session must include:

```txt
- schemaVersion;
- appVersion, if available;
- profileVersion;
- promptRegistryVersion, if available.
```

---

## 11. Migration Strategy

Migrations must be explicit.

```ts
type Migration = {
  from: string
  to: string
  migrate: (data: unknown) => unknown
}
```

Rules:

```txt
- never silently discard node conversations;
- never silently discard accepted canonical answers;
- if migration cannot preserve state, block and ask for manual export/recovery;
- keep backup before destructive migration.
```

---

## 12. Resume Strategy

```txt
1. Load latest snapshot.
2. Validate schema version.
3. Run migrations if needed.
4. Validate activeNodeId.
5. Validate nodeStates and canonical answers.
6. Repair safe inconsistencies.
7. Return render snapshot.
```

---

## 13. Backup and Export

The system should support a full session export:

```txt
session.json
messages.jsonl
events.jsonl
canonical-answers.json
artifacts/
```

Purpose:

```txt
- user trust;
- recovery;
- Git archival;
- external inspection by agents.
```

---

## 14. Data Sensitivity

Potentially sensitive data:

```txt
- user project ideas;
- business strategy;
- financial assumptions;
- market plans;
- technical architecture;
- API keys if accidentally pasted;
- private prompts.
```

Rules:

```txt
- never log provider secrets;
- redact secrets from diagnostics;
- make export location explicit;
- avoid sending unnecessary context to LLM providers.
```

---

## 15. Persistence Invariants

```txt
- A persisted accepted node must have a canonical answer.
- A canonical answer must reference source messages.
- A session snapshot must include schemaVersion.
- Generated artifacts must record source nodes/documents.
- Resume must never silently drop active work.
```
