# 13 — LOGOS Engine TUI Prototypes

## Purpose

This document consolidates the behavioral prototypes for the LOGOS Engine TUI as defined in `01-prototype-plan.md`. It translates the specification documents (`02`–`12`) into concrete wireframes, state definitions, and flow walkthroughs.

The prototypes validate the core interaction loop:

```
Select structure → Activate node → Agent asks context-aware question
→ User responds → Engine evaluates state → Agent refines/synthesizes
→ User accepts or edits → Node becomes source for canonical document
```

---

## Part 1: State Inventory

### 1.1 Session Modes

| Mode | Condition | Purpose |
|---|---|---|
| `idle` | `activeNodeId === null && selectedProfileId === null` | Session has not started |
| `profile_selection` | User is browsing/selecting a profile | Profile picker active |
| `structure_overview` | `activeNodeId === null && selectedProfileId !== null` | Inspect profile structure, choose node |
| `node_focus` | `activeNodeId !== null` | Working on one node conversationally |
| `document_preview` | Document preview requested | View materialized document draft |
| `export` | Export requested | Generate/output artifacts |
| `settings` | Settings/config mode active | Placeholder config surface |

**Session mode transitions:**

```
idle ──(select_profile)──→ structure_overview
idle ──(open_settings)──→ settings
structure_overview ──(select_node)──→ node_focus
structure_overview ──(change_profile)──→ idle
structure_overview ──(resume_last_node)──→ node_focus
structure_overview ──(open_settings)──→ settings
node_focus ──(deselect_node)──→ structure_overview
node_focus ──(open_document_preview)──→ document_preview
node_focus ──(open_export)──→ export
document_preview ──(close)──→ node_focus | structure_overview
export ──(close)──→ node_focus | structure_overview
settings ──(close)──→ previous mode
```

---

### 1.2 Node Lifecycle States

| Lifecycle | Symbol | Meaning |
|---|---|---|
| `not_started` | ○ | No conversation yet |
| `active` | ◐ | Currently being worked on |
| `answered` | ◐ | User answered; adequacy not yet determined |
| `needs_clarification` | ? | Ambiguity blocks synthesis |
| `needs_refinement` | △ | Answer is weak/generic/incomplete |
| `ready_for_synthesis` | ◆ | Enough information to draft canonical answer |
| `synthesized` | ◆ | Canonical draft exists, awaiting review |
| `accepted` | ✓ | Canonical answer accepted; valid source material |
| `deferred` | ⏸ | Intentionally postponed |
| `blocked` | ⚠ | Cannot progress without prerequisites |

**Valid lifecycle transitions:**

```
not_started → active
active → answered
answered → needs_clarification
answered → needs_refinement
answered → ready_for_synthesis
needs_clarification → active
needs_refinement → active
ready_for_synthesis → synthesized
synthesized → accepted
synthesized → active (reopen/edit)
accepted → active (reopen)
any non-final → deferred
any non-final → blocked
blocked → active (when blocker resolved)
```

**Invalid transitions (blocked by state engine):**

```
not_started → accepted
needs_clarification → accepted
needs_refinement → accepted
blocked → accepted
accepted → synthesized (without reopen)
synthesized → export (without acceptance)
```

---

### 1.3 Prompt States

| Prompt State | Trigger | Agent Behavior |
|---|---|---|
| `initial` | Node `not_started` | Ask one opening question anchored to canonical question |
| `follow_up` | Node `active`/`answered`, needs continuation | Respond to latest input, ask one targeted follow-up |
| `clarification` | Node `needs_clarification` | Name the ambiguity, ask one clarifying question |
| `refinement` | Node `needs_refinement` | Explain weakness, request sharper answer |
| `synthesis` | Node `ready_for_synthesis` | Draft canonical answer from conversation |
| `review` | Node `synthesized` | Present draft, invite accept/edit/regenerate/defer |
| `repair` | LLM output fails validation | Regenerate structured output |
| `blocked` | Node `blocked` | Explain blocker, identify prerequisite |
| `accepted` | Node `accepted` | Confirm, recommend next node or document preview |

**Lifecycle → Prompt State mapping:**

| Lifecycle | Default Prompt State |
|---|---|
| `not_started` | `initial` |
| `active` | `follow_up` |
| `answered` | `follow_up` |
| `needs_clarification` | `clarification` |
| `needs_refinement` | `refinement` |
| `ready_for_synthesis` | `synthesis` |
| `synthesized` | `review` |
| `accepted` | `accepted` |
| `deferred` | — (no prompt) |
| `blocked` | `blocked` |

---

### 1.4 Document States

| Status | Meaning |
|---|---|
| `not_ready` | No accepted source nodes |
| `partially_ready` | Some source nodes accepted; required nodes missing |
| `ready` | All required source nodes accepted and fresh |
| `drafted` | Materialized draft exists |
| `accepted` | Draft reviewed and accepted |
| `stale` | One or more source nodes became stale after generation |

**Document readiness rules:**

- **Ready:** all required source nodes exist, are accepted, and have non-stale canonical answers
- **Partially ready:** at least one source node accepted; some required nodes missing/deferred/blocked/stale
- **Not ready:** no accepted source nodes

---

### 1.5 Export States

| Condition | Export Availability |
|---|---|
| No profile selected | No exports available |
| Document not ready | Export blocked; missing nodes listed |
| Document ready, not drafted | Export available (generates draft then exports) |
| Document drafted, not accepted | Export available with warning |
| Document accepted, not stale | Export fully available (Markdown, HTML, Agent Pack) |
| Document stale | Export blocked until regeneration or explicit override |

---

### 1.6 Allowed Actions Per Lifecycle

| Lifecycle | Allowed Actions |
|---|---|
| `not_started` | `answer`, `skip`, `ask_for_example` |
| `active` | `answer`, `defer`, `mark_as_assumption`, `mark_as_decision` |
| `answered` | `answer`, `defer`, `mark_as_assumption`, `mark_as_decision` |
| `needs_clarification` | `answer`, `defer`, `open_prerequisite` |
| `needs_refinement` | `answer`, `defer`, `ask_for_example` |
| `ready_for_synthesis` | *(automatic transition; no user actions)* |
| `synthesized` | `accept`, `edit`, `regenerate`, `defer`, `reopen` |
| `accepted` | `continue_next`, `reopen`, `open_document_preview` |
| `deferred` | `resume` (reopens as `active`), `continue_next` |
| `blocked` | `open_prerequisite`, `defer` |

---

## Part 2: Component Model

### 2.1 Component Map

```
┌─────────────────────────────────────────────────────────────┐
│ App Shell                                                   │
│ ┌─────────────┬────────────────────────────────────────────┐│
│ │ Sidebar     │ Main Surface                               ││
│ │             │ ┌────────────────────────────────────────┐ ││
│ │ Profile     │ │ Breadcrumb                             │ ││
│ │ Header      │ ├────────────────────────────────────────┤ ││
│ │             │ │ Conversation Panel                     │ ││
│ │ Node Tree   │ │                                        │ ││
│ │  ├─ Phase   │ │  (messages, agent prompt, user input)  │ ││
│ │  │ ├─ Doc   │ │                                        │ ││
│ │  │ │ ├─Node │ ├────────────────────────────────────────┤ ││
│ │  │ │ ├─Node │ │ Canonical Answer Preview               │ ││
│ │  │ │ ├─Node │ ├────────────────────────────────────────┤ ││
│ │  │ ├─ Doc   │ │ Contextual Actions                     │ ││
│ │  ├─ Phase   │ └────────────────────────────────────────┘ ││
│ │             │                                            ││
│ │             │ (optional panels: document preview,        ││
│ │             │  export, settings overlay)                 ││
│ └─────────────┴────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

### 2.2 App Shell

**Responsibility:** Owns global layout, resolves current runtime mode, routes events to state engine.

**Rendering rule:**
```ts
if (state.activeNodeId === null) {
  renderStructuralMode()
} else {
  renderNodeFocusedMode(state.activeNodeId)
}
```

**Sub-views rendered:**
- Sidebar (always visible when profile selected)
- Main surface (mode-dependent content)
- Modal overlays (document preview, export, settings)

---

### 2.3 Profile Header

**Location:** Top of sidebar.

**Renders:**
- Selected profile name (or "No profile" if none)
- Session-level progress summary (e.g., "3/12 nodes accepted")
- Change profile action (when in `structure_overview` mode)

**States:**
- No profile selected → shows profile selection prompt
- Profile selected → shows profile name + progress

---

### 2.4 Structure Sidebar

**Location:** Left panel.

**Renders:**
- Phases, documents, and nodes as a collapsible tree
- Active node highlighted
- Status symbol per node
- Document readiness indicators

**Visibility:** Shown when `selectedProfileId !== null`. Hidden or minimal in `idle` and `settings` modes.

**Navigation behavior:**
- Selecting a node dispatches `NODE_SELECTED` event
- Current node state is preserved on navigation away
- Non-linear navigation is always allowed

---

### 2.5 Node Tree

**Location:** Inside sidebar, below profile header.

**Structure:**
```
Phase (collapsible)
  └─ Document (collapsible)
       └─ Node (selectable)
            └─ Status indicator
