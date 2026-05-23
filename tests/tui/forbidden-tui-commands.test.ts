/**
 * Step 10.2 — Forbidden TUI commands tests.
 *
 * Proves that:
 * 1. No TUI source registers or handles logos-next.
 * 2. No TUI source registers or handles logos-answer.
 * 3. No TUI source registers or handles logos-continue.
 * 4. No TUI source registers or handles logos-question.
 * 5. No TUI source registers or handles logos-phase.
 * 6. No TUI source registers or handles logos-doc.
 * 7. No TUI source registers or handles logos-set-answer.
 * 8. No TUI source registers or handles logos-skip.
 * 9. No TUI source registers or handles logos-followup.
 * 10. Slash variants are absent from active TUI source.
 *
 * Since `src/tui/` does not exist in the current repository (Strategy A:
 * Defer TUI), all forbidden-command scans return zero violations.
 * The tests also verify that the forbidden command list exported from Core
 * is exactly the nine banned patterns, consistent with the spec.
 */

import type { Stats } from 'node:fs';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	FORBIDDEN_LOGOS_COMMANDS,
	LOGOS_LIFECYCLE_COMMANDS,
} from '../../src/core/index.js';

const PROJECT_ROOT = process.cwd();

// ---------------------------------------------------------------------------
// Forbidden command patterns
// ---------------------------------------------------------------------------

