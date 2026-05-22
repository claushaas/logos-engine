/**
 * Step 4.4 — No command is needed to advance intake.
 *
 * Tests:
 * 1. User sends natural-language sufficient answer.
 * 2. handleIntakeMessage advances to next prompt automatically.
 * 3. No command string is involved.
 * 4. /logos-next is not required and not supported by this path.
 */

import { describe, expect, it } from 'vitest';

import { createLogosCore } from '../../src/core/api.js';
import { createFakeAnswerEvaluator } from '../../src/core/evaluation/fake-answer-evaluator.js';
import { createFakeFilesystem } from './helpers/fake-filesystem.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NOW = '2026-05-22T00:00:00.000Z';
const PROJECT_ROOT = '/project';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleIntakeMessage — no command needed to advance', () => {
	it('natural-language sufficient answer advances without any command', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(startResult.status).toBe('ok');

		const evaluator = createFakeAnswerEvaluator({ mode: 'sufficient' });

		// Answer is a plain natural-language sentence — no slash command, no
		// structured intent prefix, just the user typing a normal response.
		const naturalAnswer =
			'My project thesis is that existing documentation tools fail to capture intent, and LOGOS should bridge that gap.';

		const result = await core.handleIntakeMessage({
			evaluator,
			message: naturalAnswer,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('ok');
		expect(result.data?.transition).toBe('answer_accepted');
		expect(result.data?.stateChanged).toBe(true);

		// The assistant message should be the next question — not a command
		// confirmation, not a prompt to type /logos-next.
		expect(result.data?.assistantMessage).toBeDefined();
		expect(result.data?.assistantMessage?.kind).toBe('question');
		expect(result.data?.assistantMessage?.body).not.toContain('/logos');
		expect(result.data?.assistantMessage?.body).not.toContain('command');
	});

	it('/logos-next is not required — never appears in assistant text', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(startResult.status).toBe('ok');

		const evaluator = createFakeAnswerEvaluator({ mode: 'sufficient' });

		const result = await core.handleIntakeMessage({
			evaluator,
			message: 'Clear answer to the question.',
			projectRoot: PROJECT_ROOT,
		});

		expect(result.message.body).not.toContain('/logos-next');
		expect(result.message.body).not.toContain('/next');
		expect(result.message.body).not.toContain('/logos-answer');
		expect(result.message.body).not.toContain('/logos-continue');
	});

	it('forbidden commands are not recognized as intake commands', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(startResult.status).toBe('ok');

		const evaluator = createFakeAnswerEvaluator({ mode: 'sufficient' });

		// Sending /logos-next as a message, not as a Pi command.
		const result = await core.handleIntakeMessage({
			evaluator,
			message: '/logos-next',
			projectRoot: PROJECT_ROOT,
		});

		// /logos-next is an unknown slash command — should NOT be evaluated
		// as an answer.
		expect(result.data?.transition).toBe('out_of_scope');
		expect(result.data?.stateChanged).toBe(false);
	});
});
