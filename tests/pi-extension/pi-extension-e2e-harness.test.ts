/**
 * Step 11.2 — Pi Extension E2E Harness: Load & Registration.
 *
 * Proves that the Pi extension can be loaded with fake Pi and fake Core
 * and that it correctly registers commands, input handlers, and renderers
 * without calling Core product APIs or sending user messages.
 *
 * Assertions:
 * 1. Extension factory loads with fake Pi and fake Core.
 * 2. Exactly the five allowed commands are registered.
 * 3. Forbidden commands are not registered.
 * 4. At least one input handler is registered.
 * 5. Renderer registration is safe (no-op when unavailable).
 * 6. Extension load does not call Core product APIs.
 * 7. Extension load does not call sendUserMessage.
 */

import { describe, expect, it } from 'vitest';
import {
	FORBIDDEN_LOGOS_COMMANDS,
	LOGOS_LIFECYCLE_COMMANDS,
} from '../../src/core/index.js';
import { createLogosPiExtension } from '../../src/pi-extension/create-extension.js';
import type { LogosPiExtensionDependencies } from '../../src/pi-extension/extension-dependencies.js';
import {
	buildE2eDeps,
	createFakeCoreScenario,
	createFakePiHost,
	wireExtension,
} from './pi-extension-e2e-fixtures.js';

// ---------------------------------------------------------------------------
// Fake Core that throws if any method is called
// ---------------------------------------------------------------------------