```

**Rendering rules:**
- Collapse/expand per phase and document
- Show status symbol next to each node
- Active node gets highlight (inverted or bold)
- Blocked nodes show dependency note on hover/focus

---

### 2.6 Node Status Indicator

**Symbols used consistently:**

```
○  not_started        — hollow circle
◐  active/answered    — half-filled circle
?  needs_clarification — question mark
△  needs_refinement   — triangle
◆  synthesized         — diamond
✓  accepted            — checkmark
⏸  deferred            — pause symbol
⚠  blocked             — warning triangle
```

---

### 2.7 Conversation Panel

**Location:** Main surface, center.

**Renders (node_focus mode):**
- Breadcrumb showing `Phase / Document / Node`
- Node status badge
- Scrollable conversation history (user + agent messages)
- Current agent prompt/message
- User input area (when allowed)
- Contextual action bar

**Renders (structural mode):**
- Welcome/status message
- Available deterministic actions
- Profile summary
- Next recommended action

**Scrolling:** Conversation history scrolls independently; input area and actions are fixed at bottom.

---

### 2.8 Canonical Answer Preview

**Location:** Below conversation, above actions (or collapsible inline panel).

**Renders when `canonicalAnswer !== null`:**
- Clean formatted content (Markdown rendered as best-effort in terminal)
- Status badge: "Draft" / "Accepted" / "Stale"
- Confidence indicator: low / medium / high
- Source: "Generated from N conversation messages"

**Hidden when:** No canonical answer exists for the active node.

---

### 2.9 Contextual Actions

**Location:** Bottom of main surface, below input area.

**Rendering rules:**
- Only actions from `state.allowedActions` are shown
- Actions map to labels via a display map:
  - `answer` → implicit (free text input)
  - `accept` → `[Accept]`
  - `edit` → `[Edit]`
  - `regenerate` → `[Regenerate]`
  - `defer` → `[Defer]`
  - `reopen` → `[Reopen]`
  - `skip` → `[Skip]`
  - `continue_next` → `[Continue →]`
  - `mark_as_assumption` → `[Mark as Assumption]`
  - `mark_as_decision` → `[Mark as Decision]`
  - `open_prerequisite` → `[Open Prerequisite]`
  - `open_document_preview` → `[Preview Document]`

**Disabled actions:** Shown grayed out with tooltip reason.

---

### 2.10 Document Preview Panel

**Mode:** Full-panel or overlay (TBD per open decision).

**Renders:**
- Document title
- Materialized content from accepted canonical answers
- Accepted sections (rendered)
- Missing required sections (labeled with source node link)
- Draft completeness indicator (e.g., "4/6 required sections accepted")
- `[Regenerate]` action
- `[Export]` action (enabled only when ready)
- `[Close]` action

---

### 2.11 Export Panel

**Mode:** Full-panel or overlay.

**Renders:**
- Available export types:
  - `[Export Markdown]` — canonical documentation
  - `[Export HTML]` — styled artifact
  - `[Export Agent Pack]` — portable agent context
- Blocked exports with reasons
- Missing required nodes list
- `[Close]` action

---

## Part 3: State Prototypes

Each state prototype follows the format defined in `01-prototype-plan.md` §16.

---

### 3.1 State: Idle / No Active Node

#### Purpose
Initial entry point before any work begins. The user has no profile selected and no active node.

#### Entry Conditions
```ts
activeNodeId === null
selectedProfileId === null
mode === "idle"
```

#### Wireframe

```
┌──────────────────────────────────────────────────────────────┐
│ LOGOS Engine                                                 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   Welcome to LOGOS Engine                                    │
│                                                              │
│   LOGOS helps you produce structured documentation through   │
│   guided conversation. Each decision, assumption, and        │
│   insight is captured as canonical source material.          │
│                                                              │
│   To begin, select a project profile.                        │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐    │
│   │ [Select Profile]                                    │    │
│   └─────────────────────────────────────────────────────┘    │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐    │
│   │ [Import Context]                                    │    │
│   └─────────────────────────────────────────────────────┘    │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐    │
│   │ [Settings]                                          │    │
│   └─────────────────────────────────────────────────────┘    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### Visible Elements
- Welcome message
- Three deterministic actions: Select Profile, Import Context, Settings
- No sidebar (no profile selected)
- No conversation surface
- No input area

#### User Actions
- `select_profile` → opens profile picker, transitions to `profile_selection`
- `import_context` → imports external context file
- `open_settings` → opens settings panel

#### State Transitions
```
idle ──(select_profile)──→ profile_selection
idle ──(open_settings)──→ settings
```

#### Edge Cases
- If a previous session exists, an additional `[Resume Session]` action should appear
- If profile list is empty, `[Select Profile]` shows "No profiles found. Import a profile pack to begin."

---

### 3.2 State: Profile Selected / No Active Node

#### Purpose
User has selected a profile and can inspect the documentation structure before choosing where to start.

#### Entry Conditions
```ts
activeNodeId === null
selectedProfileId !== null
mode === "structure_overview"
```

#### Wireframe

```
┌──────────────────────────────┬────────────────────────────────────┐
│ LOGOS Engine                 │ Structure Overview                 │
├──────────────────────────────┼────────────────────────────────────┤
│ Profile: Startup             │                                    │
│ 3/12 nodes accepted          │ Profile: Startup                   │
│                              │ Foundation & Strategy              │
│ 01 Foundation           [–]  │                                    │
│   01 Thesis            [–]   │ 6 documents across 3 phases        │
│     ○ Core Thesis            │ 12 nodes total                     │
│     ○ Central Tension        │ 3 nodes accepted (from prior       │
│     ○ What This Is Not       │ session)                           │
│                              │                                    │
│   02 Problem Space     [+]   │ ┌──────────────────────────────┐   │
│                              │ │ [Start Documentation]        │   │
│ 02 Validation          [+]   │ └──────────────────────────────┘   │
│                              │ ┌──────────────────────────────┐   │
│ 03 Product             [+]   │ │ [Resume Last Node]           │   │
│                              │ └──────────────────────────────┘   │
│                              │ ┌──────────────────────────────┐   │
│ [Select Profile]             │ │ [Change Profile]             │   │
│ [Settings]                   │ └──────────────────────────────┘   │
└──────────────────────────────┴────────────────────────────────────┘
```

#### Visible Elements
- Sidebar with profile name, progress summary, and collapsible node tree
- Status symbols per node (○, ✓ for accepted)
- Main panel showing profile summary and deterministic actions
- Three actions: Start Documentation, Resume Last Node, Change Profile

#### User Actions
- Expand/collapse phases and documents in sidebar
- `select_node` → transitions to `node_focus`
- `start_documentation` → selects first uncompleted node, transitions to `node_focus`
- `resume_last_node` → restores `lastActiveNodeId`, transitions to `node_focus`
- `change_profile` → returns to `idle`
- `open_settings` → opens settings panel

#### State Transitions
```
structure_overview ──(select_node)──→ node_focus
structure_overview ──(change_profile)──→ idle
structure_overview ──(resume_last_node)──→ node_focus
structure_overview ──(open_settings)──→ settings
```

#### Edge Cases
- If `lastActiveNodeId` is null (fresh session), `[Resume Last Node]` is hidden
- If all nodes are accepted, show "All nodes complete. [Preview Documents] [Export]"
- If profile has no nodes (malformed profile), show error diagnostic

---

### 3.3 State: Active Node — Not Started

#### Purpose
User has selected a node that has no conversation history. The agent generates the first contextual question.

#### Entry Conditions
```ts
activeNodeId !== null
node.lifecycle === "not_started"
node.promptState === "initial"
```

#### Wireframe

```
┌──────────────────────────────┬────────────────────────────────────┐
│ LOGOS Engine                 │ Foundation / Thesis / Core Thesis  │
├──────────────────────────────┼────────────────────────────────────┤
│ Profile: Startup             │ ○ Not started                      │
│                              │                                    │
│ 01 Foundation           [–]  │ Agent                              │
│   01 Thesis            [–]   │                                    │
│     ◐ Core Thesis            │ What conviction makes this         │
│     ○ Central Tension        │ project necessary? What truth      │
│     ○ What This Is Not       │ about the world drives the         │
│                              │ decision to build this?            │
│   02 Problem Space     [+]   │                                    │
│                              │ >                                  │
│ 02 Validation          [+]   │                                    │
│                              │ [Answer] [Skip] [Ask for example]  │
│ 03 Product             [+]   │                                    │
└──────────────────────────────┴────────────────────────────────────┘
```

#### Visible Elements
- Sidebar with active node highlighted (◐ Core Thesis)
- Breadcrumb: `Foundation / Thesis / Core Thesis`
- Node status: `○ Not started`
- Agent's initial question (generated from canonical question as semantic anchor)
- Free text input area
- Actions: `[Answer]` (implicit via input), `[Skip]`, `[Ask for example]`
- No canonical answer preview

#### Agent Behavior
- Generates one opening question from the node's canonical question
- Does not list all coverage topics
- Is specific to the node context
- Does not behave like a static questionnaire

#### User Actions
- Type answer → dispatches `USER_MESSAGE_ADDED`, engine evaluates, transitions to `active` or `answered`
- `skip` → marks node for later, recommends next node
- `ask_for_example` → agent generates an example response without answering for the user

#### State Transitions
```
not_started ──(user_message)──→ active | answered
not_started ──(skip)──→ defers node, returns to structure_overview
```

#### Edge Cases
- If the node has upstream dependencies that are not yet accepted, the agent should mention them in context but not block the question
- The canonical question should be paraphrased, not shown verbatim unless it reads naturally

---

### 3.4 State: Active Node — Active / In Progress

#### Purpose
The node has an ongoing conversation. The agent evaluates the latest response and decides the next step.

#### Entry Conditions
```ts
activeNodeId !== null
node.lifecycle === "active" || node.lifecycle === "answered"
node.promptState === "follow_up"
```

#### Wireframe

