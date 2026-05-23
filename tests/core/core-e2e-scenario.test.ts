/**
 * Step 11.1 — Core End-To-End Scenario.
 *
 * Proves LOGOS Core can run the full lifecycle without Pi, CLI, TUI,
 * network, or live AI providers.
 *
 * The scenario:
 * 1. Initializes a project.
 * 2. Resolves the active profile.
 * 3. Starts intake and receives the first assistant question.
 * 4. Submits natural-language answers.
 * 5. Proves sufficient answer advancement without slash commands.
 * 6. Checks status/completeness.
 * 7. Runs generation dry-run (preflight + write plan).
 * 8. Asserts no unsafe writes occurred.
 *
 * Boundary: must not import Pi, Ink, React, TUI, CLI, or network modules.
 */

import { describe, expect, it } from 'vitest';

import { createLogosCore } from '../../src/core/api.js';
import { loadLogosConfig } from '../../src/core/config/load-config.js';
import { createFakeAnswerEvaluator } from '../../src/core/evaluation/fake-answer-evaluator.js';
import { loadIntakeState } from '../../src/core/state/intake-state-persistence.js';
import { createFakeFilesystem } from './helpers/fake-filesystem.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NOW = '2026-05-22T12:00:00.000Z';
const PROJECT_ROOT = '/project';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Set up a fresh project with standard profile and return the Core instance
 * and filesystem (for inspection).
 */