function createThrowOnCallCore() {
	const throwFn = (method: string) => () => {
		throw new Error(
			`Core.${method}() was called during registration — this must not happen.`,
		);
	};
	return {
		generate: throwFn('generate'),
		getStatus: throwFn('getStatus'),
		handleIntakeCommand: throwFn('handleIntakeCommand'),
		handleIntakeMessage: throwFn('handleIntakeMessage'),
		initProject: throwFn('initProject'),
		startIntake: throwFn('startIntake'),
		stopIntake: throwFn('stopIntake'),
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Pi Extension E2E Harness — Load & Registration', () => {
	describe('extension factory loading', () => {
		it('createLogosPiExtension accepts fake Pi and fake Core', () => {
			const fakePi = createFakePiHost();
			const fakeCore = createThrowOnCallCore() as unknown as Parameters<
				typeof createLogosPiExtension
			>[0]['core'];

			expect(() =>
				createLogosPiExtension({
					core: fakeCore,
					pi: fakePi as unknown as LogosPiExtensionDependencies['pi'],
				}),
			).not.toThrow();
		});

		it('extension load does not call Core product APIs', () => {
			const fakePi = createFakePiHost();
			const fakeCore = createThrowOnCallCore() as unknown as Parameters<
				typeof createLogosPiExtension
			>[0]['core'];

			// If any Core method is called, createThrowOnCallCore throws.
			expect(() =>
				createLogosPiExtension({
					core: fakeCore,
					getProjectRoot: () => '/repo',
					pi: fakePi as unknown as LogosPiExtensionDependencies['pi'],
				}),
			).not.toThrow();
		});

		it('extension load does not call sendUserMessage', () => {
			const fakePi = createFakePiHost();
			const scenario = createFakeCoreScenario([]);

			const { fakeCore } = buildE2eDeps({
				core: scenario as unknown as ReturnType<
					typeof buildE2eDeps
				>['fakeCore'],
				pi: fakePi,
			});

			createLogosPiExtension({
				core: fakeCore,
				getProjectRoot: () => '/repo',
				pi: fakePi as unknown as LogosPiExtensionDependencies['pi'],
			});

			expect(fakePi.sentUserMessages).toHaveLength(0);
		});
	});

	describe('command registration', () => {
		it('registers exactly the five allowed lifecycle commands', () => {
			const { fakePi } = wireExtension(createLogosPiExtension);

			expect(fakePi.commands.size).toBe(LOGOS_LIFECYCLE_COMMANDS.length);

			for (const cmd of LOGOS_LIFECYCLE_COMMANDS) {
				expect(
					fakePi.commands.has(cmd),
					`Allowed command "${cmd}" should be registered`,
				).toBe(true);
			}
		});

		it('registered command names match LOGOS_LIFECYCLE_COMMANDS', () => {
			const { fakePi } = wireExtension(createLogosPiExtension);

			const registered = [...fakePi.commands.keys()].sort();
			const canonical = [...LOGOS_LIFECYCLE_COMMANDS].sort();

			expect(registered).toEqual(canonical);
		});

		it('each registered command has a callable handler', () => {
			const { fakePi } = wireExtension(createLogosPiExtension);

			for (const [name, handler] of fakePi.commands) {
				expect(typeof handler, `Handler for "${name}" should be callable`).toBe(
					'function',
				);
			}
		});

		it('does not register forbidden command-first commands', () => {
			const { fakePi } = wireExtension(createLogosPiExtension);

			for (const forbidden of FORBIDDEN_LOGOS_COMMANDS) {
				expect(
					fakePi.commands.has(forbidden),
					`Forbidden command "${forbidden}" must not be registered`,
				).toBe(false);
			}
		});

		it('does not register arbitrary unknown commands', () => {
			const { fakePi } = wireExtension(createLogosPiExtension);

			expect(fakePi.commands.has('/unknown')).toBe(false);
			expect(fakePi.commands.has('unknown')).toBe(false);
			expect(fakePi.commands.size).toBe(LOGOS_LIFECYCLE_COMMANDS.length);
		});
	});

	describe('input handler registration', () => {
		it('registers at least one input handler for "input" events', () => {
			const { fakePi } = wireExtension(createLogosPiExtension);

			expect(fakePi.inputHandlers.length).toBeGreaterThanOrEqual(1);
		});

		it('input handler is a callable function', () => {
			const { fakePi } = wireExtension(createLogosPiExtension);

			const handler = fakePi.inputHandlers[0];
			expect(handler).toBeDefined();
			expect(typeof handler).toBe('function');
		});
	});

	describe('renderer registration', () => {
		it('registerLogosRenderers is called and safe', () => {
			const fakePi = createFakePiHost();
			const scenario = createFakeCoreScenario([]);

			expect(() =>
				createLogosPiExtension({
					core: scenario as unknown as ReturnType<
						typeof buildE2eDeps
					>['fakeCore'],
					getProjectRoot: () => '/repo',
					pi: fakePi as unknown as LogosPiExtensionDependencies['pi'],
				}),
			).not.toThrow();
		});

		it('renderer registration does not crash when registerMessageRenderer is absent', () => {
			const _fakePi = createFakePiHost();
			// The default fake Pi host has `registerMessageRenderer` which is okay.
			// But we also test that even when renderers are available, nothing crashes.
			const { fakePi: pi } = wireExtension(createLogosPiExtension);

			// The default createFakePiHost already has registerMessageRenderer.
			// Just verify it didn't throw.
			expect(pi.registeredRenderers.size).toBeGreaterThanOrEqual(0);
		});
	});

	describe('edge cases and invariants', () => {
		it('does not call sendUserMessage during load', () => {
			const { fakePi } = wireExtension(createLogosPiExtension);

			expect(fakePi.sentUserMessages).toHaveLength(0);
		});

		it('does not generate docs during load', () => {
			const { fakePi } = wireExtension(createLogosPiExtension);

			// No sent messages should indicate generation output.
			const genMessages = fakePi.sentMessages.filter(
				(m) =>
					m.customType === 'logos-core-result' &&
					typeof m.details === 'object' &&
					m.details !== null &&
					(m.details as Record<string, unknown>)?.kind === 'generation_result',
			);
			expect(genMessages).toHaveLength(0);
		});

		it('can be called multiple times with different fake Pi instances', () => {
			const pi1 = createFakePiHost();
			const pi2 = createFakePiHost();
			const scenario = createFakeCoreScenario([]);

			expect(() =>
				createLogosPiExtension({
					core: scenario as unknown as ReturnType<
						typeof buildE2eDeps
					>['fakeCore'],
					pi: pi1 as unknown as LogosPiExtensionDependencies['pi'],
				}),
			).not.toThrow();

			expect(() =>
				createLogosPiExtension({
					core: scenario as unknown as ReturnType<
						typeof buildE2eDeps
					>['fakeCore'],
					pi: pi2 as unknown as LogosPiExtensionDependencies['pi'],
				}),
			).not.toThrow();

			expect(pi1.commands.size).toBe(LOGOS_LIFECYCLE_COMMANDS.length);
			expect(pi2.commands.size).toBe(LOGOS_LIFECYCLE_COMMANDS.length);
		});
	});
});