```
┌──────────────────────────────┬────────────────────────────────────┐
│ LOGOS Engine                 │ Foundation / Thesis / Core Thesis  │
├──────────────────────────────┼────────────────────────────────────┤
│ Profile: Startup             │ ◐ In progress                      │
│                              │                                    │
│ 01 Foundation           [–]  │ You                                │
│   01 Thesis            [–]   │ We believe the current hiring      │
│     ◐ Core Thesis            │ process filters for credentials    │
│     ○ Central Tension        │ instead of competence. The world   │
│     ○ What This Is Not       │ is shifting toward skill-based     │
│                              │ evaluation but tools haven't       │
│   02 Problem Space     [+]   │ caught up.                         │
│                              │                                    │
│ 02 Validation          [+]   │ Agent                              │
│                              │ That's a clear conviction. Is the  │
│ 03 Product             [+]   │ tension primarily that hiring is   │
│                              │ slow, that it's unfair, or that    │
│                              │ it produces bad outcomes?          │
│                              │                                    │
│                              │ >                                  │
│                              │                                    │
│                              │ [Answer]  [Defer]  [Mark as        │
│                              │  Assumption]  [Mark as Decision]   │
└──────────────────────────────┴────────────────────────────────────┘
```

#### Visible Elements
- Conversation history (user and agent messages)
- Latest agent message with follow-up question
- Input area
- Actions: `[Answer]`, `[Defer]`, `[Mark as Assumption]`, `[Mark as Decision]`
- No canonical answer preview yet

#### Agent Behavior
- Evaluates latest user response against coverage topics
- Extracts facts, assumptions, decisions, risks
- Decides: follow up, clarify, refine, or signal readiness for synthesis
- Asks at most one primary question per turn

#### User Actions
- Type answer → continues conversation
- `defer` → postpones node
- `mark_as_assumption` → tags last statement as assumption (metadata only)
- `mark_as_decision` → tags last statement as explicit decision

#### State Transitions
```
active ──(user_message + evaluation)──→ answered | needs_clarification | needs_refinement | ready_for_synthesis
active ──(defer)──→ deferred
```

#### Edge Cases
- Very long conversations: agent should summarize context before asking next question
- User answers with "I don't know": agent should offer to defer, suggest research, or reframe
- User gives very long answer: agent should acknowledge, extract key points, ask one targeted follow-up

---

### 3.5 State: Active Node — Needs Clarification

#### Purpose
The user's answer contains ambiguity that blocks synthesis. The agent must resolve this before proceeding.

#### Entry Conditions
```ts
activeNodeId !== null
node.lifecycle === "needs_clarification"
node.promptState === "clarification"
```

#### Wireframe

```
┌──────────────────────────────┬────────────────────────────────────┐
│ LOGOS Engine                 │ Foundation / Thesis / Core Thesis  │
├──────────────────────────────┼────────────────────────────────────┤
│ Profile: Startup             │ ? Needs clarification              │
│                              │                                    │
│ 01 Foundation           [–]  │ Agent                              │
│   01 Thesis            [–]   │                                    │
│     ? Core Thesis            │ You mentioned the product is for   │
│     ○ Central Tension        │ "everyone" but also mentioned      │
│     ○ What This Is Not       │ "technical teams." These point     │
│                              │ in different directions.           │
│   02 Problem Space     [+]   │                                    │
│                              │ Who is the primary user you're     │
│ 02 Validation          [+]   │ building for first?                │
│                              │                                    │
│ 03 Product             [+]   │ >                                  │
│                              │                                    │
│                              │ [Answer]  [Defer]                  │
│                              │ [Open Prerequisite]                │
└──────────────────────────────┴────────────────────────────────────┘
```

#### Visible Elements
- Status symbol `?` in sidebar and header
- Agent message: names the ambiguity explicitly, asks one targeted question
- Input area
- Actions: `[Answer]`, `[Defer]`, `[Open Prerequisite]`

#### Agent Behavior
- States the ambiguity clearly and specifically
- Asks one targeted clarification question
- Avoids reopening the whole topic
- Does not ask "can you clarify?" without stating what needs clarification

#### User Actions
- Type answer → engine re-evaluates, may resolve to `active`/`answered` or escalate to `needs_refinement`
- `defer` → postpones node
- `open_prerequisite` → if ambiguity stems from unresolved upstream node, navigate to it

#### State Transitions
```
needs_clarification ──(user_message + evaluation)──→ active | answered | needs_refinement
needs_clarification ──(defer)──→ deferred
needs_clarification ──(open_prerequisite)──→ node_focus (different node)
```

#### Edge Cases
- Multiple clarifications in a row: after 3+ clarification rounds, agent should suggest deferring or marking as assumption
- User contradicts themselves: agent should surface the contradiction neutrally, not pick a side

---

### 3.6 State: Active Node — Needs Refinement

#### Purpose
The answer is understandable but too weak, generic, or imprecise to serve as canonical source material.

#### Entry Conditions
```ts
activeNodeId !== null
node.lifecycle === "needs_refinement"
node.promptState === "refinement"
```

#### Wireframe

```
┌──────────────────────────────┬────────────────────────────────────┐
│ LOGOS Engine                 │ Foundation / Thesis / Core Thesis  │
├──────────────────────────────┼────────────────────────────────────┤
│ Profile: Startup             │ △ Needs refinement                 │
│                              │                                    │
│ 01 Foundation           [–]  │ Agent                              │
│   01 Thesis            [–]   │                                    │
│     △ Core Thesis            │ Your thesis is clear but could     │
│     ○ Central Tension        │ apply to any startup. What makes   │
│     ○ What This Is Not       │ this conviction specific to your   │
│                              │ project?                           │
│   02 Problem Space     [+]   │                                    │
│                              │ For example, is there a personal   │
│ 02 Validation          [+]   │ experience, a dataset, or a market │
│                              │ shift that only you've observed?   │
│ 03 Product             [+]   │                                    │
│                              │ >                                  │
│                              │                                    │
│                              │ [Answer]  [Defer]                  │
│                              │ [Ask for example]                  │
└──────────────────────────────┴────────────────────────────────────┘
```

#### Visible Elements
- Status symbol `△` in sidebar and header
- Agent message: explains what is weak, asks for sharper version, may offer direction
- Input area
- Actions: `[Answer]`, `[Defer]`, `[Ask for example]`

#### Agent Behavior
- Identifies the specific weakness (generic, vague, unsupported, imprecise)
- Requests a more specific, sharper, or more actionable answer
- May offer a concrete direction without taking over user intent
- Uses the node's sufficiency criteria to diagnose weakness

#### User Actions
- Type refined answer → engine re-evaluates
- `defer` → postpones node
- `ask_for_example` → agent provides an illustrative example without answering for the user

#### State Transitions
```
needs_refinement ──(user_message + evaluation)──→ active | answered | needs_clarification | ready_for_synthesis
needs_refinement ──(defer)──→ deferred
```

#### Edge Cases
- User insists answer is sufficient: agent should accept at lower confidence, mark as assumption, proceed
- Refinement loops: after 3+ refinement rounds, offer to accept as-is with "low confidence" or defer
- User asks "what would you write?": agent provides concrete direction but marks it as suggestion, not answer

---

### 3.7 State: Active Node — Synthesized / Awaiting Review

#### Purpose
A canonical answer draft has been generated. The user must review, accept, edit, or regenerate it.

#### Entry Conditions
```ts
activeNodeId !== null
node.lifecycle === "synthesized"
node.canonicalAnswer !== null
node.canonicalAnswer.accepted === false
node.promptState === "review"
```

#### Wireframe

```
┌──────────────────────────────┬────────────────────────────────────┐
│ LOGOS Engine                 │ Foundation / Thesis / Core Thesis  │
├──────────────────────────────┼────────────────────────────────────┤
│ Profile: Startup             │ ◆ Awaiting review                  │
│                              │                                    │
│ 01 Foundation           [–]  │ Agent                              │
│   01 Thesis            [–]   │ Here's a draft of your core thesis.│
│     ◆ Core Thesis            │ Review it and accept, edit, or     │
│     ○ Central Tension        │ regenerate.                        │
│     ○ What This Is Not       │                                    │
│                              │ ┌──────────────────────────────┐   │
│   02 Problem Space     [+]   │ │ CANONICAL ANSWER (DRAFT)     │   │
│                              │ │                              │   │
│ 02 Validation          [+]   │ │ The hiring industry evaluates│   │
│                              │ │ credentials over competence. │   │
│ 03 Product             [+]   │ │ As work becomes more         │   │
│                              │ │ project-based and remote,    │   │
│                              │ │ skill verification is the    │   │
│                              │ │ bottleneck. This project     │   │
│                              │ │ exists to make skill-based   │   │
│                              │ │ evaluation the default.      │   │
│                              │ │                              │   │
│                              │ │ Confidence: Medium           │   │
│                              │ │ Generated from 8 messages    │   │
│                              │ └──────────────────────────────┘   │
│                              │                                    │
│                              │ [Accept] [Edit] [Regenerate]       │
│                              │ [Defer]  [Reopen]                  │
└──────────────────────────────┴────────────────────────────────────┘
```

#### Visible Elements
- Status symbol `◆` in sidebar and header
- Agent review prompt
- Canonical answer preview in a distinct box:
  - Clean content (Markdown)
  - Confidence badge: Low / Medium / High
  - Source note: "Generated from N messages"
- Actions: `[Accept]`, `[Edit]`, `[Regenerate]`, `[Defer]`, `[Reopen]`
- Input area hidden (unless Edit is selected)

#### Agent Behavior
- Presents the draft clearly
- Invites user to accept, edit, regenerate, or defer
- Does not ask new unrelated questions
- Preserves the conversational context

#### User Actions
- `accept` → marks canonical answer as accepted, transitions to `accepted`
- `edit` → opens input area, user provides correction, canonical answer becomes stale, regenerates
- `regenerate` → agent produces new draft (may use different phrasing)
- `defer` → postpones node
- `reopen` → returns to `active` for further conversation

#### State Transitions
```
synthesized ──(accept)──→ accepted
synthesized ──(edit)──→ active (with stale canonical answer)
synthesized ──(regenerate)──→ synthesized (new draft)
synthesized ──(defer)──→ deferred
synthesized ──(reopen)──→ active
```

