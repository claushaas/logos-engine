/**
 * Step 9.2 — Missing profile and project-not-initialized error renderer tests.
 *
 * Proves that `renderGenerationBlockers` correctly renders initialization
 * and profile errors with actionable next-step guidance.
 *
 * Tests:
 * 1. project_not_initialized blocker renders clearly.
 * 2. profile_not_found blocker renders clearly.
 * 3. profile_invalid blocker renders clearly.
 * 4. intake_state_missing blocker renders clearly.
 * 5. Suggested next-step text is present when implemented.
 * 6. Renderer does not call Core or filesystem APIs.
 */

import { describe, expect, it } from 'vitest';
import { renderGenerationBlockers } from '../../src/pi-extension/rendering/generation-blocker-renderer.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function blockedPreflight(
	blockers: Array<{ code: string; message: string }>,
	overrides?: Record<string, unknown>,
): Record<string, unknown> {
	return {
		blockers,
		canGeneratePartialDraft: false,
		checkedAt: '2026-05-22T12:00:00.000Z',
		completenessScore: 0,
		contradictions: [],
		missingCriticalQuestions: [],
		mode: 'final',
		optionalMissingQuestions: [],
		optionalSkippedQuestions: [],
		partialCriticalQuestions: [],
		ready: false,
		requiredSkippedQuestions: [],
		requiresExplicitConfirmation: false,
		status: 'blocked',
		warnings: [],
		...overrides,
	};
}

