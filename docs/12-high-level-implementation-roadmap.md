# 12 — Implementation Roadmap

## 1. Purpose

This document defines the recommended implementation sequence for the LOGOS Engine conversational TUI and deterministic state engine.

The roadmap prioritizes behavior before visual polish.

---

## 2. Implementation Thesis

```txt
Build the runtime first.
Render the runtime second.
Integrate the LLM third.
Materialize documents fourth.
Polish the TUI last.
```

---

## 3. Phase 1 — Core Types and Schema

Goal:

```txt
Define the core type system for profiles, nodes, runtime state, messages, lifecycle, actions, and documents.
```

Tasks:

```txt
- Define LogosProfile.
- Define PhaseDefinition.
- Define DocumentDefinition.
- Define NodeDefinition.
- Define LogosRuntimeState.
- Define NodeRuntimeState.
- Define NodeMessage.
- Define CanonicalAnswer.
- Define DocumentRuntimeState.
```

Done when:

```txt
- Types compile.
- Sample profile can be represented.
- Empty session can be initialized.
```

---

## 4. Phase 2 — Deterministic State Engine

Goal:

```txt
Implement state evaluation, transitions, guards, and allowed actions without LLM integration.
```

Tasks:

```txt
- Initialize session state.
- Select profile.
- Select node.
- Compute session mode.
- Compute node actions.
- Apply lifecycle transitions.
- Validate invalid transitions.
- Recompute document readiness.
```

Done when:

```txt
- Unit tests cover core transitions.
- Invalid transitions are rejected.
- activeNodeId controls runtime mode.
```

---

## 5. Phase 3 — TUI Static Runtime Renderer

Goal:

```txt
Render state without LLM calls.
```

Tasks:

```txt
- Render structural mode.
- Render profile structure.
- Render node sidebar.
- Render active node conversation.
- Render canonical answer preview.
- Render contextual actions.
- Render document preview placeholder.
```

Done when:

```txt
- User can navigate nodes.
- State changes are visible.
- Sidebar status indicators update.
```

---

## 6. Phase 4 — Local Conversation Simulation

Goal:

```txt
Simulate agent turns with deterministic mock outputs.
```

Tasks:

```txt
- Add user message to active node.
- Use mock agent turn output.
- Apply output through state engine.
- Generate fake canonical answer.
- Accept/reopen/defer nodes.
```

Done when:

```txt
- Full first-use flow works without LLM.
- Incomplete answer flow works without LLM.
- Review/edit/regenerate flow is represented.
```

---

## 7. Phase 5 — Prompt Orchestration

Goal:

```txt
Implement prompt selection and prompt assembly.
```

Tasks:

```txt
- Create prompt registry.
- Select prompt by node and prompt state.
- Assemble context.
- Attach output schema.
- Add repair prompt path.
```

Done when:

```txt
- Prompt can be generated for each lifecycle state.
- Prompt assembly is testable.
- Context injection is deterministic.
```

---

## 8. Phase 6 — LLM Structured Output Integration

Goal:

```txt
Call an LLM and validate structured output.
```

Tasks:

```txt
- Define AgentTurnOutput schema.
- Call model provider.
- Validate response.
- Repair invalid response.
- Apply valid response to state.
```

Done when:

```txt
- Agent can ask initial, clarification, refinement, and synthesis turns.
- Invalid outputs do not mutate state.
- State transitions remain deterministic.
```

---

## 9. Phase 7 — Document Materialization

Goal:

```txt
Generate canonical Markdown documents from accepted node answers.
```

Tasks:

```txt
- Implement materialization rules.
- Generate partial preview.
- Show missing nodes.
- Mark stale sections.
- Export Markdown.
```

Done when:

```txt
- Accepted nodes generate document sections.
- Missing required nodes are visible.
- Stale source nodes block final export.
```

---

## 10. Phase 8 — Outcome Generation

Goal:

```txt
Generate derived outputs beyond Markdown.
```

Tasks:

```txt
- HTML artifact generation placeholder.
- Agent pack generation placeholder.
- Export panel.
- Export readiness checks.
```

Done when:

```txt
- User can see available and blocked exports.
- Markdown export is functional.
- HTML/agent pack paths are defined.
```

---

## 11. Phase 9 — Persistence and Resume

Goal:

```txt
Persist sessions and resume work safely.
```

Tasks:

```txt
- Save snapshots.
- Append events.
- Restore session.
- Validate restored state.
- Repair invalid activeNodeId.
```

Done when:

```txt
- User can resume previous session.
- Node conversations persist.
- Canonical answers persist.
- Event log captures major transitions.
```

---

## 12. Phase 10 — Prototype Hardening

Goal:

```txt
Make the prototype reliable enough for real internal use.
```

Tasks:

```txt
- Add tests for major flows.
- Add schema migration placeholder.
- Add diagnostics panel/logging.
- Add error recovery UX.
- Add sample profiles.
```

Done when:

```txt
- Main flows are covered as defined in [`13-prototypes.md`](./13-prototypes.md).
- Runtime invariants are tested.
- TUI behavior matches prototype docs.
```

---

## 13. First Implementation Target

The first working slice should be:

```txt
Select profile
→ view structure
→ select node
→ answer node
→ mock agent asks refinement
→ user responds
→ mock canonical answer generated
→ user accepts
→ document preview shows accepted answer
```

This validates the architecture without depending on full LLM behavior.

> See [`13-prototypes.md`](./13-prototypes.md) Flow A (§4.1) for the complete wireframe walkthrough of this target slice.

---

## 14. Non-Negotiable Implementation Constraints

```txt
- Do not start with document editors.
- Do not start with forms.
- Do not let the LLM mutate state directly.
- Do not make the TUI responsible for lifecycle logic.
- Do not couple profile schema to runtime state.
- Do not generate final docs from unaccepted answers.
```