#### Edge Cases
- Low confidence draft: agent should explicitly flag low-confidence sections
- User accepts low-confidence: allowed, but document materialization notes the confidence
- Regeneration produces identical content: agent should acknowledge and suggest editing instead
- Very long canonical answer: preview should be scrollable

---

### 3.8 State: Active Node — Accepted

#### Purpose
The canonical answer has been accepted and is valid source material for document generation.

#### Entry Conditions
```ts
activeNodeId !== null
node.lifecycle === "accepted"
node.canonicalAnswer.accepted === true
node.promptState === "accepted"
```

#### Wireframe

```
┌──────────────────────────────┬────────────────────────────────────┐
│ LOGOS Engine                 │ Foundation / Thesis / Core Thesis  │
├──────────────────────────────┼────────────────────────────────────┤
│ Profile: Startup             │ ✓ Accepted                         │
│                              │                                    │
│ 01 Foundation           [–]  │ Agent                              │
│   01 Thesis             [–]  │ Core thesis accepted.              │
│     ✓ Core Thesis            │                                    │
│     ○ Central Tension        │ Next recommended: Central Tension  │
│     ○ What This Is Not       │ (same document, next node)         │
│                              │                                    │
│   02 Problem Space      [+]  │ ┌──────────────────────────────┐   │
│                              │ │ CANONICAL ANSWER (ACCEPTED)  │   │
│ 02 Validation           [+]  │ │                              │   │
│                              │ │ The hiring industry evaluates│   │
│ 03 Product              [+]  │ │ credentials over competence… │   │
│                              │ │                              │   │
│                              │ │ Confidence: Medium           │   │
│                              │ └──────────────────────────────┘   │
│                              │                                    │
│                              │ [Continue →]  [Reopen]             │
│                              │ [Preview Document]                 │
└──────────────────────────────┴────────────────────────────────────┘
```

#### Visible Elements
- Status symbol `✓` in sidebar and header
- Agent confirmation message
- Collapsed/accepted canonical answer preview
- Next recommended node suggestion
- Actions: `[Continue →]`, `[Reopen]`, `[Preview Document]`

#### Agent Behavior
- Confirms accepted state
- Recommends next viable node
- Suggests document preview if enough nodes in the document are accepted
- Does not reopen content unless user asks

#### User Actions
- `continue_next` → selects next recommended node, transitions to `node_focus` for that node
- `reopen` → returns node to `active`, marks canonical answer as stale
- `open_document_preview` → transitions to `document_preview`

#### State Transitions
```
accepted ──(continue_next)──→ node_focus (next node, likely not_started)
accepted ──(reopen)──→ active
accepted ──(open_document_preview)──→ document_preview
```

#### Edge Cases
- No next node (all nodes in document accepted): recommend document preview or next document
- All documents complete: recommend export
- User reopens accepted node with downstream dependents: warn that downstream answers may become stale

---

### 3.9 State: Active Node — Deferred

#### Purpose
The node has been intentionally postponed. The user can resume it or continue elsewhere.

#### Entry Conditions
```ts
activeNodeId !== null
node.lifecycle === "deferred"
```

#### Wireframe

```
┌──────────────────────────────┬────────────────────────────────────┐
│ LOGOS Engine                 │ Foundation / Thesis / Core Thesis  │
├──────────────────────────────┼────────────────────────────────────┤
│ Profile: Startup             │ ⏸ Deferred                         │
│                              │                                    │
│ 01 Foundation           [–]  │ Agent                              │
│   01 Thesis             [–]  │                                    │
│     ⏸ Core Thesis            │ This node has been deferred.       │
│     ○ Central Tension        │                                    │
│     ○ What This Is Not       │ You can resume it when ready, or   │
│                              │ continue with other nodes.         │
│   02 Problem Space      [+]  │                                    │
│                              │ Recommended next: Central Tension  │
│ 02 Validation           [+]  │                                    │
│                              │                                    │
│ 03 Product              [+]  │ [Resume]  [Continue →]             │
└──────────────────────────────┴────────────────────────────────────┘
```

#### Visible Elements
- Status symbol `⏸` in sidebar and header
- Agent message explaining deferred status
- Deferral reason if one was provided (stored in node metadata)
- Recommended next viable node
- Actions: `[Resume]`, `[Continue →]`
- Input area hidden

#### User Actions
- `resume` → reopens node at its last lifecycle (likely `active`), transitions to active conversation
- `continue_next` → selects next unblocked uncompleted node

#### State Transitions
```
deferred ──(resume)──→ active (or last lifecycle before deferral)
deferred ──(continue_next)──→ node_focus (next node)
```

#### Edge Cases
- Deferred node was `needs_clarification` before deferral: resumes as `needs_clarification`
- Deferred node was `synthesized` before deferral: resumes as `synthesized` with existing draft
- All other nodes completed, only deferred remain: agent should highlight that progress is blocked on deferred nodes

---

### 3.10 State: Active Node — Blocked

#### Purpose
The node cannot progress because prerequisite information is missing.

#### Entry Conditions
```ts
activeNodeId !== null
node.lifecycle === "blocked"
node.promptState === "blocked"
```

#### Wireframe

```
┌──────────────────────────────┬────────────────────────────────────┐
│ LOGOS Engine                 │ Validation / Core Assumptions      │
├──────────────────────────────┼────────────────────────────────────┤
│ Profile: Startup             │ ⚠ Blocked                          │
│                              │                                    │
│ 01 Foundation           [–]  │ Agent                              │
│   01 Thesis             [–]  │                                    │
│     ✓ Core Thesis            │ This node depends on your Core     │
│     ○ Central Tension        │ Thesis, which must be accepted     │
│     ○ What This Is Not       │ first.                             │
│                              │                                    │
│ 02 Validation           [–]  │ The assumptions you make here need │
│   ○ Core Assumptions     ⚠   │ a clear thesis as context.         │
│   ○ Risk Register            │                                    │
│   ○ Success Metrics          │ Prerequisite:                      │
│                              │ → Foundation / Thesis / Core       │
│ 03 Product              [+]  │   Thesis                           │
│                              │                                    │
│                              │ [Open Prerequisite]  [Defer]       │
└──────────────────────────────┴────────────────────────────────────┘
```

#### Visible Elements
- Status symbol `⚠` in sidebar and header
- Agent message explaining:
  - Why the node is blocked
  - What prerequisite is missing
  - Recommended action
- Prerequisite node name and navigation link
- Actions: `[Open Prerequisite]`, `[Defer]`
- Input area hidden

#### Agent Behavior
- Explains the blocker clearly
- Names the prerequisite node
- Offers deterministic next action (open prerequisite)
- Does not ask questions about the blocked node's topic

#### User Actions
- `open_prerequisite` → navigates to the prerequisite node in `node_focus` mode
- `defer` → postpones the blocked node (still blocked, but intentionally deferred)

#### State Transitions
```
blocked ──(open_prerequisite)──→ node_focus (prerequisite node)
blocked ──(defer)──→ deferred
blocked ──(prerequisite accepted)──→ not_started (auto-resolve when dependency satisfied)
```

#### Edge Cases
- Prerequisite node is also blocked: show dependency chain
- Multiple prerequisites missing: list all, highlight which one to address first
- Prerequisite was accepted but became stale: show "stale prerequisite" warning
- Circular dependency detected: surface as error diagnostic, allow manual override

---

### 3.11 State: Document Preview

#### Purpose
Show a document materialized from accepted node answers.

#### Entry Conditions
```ts
mode === "document_preview"
document requested via open_document_preview action
```

#### Wireframe

```
┌──────────────────────────────┬─────────────────────────────────────┐
│ LOGOS Engine                 │ Document: Foundation Thesis         │
├──────────────────────────────┼─────────────────────────────────────┤
│ Profile: Startup             │ ┌───────────────────────────────┐   │
│                              │ │ # Foundation Thesis           │   │
│ 01 Foundation           [–]  │ │                               │   │
│   01 Thesis             [–]  │ │ ## Core Thesis ✓              │   │
│     ✓ Core Thesis            │ │ The hiring industry evaluates │   │
│     ✓ Central Tension        │ │ credentials over competence…  │   │
│     ✓ What This Is Not       │ │                               │   │
│                              │ │ ## Central Tension ✓          │   │
│   02 Problem Space      [+]  │ │ There is a structural mismatch│   │
│                              │ │ between how companies hire…   │   │
│ 02 Validation           [+]  │ │                               │   │
│                              │ │ ## What This Is Not ✓         │   │
│ 03 Product              [+]  │ │ This is not an HR tool…       │   │
│                              │ │                               │   │
│                              │ │ ## Problem Statement ⚠        │   │
│                              │ │ [MISSING — requires node:     │   │
│                              │ │  Problem Space / Core Problem]│   │
│                              │ │                               │   │
│                              │ │ Completeness: 3/4 sections    │   │
│                              │ └───────────────────────────────┘   │
│                              │                                     │
│                              │ [Regenerate] [Export] [Close]       │
└──────────────────────────────┴─────────────────────────────────────┘
```

#### Visible Elements
- Document title
- Materialized content:
  - Accepted sections rendered in full
  - Missing sections labeled with `[MISSING]` and source node link
  - Stale sections labeled with `⚠ STALE`
- Completeness indicator: "N/M sections accepted"
- Actions: `[Regenerate]`, `[Export]` (enabled only when ready), `[Close]`

#### User Actions
- `regenerate` → re-materializes document from current accepted answers
- `export` → transitions to `export` mode (only if all required sections accepted and fresh)
- `close` → returns to `node_focus` (last active node) or `structure_overview`

#### State Transitions
```
document_preview ──(close)──→ node_focus | structure_overview
document_preview ──(export)──→ export
document_preview ──(select_missing_node)──→ node_focus (missing node)
```

