/**
 * Step 5.1 — Lifecycle command contract tests.
 *
 * Tests the canonical lifecycle command enum, guards, forbidden commands,
 * and that no aliases or leading slashes are present in internal values.
 */

import { describe, expect, it } from 'vitest';
import {
	FORBIDDEN_LOGOS_COMMANDS,
	type ForbiddenLogosCommand,
	isForbiddenLogosCommand,
	isLogosLifecycleCommand,
	LOGOS_LIFECYCLE_COMMANDS,
	type LogosLifecycleCommand,
} from '../../src/core/intake/lifecycle-command.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('lifecycle command contract', () => {
	describe('LOGOS_LIFECYCLE_COMMANDS', () => {
		it('contains exactly the five allowed lifecycle commands', () => {
			expect(LOGOS_LIFECYCLE_COMMANDS).toEqual([
				'logos-init',
				'logos-start',
				'logos-stop',
				'logos-status',
				'logos-generate',
			]);
		});

		it('has length 5', () => {
			expect(LOGOS_LIFECYCLE_COMMANDS.length).toBe(5);
		});
	});

	describe('LogosLifecycleCommand type', () => {
		it('accepts all allowed commands', () => {
			const valid: LogosLifecycleCommand[] = [
				'logos-init',
				'logos-start',
				'logos-stop',
				'logos-status',
				'logos-generate',
			];
			expect(valid.length).toBe(5);
		});
	});

	describe('isLogosLifecycleCommand', () => {
		it('returns true for each allowed command', () => {
			for (const cmd of LOGOS_LIFECYCLE_COMMANDS) {
				expect(isLogosLifecycleCommand(cmd), `"${cmd}"`).toBe(true);
			}
		});

		it('returns false for forbidden commands', () => {
			for (const cmd of FORBIDDEN_LOGOS_COMMANDS) {
				expect(isLogosLifecycleCommand(cmd), `"${cmd}"`).toBe(false);
			}
		});

		it('returns false for arbitrary strings', () => {
			expect(isLogosLifecycleCommand('')).toBe(false);
			expect(isLogosLifecycleCommand('help')).toBe(false);
			expect(isLogosLifecycleCommand('unknown')).toBe(false);
		});

		it('is case-sensitive', () => {
			expect(isLogosLifecycleCommand('LOGOS-INIT')).toBe(false);
			expect(isLogosLifecycleCommand('Logos-Init')).toBe(false);
		});

		it('does not accept leading slash values', () => {
			expect(isLogosLifecycleCommand('/logos-init')).toBe(false);
			expect(isLogosLifecycleCommand('/logos-start')).toBe(false);
		});
	});

	describe('internal command values', () => {
		it('do not include leading slash', () => {
			for (const cmd of LOGOS_LIFECYCLE_COMMANDS) {
				expect(cmd).not.toMatch(/^\//);
			}
			for (const cmd of FORBIDDEN_LOGOS_COMMANDS) {
				expect(cmd).not.toMatch(/^\//);
			}
		});

		it('do not include aliases beyond the five allowed commands', () => {
			const aliases = ['init', 'start', 'stop', 'status', 'generate'];
			for (const alias of aliases) {
				expect(isLogosLifecycleCommand(alias)).toBe(false);
			}
		});
	});

	describe('forbidden and allowed command overlap', () => {
		it('no forbidden command is in the allowed list', () => {
			const allowedSet = new Set<string>(LOGOS_LIFECYCLE_COMMANDS);
			for (const cmd of FORBIDDEN_LOGOS_COMMANDS) {
				expect(allowedSet.has(cmd), `"${cmd}" overlaps`).toBe(false);
			}
		});

		it('no allowed command is in the forbidden list', () => {
			const forbiddenSet = new Set<string>(FORBIDDEN_LOGOS_COMMANDS);
			for (const cmd of LOGOS_LIFECYCLE_COMMANDS) {
				expect(forbiddenSet.has(cmd), `"${cmd}" overlaps`).toBe(false);
			}
		});
	});
});

describe('forbidden command contract', () => {
	describe('FORBIDDEN_LOGOS_COMMANDS', () => {
		it('contains all prohibited command-first patterns from the spec', () => {
			const expected: ForbiddenLogosCommand[] = [
				'logos-next',
				'logos-answer',
				'logos-continue',
				'logos-question',
				'logos-phase',
				'logos-doc',
				'logos-set-answer',
				'logos-skip',
				'logos-followup',
			];
			expect(new Set(FORBIDDEN_LOGOS_COMMANDS)).toEqual(new Set(expected));
		});

		it('has length 9', () => {
			expect(FORBIDDEN_LOGOS_COMMANDS.length).toBe(9);
		});
	});

	describe('isForbiddenLogosCommand', () => {
		it('returns true for each forbidden command', () => {
			for (const cmd of FORBIDDEN_LOGOS_COMMANDS) {
				expect(isForbiddenLogosCommand(cmd), `"${cmd}"`).toBe(true);
			}
		});

		it('returns false for allowed lifecycle commands', () => {
			for (const cmd of LOGOS_LIFECYCLE_COMMANDS) {
				expect(isForbiddenLogosCommand(cmd), `"${cmd}"`).toBe(false);
			}
		});

		it('returns false for arbitrary strings', () => {
			expect(isForbiddenLogosCommand('')).toBe(false);
			expect(isForbiddenLogosCommand('help')).toBe(false);
		});

		it('is case-sensitive', () => {
			expect(isForbiddenLogosCommand('LOGOS-NEXT')).toBe(false);
		});
	});
});
