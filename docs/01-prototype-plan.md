# 01 — TUI Prototype Plan

## 1. Purpose

This document defines the prototype plan for the LOGOS Engine TUI.

The goal is to prototype the main conversational states, flows, and state-engine-driven behaviors before implementation.

The prototype must clarify how the user navigates the documentation structure, selects a semantic node/question, interacts with the agent, reviews canonical answers, and progresses toward generated documents.

This is not a visual design document.  
This is a behavioral and structural prototype plan for a terminal user interface.

---

## 2. Core Product Thesis for the TUI

The LOGOS Engine TUI is not a form-based documentation interface.

It is a conversational interface governed by a deterministic state engine.

The user may navigate a structured sidebar of phases, documents, topics, and questions, but all meaningful interaction happens through the conversational surface.

When the user selects a node/question, the TUI does not simply display a static field. Instead, it asks the state engine for the current state of that node and renders the appropriate agent-driven conversational interaction.

---

## 3. Interface Principle

```txt
Structure is navigable.
Interaction is conversational.
State is deterministic.
Documents are materialized outputs.
```

The sidebar gives the user control over where to work.

The state engine controls what kind of interaction is appropriate.

The agent generates the next message according to the active node state.

The canonical documentation is produced from accepted node states.

---

## 4. Primary Architectural Assumption

The runtime state has an `activeNodeId`.

```ts
type LogosRuntimeState = {
  activeNodeId: string | null
  selectedProfileId: string | null
  nodeStates: Record<string, NodeRuntimeState>
}
```

When `activeNodeId` is `null`, the TUI is in structural mode.

When `activeNodeId` is set, the TUI is in node-focused conversational mode.

---

## 5. Runtime Modes

### 5.1 Structural Mode

Condition:

```ts
activeNodeId === null
```

Purpose:

Allow the user to select or change the project profile, review the available documentation structure, configure session options, resume work, or start a new documentation process.

Expected UI behavior:

```txt
- Show available deterministic actions.
- Show selected profile if one exists.
- Show profile/documentation structure if available.
- Do not render a node conversation.
- Do not ask document-specific questions.
```

Typical actions:

```txt
- Select profile
- Change profile
- Review profile structure
- Start documentation
- Resume last active node
- Open settings
- Import context
- Export existing outputs
```

---

### 5.2 Node-Focused Conversational Mode

Condition:

```ts
activeNodeId !== null
```

Purpose:

Render the active node/question and its conversation, using the node state to determine the next agent behavior.

Expected UI behavior:

```txt
- Show structure sidebar.
- Highlight the active node.
- Render conversation history for the active node.
- Show canonical answer preview if available.
- Show contextual actions allowed for the current node state.
- Route user input to the active node conversation.
```

Typical actions:

```txt
- Answer
- Clarify
- Refine
- Accept
- Edit
- Regenerate
- Defer
- Reopen
- Mark as assumption
- Mark as decision
- Continue to next node
```

---

## 6. Prototype Scope

The prototype pack must cover the main TUI states and flows required to validate the interaction model.

The objective is not to prototype every edge case, but to validate the core loop:

```txt
Select structure
→ Activate node
→ Agent asks context-aware question
→ User responds
→ Engine evaluates state
→ Agent refines/synthesizes
→ User accepts or edits
→ Node becomes source for canonical document
```

---

## 7. In Scope

The following areas are in scope for the prototype pack:

```txt
- Idle state with no active node
- Profile selection
- Profile structure overview
- Sidebar navigation
- Node selection
- Active node conversation
- Node state rendering
- Initial prompt generation
- Clarification flow
- Refinement flow
- Canonical answer synthesis
- Review and acceptance flow
- Node deferral
- Blocked node behavior
- Document preview
- Document materialization trigger
- Export/outcome generation entry point
- Session resume
- Basic settings placeholder
```

---

## 8. Out of Scope

The following are explicitly out of scope for the first prototype pack:

```txt
- Final visual design
- Color system
- Typography
- Animation
- Full keyboard shortcut spec
- Authentication
- Multi-user collaboration
- Cloud sync
- Payment/billing
- Plugin system
- Full settings implementation
- Real LLM integration
- Full persistence implementation
- Final document templates
- HTML outcome design
```

These may be addressed in later prototype or implementation phases.

---

## 9. Main TUI Regions

The prototype assumes the TUI has these primary regions:

