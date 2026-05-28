# LOGOS Engine — Walkthrough

## Overview

This walkthrough guides you through a complete first session with the LOGOS
Engine using the **mock LLM provider** — no API key or LLM credentials needed.
You'll install the project, start the TUI, select the Startup profile, complete
a node conversationally, accept a canonical answer, preview a generated
document, and export it.

The walkthrough assumes you have Node.js ≥ 22 and pnpm installed.

---

## 1. Install

```bash
git clone <repository-url>
cd logos-engine
pnpm install
pnpm build
```

Verify the build succeeded:

```bash
node dist/cli/main.js --help
# or, if linked:
# logos --help
```

Expected output:

```text
Usage: logos [options]

LOGOS Engine — conversation-first documentation engine

Options:
  --profile <id>     Pre-select a profile on startup
  --session <id>     Resume a previous session
  --mock             Use mock LLM provider (no API key needed)
  --data-dir <path>  Set persistence directory (default: sessions)
  --help-profile     Show profile-related options and exit
  -h, --help         display help for command
```

---

## 2. Start the TUI

```bash
node dist/cli/main.js --mock --profile startup
```

**Flags explained:**

- `--mock` — uses the built-in deterministic mock LLM provider. No API key
  required. Responses are predictable fixtures.
- `--profile startup` — pre-selects the Startup sample profile on launch.

**What you should see:**
The terminal splits into two panels: a sidebar on the left and a main surface
on the right.

### Sidebar (left)

```text
Profile: Startup Documentation
3/12 nodes accepted

01 Foundation
   Foundation Thesis
     ○ Core Thesis
     ○ Central Tension
   Problem Space
     ○ Core Problem
     ○ Stakeholders

02 Validation
   Core Assumptions
     ⚠ Core Assumptions               ← blocked: depends on Core Thesis
     ⚠ Risk Register                  ← blocked: depends on Core Assumptions
   Evidence & Metrics
     ○ Evidence Plan
     ○ Success Metrics

03 Product
   Product Brief
     ⚠ Product Promise                ← blocked: depends on Core Thesis
     ⚠ MVP Scope                      ← blocked: depends on Product Promise
   User Experience
     ⚠ Primary Journey                ← blocked: depends on Product Promise
     ⚠ Acceptance Criteria            ← blocked: depends on Primary Journey
```

**Key:** `○` not started, `⚠` blocked by unmet dependencies.

### Main panel (right)

Shows the structure overview with profile summary and deterministic actions:

```text
Profile: Startup Documentation

3 phases, 6 documents, 12 nodes
Foundation → Validation → Product

[Start Documentation]
[Resume Last Node]
[Change Profile]
```

---

## 3. Select the First Node

Navigate to **Core Thesis** — the first unblocked node. You can select it
from the sidebar using keyboard navigation (arrow keys + Enter) or, if the
sidebar supports it, by clicking/selecting the node.

After selecting "Core Thesis", the mode switches to node-focused conversation.

### What you should see

The main panel now shows:

```text
Foundation / Foundation Thesis / Core Thesis

○ Not started

Agent
What conviction makes this project necessary? What truth about the
world drives the decision to build this?

                                                               > _
[Answer]  [Skip]  [Ask for example]
```

The sidebar updates: `○ Core Thesis` → `◐ Core Thesis` (active).

---

## 4. Answer the First Question

Type your answer at the input prompt and submit. For example:

```text
We believe that remote work has created a fundamental gap between how
people demonstrate skill and how companies evaluate it. Resumes and
credentials are proxies that break down when work becomes asynchronous
and project-based. The world is shifting toward skill-based evaluation
but the tools haven't caught up.
```

**What happens:**

1. The engine appends your message to the conversation.
2. The mock LLM provider generates a follow-up question based on the
   `active` lifecycle fixture.
3. The agent responds with a targeted follow-up.
4. The conversation history appears in the main panel.

### Multi-turn conversation

The mock provider produces deterministic responses for each lifecycle:

| Lifecycle | Mock response |
|---|---|
| `active` / `answered` | Follow-up question asking for specificity |
| `needs_clarification` | Clarifying question naming the ambiguity |
| `needs_refinement` | Request for sharper, more specific answer |
| `ready_for_synthesis` | (auto-transition) |
| `synthesized` | Presents canonical answer draft |

Continue answering 2–4 turns until the engine transitions to `synthesized`.

---

## 5. Review and Accept the Canonical Answer

When the node reaches `synthesized`, the panel shows:

```text
Foundation / Foundation Thesis / Core Thesis

◆ Awaiting review

Agent
Here's a draft of your core thesis. Review it and accept, edit,
or regenerate.

┌──────────────────────────────────────────────────────┐
│ CANONICAL ANSWER (DRAFT)                             │
│                                                      │
│ We believe that remote work has created a fundamental │
│ gap between how people demonstrate skill and how      │
│ companies evaluate it…                                │
│                                                      │
│ Confidence: Medium                                   │
│ Generated from 5 messages                            │
└──────────────────────────────────────────────────────┘

[Accept]  [Edit]  [Regenerate]  [Defer]  [Reopen]
```

