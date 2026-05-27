/**
 * Flow F — Blocked Node (STUB)
 *
 * Validates dependency-aware navigation: blocked nodes explain their
 * blocker and link to prerequisites.
 *
 * **Partially testable:** `SELECT_NODE` with dependencies results in
 * `blocked` lifecycle. But `OPEN_PREREQUISITE` event and auto-resolution
 * on prerequisite acceptance are not yet implemented (Phase 10).
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §4.6}
 */
import { describe, it } from 'vitest';

describe('Flow F — Blocked Node', () => {
	it.todo(
		'node with unmet dependency opens as blocked',
	);

	it.todo(
		'blocked node explains prerequisite and links to it',
	);

	it.todo(
		'prerequisite acceptance auto-resolves blocked node',
	);
});