```txt
┌──────────────────────────────┬────────────────────────────────────┐
│ Structure Sidebar            │ Main Conversational Surface         │
│                              │                                    │
│ - Profile                    │ - Active context breadcrumb         │
│ - Phases                     │ - Agent/user messages               │
│ - Documents                  │ - Canonical answer preview          │
│ - Nodes/questions            │ - Input area                        │
│ - Node status indicators     │ - Contextual actions                │
│                              │                                    │
└──────────────────────────────┴────────────────────────────────────┘
```

Optional regions may be prototyped later:

```txt
- Right-side document preview
- Bottom command palette
- Inline diagnostics panel
- Export panel
- Session summary panel
```

---

## 10. Core Components

The prototypes should refer to these conceptual components.

### 10.1 App Shell

Owns the global layout.

Responsibilities:

```txt
- Render sidebar and main surface.
- Resolve current runtime mode.
- Route events to the state engine.
```

---

### 10.2 Profile Header

Shows the active profile and high-level session status.

Responsibilities:

```txt
- Display selected profile.
- Show profile change action when allowed.
- Show session-level progress summary.
```

---

### 10.3 Structure Sidebar

Shows the navigable documentation structure.

Responsibilities:

```txt
- Render phases, documents, and nodes.
- Highlight active node.
- Show node status indicators.
- Allow node selection.
```

---

### 10.4 Node Tree

Nested tree inside the sidebar.

Responsibilities:

```txt
- Group questions/topics by phase and document.
- Expose collapsed/expanded states.
- Show status per node.
```

---

### 10.5 Node Status Indicator

Displays the state of each node.

Suggested symbols:

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

### 10.6 Conversation Panel

Main interaction area for the active node.

Responsibilities:

```txt
- Render node-specific conversation history.
- Render current agent prompt.
- Render user input area.
- Render contextual actions.
```

---

### 10.7 Canonical Answer Preview

Shows the current clean synthesis for the active node.

Responsibilities:

```txt
- Display canonical answer when available.
- Show whether it is accepted, draft, or stale.
- Allow review actions when permitted.
```

---

### 10.8 Contextual Actions

Shows deterministic actions allowed by the current node state.

Responsibilities:

```txt
- Never show actions not allowed by the state engine.
- Adapt action set to current node lifecycle.
- Trigger deterministic events.
```

---

### 10.9 Document Preview Panel

Shows a generated or partially generated document.

Responsibilities:

```txt
- Materialize accepted node answers into document structure.
- Show missing required nodes.
- Allow regeneration or export when valid.
```

---

### 10.10 Export Panel

Shows available output formats.

Responsibilities:

```txt
- Export Markdown canonical docs.
- Export HTML artifacts.
- Export agent packs.
- Show blocked exports if required inputs are missing.
```

---

## 11. Node Runtime State

Each node/question owns its own runtime state.

```ts
type NodeRuntimeState = {
  nodeId: string

  lifecycle:
    | "not_started"
    | "active"
    | "answered"
    | "needs_clarification"
    | "needs_refinement"
    | "synthesized"
    | "accepted"
    | "deferred"
    | "blocked"

  conversation: NodeMessage[]

  canonicalAnswer: CanonicalAnswer | null

  completeness: {
    complete: boolean
    coverage: Record<string, "missing" | "weak" | "sufficient">
    missing: string[]
    weak: string[]
    blockingIssues: string[]
  }

  extracted: {
    facts: string[]
    assumptions: string[]
    decisions: string[]
    risks: string[]
    openQuestions: string[]
  }

  promptState:
    | "initial"
    | "follow_up"
    | "clarification"
    | "refinement"
    | "synthesis"
    | "review"
    | "repair"

  allowedActions: NodeAction[]

  updatedAt: string
}
```

---

## 12. Node Message Model

The conversation history belongs to the node.

```ts
type NodeMessage = {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  createdAt: string

  metadata?: {
    promptId?: string
    promptState?: string
    model?: string
    structuredOutputId?: string
  }
}
```

A global event log may exist, but the node-level conversation is the source for that node's canonical answer.

---

## 13. Canonical Answer Model

The canonical answer is not the same as the conversation.

The conversation is exploratory.

The canonical answer is the clean materialized synthesis.

