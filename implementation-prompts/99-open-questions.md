# Open Questions

This file tracks open architectural and implementation questions discovered during documentation review.

**Status: All questions resolved (2026-05-26).**

| # | Area | Question | Impact | Decision | Blocks Step | Status |
|---|---|---|---|---|---|---|
| 1 | TUI library | Continue with Ink (React for terminal) or switch? | Medium | **Continue with Ink.** Existing `src/tui/` components are Ink-based. | 8.2 | ✅ Resolved |
| 2 | Persistence format | JSON files or SQLite? | Low | **JSON files.** Simpler for MVP; SQLite migration path documented for later. | 13.1 | ✅ Resolved |
| 3 | Prompt format | TypeScript template literals or load from `.md` files? | Low | **`.md` files.** Loaded at startup from `prompts/` directory. Enables non-developer editing. | 5.1 | ✅ Resolved |
| 4 | Type validation | Use Zod or hand-rolled validators? | Low | **Zod.** Already in `package.json`; use hand-rolled only for runtime-critical paths if performance demands it. | 6.1 | ✅ Resolved |
| 5 | Profile format | Continue with YAML or switch to TypeScript definitions? | Low | **YAML for profiles; TypeScript for contracts.** YAML is portable; TypeScript definitions are more type-safe. | 2.1 | ✅ Resolved |
| 6 | Document preview | Inline, overlay/modal, or right-side panel? | Low | **Overlay/modal.** Simplest for MVP; right-side panel deferred to later slice. | 12.2 | ✅ Resolved |
| 7 | Settings scope | Full implementation or placeholder? | Low | **Placeholder screen.** Language and depth toggles only; full settings deferred. | 8.2 | ✅ Resolved |
| 8 | Module structure migration | Existing code uses `src/core/`, `src/interview/`, etc. Roadmap uses `src/state-engine/`, `src/conversation-runtime/`, etc. How to reconcile? | High | **Aggressive migration now.** Only `src/llm/` contains non-placeholder code. All other existing `src/` directories (`core/`, `interview/`, `executive/`, `cli/`, `fs/`, `prompts/`, `renderers/`) are placeholders and can be deleted. `src/shared/` utilities should be audited and migrated into the new `src/shared/` under the roadmap structure. New code goes exclusively into roadmap-defined directories from day one. | 0.1 | ✅ Resolved |
