# 09 — Session Events and Persistence

## 1. Purpose

This document defines the event and persistence model for LOGOS Engine sessions.

The runtime state may be stored as snapshots, but important user and system actions should also be recorded as events for auditability, recovery, and future replay.

---

## 2. Core Principle

```txt
State is what the system currently knows.
Events are how the system got there.
```

---

## 3. Persistence Goals

Persistence must support:

```txt
- resume session;
- preserve node conversations;
- recover canonical answers;
- audit accepted decisions;
- track document generation;
- detect stale materializations;
- support future versioning.
```

---

## 4. Session Snapshot

```ts
type SessionSnapshot = {
  sessionId: string
  version: number
  runtimeState: LogosRuntimeState
  savedAt: string
}
```

Snapshots are optimized for fast resume.

---

## 5. Event Log

```ts
type SessionEvent = {
  id: string
  sessionId: string
  type: SessionEventType
  payload: unknown
  createdAt: string
}
```

Events are optimized for audit and reconstruction.

---

## 6. Event Types

```ts
type SessionEventType =
  | "SESSION_CREATED"
  | "PROFILE_SELECTED"
  | "PROFILE_CHANGED"
  | "NODE_SELECTED"
  | "USER_MESSAGE_ADDED"
  | "ASSISTANT_MESSAGE_ADDED"
  | "NODE_LIFECYCLE_CHANGED"
  | "COMPLETENESS_EVALUATED"
  | "CANONICAL_ANSWER_DRAFTED"
  | "CANONICAL_ANSWER_ACCEPTED"
  | "CANONICAL_ANSWER_MARKED_STALE"
  | "NODE_DEFERRED"
  | "NODE_BLOCKED"
  | "DOCUMENT_PREVIEW_GENERATED"
  | "DOCUMENT_MARKED_STALE"
  | "EXPORT_GENERATED"
  | "SETTINGS_UPDATED"
```

---

## 7. Message Events

```ts
type UserMessageAddedEvent = {
  type: "USER_MESSAGE_ADDED"
  nodeId: string
  messageId: string
  content: string
}

type AssistantMessageAddedEvent = {
  type: "ASSISTANT_MESSAGE_ADDED"
  nodeId: string
  messageId: string
  promptId: string
  promptState: string
  structuredOutputId: string
}
```

---

## 8. Canonical Answer Events

```ts
type CanonicalAnswerDraftedEvent = {
  type: "CANONICAL_ANSWER_DRAFTED"
  nodeId: string
  canonicalAnswerId: string
  sourceMessageIds: string[]
}

type CanonicalAnswerAcceptedEvent = {
  type: "CANONICAL_ANSWER_ACCEPTED"
  nodeId: string
  canonicalAnswerId: string
}
```

---

## 9. Snapshot Strategy

Recommended strategy:

```txt
- Append events for all meaningful transitions.
- Save snapshot after each completed turn.
- Use snapshot for resume.
- Keep events for audit and future replay.
```

---

## 10. Resume Rules

When resuming:

```txt
1. Load latest session snapshot.
2. Validate runtime state.
3. If activeNodeId is valid, restore node-focused mode.
4. If activeNodeId is invalid, clear active node and show structure overview.
5. Surface recoverable diagnostics when repair occurs.
```

---

## 11. Versioning

Session state should be versioned.

```ts
type PersistedSession = {
  schemaVersion: string
  sessionId: string
  snapshot: SessionSnapshot
  events: SessionEvent[]
}
```

Migrations must be explicit when schema changes.

---

## 12. Non-Negotiable Rules

```txt
- Node conversations must be persisted.
- Accepted canonical answers must be persisted.
- State transitions that affect documents must be evented.
- Resume must never silently drop work.
- Schema version must be stored with persisted session.

## See Also

- [`13-prototypes.md`](./13-prototypes.md) — Session resume flow prototype (§4.9, Flow I) showing how the TUI detects, restores, and validates a previous session on launch.
```
