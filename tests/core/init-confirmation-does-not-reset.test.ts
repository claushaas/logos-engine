/**
 * Step 5.4 — /logos-init confirmed input does not reset during active intake.
 *
 * Tests:
 * 1. Given active intake.
 * 2. When handleIntakeCommand({ command: "logos-init", confirmed: true }) runs.
 * 3. Then destructive reset still does not occur (MVP safety).
 * 4. Then active state is preserved.
 * 5. Then result remains confirm_required or block.
 * 6. Then no config overwrite occurs.
 * 7. Then no generated paths are changed.
 */

import { describe, expect, it } from 'vitest';
import { createLogosCore } from '../../src/core/api.js';
import { handleIntakeCommand } from '../../src/core/intake/handle-intake-command.js';
import { createDefaultIntakeState } from '../../src/core/state/intake-state-defaults.js';
import {
	loadIntakeState,
	saveIntakeState,
} from '../../src/core/state/intake-state-persistence.js';
import { createFakeFilesystem } from './helpers/fake-filesystem.js';

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const NOW = '2026-05-22T00:00:00Z';
const PROJECT_ROOT = '/project';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleIntakeCommand — logos-init with confirmed: true during active intake', () => {
	it('still returns confirm_required and does not reset', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		const q1Id = startResult.data?.activeQuestionId;

		const result = await handleIntakeCommand({
			command: 'logos-init',
			confirmed: true,
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('confirmation_required');
		expect(result.data?.disposition).toBe('confirm_required');
		expect(result.data?.mode).toBe('intake_active');
		expect(result.data?.activeQuestionId).toBe(q1Id);
		expect(result.data?.stateChanged).toBe(false);
		expect(result.data?.persisted).toBe(false);
	});

	it('preserves active question id even with confirmed: true', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		const q1Id = startResult.data?.activeQuestionId;

		await handleIntakeCommand({
			command: 'logos-init',
			confirmed: true,
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

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
	});

	it('does not overwrite config even with confirmed: true', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		const { loadLogosConfig } = await import(
			'../../src/core/config/load-config.js'
		);
		const beforeResult = await loadLogosConfig({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(beforeResult.ok).toBe(true);
		const beforeUpdatedAt = beforeResult.ok
			? beforeResult.config.updatedAt
			: '';

		await handleIntakeCommand({
			command: 'logos-init',
			confirmed: true,
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

		const afterResult = await loadLogosConfig({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(afterResult.ok).toBe(true);
		if (afterResult.ok) {
			expect(afterResult.config.updatedAt).toBe(beforeUpdatedAt);
		}
	});

	it('does not write generated paths even with confirmed: true', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		await handleIntakeCommand({
			command: 'logos-init',
			confirmed: true,
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

		const docsDir = '/project/docs';
		const hasGeneratedDocs = await fs.fileExists({ path: docsDir });
		expect(hasGeneratedDocs).toBe(false);
	});

	it('does not create answer or evaluation records even with confirmed: true', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		await handleIntakeCommand({
			command: 'logos-init',
			confirmed: true,
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			expect(Object.keys(loadResult.state.answeredQuestions)).toHaveLength(0);
			expect(Object.keys(loadResult.state.partialQuestions)).toHaveLength(0);
			expect(Object.keys(loadResult.state.contradictions)).toHaveLength(0);
		}
	});

	it('blocks with active_intake_state_inconsistent when prompt is missing even with confirmed: true', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		const state = createDefaultIntakeState({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		state.mode = 'intake_active';
		state.activeQuestionId = undefined;
		state.activePrompt = undefined;

		await saveIntakeState({
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
			state,
		});

		const result = await handleIntakeCommand({
			command: 'logos-init',
			confirmed: true,
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('blocked');
		expect(result.data?.disposition).toBe('block');
		expect(
			result.blockers.some(
				(b) => b.code === 'active_intake_state_inconsistent',
			),
		).toBe(true);
		expect(result.data?.stateChanged).toBe(false);
		expect(result.data?.persisted).toBe(false);
	});
});

describe('handleIntakeCommand — logos-init confirmed: true when intake is not active', () => {
	it('returns execute disposition when intake is idle even with confirmed: true', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		const result = await handleIntakeCommand({
			command: 'logos-init',
			confirmed: true,
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('ok');
		expect(result.data?.disposition).toBe('execute');
		expect(result.data?.mode).toBe('idle');
	});
});
