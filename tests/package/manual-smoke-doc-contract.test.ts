/**
 * Step 11.4 — Manual Smoke Doc Contract Test.
 *
 * Proves that `docs/PI_EXTENSION_MANUAL_SMOKE.md` is present and
 * correctly describes the Pi-extension-first manual smoke workflow.
 *
 * Tests:
 *
 *  1. The document exists.
 *  2. It mentions /logos-init, /logos-start, /logos-status, /logos-generate.
 *  3. It instructs natural user answers after /logos-start (no command-first).
 *  4. It states /logos-start asks the first question immediately.
 *  5. It lists forbidden command-first commands as unsupported or not available.
 *  6. It states partial generation requires confirmation.
 *  7. It states automated tests use the fake Pi harness.
 *  8. It does NOT instruct the user to use /logos-next or /logos-answer as
 *     valid workflow commands (listed as unsupported is acceptable).
 *  9. It does NOT describe CLI/TUI as the MVP path.
 * 10. It includes a failure recording template.
 * 11. It includes a "not covered" section.
 *
 * Boundary: file-reading and text-scanning only.  No production, Pi,
 * CLI, TUI, or network imports.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_ROOT = process.cwd();
const SMOKE_DOC_PATH = 'docs/PI_EXTENSION_MANUAL_SMOKE.md';

const FORBIDDEN_COMMANDS = [
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

// CLI/TUI phrasing that must NOT appear as the primary product surface.
const CLI_TUI_PATH_PATTERNS = [
	'CLI-based',
	'TUI-based',
	'CLI is the primary',
	'TUI is the primary',
	'command-line interface is the primary',
	'terminal UI is the primary',
	'run logos',
	'logos binary',
	'logos-cli',
	'logos-tui',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function projectPath(relPath: string): string {
	return resolve(PROJECT_ROOT, relPath);
}

function getSmokeDocContent(): string {
	const fullPath = projectPath(SMOKE_DOC_PATH);
	if (!existsSync(fullPath)) {
		throw new Error(`Smoke doc not found at ${SMOKE_DOC_PATH}`);
	}
	return readFileSync(fullPath, 'utf-8');
}

/**
 * Determine whether a forbidden command is mentioned only as "unsupported"
 * or "not available" rather than as a valid workflow command.
 *
 * Heuristic: if the content contains the forbidden command name AND does
 * NOT also contain any "unsupported / not registered / not available /
 * forbidden" phrasing within a reasonable distance, flag it.
 */
