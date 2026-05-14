# Phase Implementation Prompt

Use this prompt when asking an AI coding agent to implement a phase from `00_IMPLEMENTATION_ROADMAP.md`.

```text
You are working in the LOGOS Engine repository.

Implement Phase <PHASE_NUMBER> — <PHASE_NAME> from:

- docs/09-implementation-roadmap/00_IMPLEMENTATION_ROADMAP.md

The actionable tasks for each phase are listed in:

- docs/09-implementation-roadmap/01_PHASED_TASKS.md

Before implementing anything, you must read:

- AGENTS.md
- docs/09-implementation-roadmap/00_IMPLEMENTATION_ROADMAP.md
- docs/09-implementation-roadmap/01_PHASED_TASKS.md
- docs/09-implementation-roadmap/02_TECHNICAL_MILESTONES.md
- every related document listed in the target phase of the roadmap

Do not implement from memory. The documentation is part of the product contract.

Implementation rules:

- Follow the scope of the requested phase.
- Use the tasks and acceptance checklist from 01_PHASED_TASKS.md as the implementation checklist.
- Keep the implementation aligned with the roadmap and technical milestones.
- Preserve the TUI-first model: `logos` opens the TUI, normal text input is AI conversation, and slash commands are reserved for explicit system operations.
- Treat profile YAML files as source of truth for profiles.
- Keep Markdown as rendered output, not source of truth.
- Keep deterministic validation separate from AI judgment.
- Do not store raw LLM tokens in project files.
- AI-generated proposals must not become confirmed decisions without user confirmation.
- Prefer simple TypeScript modules, explicit schemas, testable logic, and no premature abstractions.

If anything is unclear, contradictory, missing, or underspecified, do not decide alone.

Ask me before choosing an implementation direction.

When implementing:

1. Summarize the relevant phase objective and acceptance criteria.
2. Identify the files and modules you expect to touch.
3. Implement the phase tasks.
4. Add or update tests appropriate to the phase.
5. Update documentation if the implementation refines the contract.
6. Run the relevant validation commands, including:

   pnpm lint:md
   pnpm lint:biome

7. Report what changed, which checks passed, and any remaining risks or open questions.
```

## Short Version

```text
Implement Phase <PHASE_NUMBER> — <PHASE_NAME> from docs/09-implementation-roadmap/00_IMPLEMENTATION_ROADMAP.md.

Use docs/09-implementation-roadmap/01_PHASED_TASKS.md as the task checklist.

Before coding, read AGENTS.md, the roadmap phase, the phased tasks, technical milestones, and every related document listed for that phase.

Documentation is part of the product contract. Do not implement from memory.

If anything is unclear, contradictory, missing, or underspecified, ask me first instead of deciding alone.

After implementation, run pnpm lint:md and pnpm lint:biome, and report changes, checks, risks, and open questions.
```
