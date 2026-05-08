# LOGOS Engine

LOGOS Engine is a local-first, open-source TUI system for structured externalization of intent.

Its purpose is to help people transform a diffuse idea into a complete, coherent, auditable documentation package before committing heavily to execution.

The first supported profile is **App Business**, focused on people who want to design, validate, document, and build an app-based venture. The system is intentionally designed to support other outcomes later, such as websites, SaaS products, courses, books, agencies, research projects, communities, and other structured initiatives.

LOGOS Engine is not a document generator.

It is a decision clarification engine.

It helps users:

- clarify intent;
- identify missing decisions;
- separate facts from assumptions;
- expose risks;
- understand dependencies;
- generate canonical documentation;
- prepare consistent implementation artifacts;
- avoid preventable late-stage pivots.

## Repository Structure

```text
src/
  application/
  ai/
  domain/
  foundation/
  storage/
  tui/
tests/
  fixtures/
docs/
  00-foundation/
  01-product/
  02-open-source/
  03-system-architecture/
  04-tui-experience/
  05-profiles/
  06-documentation-system/
  07-ai-and-agent-behavior/
  08-growth-and-community/
  09-implementation-roadmap/
  10-operational-playbooks/
```

## Local Development

LOGOS Engine uses Node.js, pnpm, TypeScript, Vitest, Biome, and markdownlint.

Required baseline:

- Node.js 22 or newer;
- pnpm 10.33.2, as declared in `package.json`.

Install dependencies:

```bash
pnpm install
```

Run the Phase 0 validation commands:

```bash
pnpm test
pnpm build
pnpm smoke:cli
pnpm lint:md
pnpm lint:biome
```

Additional useful commands:

```bash
pnpm typecheck
pnpm test:coverage
pnpm format
```

The `smoke:cli` script is a Phase 0 preflight. The executable `logos` command and Ink TUI are Phase 1 scope.

## First Outcome Profile

The first canonical profile is:

```text
app-business
```

This profile guides the user through the complete documentation needed to design and execute an app-based business, including ideation, market analysis, business model, financial reasoning, marketing strategy, product thesis, UX, architecture, implementation, testing, launch, and operations.

## Core Principle

The source of truth is not the generated Markdown.

The source of truth is the structured decision registry.

Markdown documents are rendered views of the current state of the project.

## License Direction

LOGOS Engine is open source and free to use.

Code is licensed under MIT. Documentation template licensing can be refined when generated templates are introduced.

## AI Safety Baseline

AI is a first-class workflow layer, but it is not a source of confirmed truth.

Repository defaults follow these rules:

- default tests must not call live models;
- default tests must not require network access or AI credentials;
- raw LLM tokens must not be stored in project files;
- AI output must remain draft, proposed, needs_review, rejected, or explicitly confirmed;
- AI-generated decisions may become confirmed only after user confirmation;
- deterministic validation stays separate from AI judgment.