#### Edge Cases
- Document has zero accepted nodes: show "No content yet. Accept node answers to populate this document."
- All nodes accepted but document not generated: show `[Generate Document]` as primary action
- Stale sections: show warning and offer regeneration
- Very long documents: virtual scrolling in terminal

---

### 3.12 State: Export / Outcome Generation

#### Purpose
Generate and export canonical outputs from accepted documentation.

#### Entry Conditions
```ts
mode === "export"
```

#### Wireframe

```
┌──────────────────────────────┬────────────────────────────────────┐
│ LOGOS Engine                 │ Export Outcomes                    │
├──────────────────────────────┼────────────────────────────────────┤
│ Profile: Startup             │                                    │
│                              │ Available Exports                  │
│ 01 Foundation           [–]  │                                    │
│   01 Thesis            [–]   │ ┌──────────────────────────────┐   │
│     ✓ Core Thesis            │ │ [Export Markdown]     ✓      │   │
│     ✓ Central Tension        │ │ Canonical documentation in   │   │
│     ✓ What This Is Not       │ │ portable Markdown format.    │   │
│                              │ └──────────────────────────────┘   │
│   02 Problem Space     [+]   │                                    │
│                              │ ┌──────────────────────────────┐   │
│ 02 Validation          [+]   │ │ [Export HTML]         ✓      │   │
│                              │ │ Styled documentation as a    │   │
│ 03 Product             [+]   │ │ standalone HTML artifact.    │   │
│                              │ └──────────────────────────────┘   │
│                              │                                    │
│                              │ ┌──────────────────────────────┐   │
│                              │ │ [Export Agent Pack]   ⚠      │   │
│                              │ │ Blocked: Product Phase       │   │
│                              │ │ missing 4/6 required nodes.  │   │
│                              │ └──────────────────────────────┘   │
│                              │                                    │
│                              │ [Close]                            │
└──────────────────────────────┴────────────────────────────────────┘
```

#### Visible Elements
- Export type list with availability status:
  - `✓` available
  - `⚠` blocked (with reason)
- Blocked exports show missing requirements
- Actions: each export type is an action; `[Close]`

#### User Actions
- Select export type → engine generates artifact, saves to output path
- `close` → returns to previous mode

#### State Transitions
```
export ──(close)──→ document_preview | node_focus | structure_overview
export ──(export_triggered)──→ export (with generation progress)
```

#### Edge Cases
- No documents ready for any export: all options show `⚠`, suggest which nodes to complete
- Export in progress: show spinner/progress indicator
- Export to existing file: warn about overwrite or auto-version

---

### 3.13 State: Settings / Config

#### Purpose
Placeholder for future configuration options. Minimal in first prototype.

#### Entry Conditions
```ts
mode === "settings"
```

#### Wireframe

```
┌──────────────────────────────┬────────────────────────────────────┐
│ LOGOS Engine                 │ Settings                           │
├──────────────────────────────┼────────────────────────────────────┤
│                              │                                    │
│                              │ Language:        [English     ▼]   │
│                              │ Depth:           [Standard    ▼]   │
│                              │ Output formats:  [✓] Markdown      │
│                              │                  [✓] HTML          │
│                              │                  [ ] Agent Pack    │
│                              │                                    │
│                              │ Model/Provider:  [Default     ▼]   │
│                              │                                    │
│                              │ Profile Behavior:                  │
│                              │ [ ] Auto-accept after synthesis    │
│                              │ [✓] Confirm before accepting       │
│                              │ [ ] Strict dependency ordering     │
│                              │                                    │
│                              │ ─────────────────────────────      │
│                              │ These settings are placeholders.   │
│                              │ Full implementation in later       │
│                              │ phases.                            │
│                              │                                    │
│                              │ [Close]                            │
└──────────────────────────────┴────────────────────────────────────┘
```

#### Visible Elements
- Settings fields (placeholder values):
  - Language selector
  - Depth selector
  - Output format toggles
  - Model/provider selector
  - Profile behavior toggles
- Notice: "These settings are placeholders."
- Action: `[Close]`

#### User Actions
- Toggle/select settings → stored in session (not persisted in first prototype)
- `close` → returns to previous mode

#### State Transitions
```
settings ──(close)──→ previous mode (idle | structure_overview)
```

---

## Part 4: Flow Prototypes

Each flow prototype follows the format defined in `01-prototype-plan.md` §16.

---

### 4.1 Flow A — First Use

#### Purpose
Validate the complete first interaction loop: idle → profile selection → structure overview → first node → conversation → synthesis → acceptance.

#### Initial State
```ts
mode === "idle"
activeNodeId === null
selectedProfileId === null
```

#### Steps

**Step 1: Idle → Profile Selection**
- User sees welcome screen (State 3.1)
- User selects `[Select Profile]`
- Profile picker appears (list of available profiles)
- User selects "Startup"
- Engine sets `selectedProfileId`, loads profile structure
- Mode transitions to `structure_overview`

**Step 2: Structure Overview → First Node**
- User sees profile structure (State 3.2)
- Sidebar shows phases, documents, nodes with `○` status
- User selects first node: "Core Thesis"
- Engine sets `activeNodeId`, initializes node runtime state
- Mode transitions to `node_focus`

**Step 3: Not Started → First Question**
- User sees agent's initial question (State 3.3)
- Agent asks: "What conviction makes this project necessary?"
- User types answer and submits

**Step 4: Conversation → Synthesis**
- Engine evaluates answer
- Agent follows up with targeted questions (State 3.4)
- After 2-3 turns, engine determines readiness for synthesis
- Agent generates canonical answer draft
- Mode stays `node_focus`, lifecycle → `synthesized`

**Step 5: Review → Acceptance**
- User sees canonical answer preview (State 3.7)
- User reviews content
- User selects `[Accept]`
- Engine marks canonical answer as accepted
- Lifecycle → `accepted` (State 3.8)

#### Wireframes

```
Step 1:                    Step 2:                    Step 3:
┌────────────────────┐    ┌───────┬──────────────┐    ┌───────┬──────────────┐
│ LOGOS Engine       │    │Profile│ Structure    │    │Profile│ Core Thesis  │
│                    │    │Strtup │ Overview     │    │Strtup │ ◐ Active     │
│ Welcome…           │    │       │              │    │       │              │
│                    │    │ 01 Fd │ Profile:     │    │ 01 Fd │ Agent        │
│ [Select Profile]   │    │  ○ Th │ Startup      │    │  ◐ Th │ What         │
│ [Import Context]   │    │  ○ Pr │              │    │  ○ Te │ conviction…  │
│ [Settings]         │    │       │ [Start Doc]  │    │  ○ Wh │              │
│                    │    │ 02 Vd │ [Resume]     │    │       │ >            │
│                    │    │       │ [Change]     │    │ 02 Vd │              │
└────────────────────┘    └───────┴──────────────┘    └───────┴──────────────┘

Step 4:                    Step 5:
┌───────┬──────────────┐    ┌───────┬──────────────┐
│Profile│ Core Thesis  │    │Profile│ Core Thesis  │
│Strtup │ ◆ Review     │    │Strtup │ ✓ Accepted   │
│       │              │    │       │              │
│ 01 Fd │ Agent        │    │ 01 Fd │ Agent        │
│  ◆ Th │ Review draft │    │  ✓ Th │ Accepted.    │
│  ○ Te │              │    │  ○ Te │ Next:        │
│  ○ Wh │ ┌──────────┐ │    │  ○ Wh │ Central      │
│       │ │CANONICAL │ │    │       │ Tension      │
│ 02 Vd │ │ANSWER    │ │    │ 02 Vd │              │
│       │ │(DRAFT)   │ │    │       │ [Continue→]  │
│       │ └──────────┘ │    │       │ [Reopen]     │
│       │ [Accept]     │    │       │ [Preview]    │
│       │ [Edit]       │    │       │              │
└───────┴──────────────┘    └───────┴──────────────┘
```

#### State Transitions
```
idle → profile_selection → structure_overview → node_focus (not_started)
→ node_focus (active) → node_focus (synthesized) → node_focus (accepted)
```

#### Data Written
- `selectedProfileId`: "startup"
- `activeNodeId`: "foundation.thesis.core"
- `nodeStates["foundation.thesis.core"]`: full conversation + accepted canonical answer
- Session snapshot after each turn

#### Success Criteria
- User sees the complete loop in one session
- Each state renders correctly according to Section 3 state prototypes
- Canonical answer is generated from conversation, not from template
- Accepted answer persists in node state

#### Edge Cases
- User types very short first answer: agent should ask follow-up, not jump to synthesis
- User selects wrong profile: `[Change Profile]` available in structure overview

---

### 4.2 Flow B — Incomplete Answer

#### Purpose
Validate that the system does not blindly accept weak input. The clarification → refinement → synthesis path.

#### Initial State
```ts
mode === "node_focus"
activeNodeId === "foundation.thesis.core"
node.lifecycle === "not_started"
```

#### Steps

**Step 1: Weak initial answer**
- Agent asks opening question
- User answers with something generic: "We want to make hiring better"
- Engine evaluates: coverage topics are weak or missing

**Step 2: Clarification**
- Agent detects ambiguity: "Better in what way? Faster, fairer, or more accurate?"
- Lifecycle → `needs_clarification` (State 3.5)
- User clarifies: "More accurate — credentials don't predict performance"

**Step 3: Refinement**
- Engine evaluates: answer is clearer but still generic
- Agent requests refinement: "That's a known problem. What specific insight or data do you have that others don't?"
- Lifecycle → `needs_refinement` (State 3.6)
- User provides specific insight: "We analyzed 10,000 hires and found that work-sample tests predict performance 4x better than resume screening"

**Step 4: Synthesis**
- Engine evaluates: coverage sufficient, blockers resolved
- Agent generates canonical answer draft
- Lifecycle → `ready_for_synthesis` → `synthesized` (State 3.7)

