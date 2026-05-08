# TUI Product Spec

## Purpose

The TUI is the primary interface for LOGOS Engine V1.

It should feel like a structured conversation with a rigorous project architect, not like a form.

## Commands

### `logos init`

Initializes LOGOS Engine in the current directory.

### `logos continue`

Resumes the next best question group.

### `logos diagnose`

Runs diagnostics and shows gaps.

### `logos generate`

Renders or refreshes documents.

### `logos validate`

Checks phase readiness.

### `logos status`

Shows current project progress.

## Interaction Principles

- Ask in small batches.
- Explain why a question matters.
- Allow "I don't know yet".
- Store assumptions explicitly.
- Do not shame uncertainty.
- Avoid fake certainty.
- Prefer progress with traceability.

## Question Group Size

Recommended:

- minimum: 3 questions;
- ideal: 5 to 8 questions;
- maximum: 12 questions.

## Navigation

The user should be able to:

- answer;
- skip;
- mark as assumption;
- go back;
- save and exit;
- view related docs;
- run diagnostics.

## UX Tone

The TUI should be:

- precise;
- calm;
- minimal;
- direct;
- useful.