function isMentionedAsUnsupported(content: string, cmd: string): boolean {
	const idx = content.indexOf(cmd);
	if (idx === -1) return true; // not mentioned at all — fine

	// Check a window of 500 chars around the mention
	const start = Math.max(0, idx - 200);
	const end = Math.min(content.length, idx + cmd.length + 300);
	const window = content.substring(start, end).toLowerCase();

	const unsupportedPhrases = [
		'not registered',
		'not available',
		'not a valid',
		'not recognized',
		'not supported',
		'not a logos',
		'forbidden',
		'unsupported',
		'do not trigger',
		'does not recognize',
		'ignore them',
		'not needed',
		'as unsupported',
		'must not be registered',
		'must not',
		'not be available',
		'unknown command',
		'acceptable',
	];

	return unsupportedPhrases.some((p) => window.includes(p));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('manual smoke doc contract (Step 11.4)', () => {
	describe('document existence', () => {
		it('docs/PI_EXTENSION_MANUAL_SMOKE.md exists', () => {
			expect(existsSync(projectPath(SMOKE_DOC_PATH))).toBe(true);
		});
	});

	describe('allowed lifecycle commands', () => {
		let content: string;

		// Load content lazily after existence check
		function ensureContent(): string {
			if (!content) content = getSmokeDocContent();
			return content;
		}

		it('mentions /logos-init', () => {
			expect(ensureContent()).toContain('/logos-init');
		});

		it('mentions /logos-start', () => {
			expect(ensureContent()).toContain('/logos-start');
		});

		it('mentions /logos-status', () => {
			expect(ensureContent()).toContain('/logos-status');
		});

		it('mentions /logos-generate', () => {
			expect(ensureContent()).toContain('/logos-generate');
		});
	});

	describe('conversational intake instructions', () => {
		let content: string;

		function ensureContent(): string {
			if (!content) content = getSmokeDocContent();
			return content;
		}

		it('instructs natural user answers after /logos-start (no command needed)', () => {
			const c = ensureContent();
			// Must describe natural-language answering
			expect(
				c.includes('natural-language') ||
					c.includes('natural language') ||
					c.includes('natural answer') ||
					c.includes('answer naturally'),
				'Document must describe natural-language answering after /logos-start',
			).toBe(true);
		});

		it('states /logos-start asks first question immediately', () => {
			const c = ensureContent();
			expect(
				c.includes('immediately') && c.includes('first'),
				'Document must state /logos-start immediately asks the first question',
			).toBe(true);
		});

		it('does NOT instruct using /logos-next as a valid workflow command', () => {
			const c = ensureContent();
			expect(
				isMentionedAsUnsupported(c, '/logos-next'),
				'/logos-next must not be presented as a valid workflow command',
			).toBe(true);
		});

		it('does NOT instruct using /logos-answer as a valid workflow command', () => {
			const c = ensureContent();
			expect(
				isMentionedAsUnsupported(c, '/logos-answer'),
				'/logos-answer must not be presented as a valid workflow command',
			).toBe(true);
		});
	});

	describe('forbidden command coverage', () => {
		let content: string;

		function ensureContent(): string {
			if (!content) content = getSmokeDocContent();
			return content;
		}

		it('lists all nine forbidden commands', () => {
			const c = ensureContent();
			const missing: string[] = [];

			for (const cmd of FORBIDDEN_COMMANDS) {
				if (!c.includes(`/${cmd}`) && !c.includes(cmd)) {
					missing.push(cmd);
				}
			}

			expect(
				missing,
				missing.length > 0
					? `Forbidden commands not mentioned: ${missing.join(', ')}`
					: undefined,
			).toEqual([]);
		});

		for (const cmd of FORBIDDEN_COMMANDS) {
			it(`"${cmd}" is listed as unsupported / not available`, () => {
				const c = ensureContent();
				expect(
					isMentionedAsUnsupported(c, `/${cmd}`) ||
						isMentionedAsUnsupported(c, cmd),
					`"${cmd}" must be clearly listed as unsupported or not available`,
				).toBe(true);
			});
		}
	});

	describe('generation safety', () => {
		let content: string;

		function ensureContent(): string {
			if (!content) content = getSmokeDocContent();
			return content;
		}

		it('states partial generation requires confirmation', () => {
			const c = ensureContent();
			expect(
				c.includes('partial') &&
					(c.includes('confirmation') || c.includes('confirm')),
				'Document must state partial generation requires confirmation',
			).toBe(true);
		});

		it('states declining confirmation writes nothing', () => {
			const c = ensureContent();
			expect(
				c.includes('writes nothing') ||
					c.includes('no files') ||
					c.includes('nothing is written') ||
					c.includes('Declining'),
				'Document must state declining partial generation writes nothing',
			).toBe(true);
		});
	});

	describe('automated tests vs manual smoke distinction', () => {
		it('states automated tests use the fake Pi harness', () => {
			const c = getSmokeDocContent();
			expect(
				c.includes('fake Pi harness') ||
					c.includes('fake Pi') ||
					c.includes('automated test') ||
					c.includes('Automated contract'),
				'Document must state automated tests use the fake Pi harness',
			).toBe(true);
		});

		it('states that this is a manual checklist, not an automated test', () => {
			const c = getSmokeDocContent();
			expect(
				c.includes('manual smoke checklist') ||
					c.includes('not an automated test') ||
					c.includes('It is not an automated test'),
				'Document must state it is a manual checklist, not automated',
			).toBe(true);
		});
	});

	describe('no CLI/TUI presented as MVP path', () => {
		it('does not describe CLI or TUI as the primary product surface', () => {
			const c = getSmokeDocContent();
			const violations: string[] = [];

			for (const pattern of CLI_TUI_PATH_PATTERNS) {
				if (c.toLowerCase().includes(pattern.toLowerCase())) {
					violations.push(pattern);
				}
			}

			expect(
				violations,
				violations.length > 0
					? `CLI/TUI MVP language found: ${violations.join(', ')}`
					: undefined,
			).toEqual([]);
		});
	});

	describe('failure recording template', () => {
		it('includes a failure recording template', () => {
			const c = getSmokeDocContent();
			expect(
				c.includes('Failure Recording') ||
					c.includes('failure recording') ||
					c.includes('Failure recording'),
				'Document must include a failure recording template',
			).toBe(true);
		});

		it('failure template includes Date, Git SHA, and Expected/Actual fields', () => {
			const c = getSmokeDocContent();
			const requiredFields = ['Date', 'Git SHA', 'Expected', 'Actual'];
			const missing: string[] = [];

			for (const field of requiredFields) {
				// Use a loose match — the template should contain these field names.
				if (!c.includes(field)) {
					missing.push(field);
				}
			}

			expect(
				missing,
				missing.length > 0
					? `Failure template missing fields: ${missing.join(', ')}`
					: undefined,
			).toEqual([]);
		});
	});

	describe('not covered section', () => {
		it('includes a "Not Covered" section', () => {
			const c = getSmokeDocContent();
			expect(
				c.includes('Not Covered') ||
					c.includes('not covered') ||
					c.includes('Not covered'),
				'Document must include a "Not Covered" section',
			).toBe(true);
		});
	});

	describe('cleanup guidance', () => {
		it('includes cleanup or reset guidance', () => {
			const c = getSmokeDocContent();
			expect(
				c.includes('Cleanup') ||
					c.includes('cleanup') ||
					c.includes('clean up') ||
					c.includes('reset'),
				'Document must include cleanup/reset guidance',
			).toBe(true);
		});
	});

	describe('extension loading guidance', () => {
		it('includes instructions for loading the extension in Pi', () => {
			const c = getSmokeDocContent();
			expect(
				c.includes('Extension Loading') ||
					c.includes('extension loading') ||
					c.includes('load the extension') ||
					c.includes('pi -e') ||
					c.includes('.pi/extensions'),
				'Document must include extension loading instructions',
			).toBe(true);
		});
	});
});
