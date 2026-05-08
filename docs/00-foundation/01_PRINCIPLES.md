# LOGOS Engine — Principles

## 1. Decisions Before Documents

Documents are projections of structured decisions.

A document may be regenerated. A decision must be traceable.

## 2. Clarity Before Execution

The system should slow down premature execution when critical uncertainty exists.

It should not block progress unnecessarily, but it must expose risk clearly.

## 3. Facts, Assumptions, and Hypotheses Must Stay Separate

The system must never convert an assumption into a fact.

Each generated document should distinguish:

- confirmed facts;
- assumptions;
- hypotheses;
- open questions;
- risks;
- dependencies.

## 4. Local-First by Default

The first version should run locally.

Markdown, JSON, and Git should be enough to make the system useful.

## 5. No Hidden Magic

Users should be able to inspect:

- conversation turns and questions asked;
- decisions stored;
- documents generated;
- validation rules;
- dependency mappings.

The primary experience should still feel like a natural conversation with AI. Inspectability belongs in review, diagnostics, state files, and generated audit trails, not in a user-facing requirement to answer deterministic question ids.

## 6. Open Source Reciprocity

LOGOS Engine is built as a contribution to others.

It should help people who are learning, experimenting, building, and trying to structure their ideas without needing to pay for expensive tooling.

## 7. Outcome-Oriented, Not Domain-Locked

The first profile is App Business.

The engine itself must remain generic.

## 8. Documentation Is a Living System

Documentation should evolve as decisions evolve.

When a decision changes, the system should identify affected documents and recommend updates.

## 9. The User Owns the Decision

The system may suggest, challenge, and diagnose.

It must not decide silently.

## 10. Simple Core, Expandable Edge

The V1 should be useful without complex multi-agent orchestration.

The core system should be:

- profiles;
- AI-led conversation;
- decisions;
- validation;
- rendering;
- diagnostics.