**Step 5: Acceptance**
- User reviews and accepts
- Lifecycle → `accepted` (State 3.8)

#### State Transitions
```
not_started → active → needs_clarification → active → needs_refinement
→ active → ready_for_synthesis → synthesized → accepted
```

#### Data Written
- Conversation messages capturing the progression from weak to specific
- Extracted data: facts, assumptions, decisions updated after each turn
- Completeness evaluation showing progression from `missing` → `weak` → `sufficient`
- Canonical answer with confidence: "Medium" (initially) → "High" (after refinement)

#### Success Criteria
- System correctly identifies ambiguity and requests clarification before synthesis
- System correctly identifies generic/weak content and requests refinement
- Synthesis only occurs when coverage is sufficient
- User cannot accept a canonical answer that hasn't been synthesized

#### Edge Cases
- User gives up during clarification: should be able to defer
- User contradicts earlier clarification during refinement: agent should surface the contradiction
- Refinement request is ignored (user repeats same answer): agent should accept at lower confidence or suggest deferral

---

### 4.3 Flow C — Sidebar Navigation During Work

#### Purpose
Validate non-linear navigation without losing conversational state.

#### Initial State
```ts
mode === "node_focus"
activeNodeId === "foundation.thesis.core"
node.lifecycle === "active" (mid-conversation)
```

#### Steps

**Step 1: Work in progress on Core Thesis**
- User is mid-conversation with agent on "Core Thesis"
- 4 messages exchanged, node is `active`/`answered`

**Step 2: Navigate to another node**
- User selects "Central Tension" in sidebar
- Engine deselects current node (preserves state), sets new `activeNodeId`
- "Core Thesis" state is preserved with all messages

**Step 3: Work on new node**
- "Central Tension" loads as `not_started`
- Agent generates initial question for Central Tension
- User answers one turn

**Step 4: Navigate back**
- User selects "Core Thesis" in sidebar
- Engine restores "Core Thesis" state exactly as left
- Conversation history intact, lifecycle preserved
- Agent continues from where the conversation left off

#### Wireframes

```
Step 1 (Core Thesis):     Step 2 (Central Tension):   Step 4 (back to Core):
┌───────┬──────────────┐    ┌───────┬───────────────┐    ┌───────┬──────────────┐
│Profile│ Core Thesis  │    │Profile│ Central Tens. │    │Profile│ Core Thesis  │
│Strtup │ ◐ Active     │    │Strtup │ ○ Not started │    │Strtup │ ◐ Active     │
│       │              │    │       │               │    │       │              │
│ 01 Fd │ You:         │    │ 01 Fd │ Agent         │    │ 01 Fd │ [conversation│
│  ◐ Th │ Hiring is…   │    │  ◐ Th │ What central  │    │  ◐ Th │  restored]   │
│  ○ Te │              │    │  ○ Te │ tension…      │    │  ○ Te │              │
│  ○ Wh │ Agent:       │    │  ○ Wh │               │    │  ○ Wh │ Agent:       │
│       │ Good. Who…   │    │       │ >             │    │       │ As I was     │
│ 02 Vd │              │    │ 02 Vd │               │    │ 02 Vd │ saying…      │
│       │ >            │    │       │               │    │       │              │
└───────┴──────────────┘    └───────┴───────────────┘    └───────┴──────────────┘
```

#### State Transitions
```
node_focus (Core Thesis, active)
→ node_focus (Central Tension, not_started)
→ node_focus (Core Thesis, active) [restored]
```

#### Data Written
- Both node states updated independently
- `lastActiveNodeId` updated to most recently active node
- Session snapshot preserves both nodes' full state

#### Success Criteria
- Node A's conversation survives navigation to Node B and back
- Node A's lifecycle is unchanged by the navigation
- Sidebar status symbols update correctly for both nodes
- Breadcrumb and conversation panel switch completely on navigation

#### Edge Cases
- Navigating away while agent is "thinking" (generating response): response should still be delivered to correct node, possibly shown as unread
- Rapid navigation (clicking multiple nodes quickly): engine should debounce or queue
- Node deleted from profile while active: should surface error and deselect

---

### 4.4 Flow D — Review, Edit, Regenerate

#### Purpose
Validate user control over generated canonical content.

#### Initial State
```ts
activeNodeId === "foundation.thesis.core"
node.lifecycle === "synthesized"
node.canonicalAnswer !== null
node.canonicalAnswer.accepted === false
```

#### Steps

**Step 1: Review draft**
- User sees canonical answer draft (State 3.7)
- User reads the content
- User disagrees with one sentence

**Step 2: Edit**
- User selects `[Edit]`
- Input area appears with the canonical answer content pre-filled for editing
- User modifies the sentence and submits

**Step 3: Regeneration**
- Engine marks existing canonical answer as stale
- Agent regenerates synthesis incorporating the edit
- New canonical answer draft appears
- `generatedFromMessageIds` updated to include edit message

**Step 4: Accept**
- User reviews regenerated draft
- User selects `[Accept]`
- Lifecycle → `accepted`

#### Wireframes

```
Step 1 (Review):          Step 2 (Edit):            Step 4 (Accept):
┌───────┬──────────────┐    ┌───────┬──────────────┐    ┌───────┬──────────────┐
│Profile│ Core Thesis  │    │Profile│ Core Thesis  │    │Profile│ Core Thesis  │
│Strtup │ ◆ Review     │    │Strtup │ ◐ Active     │    │Strtup │ ✓ Accepted   │
│       │              │    │       │              │    │       │              │
│ 01 Fd │ ┌──────────┐ │    │ 01 Fd │ Edit mode    │    │ 01 Fd │ ┌──────────┐ │
│  ◆ Th │ │CANONICAL │ │    │  ◆ Th │              │    │  ✓ Th │ │CANONICAL │ │
│  ○ Te │ │ANSWER    │ │    │  ○ Te │ > [edited    │    │  ○ Te │ │ANSWER    │ │
│  ○ Wh │ │          │ │    │  ○ Wh │   content]   │    │  ○ Wh │ │(ACCEPTED)│ │
│       │ └──────────┘ │    │       │              │    │       │ └──────────┘ │
│ 02 Vd │              │    │ 02 Vd │ [Submit]     │    │ 02 Vd │              │
│       │ [Accept]     │    │       │ [Cancel]     │    │       │ [Continue→]  │
│       │ [Edit]       │    │       │              │    │       │ [Reopen]     │
└───────┴──────────────┘    └───────┴──────────────┘    └───────┴──────────────┘
```

#### State Transitions
```
synthesized → active (edit mode) → ready_for_synthesis → synthesized → accepted
```

#### Data Written
- Original canonical answer marked `stale: true`
- Edit message appended to node conversation
- New canonical answer generated with updated `generatedFromMessageIds`
- Staleness event logged

#### Success Criteria
- User can edit canonical answer text directly
- Stale answer is not accidentally accepted
- Regenerated answer incorporates user edits
- Downstream dependents are flagged as potentially affected

#### Edge Cases
- User edits and accepts without regeneration: engine should regenerate automatically to ensure consistency
- User edits to something contradictory to earlier conversation: agent should flag inconsistency
- User cancels edit: return to review state with original draft intact
- Multiple edit-regenerate cycles: no limit, but each cycle creates a new draft version

---

### 4.5 Flow E — Deferred Node

#### Purpose
Validate that uncertainty can be parked without blocking all progress.

#### Initial State
```ts
activeNodeId === "foundation.thesis.core"
node.lifecycle === "needs_clarification"
```

#### Steps

**Step 1: Stuck on clarification**
- Agent has asked for clarification
- User is unsure how to answer right now

**Step 2: Defer**
- User selects `[Defer]`
- Lifecycle → `deferred` (State 3.9)
- Sidebar updates: `?` → `⏸`
- Agent recommends next viable node

**Step 3: Continue elsewhere**
- User selects `[Continue →]`
- Engine navigates to next unblocked, uncompleted node
- User works on other nodes

**Step 4: Resume (later)**
- User navigates back to deferred node in sidebar
- Node shows `⏸ Deferred` state
- User selects `[Resume]`
- Node reopens at `needs_clarification` with conversation intact
- Agent re-presents the clarification question

#### State Transitions
```
needs_clarification → deferred → (other nodes worked) → deferred → needs_clarification (resumed)
```

#### Data Written
- Node state updated to `deferred` with timestamp and optional reason
- `lastActiveNodeId` updated to next active node
- On resume: lifecycle restored to pre-deferral state

#### Success Criteria
- Deferred node is clearly marked in sidebar
- Deferral does not lose conversation history
- System recommends viable alternative nodes
- Resuming restores the correct lifecycle state

#### Edge Cases
- All other nodes also deferred/blocked: system should recommend which deferred node to tackle first
- Deferred node's upstream dependency changes while deferred: mark as stale on resume
- User defers during synthesis review: preserves the canonical answer draft

---

### 4.6 Flow F — Blocked Node

#### Purpose
Validate dependency-aware navigation: blocked nodes explain their blocker and link to prerequisites.

#### Initial State
```ts
selectedProfileId === "startup"
activeNodeId === null
mode === "structure_overview"
```

#### Steps

**Step 1: Select dependent node**
- User selects "Core Assumptions" (depends on "Core Thesis")
- Engine checks dependencies
- "Core Thesis" is not yet accepted
- Node opens as `blocked` (State 3.10)

**Step 2: Blocker explanation**
- Agent explains: "This node depends on Core Thesis, which must be accepted first."
- Prerequisite node is shown with navigation link

**Step 3: Open prerequisite**
- User selects `[Open Prerequisite]`
- Engine navigates to "Core Thesis"
- If "Core Thesis" is `not_started`, user works through it
- If already in progress, user continues where they left off

