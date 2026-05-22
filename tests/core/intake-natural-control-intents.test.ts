/**
 * Step 8.4 — Natural control intent integration tests.
 *
 * Tests that natural-language control intents during active intake:
 * 1. Natural pause actually pauses intake (mode → paused, persists).
 * 2. Natural status returns status without evaluating as answer.
 * 3. Natural generation returns generation request without evaluating.
 * 4. Natural skip/pending applies skip policy without evaluating.
 * 5. Natural revision is recognized safely.
 * 6. Slash command variants are not evaluated as answers.
 */

import { describe, expect, it } from 'vitest';

import { createLogosCore } from '../../src/core/api.js';
import { loadIntakeState } from '../../src/core/state/intake-state-persistence.js';
import { createFakeFilesystem } from './helpers/fake-filesystem.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NOW = '2026-05-22T00:00:00.000Z';
const PROJECT_ROOT = '/project';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleIntakeMessage — natural control intents', () => {
	// -----------------------------------------------------------------------
	// Natural pause (Step 8.4 — should actually pause, not just return placeholder)
	// -----------------------------------------------------------------------
	describe('natural pause intent', () => {
		it('"pause" pauses intake and persists', async () => {
			const fs = createFakeFilesystem();
			fs.addStandardProfile();
			const core = createLogosCore({ filesystem: fs });

			await core.initProject({ projectRoot: PROJECT_ROOT });
			const startResult = await core.startIntake({
				now: NOW,
				projectRoot: PROJECT_ROOT,
			});
			expect(startResult.status).toBe('ok');
			const q1Id = startResult.data?.activeQuestionId;

			const result = await core.handleIntakeMessage({
				message: 'pause',
				projectRoot: PROJECT_ROOT,
			});

			expect(result.status).toBe('ok');
			expect(result.data?.transition).toBe('pause_requested');
			expect(result.data?.stateChanged).toBe(true);

			// Verify state is actually paused.
			const loadResult = await loadIntakeState({
				filesystem: fs,
				now: NOW,
				projectRoot: PROJECT_ROOT,
			});
			expect(loadResult.ok).toBe(true);
			if (loadResult.ok) {
				expect(loadResult.state.mode).toBe('paused');
				// Active prompt is preserved.
				expect(loadResult.state.activeQuestionId).toBe(q1Id);
				expect(loadResult.state.activePrompt).toBeDefined();
			}
		});

		it('"pausar" also pauses intake', async () => {
			const fs = createFakeFilesystem();
			fs.addStandardProfile();
			const core = createLogosCore({ filesystem: fs });

			await core.initProject({ projectRoot: PROJECT_ROOT });
			await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

			const result = await core.handleIntakeMessage({
				message: 'pausar',
				projectRoot: PROJECT_ROOT,
			});

			expect(result.data?.transition).toBe('pause_requested');
			expect(result.data?.stateChanged).toBe(true);

			const loadResult = await loadIntakeState({
				filesystem: fs,
				now: NOW,
				projectRoot: PROJECT_ROOT,
			});
			expect(loadResult.ok).toBe(true);
			if (loadResult.ok) {
				expect(loadResult.state.mode).toBe('paused');
			}
		});

		it('"stop intake" pauses intake', async () => {
			const fs = createFakeFilesystem();
			fs.addStandardProfile();
			const core = createLogosCore({ filesystem: fs });

			await core.initProject({ projectRoot: PROJECT_ROOT });
			await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

			const result = await core.handleIntakeMessage({
				message: 'stop intake',
				projectRoot: PROJECT_ROOT,
			});

			expect(result.data?.stateChanged).toBe(true);

			const loadResult = await loadIntakeState({
				filesystem: fs,
				now: NOW,
				projectRoot: PROJECT_ROOT,
			});
			expect(loadResult.ok).toBe(true);
			if (loadResult.ok) {
				expect(loadResult.state.mode).toBe('paused');
			}
		});

		it('pause does not call evaluator', async () => {
			const fs = createFakeFilesystem();
			fs.addStandardProfile();
			const core = createLogosCore({ filesystem: fs });

			await core.initProject({ projectRoot: PROJECT_ROOT });
			await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

			const result = await core.handleIntakeMessage({
				message: 'pause',
				projectRoot: PROJECT_ROOT,
			});

			expect(result.data?.evaluationResult).toBeUndefined();
		});

		it('pause preserves the active prompt for resume', async () => {
			const fs = createFakeFilesystem();
			fs.addStandardProfile();
			const core = createLogosCore({ filesystem: fs });

			await core.initProject({ projectRoot: PROJECT_ROOT });
			await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

			const preLoad = await loadIntakeState({
				filesystem: fs,
				now: NOW,
				projectRoot: PROJECT_ROOT,
			});
			expect(preLoad.ok).toBe(true);
			const prePromptId = preLoad.ok
				? preLoad.state.activePrompt?.questionId
				: undefined;

			await core.handleIntakeMessage({
				message: 'pause',
				projectRoot: PROJECT_ROOT,
			});

			const postLoad = await loadIntakeState({
				filesystem: fs,
				now: NOW,
				projectRoot: PROJECT_ROOT,
			});
			expect(postLoad.ok).toBe(true);
			if (postLoad.ok) {
				expect(postLoad.state.activePrompt?.questionId).toBe(prePromptId);
			}
		});

		it('pause returns a status message with progress info', async () => {
			const fs = createFakeFilesystem();
			fs.addStandardProfile();
			const core = createLogosCore({ filesystem: fs });

			await core.initProject({ projectRoot: PROJECT_ROOT });
			await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

			const result = await core.handleIntakeMessage({
				message: 'pause',
				projectRoot: PROJECT_ROOT,
			});

			expect(result.message.kind).toBe('status');
			expect(result.message.body).toContain('paused');
		});
	});

	// -----------------------------------------------------------------------
	// Natural status intent
	// -----------------------------------------------------------------------
	describe('natural status intent', () => {
		it('"status" returns status without evaluating as answer', async () => {
			const fs = createFakeFilesystem();
			fs.addStandardProfile();
			const core = createLogosCore({ filesystem: fs });

			await core.initProject({ projectRoot: PROJECT_ROOT });
			await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

			const result = await core.handleIntakeMessage({
				message: 'status',
				projectRoot: PROJECT_ROOT,
			});

			expect(result.data?.transition).toBe('status_requested');
			expect(result.data?.evaluationResult).toBeUndefined();
			expect(result.data?.stateChanged).toBe(false);
			expect(result.message.kind).toBe('status');
		});

		it('"como está o progresso?" returns status without evaluating', async () => {
			const fs = createFakeFilesystem();
			fs.addStandardProfile();
			const core = createLogosCore({ filesystem: fs });

			await core.initProject({ projectRoot: PROJECT_ROOT });
			await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

			const result = await core.handleIntakeMessage({
				message: 'como está o progresso?',
				projectRoot: PROJECT_ROOT,
			});

			expect(result.data?.transition).toBe('status_requested');
			expect(result.data?.evaluationResult).toBeUndefined();
		});

		it('natural status does not pause intake', async () => {
			const fs = createFakeFilesystem();
			fs.addStandardProfile();
			const core = createLogosCore({ filesystem: fs });

			await core.initProject({ projectRoot: PROJECT_ROOT });
			await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

			const result = await core.handleIntakeMessage({
				message: 'status',
				projectRoot: PROJECT_ROOT,
			});

			expect(result.data?.stateChanged).toBe(false);

			const loadResult = await loadIntakeState({
				filesystem: fs,
				now: NOW,
				projectRoot: PROJECT_ROOT,
			});
			expect(loadResult.ok).toBe(true);
			if (loadResult.ok) {
				// Mode stays active, not paused.
				expect(loadResult.state.mode).toBe('intake_active');
			}
		});
	});

	// -----------------------------------------------------------------------
	// Natural generation intent
	// -----------------------------------------------------------------------
	describe('natural generation intent', () => {
		it('"gerar documentação" returns generation request without evaluating', async () => {
			const fs = createFakeFilesystem();
			fs.addStandardProfile();
			const core = createLogosCore({ filesystem: fs });

			await core.initProject({ projectRoot: PROJECT_ROOT });
			await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

			const result = await core.handleIntakeMessage({
				message: 'gerar documentação',
				projectRoot: PROJECT_ROOT,
			});

			expect(result.data?.transition).toBe('generation_requested');
			expect(result.data?.evaluationResult).toBeUndefined();
			expect(result.data?.stateChanged).toBe(false);
		});

		it('"generate docs" does not evaluate as answer', async () => {
			const fs = createFakeFilesystem();
			fs.addStandardProfile();
			const core = createLogosCore({ filesystem: fs });

			await core.initProject({ projectRoot: PROJECT_ROOT });
			await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

			const result = await core.handleIntakeMessage({
				message: 'generate docs',
				projectRoot: PROJECT_ROOT,
			});

			expect(result.data?.transition).toBe('generation_requested');
			expect(result.data?.evaluationResult).toBeUndefined();
		});

		it('"gerar agora" does not write files', async () => {
			const fs = createFakeFilesystem();
			fs.addStandardProfile();
			const core = createLogosCore({ filesystem: fs });

			await core.initProject({ projectRoot: PROJECT_ROOT });
			await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

			const result = await core.handleIntakeMessage({
				message: 'gerar agora',
				projectRoot: PROJECT_ROOT,
			});

			expect(result.data?.transition).toBe('generation_requested');
			// State should not have changed.
			expect(result.data?.stateChanged).toBe(false);
		});

		it('natural generation does not silently start generation', async () => {
			const fs = createFakeFilesystem();
			fs.addStandardProfile();
			const core = createLogosCore({ filesystem: fs });

			await core.initProject({ projectRoot: PROJECT_ROOT });
			await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

			const result = await core.handleIntakeMessage({
				message: 'generate',
				projectRoot: PROJECT_ROOT,
			});

			// The result should be status/warning, not generation_result.
			expect(['status', 'warning']).toContain(result.message.kind);
		});
	});

	// -----------------------------------------------------------------------
	// Natural skip / pending intent
	// -----------------------------------------------------------------------
	describe('natural skip / pending intent', () => {
		it('"skip this" does not evaluate as answer and applies skip policy', async () => {
			const fs = createFakeFilesystem();
			fs.addStandardProfile();
			const core = createLogosCore({ filesystem: fs });

			await core.initProject({ projectRoot: PROJECT_ROOT });
			await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

			const result = await core.handleIntakeMessage({
				message: 'skip this',
				projectRoot: PROJECT_ROOT,
			});

			expect(result.data?.evaluationResult).toBeUndefined();
			expect(result.data?.stateChanged).toBe(true);
		});

		it('"não sei" records as pending without evaluating', async () => {
			const fs = createFakeFilesystem();
			fs.addStandardProfile();
			const core = createLogosCore({ filesystem: fs });

			await core.initProject({ projectRoot: PROJECT_ROOT });
			await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

			const result = await core.handleIntakeMessage({
				message: 'não sei',
				projectRoot: PROJECT_ROOT,
			});

			expect(result.data?.evaluationResult).toBeUndefined();
			// Required question → pending_recorded.
			expect(result.data?.transition).toBe('pending_recorded');
		});

		it('"deixa pendente" marks as pending', async () => {
			const fs = createFakeFilesystem();
			fs.addStandardProfile();
			const core = createLogosCore({ filesystem: fs });

			await core.initProject({ projectRoot: PROJECT_ROOT });
			await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

			const result = await core.handleIntakeMessage({
				message: 'deixa pendente',
				projectRoot: PROJECT_ROOT,
			});

			expect(result.data?.transition).toBe('pending_recorded');
		});

		it('"/logos-skip" is treated as unknown command, not skip intent', async () => {
			const fs = createFakeFilesystem();
			fs.addStandardProfile();
			const core = createLogosCore({ filesystem: fs });

			await core.initProject({ projectRoot: PROJECT_ROOT });
			await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

			const result = await core.handleIntakeMessage({
				message: '/logos-skip',
				projectRoot: PROJECT_ROOT,
			});

			// Not evaluated as answer; it's an out-of-scope slash command.
			expect(result.data?.evaluationResult).toBeUndefined();
			expect(result.data?.transition).not.toBe('pending_recorded');
			expect(result.data?.transition).not.toBe('skipped');
		});
	});

	// -----------------------------------------------------------------------
	// Natural revision intent
	// -----------------------------------------------------------------------
	describe('natural revision intent', () => {
		it('"actually" is recognized as revision and does not evaluate as answer', async () => {
			const fs = createFakeFilesystem();
			fs.addStandardProfile();
			const core = createLogosCore({ filesystem: fs });

			await core.initProject({ projectRoot: PROJECT_ROOT });
			await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

			const result = await core.handleIntakeMessage({
				message: 'actually',
				projectRoot: PROJECT_ROOT,
			});

			expect(result.data?.evaluationResult).toBeUndefined();
			expect(result.data?.transition).toBe('blocked');
		});

		it('"na verdade" is recognized as revision', async () => {
			const fs = createFakeFilesystem();
			fs.addStandardProfile();
			const core = createLogosCore({ filesystem: fs });

			await core.initProject({ projectRoot: PROJECT_ROOT });
			await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

			const result = await core.handleIntakeMessage({
				message: 'na verdade',
				projectRoot: PROJECT_ROOT,
			});

			expect(result.data?.evaluationResult).toBeUndefined();
		});

		it('revision does not advance the active question', async () => {
			const fs = createFakeFilesystem();
			fs.addStandardProfile();
			const core = createLogosCore({ filesystem: fs });

			await core.initProject({ projectRoot: PROJECT_ROOT });
			const startResult = await core.startIntake({
				now: NOW,
				projectRoot: PROJECT_ROOT,
			});
			const q1Id = startResult.data?.activeQuestionId;

			await core.handleIntakeMessage({
				message: 'let me revise',
				projectRoot: PROJECT_ROOT,
			});

			const loadResult = await loadIntakeState({
				filesystem: fs,
				now: NOW,
				projectRoot: PROJECT_ROOT,
			});
			expect(loadResult.ok).toBe(true);
			if (loadResult.ok) {
				// Active question remains, no answers recorded.
				expect(loadResult.state.activeQuestionId).toBe(q1Id);
			}
		});
	});

	// -----------------------------------------------------------------------
	// Slash command variants
	// -----------------------------------------------------------------------
	describe('slash command safety', () => {
		it('/logos-status is never evaluated as answer', async () => {
			const fs = createFakeFilesystem();
			fs.addStandardProfile();
			const core = createLogosCore({ filesystem: fs });

			await core.initProject({ projectRoot: PROJECT_ROOT });
			await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

			const result = await core.handleIntakeMessage({
				message: '/logos-status',
				projectRoot: PROJECT_ROOT,
			});

			expect(result.data?.evaluationResult).toBeUndefined();
			expect(result.data?.transition).toBe('command_control');
		});

		it('/logos-generate is never evaluated as answer', async () => {
			const fs = createFakeFilesystem();
			fs.addStandardProfile();
			const core = createLogosCore({ filesystem: fs });

			await core.initProject({ projectRoot: PROJECT_ROOT });
			await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

			const result = await core.handleIntakeMessage({
				message: '/logos-generate',
				projectRoot: PROJECT_ROOT,
			});

			expect(result.data?.evaluationResult).toBeUndefined();
			expect(result.data?.transition).toBe('command_control');
		});

		it('/help is not evaluated as answer', async () => {
			const fs = createFakeFilesystem();
			fs.addStandardProfile();
			const core = createLogosCore({ filesystem: fs });

			await core.initProject({ projectRoot: PROJECT_ROOT });
			await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

			const result = await core.handleIntakeMessage({
				message: '/help',
				projectRoot: PROJECT_ROOT,
			});

			expect(result.data?.evaluationResult).toBeUndefined();
			expect(result.data?.transition).toBe('out_of_scope');
		});
	});
});