```ts
type CanonicalAnswer = {
  content: string
  format: "markdown" | "structured"
  generatedAt: string
  generatedFromMessageIds: string[]
  confidence: "low" | "medium" | "high"
  accepted: boolean
  stale: boolean
}
```

A canonical answer becomes stale when:

```txt
- The user adds new relevant information.
- The user edits a previous answer.
- The node state is reopened.
- A dependent upstream node changes materially.
```

---

## 14. Main States to Prototype

The first prototype pack must include the following states.

---

### 14.1 Idle / No Active Node

Condition:

```ts
activeNodeId === null
selectedProfileId === null
```

Purpose:

Initial entry point before the work begins.

Must show:

```txt
- Welcome/context message
- Profile selection action
- Optional import context action
- Optional settings action
```

---

### 14.2 Profile Selected / No Active Node

Condition:

```ts
activeNodeId === null
selectedProfileId !== null
```

Purpose:

Allow the user to inspect the profile structure and begin.

Must show:

```txt
- Selected profile
- Phase/document/node tree
- Start action
- Change profile action
- Resume action if previous node exists
```

---

### 14.3 Active Node — Not Started

Condition:

```ts
activeNodeId !== null
node.lifecycle === "not_started"
```

Purpose:

Start the conversation for a node.

Agent behavior:

```txt
- Generate the first contextual question.
- Use the node's canonical question as semantic anchor.
- Ask only one question.
- Avoid showing the full questionnaire.
```

---

### 14.4 Active Node — Active / In Progress

Condition:

```ts
node.lifecycle === "active" || node.lifecycle === "answered"
```

Purpose:

Continue the node-specific conversation.

Agent behavior:

```txt
- Evaluate the latest user response.
- Extract useful information.
- Decide whether to ask follow-up, clarify, refine, or synthesize.
```

---

### 14.5 Active Node — Needs Clarification

Condition:

```ts
node.lifecycle === "needs_clarification"
```

Purpose:

Resolve ambiguity that blocks synthesis.

Agent behavior:

```txt
- State the ambiguity clearly.
- Ask one targeted clarification question.
- Avoid reopening the whole topic.
```

---

### 14.6 Active Node — Needs Refinement

Condition:

```ts
node.lifecycle === "needs_refinement"
```

Purpose:

Improve a weak or generic answer.

Agent behavior:

```txt
- Explain what is weak or too generic.
- Ask for a more specific answer.
- Offer a concrete direction when useful.
```

---

### 14.7 Active Node — Synthesized / Awaiting Review

Condition:

```ts
node.lifecycle === "synthesized"
canonicalAnswer !== null
canonicalAnswer.accepted === false
```

Purpose:

Let the user review the canonical answer.

Must show:

```txt
- Canonical answer preview
- Source conversation summary
- Accept action
- Edit action
- Regenerate action
- Defer action
```

---

### 14.8 Active Node — Accepted

Condition:

```ts
node.lifecycle === "accepted"
canonicalAnswer.accepted === true
```

Purpose:

Show accepted canonical content and allow forward movement.

Must show:

```txt
- Accepted answer
- Continue to next recommended node
- Reopen action
- Open document preview action if document has enough accepted nodes
```

---

### 14.9 Active Node — Deferred

Condition:

```ts
node.lifecycle === "deferred"
```

Purpose:

Show that the node has been intentionally postponed.

Must show:

```txt
- Deferred status
- Reason if provided
- Resume action
- Continue elsewhere action
```

---

### 14.10 Active Node — Blocked

Condition:

```ts
node.lifecycle === "blocked"
```

Purpose:

Show that the node cannot progress without missing prerequisite information.

Must show:

```txt
- Blocking reason
- Required prerequisite node or input
- Recommended action
```

---

### 14.11 Document Preview

Condition:

```ts
document preview requested
```

Purpose:

Show document materialized from accepted node answers.

Must show:

```txt
- Document title
- Accepted sections
- Missing required sections
- Draft completeness
- Regenerate document action
- Export action when valid
```

---

### 14.12 Export / Outcome Generation

Condition:

```ts
export requested
```

Purpose:

Generate canonical outputs.

Must show:

```txt
- Available export types
- Blocked exports
- Required missing nodes
- Export action
```

---

### 14.13 Settings / Config

Condition:

```ts
mode === "config"
```

Purpose:

Placeholder for future deterministic settings.

Must show:

```txt
- Language
- Depth
- Output formats
- Model/provider placeholder
- Profile behavior settings placeholder
```