/** Forbidden command names (without slash). */
const FORBIDDEN_NAMES = [
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

/** Slash-prefixed variants that must not appear in active TUI source. */
const SLASH_FORBIDDEN_PATTERNS = FORBIDDEN_NAMES.map((n) => `/${n}`);

/** Legacy short command names that must not appear in TUI command handling. */
const LEGACY_SHORT_NAMES = [
	'next',
	'answer',
	'continue',
	'question',
	'phase',
	'doc',
	'set-answer',
	'skip',
	'followup',
];

/** Slash-prefixed legacy short patterns. */
const SLASH_LEGACY_SHORT = LEGACY_SHORT_NAMES.map((n) => `/${n}`);

/** All patterns that TUI source must not reference. */
const ALL_FORBIDDEN_PATTERNS = [
	...FORBIDDEN_NAMES,
	...SLASH_FORBIDDEN_PATTERNS,
	...SLASH_LEGACY_SHORT,
];

// ---------------------------------------------------------------------------
// File scanning helpers
// ---------------------------------------------------------------------------

function findTsFiles(dir: string): string[] {
	if (!existsSync(dir)) return [];

	const entries = readdirSync(dir);
	const files: string[] = [];

	for (const entry of entries) {
		const fullPath = join(dir, entry);
		let stat: Stats;
		try {
			stat = statSync(fullPath);
		} catch {
			continue;
		}
		if (stat.isDirectory()) {
			files.push(...findTsFiles(fullPath));
		} else if (
			stat.isFile() &&
			(entry.endsWith('.ts') || entry.endsWith('.tsx'))
		) {
			files.push(fullPath);
		}
	}

	return files;
}

type CommandViolation = {
	file: string;
	pattern: string;
};

/**
 * Scan TUI source for forbidden command patterns.
 *
 * Returns violations where TUI source matches forbidden command names.
 * This scans for the patterns in any context — not just imports/strings,
 * but the presence of these command names in TUI source is a strong signal
 * of forbidden command-first intake progression.
 */
function scanTuiForForbiddenCommands(): CommandViolation[] {
	const tuiDir = join(PROJECT_ROOT, 'src', 'tui');
	if (!existsSync(tuiDir)) return [];

	const files = findTsFiles(tuiDir);
	const violations: CommandViolation[] = [];

	for (const file of files) {
		const source = readFileSync(file, 'utf-8');
		const fileRel = relative(PROJECT_ROOT, file);

		for (const pattern of ALL_FORBIDDEN_PATTERNS) {
			if (source.includes(pattern)) {
				violations.push({ file: fileRel, pattern });
			}
		}
	}

	return violations;
}

/**
 * Scan full source tree for forbidden command names used in
 * command-registration contexts (e.g., registerCommand, pi.registerCommand).
 * This is a broader check beyond just TUI — it catches any source
 * that might be trying to register a forbidden command.
 */
function scanAllSourceForForbiddenCommandRegistration(): CommandViolation[] {
	const srcDir = join(PROJECT_ROOT, 'src');
	if (!existsSync(srcDir)) return [];

	const files = findTsFiles(srcDir);
	const violations: CommandViolation[] = [];
	// Patterns that indicate command registration
	const registrationPatterns = [
		/registerCommand\s*\(\s*['"]([^'"]+)['"]/g,
		/\.command\s*\(\s*['"]([^'"]+)['"]/g,
	];

	for (const file of files) {
		const source = readFileSync(file, 'utf-8');
		const fileRel = relative(PROJECT_ROOT, file);

		for (const regex of registrationPatterns) {
			let match = regex.exec(source);
			while (match !== null) {
				const cmdName = match[1];
				// Check if the registered command is a forbidden logo-prefixed name
				if (FORBIDDEN_NAMES.includes(cmdName)) {
					violations.push({ file: fileRel, pattern: cmdName });
				}
				// Also check legacy short names (only if they appear as standalone
				// commands in a registration context, not just any string)
				if (
					LEGACY_SHORT_NAMES.includes(cmdName) &&
					// Exclude when the command is not logos-prefixed but appears
					// in a registration call — could be a false positive for
					// non-LOGOS commands, but we want to flag anything suspicious
					!cmdName.startsWith('logos-')
				) {
					// Only flag if it's in a context that looks like a LOGOS command
					// We use a simple heuristic: the file also references LOGOS
					if (source.includes('logos')) {
						violations.push({
							file: fileRel,
							pattern: `/${cmdName} (legacy short)`,
						});
					}
				}
				match = regex.exec(source);
			}
		}
	}

	return violations;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('forbidden TUI commands (Step 10.2)', () => {
	describe('TUI source forbidden command patterns', () => {
		it('logos-next is not present in TUI source', () => {
			const violations = scanTuiForForbiddenCommands();
			const nextViolations = violations.filter((v) =>
				v.pattern.includes('logos-next'),
			);
			expect(
				nextViolations,
				'TUI source must not contain logos-next. If violations found, TUI is non-compliant.',
			).toEqual([]);
		});

		it('logos-answer is not present in TUI source', () => {
			const violations = scanTuiForForbiddenCommands();
			const answerViolations = violations.filter((v) =>
				v.pattern.includes('logos-answer'),
			);
			expect(answerViolations).toEqual([]);
		});

		it('logos-continue is not present in TUI source', () => {
			const violations = scanTuiForForbiddenCommands();
			const continueViolations = violations.filter((v) =>
				v.pattern.includes('logos-continue'),
			);
			expect(continueViolations).toEqual([]);
		});

		it('logos-question is not present in TUI source', () => {
			const violations = scanTuiForForbiddenCommands();
			const questionViolations = violations.filter((v) =>
				v.pattern.includes('logos-question'),
			);
			expect(questionViolations).toEqual([]);
		});

		it('logos-phase is not present in TUI source', () => {
			const violations = scanTuiForForbiddenCommands();
			const phaseViolations = violations.filter((v) =>
				v.pattern.includes('logos-phase'),
			);
			expect(phaseViolations).toEqual([]);
		});

		it('logos-doc is not present in TUI source', () => {
			const violations = scanTuiForForbiddenCommands();
			const docViolations = violations.filter((v) =>
				v.pattern.includes('logos-doc'),
			);
			expect(docViolations).toEqual([]);
		});

		it('logos-set-answer is not present in TUI source', () => {
			const violations = scanTuiForForbiddenCommands();
			const setAnswerViolations = violations.filter((v) =>
				v.pattern.includes('logos-set-answer'),
			);
			expect(setAnswerViolations).toEqual([]);
		});

		it('logos-skip is not present in TUI source', () => {
			const violations = scanTuiForForbiddenCommands();
			const skipViolations = violations.filter((v) =>
				v.pattern.includes('logos-skip'),
			);
			expect(skipViolations).toEqual([]);
		});

		it('logos-followup is not present in TUI source', () => {
			const violations = scanTuiForForbiddenCommands();
			const followupViolations = violations.filter((v) =>
				v.pattern.includes('logos-followup'),
			);
			expect(followupViolations).toEqual([]);
		});

		it('all forbidden LOGOS commands are absent from TUI source', () => {
			const violations = scanTuiForForbiddenCommands();

			if (violations.length > 0) {
				const messages = violations.map((v) => `${v.file}: "${v.pattern}"`);
				throw new Error(
					`Forbidden command patterns found in TUI source:\n${messages.join('\n')}`,
				);
			}

			// No TUI source = zero violations
			expect(violations).toEqual([]);
		});
	});

	describe('slash-prefixed forbidden command patterns', () => {
		it('/logos-next is not present in any source file that registers commands', () => {
			// Since there is no TUI source, we check all source for command registration
			const violations = scanAllSourceForForbiddenCommandRegistration();
			const slashNext = violations.filter((v) => v.pattern === 'logos-next');
			expect(slashNext).toEqual([]);
		});

		it('/logos-answer is not registered anywhere', () => {
			const violations = scanAllSourceForForbiddenCommandRegistration();
			const slashAnswer = violations.filter(
				(v) => v.pattern === 'logos-answer',
			);
			expect(slashAnswer).toEqual([]);
		});

		it('/logos-continue is not registered anywhere', () => {
			const violations = scanAllSourceForForbiddenCommandRegistration();
			const slashContinue = violations.filter(
				(v) => v.pattern === 'logos-continue',
			);
			expect(slashContinue).toEqual([]);
		});

		it('no forbidden command is registered in any source file', () => {
			const violations = scanAllSourceForForbiddenCommandRegistration();

			if (violations.length > 0) {
				const messages = violations.map((v) => `${v.file}: "${v.pattern}"`);
				throw new Error(
					`Forbidden LOGOS commands registered in source:\n${messages.join('\n')}`,
				);
			}

			expect(violations).toEqual([]);
		});
	});

	describe('strategy consistency', () => {
		it('TUI source directory is absent (Strategy A)', () => {
			const tuiDir = join(PROJECT_ROOT, 'src', 'tui');
			expect(existsSync(tuiDir)).toBe(false);
		});

		it('FORBIDDEN_LOGOS_COMMANDS includes all nine banned patterns', () => {
			expect(FORBIDDEN_LOGOS_COMMANDS).toEqual([
				'logos-next',
				'logos-answer',
				'logos-continue',
				'logos-question',
				'logos-phase',
				'logos-doc',
				'logos-set-answer',
				'logos-skip',
				'logos-followup',
			]);
		});

		it('LOGOS_LIFECYCLE_COMMANDS includes only the five allowed MVP commands', () => {
			expect(LOGOS_LIFECYCLE_COMMANDS).toEqual([
				'logos-init',
				'logos-start',
				'logos-stop',
				'logos-status',
				'logos-generate',
			]);
		});

		it('forbidden and allowed command lists are disjoint', () => {
			const allowedSet = new Set<string>(LOGOS_LIFECYCLE_COMMANDS);
			for (const cmd of FORBIDDEN_LOGOS_COMMANDS) {
				expect(
					allowedSet.has(cmd as string),
					`"${cmd}" is forbidden but appears in LOGOS_LIFECYCLE_COMMANDS`,
				).toBe(false);
			}
		});

		it('no slash-prefixed forbidden command pattern exists in any source registering Pi commands', () => {
			const srcDir = join(PROJECT_ROOT, 'src');
			if (!existsSync(srcDir)) {
				expect(true).toBe(true);
				return;
			}

			const files = findTsFiles(srcDir);
			const slashPatterns = SLASH_FORBIDDEN_PATTERNS;
			const violations: string[] = [];

			for (const file of files) {
				const source = readFileSync(file, 'utf-8');
				const fileRel = relative(PROJECT_ROOT, file);

				// Skip Core intake modules — they legitimately reference
				// forbidden command names for detection/definition purposes.
				if (
					file.includes('/core/intake/') ||
					file.includes('\\core\\intake\\')
				) {
					continue;
				}

				for (const pattern of slashPatterns) {
					// Only flag if the pattern appears as a string literal used in
					// command registration (registerCommand or .command patterns)
					if (
						source.includes(`"${pattern}"`) ||
						source.includes(`'${pattern}'`)
					) {
						violations.push(`${fileRel}: contains "${pattern}"`);
					}
				}
			}

			expect(
				violations,
				`Slash-prefixed forbidden commands found in source (outside Core intake):\n${violations.join('\n')}`,
			).toEqual([]);
		});
	});
});