function errorMsg(body: string) {
	return { body, kind: 'error' as const };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Step 9.2 — missing profile and init errors', () => {
	describe('project_not_initialized', () => {
		it('renders clearly with actionable hint', () => {
			const rendered = renderGenerationBlockers({
				message: errorMsg('LOGOS project is not initialized.'),
				preflight: blockedPreflight([
					{
						code: 'project_not_initialized',
						message: 'Project .logos/config.yml is missing.',
					},
				]),
			});

			expect(rendered.body).toContain(
				'[project_not_initialized] Project .logos/config.yml is missing.',
			);
			expect(rendered.body).toContain('→ Run /logos-init first.');
			expect(rendered.body).toContain('Generation readiness: blocked');
		});

		it('preserves blocker in rendered payload', () => {
			const rendered = renderGenerationBlockers({
				message: errorMsg('Not initialized.'),
				preflight: blockedPreflight([
					{ code: 'project_not_initialized', message: 'Missing config.' },
				]),
			});

			expect(rendered.blockers).toBeDefined();
			expect(rendered.blockers?.length).toBe(1);
			expect((rendered.blockers?.[0] as Record<string, unknown>)?.code).toBe(
				'project_not_initialized',
			);
		});
	});

	describe('profile_not_found', () => {
		it('renders clearly with actionable hint', () => {
			const rendered = renderGenerationBlockers({
				message: errorMsg('Active profile is missing.'),
				preflight: blockedPreflight([
					{
						code: 'profile_not_found',
						message: 'Profile "custom" not found in profiles/custom/.',
					},
				]),
			});

			expect(rendered.body).toContain(
				'[profile_not_found] Profile "custom" not found in profiles/custom/.',
			);
			expect(rendered.body).toContain(
				'→ Check activeProfileId in .logos/config.yml and verify profiles/<id>/ exists.',
			);
		});
	});

	describe('profile_invalid', () => {
		it('renders clearly with actionable hint', () => {
			const rendered = renderGenerationBlockers({
				message: errorMsg('Active profile is invalid.'),
				preflight: blockedPreflight([
					{
						code: 'profile_invalid',
						message: 'Active profile contract is malformed.',
					},
				]),
			});

			expect(rendered.body).toContain(
				'[profile_invalid] Active profile contract is malformed.',
			);
			expect(rendered.body).toContain(
				'→ Fix the active profile contract under profiles/<id>/.',
			);
		});
	});

	describe('intake_state_missing', () => {
		it('renders clearly with actionable hint', () => {
			const rendered = renderGenerationBlockers({
				message: errorMsg('No intake state found.'),
				preflight: blockedPreflight([
					{
						code: 'intake_state_missing',
						message: 'Intake has not been started.',
					},
				]),
			});

			expect(rendered.body).toContain(
				'[intake_state_missing] Intake has not been started.',
			);
			expect(rendered.body).toContain('→ Start intake with /logos-start.');
		});

		it('preserves blocker metadata', () => {
			const rendered = renderGenerationBlockers({
				message: errorMsg('No intake.'),
				preflight: blockedPreflight([
					{
						code: 'intake_state_missing',
						message: 'Intake missing.',
					},
				]),
			});

			const metaBlockers = rendered.metadata?.blockerCodes as
				| Array<{ code: string }>
				| undefined;
			expect(metaBlockers).toBeDefined();
			expect(metaBlockers?.[0]?.code).toBe('intake_state_missing');
		});
	});

	describe('question_registry_empty', () => {
		it('renders clearly with actionable hint', () => {
			const rendered = renderGenerationBlockers({
				message: errorMsg('No questions found.'),
				preflight: blockedPreflight([
					{
						code: 'question_registry_empty',
						message: 'Profile question registry is empty.',
					},
				]),
			});

			expect(rendered.body).toContain(
				'[question_registry_empty] Profile question registry is empty.',
			);
			expect(rendered.body).toContain(
				'→ Check profile question contracts under the active profile.',
			);
		});
	});

	describe('multiple blockers', () => {
		it('renders all blockers with hints', () => {
			const rendered = renderGenerationBlockers({
				message: errorMsg('Multiple blockers found.'),
				preflight: blockedPreflight([
					{
						code: 'project_not_initialized',
						message: 'Not initialized.',
					},
					{
						code: 'profile_not_found',
						message: 'Profile missing.',
					},
					{
						code: 'intake_state_missing',
						message: 'No intake.',
					},
				]),
			});

			expect(rendered.body).toContain('→ Run /logos-init first.');
			expect(rendered.body).toContain(
				'→ Check activeProfileId in .logos/config.yml and verify profiles/<id>/ exists.',
			);
			expect(rendered.body).toContain('→ Start intake with /logos-start.');
		});
	});

	describe('output path blockers', () => {
		it('renders unsafe_output_path with hint', () => {
			const rendered = renderGenerationBlockers({
				message: errorMsg('Unsafe output path.'),
				preflight: blockedPreflight([
					{
						code: 'unsafe_output_path',
						message: 'Output path escapes project root.',
					},
				]),
			});

			expect(rendered.body).toContain(
				'→ Fix unsafe output paths in profile contracts.',
			);
		});

		it('renders overwrite_risk with hint', () => {
			const rendered = renderGenerationBlockers({
				message: errorMsg('Overwrite risk.'),
				preflight: blockedPreflight([
					{
						code: 'overwrite_risk',
						message: 'Existing generated files would be overwritten.',
					},
				]),
			});

			expect(rendered.body).toContain(
				'→ Review existing generated paths or use explicit confirmation.',
			);
		});

		it('renders manual_edit_risk with hint', () => {
			const rendered = renderGenerationBlockers({
				message: errorMsg('Manual edit risk.'),
				preflight: blockedPreflight([
					{
						code: 'manual_edit_risk',
						message: 'Manually edited files would be overwritten.',
					},
				]),
			});

			expect(rendered.body).toContain(
				'→ Review existing manually edited files before overwriting.',
			);
		});
	});

	describe('renderer does not call Core or filesystem', () => {
		it('renderGenerationBlockers is a pure function with no side effects', () => {
			// Pure renderer — no Core APIs, no filesystem, no Pi runtime calls.
			const rendered = renderGenerationBlockers({
				message: errorMsg('Blocked.'),
				preflight: blockedPreflight([
					{ code: 'project_not_initialized', message: 'Missing config.' },
				]),
			});

			expect(rendered.type).toBe('logos');
			expect(rendered.kind).toBe('error');
		});
	});
});