---

## 15. Main Flows to Prototype

The prototype pack must include these flows.

---

### 15.1 Flow A — First Use

```txt
Idle / No Active Node
→ Profile Selection
→ Profile Structure Overview
→ Select First Node
→ Active Node — Not Started
→ User Answer
→ Active Node — In Progress
→ Synthesized / Awaiting Review
→ Accepted
```

Purpose:

Validate the complete first interaction loop.

---

### 15.2 Flow B — Incomplete Answer

```txt
Active Node — Not Started
→ User Answer
→ Needs Clarification
→ User Clarifies
→ Needs Refinement
→ User Refines
→ Synthesized / Awaiting Review
→ Accepted
```

Purpose:

Validate that the system does not blindly accept weak input.

---

### 15.3 Flow C — Sidebar Navigation During Work

```txt
Active Node — In Progress
→ User selects another node
→ Current node state is preserved
→ New active node loads
→ Agent generates message based on new node state
```

Purpose:

Validate non-linear navigation without losing conversational state.

---

### 15.4 Flow D — Review, Edit, Regenerate

```txt
Synthesized / Awaiting Review
→ User chooses Edit
→ User provides correction
→ Canonical answer becomes stale
→ Agent regenerates synthesis
→ User accepts
```

Purpose:

Validate control over generated canonical content.

---

### 15.5 Flow E — Deferred Node

```txt
Active Node — Needs Clarification
→ User defers
→ Node marked as deferred
→ Sidebar updates status
→ System recommends next viable node
```

Purpose:

Validate that uncertainty can be parked without blocking all progress.

---

### 15.6 Flow F — Blocked Node

```txt
User selects node
→ Engine detects prerequisite missing
→ Node opens as Blocked
→ System explains dependency
→ User opens prerequisite node
```

Purpose:

Validate dependency-aware navigation.

---

### 15.7 Flow G — Document Preview

```txt
Multiple required nodes accepted
→ Document preview becomes available
→ User opens document preview
→ Engine materializes draft document
→ Missing sections are shown
```

Purpose:

Validate document-as-output behavior.

---

### 15.8 Flow H — Export Outcomes

```txt
Document preview valid
→ User opens export
→ Selects Markdown / HTML / Agent Pack
→ Engine generates output
```

Purpose:

Validate export and outcome generation entry point.

---

### 15.9 Flow I — Resume Session

```txt
User opens existing session
→ activeNodeId restored or null
→ TUI shows resume options
→ User resumes last active node
```

Purpose:

Validate continuity across sessions.

---

### 15.10 Flow J — Change Profile Before Work Starts

```txt
activeNodeId === null
→ User changes profile
→ Structure reloads
→ Node states reset
```

Purpose:

Validate profile switching in idle mode.

Profile migration after work has started is out of scope for the first prototype pack.

---

## 16. Prototype Format

Each state prototype should use this format:

```md
# State Prototype: [State Name]

## Purpose

## Entry Conditions

## State Engine Inputs

## Wireframe

## Visible Elements

## Agent Behavior

## User Actions

## State Transitions

## Edge Cases

## Notes
```

Each flow prototype should use this format:

```md
# Flow Prototype: [Flow Name]

## Purpose

## Initial State

## Steps

## Wireframes

## State Transitions

## Data Written

## Success Criteria

## Edge Cases

## Notes
```

---

## 17. Wireframe Style

Wireframes must be text-based.

Use simple terminal-style blocks.

Example:

```txt
┌──────────────────────────────┬────────────────────────────────────┐
│ LOGOS Engine                 │ Foundation / Thesis / Core Thesis │
├──────────────────────────────┼────────────────────────────────────┤
│ Profile: Startup             │ Agent                              │
│                              │                                    │
│ 01 Foundation                │ What conviction makes this         │
│   01 Thesis                  │ project necessary?                 │
│     ◐ Core Thesis            │                                    │
│     ○ Central Tension        │ >                                  │
│     ○ What This Is Not       │                                    │
│                              │ [Answer] [Skip] [Ask example]      │
└──────────────────────────────┴────────────────────────────────────┘
```

Rules:

```txt
- Prefer clarity over aesthetics.
- Use symbols consistently.
- Keep each wireframe focused on one state.
- Do not over-specify final styling.
- Show enough UI to understand behavior.
```

---

