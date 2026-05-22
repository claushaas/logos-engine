import { describe, expect, it, vi } from 'vitest';
import { routePiInput } from '../../src/pi-extension/input/input-router.js';
import {
	createFakeCore,
	ctx,
	handledMessageResult,
	inputEvent,
	makeDeps,
	statusResultForMode,
} from './input-routing-test-helpers.js';

describe('Pi input routing when LOGOS intake is active', () => {
	it('routes natural-language input to Core, renders the result, and returns handled', async () => {
		const messageResult = handledMessageResult('Next LOGOS prompt.');
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});
		const renderCoreResult = vi.fn();

		const result = await routePiInput({
			ctx: ctx('/repo/project'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('The central thesis is durable local truth.'),
		});

		expect(result).toEqual({ action: 'handled' });
		expect(fakeCore.getStatus).toHaveBeenCalledWith({
			projectRoot: '/repo/project',
		});
		expect(fakeCore.handleIntakeMessage).toHaveBeenCalledTimes(1);
		expect(fakeCore.handleIntakeMessage).toHaveBeenCalledWith({
			message: 'The central thesis is durable local truth.',
			projectRoot: '/repo/project',
		});
		expect(renderCoreResult).toHaveBeenCalledTimes(1);
		expect(renderCoreResult).toHaveBeenCalledWith(
			messageResult,
			expect.objectContaining({ cwd: '/repo/project' }),
		);
	});

	it('does not call command-specific Core APIs for normal input', async () => {
		const fakeCore = createFakeCore({
			statusResult: statusResultForMode('intake_active'),
		});

		await routePiInput({
			ctx: ctx(),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
			event: inputEvent('This answers the active question.'),
		});

		expect(fakeCore.startIntake).not.toHaveBeenCalled();
		expect(fakeCore.generate).not.toHaveBeenCalled();
		expect(fakeCore.handleIntakeCommand).not.toHaveBeenCalled();
	});

	it('supports public status data at data.intake.mode', async () => {
		const fakeCore = createFakeCore({
			statusResult: {
				blockers: [],
				changedPaths: [],
				data: { intake: { mode: 'intake_active' } },
				dryRun: false,
				errors: [],
				message: { body: 'active', kind: 'status' },
				status: 'ok',
				warnings: [],
			},
		});

		const result = await routePiInput({
			ctx: ctx(),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
			event: inputEvent('Natural answer.'),
		});

		expect(result).toEqual({ action: 'handled' });
		expect(fakeCore.handleIntakeMessage).toHaveBeenCalledTimes(1);
	});
});
