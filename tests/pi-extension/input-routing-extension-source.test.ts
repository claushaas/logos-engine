import { describe, expect, it, vi } from 'vitest';
import { routePiInput } from '../../src/pi-extension/input/input-router.js';
import {
	createFakeCore,
	ctx,
	inputEvent,
	inputEventWithoutSource,
	makeDeps,
	statusResultForMode,
} from './input-routing-test-helpers.js';

describe('Pi input routing extension-source loop safety', () => {
	it('returns continue for extension-injected input without calling Core or renderer', async () => {
		const fakeCore = createFakeCore({
			statusResult: statusResultForMode('intake_active'),
		});
		const renderCoreResult = vi.fn();

		const result = await routePiInput({
			ctx: ctx(),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('LOGOS rendered output', 'extension'),
		});

		expect(result).toEqual({ action: 'continue' });
		expect(fakeCore.getStatus).not.toHaveBeenCalled();
		expect(fakeCore.handleIntakeMessage).not.toHaveBeenCalled();
		expect(renderCoreResult).not.toHaveBeenCalled();
	});

	it('does not automatically block input when source is absent', async () => {
		const fakeCore = createFakeCore({
			statusResult: statusResultForMode('intake_active'),
		});
		const renderCoreResult = vi.fn();

		const result = await routePiInput({
			ctx: ctx(),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEventWithoutSource(
				'A normal answer without source metadata.',
			),
		});

		expect(result).toEqual({ action: 'handled' });
		expect(fakeCore.getStatus).toHaveBeenCalledTimes(1);
		expect(fakeCore.handleIntakeMessage).toHaveBeenCalledTimes(1);
		expect(renderCoreResult).toHaveBeenCalledTimes(1);
	});
});
