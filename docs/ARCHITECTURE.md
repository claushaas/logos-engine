# LOGOS Engine MVP Architecture

<!--
Purpose: Record the simplified MVP architecture.
What it should do: Explain why this project is a single-package modular app instead of a monorepo.
Why it exists: Prevents premature package splitting while preserving clear boundaries.
-->

## Current decision

Use a single package with strong internal module boundaries.

## Future extraction candidates

- `src/core` → `packages/logos-core`
- `src/interview` → `packages/logos-interview`
- `src/llm` → `packages/logos-llm`
- `src/renderers` → `packages/logos-renderers`
- `src/executive` → `packages/logos-executive`

Only extract when there is a concrete reason: separate app clients, separate builds, publication, or clear maintenance pain.
