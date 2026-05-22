import { describe, expect, it, vi } from 'vitest';
import { createLogosPiExtension } from '../../src/pi-extension/create-extension.js';
import { routePiInput } from '../../src/pi-extension/input/input-router.js';
import { registerLogosInputRouting } from '../../src/pi-extension/input/register-input-routing.js';
import {
	createFakeCore,
	createFakePi,
	ctx,
	inputEvent,
	makeDeps,
	statusResultForMode,
} from './input-routing-test-helpers.js';

describe('Pi input routing when LOGOS intake is inactive', () => {
	it('registers an input handler with pi.on("input", ...)', () => {
		const pi = createFakePi();
		const { core } = createFakeCore();

		registerLogosInputRouting(makeDeps({ core, pi }));

		expect(pi.inputHandlers).toHaveLength(1);
	});

	it('extension factory registers an input handler without calling Core', () => {
		const pi = createFakePi();
		const fakeCore = createFakeCore();

		createLogosPiExtension(makeDeps({ core: fakeCore.core, pi }));

		expect(pi.inputHandlers).toHaveLength(1);
		expect(fakeCore.getStatus).not.toHaveBeenCalled();
		expect(fakeCore.handleIntakeMessage).not.toHaveBeenCalled();
	});

	it('does not register duplicate input handlers for the same Pi API', () => {
		const pi = createFakePi();
		const { core } = createFakeCore();
		const deps = makeDeps({ core, pi });

		registerLogosInputRouting(deps);
		registerLogosInputRouting(deps);

		expect(pi.inputHandlers).toHaveLength(1);
	});

	it.each([
		'idle',
		'paused',
		'complete',
	] as const)('returns continue and preserves normal Pi behavior when mode is %s', async (mode) => {
		const fakeCore = createFakeCore({
			statusResult: statusResultForMode(mode),
		});
		const renderCoreResult = vi.fn();

		const result = await routePiInput({
			ctx: ctx(),
			deps: makeDeps({
				core: fakeCore.core,
				renderCoreResult,
			}),
			event: inputEvent('This is a normal Pi prompt.'),
		});

		expect(result).toEqual({ action: 'continue' });
		expect(fakeCore.getStatus).toHaveBeenCalledTimes(1);
		expect(fakeCore.handleIntakeMessage).not.toHaveBeenCalled();
		expect(renderCoreResult).not.toHaveBeenCalled();
	});

	it('returns continue when status shape does not expose intake mode', async () => {
		const fakeCore = createFakeCore({
			statusResult: {
				blockers: [],
				changedPaths: [],
				dryRun: false,
				errors: [],
				message: { body: 'ambiguous', kind: 'status' },
				status: 'ok',
				warnings: [],
			},
		});
		const renderCoreResult = vi.fn();

		const result = await routePiInput({
			ctx: ctx(),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('Natural input.'),
		});

		expect(result).toEqual({ action: 'continue' });
		expect(fakeCore.handleIntakeMessage).not.toHaveBeenCalled();
		expect(renderCoreResult).not.toHaveBeenCalled();
	});

	it('returns continue when getStatus fails', async () => {
		const fakeCore = createFakeCore();
		fakeCore.getStatus.mockRejectedValueOnce(new Error('state unavailable'));
		const renderCoreResult = vi.fn();

		const result = await routePiInput({
			ctx: ctx(),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('Natural input.'),
		});

		expect(result).toEqual({ action: 'continue' });
		expect(fakeCore.handleIntakeMessage).not.toHaveBeenCalled();
		expect(renderCoreResult).not.toHaveBeenCalled();
	});
});