## 18. Status Symbols

Use the following symbols consistently:

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

## 19. Contextual Action Rules

Contextual actions must come from the state engine.

The TUI must not hardcode actions based only on screen type.

Example:

```ts
type NodeAction =
  | "answer"
  | "accept"
  | "edit"
  | "regenerate"
  | "defer"
  | "reopen"
  | "skip"
  | "continue_next"
  | "mark_as_assumption"
  | "mark_as_decision"
  | "open_prerequisite"
  | "open_document_preview"
```

Rules:

```txt
- Only render allowed actions.
- Actions must be state-specific.
- Actions may change after each user or agent turn.
- Free text input is allowed only when the current state permits user response.
```

---

## 20. Agent Behavior Rules

The agent must never behave like a static questionnaire.

For each active node, the agent must:

```txt
- Use the node's canonical question as semantic anchor.
- Use the node state to decide the next intervention.
- Ask at most one primary question per turn.
- Prefer clarification over premature synthesis.
- Prefer synthesis when sufficient information exists.
- Make weak points explicit when refinement is needed.
- Surface contradictions as decision points.
- Generate canonical answer only when the state allows synthesis.
```

The agent may produce:

```txt
- Initial question
- Clarification request
- Refinement request
- Summary
- Canonical answer draft
- Review prompt
- Blocker explanation
- Next-node recommendation
```

---

## 21. State Engine Responsibilities

The state engine is responsible for:

```txt
- Tracking activeNodeId.
- Tracking selected profile.
- Tracking node lifecycle.
- Storing node-level conversations.
- Storing canonical answers.
- Evaluating completeness.
- Selecting prompt state.
- Determining allowed actions.
- Applying state transitions.
- Marking canonical answers as stale when needed.
- Determining document readiness.
```

The TUI is responsible for rendering state, not deciding state.

---

## 22. Prototype Completion Criteria

The prototype pack is complete when it allows a developer or product reviewer to understand:

```txt
- What the user sees in each main state.
- How the user moves between states.
- How activeNodeId controls the main interaction mode.
- How nodeStates control conversational behavior.
- How the sidebar and conversation surface interact.
- How canonical answers are generated and reviewed.
- How accepted node answers become document material.
- How exports become available.
```

---

## 23. First Prototype Deliverables

The first prototype set should include:

```txt
02-state-inventory.md
03-component-model.md
04-flow-prototypes.md
05-state-prototypes.md
06-state-engine-contract.md
07-implementation-notes.md
```

> **Implemented in [`13-prototypes.md`](./13-prototypes.md).** The prototype deliverables above have been consolidated into a single document containing the state inventory, component model, 13 state prototypes with wireframes, 10 flow prototypes, state engine contract summary, and implementation notes.

Recommended order:

```txt
1. 02-state-inventory.md
2. 03-component-model.md
3. 04-flow-prototypes.md
4. 05-state-prototypes.md
5. 06-state-engine-contract.md
6. 07-implementation-notes.md
```

---

## 24. Non-Negotiable Design Constraints

```txt
- The TUI must be conversation-first.
- The sidebar must be navigational, not form-based.
- The state engine must own the interaction state.
- Each node must own its own conversation history.
- Canonical answers must be separate from raw messages.
- Documents must be generated from accepted canonical answers.
- The user must be able to navigate non-linearly.
- The agent must adapt its question to the node state.
- Deterministic options must appear only when allowed by state.
```

---

## 25. Open Decisions

The following decisions are intentionally left open for later prototype steps:

```txt
- Whether the internal term should be node, question, topic, or semantic unit.
- Whether document preview is inline, modal, or right-side panel.
- Whether profile switching after work starts should support migration.
- Whether the TUI should include a command palette.
- Whether the TUI should support split-pane document editing.
- Whether accepted canonical answers can be manually edited outside conversation.
- Whether exports should be generated immediately or queued as artifacts.
```

---

## 26. Recommended Next Step

Create `02-state-inventory.md`.

> **Done.** See [`13-prototypes.md`](./13-prototypes.md) Part 1 (State Inventory) and Part 3 (State Prototypes) for the complete state inventory with wireframes.

That document should define every runtime state in detail:

```txt
- session modes
- node lifecycle states
- prompt states
- document states
- export states
- allowed transitions
- invalid transitions
```

This will become the foundation for both the wireframes and the implementation contract.