**Step 4: Prerequisite accepted → blocked node auto-resolves**
- User completes and accepts "Core Thesis"
- Engine detects dependency satisfaction
- "Core Assumptions" lifecycle auto-transitions from `blocked` → `not_started`
- Sidebar symbol changes: `⚠` → `○`
- User can now select it normally

#### Wireframes

```
Step 1-2 (Blocked):       Step 3 (Prerequisite):    Step 4 (Unblocked):
┌───────┬──────────────┐    ┌───────┬──────────────┐    ┌───────┬──────────────┐
│Profile│ Core Assump. │    │Profile│ Core Thesis  │    │Profile│ Core Assump. │
│Strtup │ ⚠ Blocked    │    │Strtup │ ○ Not started│    │Strtup │ ○ Not started│
│       │              │    │       │              │    │       │              │
│ 01 Fd │ Agent        │    │ 01 Fd │ Agent        │    │ 01 Fd │ Agent        │
│  ✓ Th │              │    │  ◐ Th │ What         │    │  ✓ Th │ What         │
│  ○ Te │ Blocked by:  │    │  ○ Te │ conviction…  │    │  ○ Te │ assumptions  │
│  ○ Wh │ Core Thesis  │    │  ○ Wh │              │    │  ○ Wh │ underlie…    │
│       │              │    │       │ >            │    │       │              │
│ 02 Vd │ [Open Prereq]│    │ 02 Vd │              │    │ 02 Vd │ >            │
│  ⚠ As │ [Defer]      │    │       │              │    │  ○ As │              │
└───────┴──────────────┘    └───────┴──────────────┘    └───────┴──────────────┘
```

#### State Transitions
```
structure_overview → node_focus (blocked) → node_focus (prerequisite)
→ prerequisite lifecycle progression → prerequisite accepted
→ blocked node auto-resolves to not_started
```

#### Data Written
- Blocked node dependency state: `blockedBy: ["foundation.thesis.core"]`
- On prerequisite acceptance: blocked node `blockedBy` cleared, lifecycle updated
- Dependency resolution event logged

#### Success Criteria
- Node with unmet dependencies opens as blocked, not as not_started
- Blocker explanation names the specific prerequisite
- User can navigate directly to prerequisite from blocked node
- Auto-resolution when prerequisite is accepted

#### Edge Cases
- Multiple prerequisites: show all, indicate which to address first
- Prerequisite itself is blocked: show dependency chain
- Circular dependency: detect and surface as error, offer manual resolution
- Prerequisite exists but was deleted from profile: surface as broken reference

---

### 4.7 Flow G — Document Preview

#### Purpose
Validate document-as-output behavior: accepted nodes materialize into readable documents.

#### Initial State
```ts
// Three nodes in "Foundation Thesis" document accepted:
nodeStates["foundation.thesis.core"].lifecycle === "accepted"
nodeStates["foundation.thesis.tension"].lifecycle === "accepted"
nodeStates["foundation.thesis.what_not"].lifecycle === "synthesized" // not accepted
```

#### Steps

**Step 1: Trigger document preview**
- User is on "Core Thesis" (accepted)
- User selects `[Preview Document]`
- Mode transitions to `document_preview` (State 3.11)

**Step 2: View materialized document**
- Document shows:
  - "Core Thesis" section ✓ (accepted content rendered)
  - "Central Tension" section ✓ (accepted content rendered)
  - "What This Is Not" section ⚠ (marked as synthesized but not accepted)
  - Missing sections (if any) labeled
- Completeness: "2/3 sections accepted, 1 pending review"

**Step 3: Return to work**
- User sees "What This Is Not" is not yet accepted
- User can navigate to it from the missing section link
- Or close document preview and continue working

**Step 4: All nodes accepted → regenerate**
- User accepts "What This Is Not"
- Returns to document preview
- Selects `[Regenerate]`
- Document now shows all 3 sections accepted
- `[Export]` becomes enabled

#### State Transitions
```
node_focus (accepted) → document_preview → node_focus (missing node)
→ node_focus (accepted) → document_preview (regenerated)
```

#### Data Written
- Document runtime state updated with draft content
- `missingRequiredNodeIds` computed from materialization rules
- Draft content generated from accepted canonical answers

#### Success Criteria
- Document preview shows only accepted nodes as complete content
- Unaccepted nodes are clearly labeled with their status
- Missing sections link back to source nodes
- Regeneration updates content when nodes change state
- Export button is disabled until all required nodes are accepted

#### Edge Cases
- No nodes accepted yet: show "No content" message with guidance
- Stale accepted answer: section content shown with ⚠ stale warning
- Very long document: scrollable preview
- Document has zero required nodes (all optional): show "No required sections" note

---

### 4.8 Flow H — Export Outcomes

#### Purpose
Validate export and outcome generation entry point.

#### Initial State
```ts
// Foundation Thesis document is ready (all required nodes accepted, not stale)
documentStates["foundation.thesis"].status === "drafted" // or "accepted"
```

#### Steps

**Step 1: Open export**
- User is in document preview for "Foundation Thesis"
- Document is complete and accepted
- User selects `[Export]`
- Mode transitions to `export` (State 3.12)

**Step 2: View export options**
- Available exports shown:
  - `[Export Markdown]` ✓
  - `[Export HTML]` ✓
  - `[Export Agent Pack]` ⚠ (blocked: other documents incomplete)

**Step 3: Export Markdown**
- User selects `[Export Markdown]`
- Engine generates Markdown file from document draft
- File saved to configured output path
- Confirmation message shown: "Exported to ./output/foundation-thesis.md"

**Step 4: Return**
- User selects `[Close]`
- Returns to document preview or node focus

#### State Transitions
```
document_preview → export → export (generating) → document_preview (after close)
```

#### Data Written
- Export artifact file on disk
- Export event logged in session
- Export metadata stored in document state

#### Success Criteria
- Only ready documents can be exported without warning
- Blocked exports show specific missing requirements
- Generated files contain correct content
- Export does not mutate runtime state (except logging)

#### Edge Cases
- Export to existing file path: warn and confirm overwrite
- Export while content is stale: block or warn explicitly
- Export Agent Pack when multiple documents exist: aggregate all accepted documents
- Empty export (no content): should not be possible if readiness rules are enforced

---

### 4.9 Flow I — Resume Session

#### Purpose
Validate continuity across sessions: user closes and reopens, work is restored.

#### Initial State
```ts
// Previous session exists with:
sessionId: "sess-001"
selectedProfileId: "startup"
activeNodeId: "foundation.thesis.core"
nodeStates["foundation.thesis.core"].lifecycle: "active"
// 6 messages in conversation
lastActiveNodeId: "foundation.thesis.core"
```

#### Steps

**Step 1: Open LOGOS with existing session**
- User launches LOGOS
- Engine detects existing session snapshot
- Idle screen shows additional option: `[Resume Session]`

**Step 2: Resume**
- User selects `[Resume Session]`
- Engine loads snapshot
- Validates runtime state
- Restores `activeNodeId` and `selectedProfileId`
- Mode → `node_focus`, active node → "Core Thesis"
- Conversation history restored

**Step 3: Continue work**
- User sees the conversation exactly as left
- Agent is ready for next input
- Lifecycle and prompt state restored correctly

#### State Transitions
```
idle (session detected) → node_focus (restored state)
```

#### Data Written
- Session snapshot loaded (read)
- New events appended as user continues work
- New snapshots saved after each turn

#### Success Criteria
- Session detection works on launch
- All node states restored correctly
- Conversation history intact
- Active node and profile restored
- Can continue without re-answering previous questions

#### Edge Cases
- Snapshot corrupted: attempt repair, fall back to structure_overview with diagnostic
- Active node deleted from profile since last session: clear activeNodeId, show warning
- Profile changed externally: detect schema version mismatch, offer migration or reset
- Multiple sessions exist: show session picker

---

### 4.10 Flow J — Change Profile Before Work Starts

#### Purpose
Validate profile switching in idle/structure_overview mode.

#### Initial State
```ts
activeNodeId === null
selectedProfileId === "startup"
mode === "structure_overview"
nodeStates: {} // no node work done yet
```

#### Steps

**Step 1: Review current profile**
- User is in structure overview for "Startup" profile
- Sidebar shows "Startup" structure

**Step 2: Change profile**
- User selects `[Change Profile]`
- Engine confirms: "This will clear the current profile view. Continue?"
- User confirms

**Step 3: Select new profile**
- Profile picker appears
- User selects "Enterprise" profile
- Engine loads new profile structure
- Mode → `structure_overview` with new profile

**Step 4: New structure loaded**
- Sidebar now shows "Enterprise" phases, documents, nodes
- All nodes show `○` (not_started)
- User can begin work on new profile

#### State Transitions
```
structure_overview → idle → profile_selection → structure_overview
```

#### Data Written
- `selectedProfileId` updated
- Previous profile's runtime state cleared (no work was done)
- Node states reset for new profile

#### Success Criteria
- Profile switch is confirmed before execution
- New profile structure loads correctly
- No orphaned node states from previous profile
- UI updates immediately to reflect new profile

#### Edge Cases
- Profile switch with existing work: out of scope for first prototype (see §15.10 note)
- Selected profile fails to load: surface error, keep previous profile
- Same profile selected again: no-op or reload structure
- Profile file missing/corrupt: show error, offer to select different profile

---

## Part 5: State Engine Contract Summary

### 5.1 Primary Interfaces

