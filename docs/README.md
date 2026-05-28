# LOGOS Engine — Conversation State Canonical Docs

This package defines the canonical architecture for the LOGOS Engine conversational TUI, deterministic state engine, node-focused conversation model, prompt orchestration, document materialization, and output generation.

The core thesis is:

```txt
The LOGOS Engine is a conversation-first documentation engine governed by a deterministic state engine.
```

The TUI is not a form-based questionnaire. The sidebar is a navigable structural map. The active node determines the current conversational context. The state engine determines which prompt behavior is valid. The agent generates the next intervention. Canonical documents are materialized from accepted node answers.

## Documents

```txt
01-prototype-plan.md
02-state-engine-canonical-spec.md
03-conversation-runtime-spec.md
04-node-lifecycle-and-question-state.md
05-prompt-orchestration-spec.md
06-agent-turn-contract.md
07-document-materialization-spec.md
08-tui-state-and-rendering-contract.md
09-session-events-and-persistence.md
10-profile-and-node-schema-spec.md
11-conversation-quality-and-completeness.md
12-implementation-roadmap.md
13-prototypes.md
14-real-llm-integration-plan.md
15-real-llm-implementation-roadmap.md
```

## Reading Order

1. `01-prototype-plan.md` — prototype scope and flow plan.
2. `02-state-engine-canonical-spec.md` — deterministic state engine.
3. `03-conversation-runtime-spec.md` — node-scoped conversation model.
4. `04-node-lifecycle-and-question-state.md` — node lifecycle and transitions.
5. `05-prompt-orchestration-spec.md` — prompt selection by state.
6. `06-agent-turn-contract.md` — structured LLM turn contract.
7. `07-document-materialization-spec.md` — canonical document generation.
8. `08-tui-state-and-rendering-contract.md` — rendering rules for the TUI.
9. `09-session-events-and-persistence.md` — event log and persistence rules.
10. `10-profile-and-node-schema-spec.md` — profile, document, and node definitions.
11. `11-conversation-quality-and-completeness.md` — sufficiency and quality rules.
12. `12-implementation-roadmap.md` — implementation plan.
13. `13-prototypes.md` — rendered wireframes, state prototypes, and flow walkthroughs.
14. `14-real-llm-integration-plan.md` — plan for replacing mock-only AI with real provider integration.
15. `15-real-llm-implementation-roadmap.md` — step-by-step roadmap for real LLM implementation.
