/**
 * Allowed actions computation — pure function mapping node lifecycle to the
 * set of `NodeAction` values permitted in that lifecycle.
 *
 * The TUI must render only the actions returned by this module. Hardcoding
 * lifecycle-to-action rules in render components would violate the
 * architecture.
 *
 * All functions are pure: no side effects, no state mutation.
 *
 * @see {@link https://logos-engine/docs/04-node-lifecycle-and-question-state.md §8}
 * @see {@link https://logos-engine/docs/13-prototypes.md §1.6}
 * @see {@link https://logos-engine/docs/13-prototypes.md Appendix A}
 */
import type { NodeAction, NodeLifecycle } from '../contracts/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Action map — single source of truth for lifecycle → allowed actions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Every lifecycle mapped to the ordered set of `NodeAction` values that
 * the state engine permits in that lifecycle.
 *
 * Derived from the canonical spec §8, prototypes §1.6, and Appendix A.
 *
 * `ready_for_synthesis` has an empty action set because the transition to
 * `synthesized` is automatic (the engine evaluates completeness and
 * triggers synthesis without requiring a user action).
 */
const ALLOWED_ACTIONS_BY_LIFECYCLE: Readonly<
	Record<NodeLifecycle, readonly NodeAction[]>
> = {
	not_started: ['answer', 'skip', 'ask_for_example'],
	active: ['answer', 'defer', 'mark_as_assumption', 'mark_as_decision'],
	answered: ['answer', 'defer', 'mark_as_assumption', 'mark_as_decision'],
	needs_clarification: ['answer', 'defer', 'open_prerequisite'],
	needs_refinement: ['answer', 'defer', 'ask_for_example'],
	ready_for_synthesis: [], // automatic transition — no user actions
	synthesized: ['accept', 'edit', 'regenerate', 'defer', 'reopen'],
	accepted: ['continue_next', 'reopen', 'open_document_preview'],
	deferred: ['resume', 'continue_next'],
	blocked: ['open_prerequisite', 'defer'],
};

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Returns the set of `NodeAction` values allowed in the given lifecycle.
 *
 * The returned array is a **copy** — callers cannot mutate the
 * module-level source of truth.
 *
 * @param lifecycle - The current node lifecycle.
 * @returns A new array of allowed actions for that lifecycle. May be
 *   empty (e.g., `ready_for_synthesis`).
 */
export function getAllowedActions(lifecycle: NodeLifecycle): NodeAction[] {
	return [...ALLOWED_ACTIONS_BY_LIFECYCLE[lifecycle]];
}

/**
 * Check whether a specific `NodeAction` is allowed in the given lifecycle.
 *
 * @param lifecycle - The current node lifecycle.
 * @param action    - The action to check.
 * @returns `true` if the action is permitted in that lifecycle.
 */
export function isActionAllowed(
	lifecycle: NodeLifecycle,
	action: NodeAction,
): boolean {
	return ALLOWED_ACTIONS_BY_LIFECYCLE[lifecycle].includes(action);
}
