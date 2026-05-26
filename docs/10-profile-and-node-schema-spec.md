# 10 — Profile and Node Schema Spec

## 1. Purpose

This document defines the schema for LOGOS Engine profiles, phases, documents, and nodes.

Profiles define the structural map. Runtime state defines the current progress through that map.

---

## 2. Core Principle

```txt
Profile schema defines what can be worked.
Runtime state defines what has happened.
```

---

## 3. Profile Definition

```ts
type LogosProfile = {
  id: string
  title: string
  description?: string
  version: string
  phases: PhaseDefinition[]
  documents: DocumentDefinition[]
  nodes: NodeDefinition[]
  materializationRules: DocumentMaterializationRule[]
}
```

---

## 4. Phase Definition

```ts
type PhaseDefinition = {
  id: string
  title: string
  order: number
  purpose: string
}
```

Example phases:

```txt
01-foundation
02-validation
03-product
04-engineering
05-go-to-market
06-operations
```

---

## 5. Document Definition

```ts
type DocumentDefinition = {
  id: string
  phaseId: string
  title: string
  order: number
  purpose: string
  outputPath: string
  requiredNodeIds: string[]
  optionalNodeIds: string[]
}
```

---

## 6. Node Definition

```ts
type NodeDefinition = {
  id: string
  phaseId: string
  documentId: string
  title: string
  order: number

  canonicalQuestion: string
  coverageTopics: string[]
  sufficiencyCriteria: string[]

  dependencies?: {
    requiredNodeIds?: string[]
    recommendedNodeIds?: string[]
  }

  promptRefs: {
    initial?: string
    followUp?: string
    clarification?: string
    refinement?: string
    synthesis?: string
    review?: string
    blocked?: string
    repair?: string
  }

  outputSchemaRef?: string
}
```

---

## 7. Canonical Question

Each node should have one canonical question.

Purpose:

```txt
- Anchor the semantic intent of the node.
- Prevent uncontrolled question banks.
- Guide prompt generation.
```

The canonical question is not always shown verbatim to the user.

---

## 8. Coverage Topics

Coverage topics define what the answer should cover.

Example:

```yaml
coverageTopics:
  - central conviction
  - relevant change in the world
  - unresolved tension
  - ignored truth
  - promise without marketing
```

They should guide evaluation, not become a checklist shown as a form.

---

## 9. Sufficiency Criteria

Sufficiency criteria define what makes the node complete.

Example:

```yaml
sufficiencyCriteria:
  - thesis is specific to the project
  - problem is not confused with solution
  - central tension is explicit
  - unsupported claims are marked as assumptions
```

---

## 10. Prompt References

Prompt references allow state-specific behavior.

```yaml
promptRefs:
  initial: prompts/foundation/thesis/initial.md
  clarification: prompts/foundation/thesis/clarification.md
  refinement: prompts/foundation/thesis/refinement.md
  synthesis: prompts/foundation/thesis/synthesis.md
  review: prompts/foundation/thesis/review.md
```

---

## 11. Minimal YAML Example

```yaml
id: foundation.thesis.core
phaseId: 01-foundation
documentId: foundation.thesis
title: Core Thesis
order: 1

canonicalQuestion: >
  What truth, hypothesis, or conviction justifies this project existing?

coverageTopics:
  - central conviction
  - relevant change in the world
  - unresolved tension
  - ignored truth
  - promise without marketing

sufficiencyCriteria:
  - the thesis is specific
  - the tension is explicit
  - the claim is not generic
  - uncertainty is marked

promptRefs:
  initial: prompts/foundation/thesis/core.initial.md
  clarification: prompts/foundation/thesis/core.clarification.md
  refinement: prompts/foundation/thesis/core.refinement.md
  synthesis: prompts/foundation/thesis/core.synthesis.md
  review: prompts/foundation/thesis/core.review.md
```

---

## 12. Non-Negotiable Rules

```txt
- Profiles define structure, not runtime progress.
- Nodes must have one canonical question.
- Coverage topics must not become static form fields.
- Prompt refs must support state-specific behavior.
- Document generation must reference source nodes explicitly.

## See Also

- [`13-prototypes.md`](./13-prototypes.md) — Component model (§2.3–§2.5) showing how profile structure, phases, documents, and nodes are rendered in the sidebar with status indicators. State prototypes (§3.2) show the profile/structure overview wireframe.
```
