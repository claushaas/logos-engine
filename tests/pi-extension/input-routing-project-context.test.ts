import { describe, expect, it, vi } from 'vitest';
import { routePiInput } from '../../src/pi-extension/input/input-router.js';
import {
	createFakeCore,
	ctx,
	inputEvent,
	makeDeps,
	statusResultForMode,
} from './input-routing-test-helpers.js';

describe('Pi input routing project context', () => {
	it('passes ctx.cwd to getStatus and handleIntakeMessage when active', async () => {
		const fakeCore = createFakeCore({
			statusResult: statusResultForMode('intake_active'),
		});

		await routePiInput({
			ctx: ctx('/ctx/project'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
			event: inputEvent('Use the current repository as the product scope.'),
		});

		expect(fakeCore.getStatus).toHaveBeenCalledWith({
			projectRoot: '/ctx/project',
		});
		expect(fakeCore.handleIntakeMessage).toHaveBeenCalledWith({
			message: 'Use the current repository as the product scope.',
			projectRoot: '/ctx/project',
		});
	});

	it('honors a custom getProjectRoot dependency', async () => {
		const fakeCore = createFakeCore({
			statusResult: statusResultForMode('intake_active'),
		});
		const getProjectRoot = vi.fn(() => '/custom/project-root');

		await routePiInput({
			ctx: ctx('/ctx/project'),
			deps: makeDeps({
				core: fakeCore.core,
				getProjectRoot,
				renderCoreResult: vi.fn(),
			}),
			event: inputEvent('Natural answer.'),
		});

		expect(getProjectRoot).toHaveBeenCalledWith(
			expect.objectContaining({ cwd: '/ctx/project' }),
		);
		expect(fakeCore.getStatus).toHaveBeenCalledWith({
			projectRoot: '/custom/project-root',
		});
		expect(fakeCore.handleIntakeMessage).toHaveBeenCalledWith({
			message: 'Natural answer.',
			projectRoot: '/custom/project-root',
		});
	});

	it('does not hardcode project root', async () => {
		const fakeCore = createFakeCore({
			statusResult: statusResultForMode('intake_active'),
		});

		await routePiInput({
			ctx: ctx('/another/project'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
			event: inputEvent('Answer for another project.'),
		});

		expect(fakeCore.getStatus).toHaveBeenCalledWith({
			projectRoot: '/another/project',
		});
		expect(fakeCore.getStatus).not.toHaveBeenCalledWith({
			projectRoot: process.cwd(),
		});
	});

	it('falls back to the existing project-root helper policy when cwd is missing', async () => {
		const fakeCore = createFakeCore({
			statusResult: statusResultForMode('intake_active'),
		});

		await routePiInput({
			ctx: {} as Parameters<typeof routePiInput>[0]['ctx'],
			deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
			event: inputEvent('Answer without cwd.'),
		});

		expect(fakeCore.getStatus).toHaveBeenCalledWith({
			projectRoot: process.cwd(),
		});
		expect(fakeCore.handleIntakeMessage).toHaveBeenCalledWith({
			message: 'Answer without cwd.',
			projectRoot: process.cwd(),
		});
	});
});
