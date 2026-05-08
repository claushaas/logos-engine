# Conceptual Model

## Core Transformation

```text
Diffuse intent
→ structured interrogation
→ explicit decisions
→ dependency analysis
→ canonical documentation
→ executable plan
```

## Core Entities

### Intent

The initial unclear desire or direction.

Example:

> I want to build an app to help families manage their budget.

### Question

A structured prompt designed to extract a decision, assumption, risk, or clarification.

### Answer

The user's response to a question.

### Decision

A normalized, structured statement derived from one or more answers.

### Assumption

A statement that is currently accepted for planning but not validated.

### Risk

A potential failure mode or uncertainty.

### Dependency

A relationship between decisions.

Example:

```text
offline_first = true
→ requires sync strategy
→ affects storage
→ affects testing
→ affects architecture
```

### Document

A rendered Markdown view of current project knowledge.

### Profile

A domain-specific configuration that defines:

- phases;
- canonical documents;
- questions;
- validation rules;
- decision schema;
- dependency rules;
- terminology.

## Key Architectural Claim

The system should not treat Markdown as the source of truth.

Markdown is the human-readable projection.

The structured decision registry is the source of truth.
