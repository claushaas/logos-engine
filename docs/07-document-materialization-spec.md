# 07 — Document Materialization Spec

## 1. Purpose

This document defines how canonical documents are generated from accepted node answers.

The LOGOS Engine does not treat documents as the primary interaction surface. Documents are materialized outputs derived from structured conversational work.

---

## 2. Core Principle

```txt
Nodes are worked through conversation.
Canonical answers are accepted by the user.
Documents are materialized from accepted canonical answers.
```

---

## 3. Document Runtime State

```ts
type DocumentRuntimeState = {
  documentId: string
  status: DocumentStatus
  sourceNodeIds: string[]
  requiredNodeIds: string[]
  optionalNodeIds: string[]
  missingRequiredNodeIds: string[]
  staleSourceNodeIds: string[]
  draft: MaterializedDocumentDraft | null
  updatedAt: string
}

type DocumentStatus =
  | "not_ready"
  | "partially_ready"
  | "ready"
  | "drafted"
  | "accepted"
  | "stale"
```

---

## 4. Materialization Rule

Each document declares how it is assembled.

```ts
type DocumentMaterializationRule = {
  documentId: string
  title: string
  outputPath: string
  sourceNodeIds: string[]
  requiredNodeIds: string[]
  optionalNodeIds: string[]
  sections: DocumentSectionRule[]
}

type DocumentSectionRule = {
  sectionId: string
  title: string
  sourceNodeIds: string[]
  required: boolean
}
```

---

## 5. Readiness Rules

A document is ready when:

```txt
- all required source nodes exist;
- all required source nodes are accepted;
- no required source node has a stale canonical answer;
- materialization rule is valid.
```

A document is partially ready when:

```txt
- at least one source node is accepted;
- some required nodes are still missing, deferred, blocked, or stale.
```

---

## 6. Materialized Document Draft

```ts
type MaterializedDocumentDraft = {
  documentId: string
  content: string
  format: "markdown"
  generatedAt: string
  sourceNodeIds: string[]
  missingSections: string[]
  stale: boolean
}
```

---

## 7. Materialization Flow

```txt
1. User opens document preview.
2. State engine evaluates document readiness.
3. If ready or partially ready, materializer assembles draft.
4. Draft shows accepted sections and missing sections.
5. User can regenerate, accept, or return to missing nodes.
6. Accepted document can be exported.
```

---

## 8. Partial Document Preview

Partial previews are allowed and useful.

Rules:

```txt
- Must label missing required sections.
- Must not pretend the document is complete.
- Must link missing sections to source nodes.
- Must mark stale sections.
```

---

## 9. Document Staleness

A document becomes stale when:

```txt
- any accepted source node becomes stale;
- any source node is reopened;
- materialization rule changes;
- profile schema changes;
- user edits canonical answer after document generation.
```

---

## 10. Export Eligibility

A document can be exported as canonical Markdown when:

```txt
- status is drafted or accepted;
- all required nodes are accepted;
- no required source node is stale;
- document draft is not stale.
```

HTML artifacts and agent packs may have additional requirements.

---

## 11. Non-Negotiable Rules

```txt
- Documents must not be generated from raw conversation alone.
- Required missing nodes must be visible.
- Stale source nodes must block final export unless explicitly resolved.
- Document preview is an output surface, not the primary interaction model.
- User must be able to navigate from missing document section to source node.

## See Also

- [`13-prototypes.md`](./13-prototypes.md) — Document preview prototype (§3.11) and export prototype (§3.12) with wireframes showing materialized documents, missing sections, and export eligibility. Flow G (§4.7) and Flow H (§4.8) walk through document preview and export end-to-end.
```
