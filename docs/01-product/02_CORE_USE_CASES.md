# Core Use Cases

## Use Case 1 — Start a New App Business

The user runs:

```bash
logos
```

Then runs:

```text
/init
```

Then selects:

```text
App Business
```

The system creates a workspace, starts an AI-led intake conversation, interprets answers into structured state, and renders initial documentation.

## Use Case 2 — Continue an Existing Documentation Session

The user runs:

```bash
logos
```

Then runs `/continue`.

The system reads current state, gives the AI the relevant profile and project context, and resumes the conversation at the next useful point.

## Use Case 3 — Diagnose Missing Decisions

The user runs:

```text
/diagnose
```

The system checks the decision registry and generated documents for:

- missing required decisions;
- unresolved assumptions;
- inconsistent answers;
- high-risk gaps;
- documents that need updating.

## Use Case 4 — Generate or Refresh Documents

The user runs:

```text
/generate
```

The system renders Markdown documents from the current decision registry.

## Use Case 5 — Validate Phase Completion

The user runs:

```text
/validate
```

The system checks whether the current phase has enough information to be considered ready.

## Use Case 6 — Change a Decision

The user updates a decision.

The system identifies impacted documents and downstream decisions.

## Use Case 7 — Export Implementation Roadmap

V1 generates this as `IMPLEMENTATION_PLAN.md` during document rendering.

The document includes:

- milestones;
- phases;
- technical epics;
- validation gates;
- testing requirements;
- launch checklist.

A future export command may generate additional formats from the same structured state.

## Use Case 8 — Prepare Agent Prompts

Future capability:

Generate structured prompts for implementation agents such as OpenCode, OpenClaw, Claude Code, or Codex-like agents.
