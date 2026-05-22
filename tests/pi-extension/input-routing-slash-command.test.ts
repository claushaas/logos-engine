import { describe, expect, it, vi } from 'vitest';
import { routePiInput } from '../../src/pi-extension/input/input-router.js';
import {
	createFakeCore,
	ctx,
	inputEvent,
	makeDeps,
	statusResultForMode,
} from './input-routing-test-helpers.js';

const slashInputs = [
	'/logos-start',
	'/logos-stop',
	'/logos-status',
	'/logos-generate',
	'/logos-init',
	'/logos-next',
	'/logos-answer',
	'/unknown',
	'   /logos-status',
] as const;

describe('Pi input routing slash-command safety', () => {
	it.each(
		slashInputs,
	)('returns continue and never routes %s as an intake answer', async (text) => {
		const fakeCore = createFakeCore({
			statusResult: statusResultForMode('intake_active'),
		});
		const renderCoreResult = vi.fn();

		const result = await routePiInput({
			ctx: ctx(),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent(text),
		});

		expect(result).toEqual({ action: 'continue' });
		expect(fakeCore.getStatus).not.toHaveBeenCalled();
		expect(fakeCore.handleIntakeMessage).not.toHaveBeenCalled();
		expect(renderCoreResult).not.toHaveBeenCalled();
	});

	it('does not treat whitespace-only input as an answer', async () => {
		const fakeCore = createFakeCore({
			statusResult: statusResultForMode('intake_active'),
		});
		const renderCoreResult = vi.fn();

		const result = await routePiInput({
			ctx: ctx(),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('   \n\t   '),
		});

		expect(result).toEqual({ action: 'continue' });
		expect(fakeCore.getStatus).not.toHaveBeenCalled();
		expect(fakeCore.handleIntakeMessage).not.toHaveBeenCalled();
		expect(renderCoreResult).not.toHaveBeenCalled();
	});
});
