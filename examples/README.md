# Examples

Example workspaces demonstrating LOGOS Engine in action.

## App Business — FitFlow

A complete App Business profile workspace for "FitFlow," a hypothetical personal trainer scheduling app.

This example demonstrates the current structured workspace shape:

- intake state across all 12 phases
- 38 confirmed and assumed decisions
- A fully populated canonical document tree
- Workspace state files (`.logos/project.json`, `.logos/answers.json`, `.logos/decisions.json`)

The roadmap now targets AI-led conversational intake as the normal product flow.
Phase 18 updates examples and fixtures so they demonstrate conversation-first
usage instead of deterministic question answering.

Location: `tests/fixtures/example-workspace/`

### What You Can See

**Intake answers** covering:

- Foundation and idea clarity (`00-intake`)
- Market analysis and competitor positioning (`01-market`)
- Business model and positioning (`02-business`)
- Pricing, financial model, and break-even (`03-economics`)
- Product thesis and MVP scope (`04-product`)
- UX flows, design direction, and onboarding (`05-design`)
- Architecture, tech stack, data model, and API spec (`06-architecture`)
- Implementation plan and development standards (`07-implementation`)
- Testing strategy (`08-testing`)
- Marketing strategy, launch plan, and content strategy (`09-go-to-market`)
- Operations, support, and metrics (`10-operations`)
- Decision log and risk register (`11-governance`)

**Generated documents** in `docs/` following the canonical App Business tree.

Location: `tests/fixtures/example-workspace/docs/`

### Try It

```bash
logos
/init
# Select app-business profile
# Continue the AI-led conversation or inspect the example state
/generate
```

## Minimal Workspace

A freshly initialized workspace with only the profile lock and empty state files. Useful for understanding the baseline structure.

Location: `tests/fixtures/minimal-workspace/`
