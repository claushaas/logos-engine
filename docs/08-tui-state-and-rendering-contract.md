# 08 — TUI State and Rendering Contract

## 1. Purpose

This document defines how the TUI renders the LOGOS Engine runtime state.

The TUI is a state renderer. It does not own business logic, prompt logic, node lifecycle, or document readiness.

---

## 2. Core Principle

```txt
The TUI renders what the state engine says is true.
```

---

## 3. Primary Rendering Switch

```ts
if (state.activeNodeId === null) {
  renderStructuralMode()
} else {
  renderNodeFocusedMode(state.activeNodeId)
}
```

---

## 4. Structural Mode Rendering

Condition:

```ts
activeNodeId === null
```

The TUI should render:

```txt
- selected profile or profile selection prompt;
- deterministic session actions;
- profile structure if available;
- no node-specific conversation;
- resume option if lastActiveNodeId exists.
```

---

## 5. Node-Focused Mode Rendering

Condition:

```ts
activeNodeId !== null
```

The TUI should render:

```txt
- sidebar with active node highlighted;
- breadcrumb for active node;
- node lifecycle/status;
- node conversation messages;
- canonical answer preview if available;
- completeness diagnostics if relevant;
- contextual actions from state engine;
- user input if allowed.
```

---

## 6. Sidebar Rendering

The sidebar renders the profile structure.

It must show:

```txt
- phases;
- documents;
- nodes;
- status symbol per node;
- active node highlight;
- document readiness indicator when useful.
```

Status symbols:

```txt
○ Not started
◐ In progress
? Needs clarification
△ Needs refinement
◆ Synthesized / awaiting review
✓ Accepted
⏸ Deferred
⚠ Blocked
```

---

## 7. Main Panel Rendering

The main panel changes according to mode.

Structural mode main panel:

```txt
- welcome/status message;
- available deterministic actions;
- selected profile summary;
- next recommended action.
```

Node-focused main panel:

```txt
- active node title;
- conversation;
- canonical answer preview;
- action bar;
- input area.
```

Document preview mode:

```txt
- materialized draft;
- missing nodes;
- stale sections;
- export eligibility.
```

---

## 8. Contextual Actions Rendering

The TUI must render only actions returned by the state engine.

```ts
type ContextualActionRenderModel = {
  action: NodeAction
  label: string
  enabled: boolean
  reasonIfDisabled?: string
}
```

The TUI must not hardcode lifecycle-to-action rules independently.

---

## 9. User Input Rendering

Free text input is shown only when state allows text input.

Text input is usually allowed for:

```txt
- not_started
- active
- answered
- needs_clarification
- needs_refinement
- review edit mode
```

Text input is usually hidden or disabled for:

```txt
- blocked without prerequisite selection
- accepted unless reopened
- export mode
- settings mode
```

---

## 10. Wireframe Baseline

```txt
┌──────────────────────────────┬────────────────────────────────────┐
│ LOGOS Engine                 │ Foundation / Thesis / Core Thesis │
├──────────────────────────────┼────────────────────────────────────┤
│ Profile: Startup             │ Status: Needs refinement △         │
│                              │                                    │
│ 01 Foundation                │ Agent                              │
│   01 Thesis                  │ Your answer is clear, but still    │
│     △ Core Thesis            │ generic. What makes this thesis    │
│     ○ Central Tension        │ specific to this project?          │
│     ✓ What This Is Not       │                                    │
│                              │ >                                  │
│ 02 Validation                │                                    │
│   ○ Core Assumptions         │ [Answer] [Defer] [Ask example]     │
└──────────────────────────────┴────────────────────────────────────┘
```

---

## 11. Rendering Invariants

```txt
- Active node in sidebar must match activeNodeId.
- Conversation panel must show only active node conversation.
- Canonical preview must belong to active node.
- Actions must be state-engine-approved.
- Document preview must show missing/stale status.
- TUI must survive node switching without losing conversation state.
```

---

## 12. Non-Negotiable Rules

```txt
- Sidebar is navigational, not form-based.
- Main surface is conversational.
- TUI never decides node lifecycle.
- TUI never marks canonical answers as accepted by itself.
- TUI never exports blocked or stale documents without state approval.

## See Also

- [`13-prototypes.md`](./13-prototypes.md) — Complete rendered wireframes for all 13 TUI states and 10 flows. Part 2 (Component Model) maps each rendering rule to its visual component. This document is the direct fulfillment of the rendering contract defined here.
```