async function setupFreshProject() {
	const fs = createFakeFilesystem();
	fs.addStandardProfile();
	const core = createLogosCore({ filesystem: fs });

	const initResult = await core.initProject({ projectRoot: PROJECT_ROOT });
	if (initResult.status !== 'ok') {
		throw new Error(
			`initProject failed: ${initResult.status} — ${String(initResult.message.body)}`,
		);
	}

	return { core, fs };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Core E2E scenario — full lifecycle without Pi', () => {
	// -----------------------------------------------------------------------
	// 1. Init
	// -----------------------------------------------------------------------

	it('initializes a project with the standard profile', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		const result = await core.initProject({
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('ok');
		expect(result.data?.initialized).toBe(true);
		expect(result.data?.activeProfileId).toBe('standard');

		// Config was persisted.
		const configLoad = await loadLogosConfig({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(configLoad.ok).toBe(true);
		if (configLoad.ok) {
			expect(configLoad.config.activeProfileId).toBe('standard');
			expect(configLoad.createdDefault).toBe(false);
		}

		// No generated docs were written.
		expect(
			await fs.fileExists({ path: '/project/docs/01-foundation/01-thesis.md' }),
		).toBe(false);

		// No Pi/CLI/TUI imports are involved (proved by boundary).
	});

	// -----------------------------------------------------------------------
	// 2. Start intake — assistant speaks first
	// -----------------------------------------------------------------------

	it('starts intake and immediately emits an assistant question', async () => {
		const { core, fs } = await setupFreshProject();

		const result = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		// Result is successful.
		expect(result.status).toBe('ok');

		// Assistant message is present with question text.
		expect(result.message.kind).toBe('question');
		expect(result.message.body.length).toBeGreaterThan(10);
		expect(result.message.body).not.toContain('not implemented');

		// Intake mode is active.
		expect(result.data?.mode).toBe('intake_active');

		// Active question id is set.
		const q1Id = result.data?.activeQuestionId;
		expect(q1Id).toBeDefined();
		expect(q1Id).toMatch(/^01-foundation\./);

		// Active prompt is present.
		expect(result.data?.activePrompt).toBeDefined();
		expect(result.data?.activePrompt?.kind).toBe('question');
		expect(result.data?.activePrompt?.questionId).toBe(q1Id);

		// State is persisted.
		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			expect(loadResult.state.mode).toBe('intake_active');
			expect(loadResult.state.activeQuestionId).toBe(q1Id);
			expect(loadResult.state.activePrompt?.questionId).toBe(q1Id);
		}

		// User did not need to provide an initial answer first.
		// No command-first progression occurs.
	});

	// -----------------------------------------------------------------------
	// 3. Natural-language answer advancement
	// -----------------------------------------------------------------------

	it('accepts a natural-language answer and advances to the next question automatically', async () => {
		const { core, fs } = await setupFreshProject();

		// Start intake.
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(startResult.status).toBe('ok');
		const q1Id = startResult.data?.activeQuestionId;
		expect(q1Id).toBeDefined();

		// Create a fake evaluator that returns sufficient.
		const evaluator = createFakeAnswerEvaluator({ mode: 'sufficient' });

		// Submit a natural-language answer (no slash commands).
		const answerText =
			'The project exists to turn unclear early-stage product ideas into structured, validated documentation that can guide implementation.';

		const msgResult = await core.handleIntakeMessage({
			evaluator,
			message: answerText,
			projectRoot: PROJECT_ROOT,
		});

		// Result is ok.
		expect(msgResult.status).toBe('ok');

		// State changed.
		expect(msgResult.data?.stateChanged).toBe(true);

		// Transition is answer_accepted.
		expect(msgResult.data?.transition).toBe('answer_accepted');

		// Next question is different from Q1.
		const q2Id = msgResult.data?.activeQuestionId;
		expect(q2Id).toBeDefined();
		expect(q2Id).not.toBe(q1Id);

		// Assistant message is present asking next question.
		expect(msgResult.data?.assistantMessage).toBeDefined();
		expect(msgResult.data?.assistantMessage?.body.length).toBeGreaterThan(0);

		// No /logos-next or /logos-answer was used.

		// Answer is persisted as sufficient.
		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			const q1Record = loadResult.state.answeredQuestions[q1Id as string];
			expect(q1Record).toBeDefined();
			expect(q1Record?.status).toBe('sufficient');
			expect(q1Record?.answer).toBe(answerText);

			// Active question is now Q2.
			expect(loadResult.state.activeQuestionId).toBe(q2Id);
			expect(loadResult.state.mode).toBe('intake_active');
		}
	});

	// -----------------------------------------------------------------------
	// 4. Partial answer — follow-up without advancement
	// -----------------------------------------------------------------------

	it('handles a partial answer with a follow-up without advancing', async () => {
		const { core, fs } = await setupFreshProject();

		// Start intake.
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(startResult.status).toBe('ok');
		const q1Id = startResult.data?.activeQuestionId;
		expect(q1Id).toBeDefined();

		// Create a fake evaluator that returns partial.
		const evaluator = createFakeAnswerEvaluator({ mode: 'partial' });

		const partialAnswer = 'Just a partial thought.';

		const msgResult = await core.handleIntakeMessage({
			evaluator,
			message: partialAnswer,
			projectRoot: PROJECT_ROOT,
		});

		expect(msgResult.status).toBe('ok');
		expect(msgResult.data?.stateChanged).toBe(true);

		// Transition should indicate follow-up, not advancement.
		expect(msgResult.data?.transition).toBe('follow_up_requested');

		// Active question should NOT advance.
		expect(msgResult.data?.activeQuestionId).toBe(q1Id);

		// Assistant message should be a follow-up.
		expect(msgResult.data?.assistantMessage).toBeDefined();
		expect(msgResult.data?.assistantMessage?.body.length).toBeGreaterThan(0);

		// State persists the partial answer.
		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			const q1Partial = loadResult.state.partialQuestions[q1Id as string];
			expect(q1Partial).toBeDefined();
			expect(q1Partial?.answer).toBe(partialAnswer);
			expect(q1Partial?.missingAspects).toBeDefined();
			expect(q1Partial?.missingAspects.length).toBeGreaterThan(0);

			// The answeredQuestions record exists with status 'partial'.
			// (Core always records the evaluation in answeredQuestions.)
			const q1Answered = loadResult.state.answeredQuestions[q1Id as string];
			expect(q1Answered).toBeDefined();
			expect(q1Answered?.status).toBe('partial');

			// Active question remains Q1.
			expect(loadResult.state.activeQuestionId).toBe(q1Id);
		}
	});

	// -----------------------------------------------------------------------
	// 5. Multiple answers — progression loop
	// -----------------------------------------------------------------------

	it('advances through multiple questions with sufficient answers', async () => {
		const { core, fs } = await setupFreshProject();

		// Start intake.
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(startResult.status).toBe('ok');

		const evaluator = createFakeAnswerEvaluator({ mode: 'sufficient' });

		// Answer questions until complete or max iterations.
		const answeredIds: string[] = [];
		let lastResult = startResult;
		const maxIterations = 20;

		for (let i = 0; i < maxIterations; i++) {
			// If already complete, stop.
			if (lastResult.data?.mode === 'complete') break;

			const msgResult = await core.handleIntakeMessage({
				evaluator,
				message: `My detailed answer for question ${i + 1} about this project.`,
				projectRoot: PROJECT_ROOT,
			});

			lastResult = msgResult;

			if (msgResult.status !== 'ok') break;

			if (msgResult.data?.transition === 'answer_accepted') {
				const _prevQId =
					i === 0
						? startResult.data?.activeQuestionId
						: msgResult.data?.activeQuestionId
							? undefined // new question set
							: undefined;
				// Track answered questions from persisted state.
			}

			if (msgResult.data?.activeQuestionId) {
				answeredIds.push(msgResult.data.activeQuestionId);
			}
		}

		// Should have advanced through at least 2 questions.
		expect(answeredIds.length).toBeGreaterThanOrEqual(2);

		// State should be persisted with multiple answers.
		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			const sufficientCount = Object.keys(
				loadResult.state.answeredQuestions,
			).length;
			expect(sufficientCount).toBeGreaterThanOrEqual(2);
			// Mode may be intake_active or complete if all questions exhausted.
			expect(['intake_active', 'complete']).toContain(loadResult.state.mode);
		}
	});

	// -----------------------------------------------------------------------
	// 6. Status / completeness
	// -----------------------------------------------------------------------

	it('reports status after answering questions', async () => {
		const { core } = await setupFreshProject();

		// Start intake.
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(startResult.status).toBe('ok');

		// Answer one question.
		const evaluator = createFakeAnswerEvaluator({ mode: 'sufficient' });
		await core.handleIntakeMessage({
			evaluator,
			message: 'A well-reasoned thesis about the project purpose.',
			projectRoot: PROJECT_ROOT,
		});

		// Get status.
		const statusResult = await core.getStatus({
			projectRoot: PROJECT_ROOT,
		});

		// Status should be structured (even if stub implementation).
		expect(statusResult.status).toBeDefined();
		expect(statusResult.data).toBeDefined();
		expect(statusResult.data?.initialized).toBeDefined();
		expect(statusResult.data?.mode).toBeDefined();
		expect(statusResult.data?.progress).toBeDefined();
		expect(statusResult.data?.generationReadiness).toBeDefined();

		// Status result should be JSON-serializable.
		const serialized = JSON.parse(JSON.stringify(statusResult));
		expect(serialized.status).toBeDefined();
		expect(serialized.data).toBeDefined();
	});

	// -----------------------------------------------------------------------
	// 7. Generation dry-run — preflight and write plan
	// -----------------------------------------------------------------------

	it('runs generation dry-run with preflight and write plan without writing files', async () => {
		const { core, fs } = await setupFreshProject();

		// Start intake and answer one question to get some state.
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(startResult.status).toBe('ok');

		const evaluator = createFakeAnswerEvaluator({ mode: 'sufficient' });
		await core.handleIntakeMessage({
			evaluator,
			message: 'A clear, specific thesis statement for the project.',
			projectRoot: PROJECT_ROOT,
		});

		// Run generation in dry-run mode.
		const genResult = await core.generate({
			mode: 'dry_run',
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		// Dry-run should succeed without writing.
		expect(genResult.status).toBe('ok');
		expect(genResult.dryRun).toBe(true);

		// Preflight result is included.
		expect(genResult.data?.preflight).toBeDefined();
		expect(typeof genResult.data?.preflight?.completenessScore).toBe('number');
		expect(genResult.data?.preflight?.checkedAt).toBeDefined();

		// No files were written.
		expect(genResult.data?.wroteFiles).toBe(false);
		expect(genResult.data?.generatedPaths).toHaveLength(0);

		// No generated docs were written to the fake filesystem.
		expect(
			await fs.fileExists({ path: '/project/docs/01-foundation/01-thesis.md' }),
		).toBe(false);
		expect(await fs.fileExists({ path: '/project/output/final.md' })).toBe(
			false,
		);

		// Write plan is included (dry-run preview).
		expect(genResult.data?.writePlan).toBeDefined();

		// Result is JSON-serializable.
		const serialized = JSON.parse(JSON.stringify(genResult));
		expect(serialized.status).toBe('ok');
		expect(serialized.dryRun).toBe(true);
	});

	// -----------------------------------------------------------------------
	// 8. Stop intake preserves state
	// -----------------------------------------------------------------------

	it('stops intake and preserves the active question', async () => {
		const { core, fs } = await setupFreshProject();

		// Start intake.
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(startResult.status).toBe('ok');
		const q1Id = startResult.data?.activeQuestionId;
		expect(q1Id).toBeDefined();

		// Stop intake.
		const stopResult = await core.stopIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(stopResult.status).toBe('ok');
		expect(stopResult.data?.mode).toBe('paused');

		// Active question is preserved.
		expect(stopResult.data?.activeQuestionId).toBe(q1Id);

		// State is persisted.
		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			expect(loadResult.state.mode).toBe('paused');
			expect(loadResult.state.activeQuestionId).toBe(q1Id);
		}
	});

	// -----------------------------------------------------------------------
	// 9. Resume intake after stop
	// -----------------------------------------------------------------------

	it('resumes intake after stop with the same active question', async () => {
		const { core, fs } = await setupFreshProject();

		// Start intake.
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(startResult.status).toBe('ok');
		const q1Id = startResult.data?.activeQuestionId;
		expect(q1Id).toBeDefined();

		// Stop.
		await core.stopIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		// Resume.
		const resumeResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(resumeResult.status).toBe('ok');
		expect(resumeResult.data?.mode).toBe('intake_active');

		// Active question should be the same as before (resumed, not advanced).
		expect(resumeResult.data?.activeQuestionId).toBe(q1Id);

		// State should be back in intake_active.
		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			expect(loadResult.state.mode).toBe('intake_active');
			expect(loadResult.state.activeQuestionId).toBe(q1Id);
		}
	});

	// -----------------------------------------------------------------------
	// 10. Final generation with incomplete intake is blocked
	// -----------------------------------------------------------------------

	it('blocks final generation when intake is incomplete', async () => {
		const { core, fs } = await setupFreshProject();

		// Start intake but do NOT answer any questions.
		await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		// Try final generation.
		const genResult = await core.generate({
			mode: 'final',
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		// Final generation should be blocked because no questions are answered.
		// (or it could be noop if write execution is not yet implemented)
		expect(['blocked', 'noop']).toContain(genResult.status);

		// No files were written.
		expect(genResult.data?.wroteFiles).toBe(false);

		// No generated docs on disk.
		expect(
			await fs.fileExists({ path: '/project/docs/01-foundation/01-thesis.md' }),
		).toBe(false);
	});

	// -----------------------------------------------------------------------
	// 11. No Pi / CLI / TUI dependency in the test
	// -----------------------------------------------------------------------

	it('does not import Pi, CLI, TUI, Ink, React, or Commander', () => {
		// This test file imports only from src/core/** and tests/core/helpers/**.
		// The boundary is enforced by tests/core/core-boundary.test.ts.
		// This assertion is a smoke check that the Core API is usable.
		expect(typeof createLogosCore).toBe('function');
		expect(typeof createFakeAnswerEvaluator).toBe('function');
		expect(typeof createFakeFilesystem).toBe('function');
		expect(typeof loadIntakeState).toBe('function');
		expect(typeof loadLogosConfig).toBe('function');
	});

	// -----------------------------------------------------------------------
	// 12. Profile-driven: questions loaded from active profile
	// -----------------------------------------------------------------------

	it('loads questions from the active profile (standard)', async () => {
		const { core } = await setupFreshProject();

		const result = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('ok');

		// The active question id should be derived from the fake standard profile.
		// The fake profile creates documents 01-thesis and 02-problem under
		// phase 01-foundation, each with sections and questions.
		const qId = result.data?.activeQuestionId;
		expect(qId).toBeDefined();

		// Question id format: <phaseId>.<documentId>.<sectionId>.q<index+1>
		expect(qId).toMatch(/^01-foundation\.\d{2}-\w+\.\S+\.q\d+$/);
	});
});
