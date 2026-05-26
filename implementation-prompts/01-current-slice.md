# Current Slice — Minimum End-to-End Runtime

## Goal

Complete linear execution of the first functional slice until the system can:

```
Select profile
→ View structure
→ Select node
→ Answer node
→ Mock agent asks refinement
→ User responds
→ Mock canonical answer generated
→ User accepts
→ Document preview shows accepted answer
```

This is the minimum viable runtime that proves the architecture: state engine, conversation runtime, prompt orchestration, mock LLM, TUI rendering, and basic materialization — all working together.

## Included Phases and Steps

| Phase | Steps | Description |
|---|---|---|
| Phase 0 | 0.1 → 0.3 | Repository baseline, shared types, CI gates |
| Phase 1 | 1.1 → 1.5 | All core contracts and types |
| Phase 2 | 2.1 → 2.2 | Profile loading and dependency graph |
| Phase 3 | 3.1 → 3.8 | Complete deterministic state engine |
| Phase 4 | 4.1 → 4.3 | Node-scoped conversation runtime |
| Phase 5 | 5.1 → 5.3 | Prompt registry, selection, assembly |
| Phase 6 | 6.1 → 6.3 | Agent turn validation and application |
| Phase 7 | 7.1 → 7.2 | Mock LLM provider + flow harness |
| Phase 8 | 8.1 → 8.3 | TUI rendering architecture |
| Phase 9 | 9.1 → 9.2 | Sidebar navigation |
| Phase 10 | 10.1 → 10.3 | Lifecycle interaction flows |
| Phase 12 | 12.1 | Basic document materialization |

## Explicitly Deferred

The following phases are deferred to later slices:

| Phase | Reason |
|---|---|
| Phase 11 (Staleness cascade) | Not required for single-node first-use flow |
| Phase 13 (Persistence) | Deferred; mock session data lives in memory |
| Phase 14 (Error handling UI) | Basic error handling only; full recovery deferred |
| Phase 15 (Testing architecture) | Core tests included; exhaustive tests deferred |
| Phase 16 (CLI + Markdown export) | Basic CLI works; file export deferred |
| Phase 17 (HTML, Agent Pack) | Deferred to post-slice-1 |
| Phase 18 (Hardening) | Deferred to final pass |

## Success Criteria

1. User can launch TUI and see idle screen with profile selection.
2. User can select a profile and view the structure overview.
3. Sidebar renders phases, documents, and nodes with status symbols.
4. User can select a node and see the initial agent question.
5. User can type an answer and receive agent follow-up.
6. Agent can generate a canonical answer draft.
7. User can accept the canonical answer.
8. Materialized document preview shows accepted answer.
9. All flows run with Mock LLM (no network, no API keys).

## Validation Gates

At the end of the current slice:

- `pnpm typecheck` passes.
- `pnpm lint` passes.
- `pnpm test` passes (all unit + integration + flow tests written so far).
- Mock LLM flow A (First Use) runs end-to-end.
- Mock LLM flow B (Incomplete Answer → Clarification → Refinement → Synthesis → Accept) runs end-to-end.
- Sidebar renders node tree with correct status symbols.
- Conversation panel shows user and agent messages.

## Stop Condition

The first slice ends when:

1. All included steps (0.1 through 12.1) are at least `🟡 Needs review`.
2. The end-to-end mock LLM first-use flow works without errors.
3. Document preview from accepted nodes renders in TUI.
4. All acceptance criteria for the slice are met.

Do not proceed to deferred phases until the current slice passes human review and the stop condition is satisfied.
