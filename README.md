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

## AI Behavior

AI is a first-class workflow layer in LOGOS Engine. It is used for:

- Leading the intake conversation
- Generating context-aware initial and follow-up questions during intake
- Summarizing user answers into structured form
- Extracting decision proposals from answers
- Classifying assumptions and identifying gaps
- Identifying risks and inconsistencies
- Drafting document sections
- Recommending the next useful conversational move

AI output always enters the system with a status that keeps it distinct from confirmed state:

| Status | Meaning |
|--------|---------|
| `draft` | Generated but not yet reviewed |
| `proposed` | Ready for user review |
| `needs_review` | Flagged for attention |
| `rejected` | Reviewed and rejected by user |
| `confirmed` | Reviewed and accepted by user |

AI-generated decisions may become `confirmed` only after explicit user confirmation. This distinction is enforced in the data model: `DecisionStatus` and `AiOutputStatus` are separate concepts.

### Running Without A Live Remote Provider

LOGOS Engine does not require live remote model calls for installation, tests, initialization, status, validation, or provider setup.

The core intake and documentation workflow is AI-led. Local development and tests may use mocked or fixture providers, and users may configure local providers such as Ollama or LM Studio. If no AI provider is enabled for an actual workspace, LOGOS should guide the user to configure AI instead of falling back to a deterministic questionnaire.

Remote AI is always opt-in.

## Provider Configuration

LOGOS Engine supports local and remote LLM providers through a provider-agnostic abstraction. Supported presets:

- **OpenAI** — `gpt-4o`, `gpt-4o-mini`, etc.
- **Anthropic** — `claude-sonnet-4-20250514`, etc.
- **OpenRouter** — any model available through OpenRouter
- **Ollama** — local models (`llama3.2`, `mistral`, etc.)
- **LM Studio** — local models via OpenAI-compatible endpoint
- **Custom** — any OpenAI-compatible endpoint

Configure via `/config ai` in the TUI or edit `.logos/config.json`:

```json
{
  "ai": {
    "provider": "openai",
    "model": "gpt-4o",
    "tokenEnv": "LOGOS_LLM_API_KEY"
  }
}
```

API keys are loaded from environment variables — never stored in project files. The config stores the name of the environment variable, not the key value.

Full details: [Provider Configuration](./docs/07-ai-and-agent-behavior/03_PROVIDER_CONFIGURATION.md)

## Privacy

LOGOS Engine is local-first and does not collect telemetry, track usage, or phone home.

When a remote AI provider is configured, the engine sends only relevant structured project state: answers, decisions, assumptions, open questions, document contracts, and profile phase definitions. Arbitrary source files are never sent by default.

Use `/config ai --show` to inspect what context would be sent before making AI calls. Use local providers (Ollama, LM Studio) for zero-data-leaving-your-machine operation.

Full details: [Privacy](./docs/07-ai-and-agent-behavior/04_PRIVACY.md)

## AI Safety Baseline

Repository defaults follow these rules:

- default tests must not call live models;
- default tests must not require network access or AI credentials;
- raw LLM tokens must not be stored in project files;
- AI output must remain draft, proposed, needs_review, rejected, or explicitly confirmed;
- AI-generated decisions may become confirmed only after user confirmation;
- deterministic validation stays separate from AI judgment.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, contribution areas, and review guidelines.

## Open Source

- **Code**: MIT License
- **Documentation Templates**: Creative Commons Attribution 4.0
- **Code of Conduct**: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- **Security Policy**: [SECURITY.md](./SECURITY.md)