```ts
// The state engine exposes these operations to the TUI and prompt orchestrator:

interface LogosStateEngine {
  // Query
  getSnapshot(): StateEngineSnapshot
  getNodeState(nodeId: string): NodeRuntimeState | null
  getDocumentState(docId: string): DocumentRuntimeState | null

  // Commands (events)
  dispatch(event: LogosEvent): StateEngineResult
}

type LogosEvent =
  | { type: "SELECT_PROFILE"; profileId: string }
  | { type: "CHANGE_PROFILE"; profileId: string }
  | { type: "SELECT_NODE"; nodeId: string }
  | { type: "DESELECT_NODE" }
  | { type: "USER_MESSAGE"; nodeId: string; content: string }
  | { type: "ACCEPT_CANONICAL_ANSWER"; nodeId: string }
  | { type: "EDIT_CANONICAL_ANSWER"; nodeId: string; content: string }
  | { type: "REGENERATE_CANONICAL_ANSWER"; nodeId: string }
  | { type: "DEFER_NODE"; nodeId: string; reason?: string }
  | { type: "REOPEN_NODE"; nodeId: string }
  | { type: "RESUME_NODE"; nodeId: string }
  | { type: "CONTINUE_TO_NEXT" }
  | { type: "OPEN_DOCUMENT_PREVIEW"; documentId: string }
  | { type: "CLOSE_DOCUMENT_PREVIEW" }
  | { type: "OPEN_EXPORT" }
  | { type: "EXPORT_DOCUMENT"; documentId: string; format: string }
  | { type: "CLOSE_EXPORT" }
  | { type: "OPEN_SETTINGS" }
  | { type: "CLOSE_SETTINGS" }
  | { type: "RESUME_SESSION"; sessionId: string }
  | { type: "APPLY_AGENT_TURN"; nodeId: string; output: AgentTurnOutput }

type StateEngineResult =
  | { ok: true; snapshot: StateEngineSnapshot }
  | { ok: false; error: string; diagnostics: StateDiagnostic[] }
```

### 5.2 Snapshot Shape

```ts
type StateEngineSnapshot = {
  mode: SessionMode
  selectedProfileId: string | null
  activeNodeId: string | null
  activeNodeState: NodeRuntimeState | null
  allowedActions: NodeAction[]
  sidebar: SidebarRenderModel
  mainPanel: MainPanelRenderModel
  diagnostics: StateDiagnostic[]
}
```

### 5.3 Key Invariants

1. **Active node must belong to selected profile.** If `activeNodeId` is set and does not exist in the selected profile, the engine must clear it and enter `structure_overview`.

2. **Canonical answers must not be accepted without user action.** The LLM may propose acceptance intent, but only the explicit `ACCEPT_CANONICAL_ANSWER` event can transition to `accepted`.

3. **Documents must not be exported with missing required nodes.** Export readiness is checked on every export attempt.

4. **Stale canonical answers must be flagged.** If a node is reopened or new information is added, the canonical answer must be marked stale immediately.

5. **Sidebar status symbols must match node lifecycles exactly.** The TUI must derive status symbols from `node.lifecycle`, never from a separate display state.

6. **Actions must be state-derived, not hardcoded.** The TUI must render only `snapshot.allowedActions`, never a hardcoded list based on screen type.

7. **Node conversations are isolated.** Switching nodes must never lose or mix conversation history.

8. **Prompt state derives from lifecycle.** The prompt orchestrator selects the prompt based on `node.lifecycle` and `node.promptState`, never independently.

### 5.4 Validation Gates

| Gate | Check | On Failure |
|---|---|---|
| Node selection | Node exists in profile | Reject, stay in current mode |
| User message | Input allowed for current lifecycle | Reject, show diagnostic |
| Accept canonical | Answer exists, not stale, lifecycle is `synthesized` | Reject, explain what's missing |
| Export document | All required nodes accepted, not stale | Reject, list missing requirements |
| Agent turn | Output passes schema validation | Enter `repair` prompt state |
| Lifecycle transition | Transition is valid for current lifecycle | Reject, log invalid transition |

---

## Part 6: Implementation Notes

### 6.1 Architecture Layers

```
┌─────────────────────────────────┐
│ TUI (Terminal Renderer)         │  ← Renders state snapshots
├─────────────────────────────────┤
│ State Engine                    │  ← Owns all state, validates transitions
├─────────────────────────────────┤
│ Prompt Orchestrator             │  ← Selects prompts, assembles context
├─────────────────────────────────┤
│ LLM Adapter                     │  ← Calls LLM, returns structured output
├─────────────────────────────────┤
│ Document Materializer           │  ← Assembles documents from accepted answers
├─────────────────────────────────┤
│ Persistence Layer               │  ← Snapshots + event log
└─────────────────────────────────┘
```

### 6.2 Data Flow Per Turn (Node Focus)

```
User types input
  → TUI dispatches USER_MESSAGE event
    → State engine appends message, evaluates state
      → If prompt needed: Prompt Orchestrator builds request
        → LLM Adapter calls model
          → AgentTurnOutput returned
            → State engine validates output
              → State engine applies effects (update lifecycle, completeness, etc.)
                → State engine emits snapshot
                  → TUI re-renders
```

### 6.3 Rendering Optimization Notes

- **Sidebar:** Re-render only when node states change or active node changes. Do not rebuild the entire tree on every keystroke.
- **Conversation panel:** Virtual scroll for long conversations. Keep latest messages visible.
- **Canonical preview:** Toggle between collapsed (one-line summary) and expanded (full content).
- **Input area:** Multi-line support via terminal raw mode. Enter to submit, Esc to cancel, Shift+Enter for newline.

### 6.4 Terminal Compatibility

- Target: terminals supporting Unicode box-drawing characters and ANSI escape codes.
- Minimum terminal width: 80 columns. Sidebar collapses or truncates below this.
- Fallback for terminals without Unicode: ASCII-only mode with `+`, `-`, `|` characters.

### 6.5 State Persistence Strategy

- Snapshot after every completed agent turn (not after every keystroke).
- Event log append is synchronous with state mutation.
- Snapshots stored as JSON on disk (local first; cloud sync out of scope).
- Session auto-save on exit (SIGINT, SIGTERM).

### 6.6 First Implementation Priorities

1. State engine with all lifecycle transitions and guards
2. Structural mode rendering (idle + structure_overview)
3. Node-focused mode with `not_started` → `active` → `synthesized` → `accepted` core path
4. Sidebar with node tree and status indicators
5. Conversation panel with message history
6. Canonical answer preview and review flow
7. Document preview (read-only, no edit)
8. Export Markdown (simplest format)

**Defer to later iterations:**
- Full prompt orchestration with profile-specific prompts
- Real LLM integration (use mock/simulated agent for TUI prototyping)
- Settings implementation
- HTML export
- Agent Pack export
- Session resume from disk
- Profile switching with migration

### 6.7 Mock Agent for Prototyping

For TUI prototyping without real LLM integration, use a deterministic mock agent:

```ts
function mockAgentTurn(nodeState: NodeRuntimeState): AgentTurnOutput {
  switch (nodeState.lifecycle) {
    case "not_started":
      return {
        userFacingMessage: "What conviction makes this project necessary?",
        proposedLifecycle: "active",
        proposedPromptState: "follow_up",
        suggestedActions: ["answer", "skip"],
      }
    case "active":
      return {
        userFacingMessage: "That's interesting. Can you be more specific about the central tension?",
        proposedLifecycle: "needs_refinement",
        proposedPromptState: "refinement",
        suggestedActions: ["answer", "defer"],
      }
    case "needs_clarification":
      return {
        userFacingMessage: "I'm seeing a contradiction. Can you clarify which direction you mean?",
        proposedLifecycle: "active",
        proposedPromptState: "follow_up",
        suggestedActions: ["answer", "defer"],
      }
    // ... etc for each lifecycle
  }
}
```

### 6.8 Document Materialization (Simplified)

For the first prototype, document materialization is straightforward:

1. Collect all accepted canonical answers for the document's source nodes
2. Concatenate them in order, with section headers from the materialization rule
3. Mark missing sections with placeholder text
4. Output as Markdown string

No templating engine, no styling, no cross-references in the first iteration.

---

## Appendix A: Action-Label Mapping

| Action | Display Label | When Visible |
|---|---|---|
| `answer` | (implicit — free text input) | `not_started`, `active`, `answered`, `needs_clarification`, `needs_refinement` |
| `accept` | `[Accept]` | `synthesized` |
| `edit` | `[Edit]` | `synthesized` |
| `regenerate` | `[Regenerate]` | `synthesized` |
| `defer` | `[Defer]` | all non-final lifecycles |
| `reopen` | `[Reopen]` | `synthesized`, `accepted` |
| `skip` | `[Skip]` | `not_started` |
| `continue_next` | `[Continue →]` | `accepted`, `deferred` |
| `mark_as_assumption` | `[Mark as Assumption]` | `active`, `answered` |
| `mark_as_decision` | `[Mark as Decision]` | `active`, `answered` |
| `open_prerequisite` | `[Open Prerequisite]` | `blocked`, `needs_clarification` |
| `open_document_preview` | `[Preview Document]` | `accepted` |
| `ask_for_example` | `[Ask for example]` | `not_started`, `needs_refinement` |
| `resume` | `[Resume]` | `deferred` |

---

## Appendix B: Lifecycle Symbol Reference

```
○  not_started         — Hollow circle
◐  active / answered   — Half-filled circle
?  needs_clarification  — Question mark
△  needs_refinement    — Triangle (upward)
◆  synthesized          — Diamond (filled when awaiting review)
✓  accepted             — Check mark
⏸  deferred             — Pause symbol
⚠  blocked              — Warning sign
```

---

## Appendix C: Session Mode → Main Panel Content

| Mode | Main Panel Shows |
|---|---|
| `idle` | Welcome message, deterministic actions |
| `profile_selection` | Profile picker list |
| `structure_overview` | Profile summary, start/resume/change actions |
| `node_focus` | Breadcrumb, conversation, canonical preview, input, actions |
| `document_preview` | Materialized document, missing sections, regenerate/export/close |
| `export` | Export type list, blocked exports with reasons |
| `settings` | Settings fields (placeholder) |
| `error` | Error diagnostic, recovery actions |