Select **`[Accept]`**.

**What happens:**

1. The canonical answer is marked accepted. It is now valid source material for
   document generation.
2. The node lifecycle transitions to `accepted` (`✓` in sidebar).
3. Any nodes that depend on Core Thesis become unblocked (e.g., Core Assumptions,
   Product Promise change from `⚠` to `○` in the sidebar).
4. The agent recommends the next node.

---

## 6. Continue Through Dependencies

The dependency graph for the Startup profile:

```text
foundation.thesis.core
├── validation.assumptions.core → validation.assumptions.risks
└── product.brief.promise → product.brief.mvp_scope
                              └── product.experience.journey
                                    └── product.experience.criteria

foundation.thesis.tension      (no dependents)
foundation.problem.core        (no dependents)
foundation.problem.stakeholders (no dependents)
validation.evidence.plan       (no dependents)
validation.evidence.metrics    (no dependents)
```

You can:

- Follow the recommended next node (`[Continue →]`).
- Navigate to any unblocked node via the sidebar.
- Defer a node and work on others.

**Tip:** Accept Core Thesis and Central Tension to unlock the full Foundation
Thesis document. Then accept Core Problem and Stakeholders to complete the
Problem Space document.

---

## 7. Preview a Document

After accepting all required nodes for a document, select `[Preview Document]`
from an accepted node or navigate to the document in the sidebar.

Example — Foundation Thesis document:

```text
┌──────────────────────────────┬─────────────────────────────────────┐
│ LOGOS Engine                 │ Document: Foundation Thesis         │
├──────────────────────────────┼─────────────────────────────────────┤
│ Profile: Startup             │ ┌───────────────────────────────┐   │
│                              │ │ # Foundation Thesis           │   │
│ 01 Foundation           [–]  │ │                               │   │
│   Foundation Thesis     [–]  │ │ ## Core Thesis ✓              │   │
│     ✓ Core Thesis            │ │ We believe that remote work   │   │
│     ✓ Central Tension        │ │ has created a fundamental     │   │
│                              │ │ gap…                          │   │
│    Problem Space        [+]  │ │                               │   │
│                              │ │ ## Central Tension ✓          │   │
│ 02 Validation           [+]  │ │ There is a structural         │   │
│                              │ │ mismatch between how          │   │
│ 03 Product              [+]  │ │ companies evaluate skill…     │   │
│                              │ │                               │   │
│                              │ │ Completeness: 2/2 sections    │   │
│                              │ └───────────────────────────────┘   │
│                              │                                     │
│                              │ [Regenerate] [Export] [Close]       │
└──────────────────────────────┴─────────────────────────────────────┘
```

Missing sections show `[MISSING]` with a link to the source node. Stale
sections show `⚠ STALE`.

---

## 8. Export a Document

When a document is complete (all required nodes accepted), the `[Export]`
action is available from the document preview.

Select `[Export]` to open the export panel:

```text
Available Exports

┌──────────────────────────────────────────────────────┐
│ [Export Markdown]                             ✓      │
│ Canonical documentation in portable Markdown format.  │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ [Export HTML]                                 ✓      │
│ Styled documentation as a standalone HTML artifact.   │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ [Export Agent Pack]                           ⚠      │
│ Blocked: other documents incomplete.                  │
└──────────────────────────────────────────────────────┘
```

Select **`[Export Markdown]`**. The engine generates `docs/01-foundation/thesis.md`
and confirms:

```text
Exported to docs/01-foundation/thesis.md
```

---

## 9. Exit

Press `Ctrl+C` or the configured exit keybinding. The engine auto-saves your
session to the `sessions/` directory. Next time you start with:

```bash
node dist/cli/main.js --mock
```

You'll see the `[Resume Session]` option on the idle screen.

---

## 10. Session Commands

```bash
# Start fresh
node dist/cli/main.js --mock

# Start with profile pre-selected
node dist/cli/main.js --mock --profile startup

# Resume a specific session
node dist/cli/main.js --mock --session <session-id>

# Use a custom data directory
node dist/cli/main.js --mock --data-dir ./my-sessions
```

---

## Summary

You've completed a full LOGOS Engine session:

1. ✅ Installed and built the project.
2. ✅ Started the TUI with mock LLM (no API key).
3. ✅ Selected the Startup profile.
4. ✅ Answered the Core Thesis node conversationally.
5. ✅ Accepted a canonical answer.
6. ✅ Previewed a materialised document.
7. ✅ Exported Markdown.

The mock provider makes this walkthrough deterministic and reproducible — every
run produces the same agent behaviour without external API calls.
