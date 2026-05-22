/**
 * Step 9.1 — Custom message renderer registration tests.
 *
 * Proves that `registerLogosRenderers`:
 * 1. Does not throw with fake Pi.
 * 2. If fake Pi has registerMessageRenderer, it is called.
 * 3. If fake Pi lacks registerMessageRenderer, registration safely no-ops.
 * 4. Registered renderer does not require React/Ink.
 * 5. Extension factory calls registerLogosRenderers.
 */

import { describe, expect, it, vi } from 'vitest';
import { createLogosPiExtension } from '../../src/pi-extension/create-extension.js';
import type { LogosPiExtensionDependencies } from '../../src/pi-extension/extension-dependencies.js';
import { registerLogosRenderers } from '../../src/pi-extension/rendering/register-renderers.js';

// ---------------------------------------------------------------------------
// Fake helpers
// ---------------------------------------------------------------------------

type FakePi = {
	commands: Map<string, unknown>;
	registerCommand: (name: string, options: unknown) => void;
	registerMessageRenderer?: (type: string, renderer: unknown) => void;
	on?: (event: string, handler: unknown) => void;
};

function createFakePi(): FakePi {
	return {
		commands: new Map(),
		registerCommand(name, options) {
			this.commands.set(name, options);
		},
	};
}

function createFakePiWithMessageRenderer(): FakePi & {
	registerMessageRenderer: ReturnType<typeof vi.fn>;
} {
	const registerMessageRenderer = vi.fn();
	return {
		commands: new Map(),
		registerCommand(name, options) {
			this.commands.set(name, options);
		},
		registerMessageRenderer,
	};
}

function createFakeCore(): LogosPiExtensionDependencies['core'] {
	const noop = () => Promise.resolve({} as never);
	return {
		generate: noop,
		getStatus: noop,
		handleIntakeCommand: noop,
		handleIntakeMessage: noop,
		initProject: noop,
		startIntake: noop,
		stopIntake: noop,
	} as LogosPiExtensionDependencies['core'];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Step 9.1 — register message renderer', () => {
	describe('registerLogosRenderers', () => {
		it('does not throw with fake Pi lacking registerMessageRenderer', () => {
			const pi = createFakePi();

			expect(() =>
				registerLogosRenderers({
					core: createFakeCore(),
					pi: pi as LogosPiExtensionDependencies['pi'],
				}),
			).not.toThrow();
		});

		it('does not throw with fake Pi that has registerMessageRenderer', () => {
			const pi = createFakePiWithMessageRenderer();

			expect(() =>
				registerLogosRenderers({
					core: createFakeCore(),
					pi: pi as unknown as LogosPiExtensionDependencies['pi'],
				}),
			).not.toThrow();
		});

		it('calls registerMessageRenderer when available', () => {
			const pi = createFakePiWithMessageRenderer();

			registerLogosRenderers({
				core: createFakeCore(),
				pi: pi as unknown as LogosPiExtensionDependencies['pi'],
			});

			expect(pi.registerMessageRenderer).toHaveBeenCalledTimes(1);
			expect(pi.registerMessageRenderer).toHaveBeenCalledWith(
				'logos',
				expect.any(Function),
			);
		});

		it('safe no-ops when registerMessageRenderer is absent', () => {
			const pi = createFakePi();

			// Must not throw or have side effects.
			registerLogosRenderers({
				core: createFakeCore(),
				pi: pi as LogosPiExtensionDependencies['pi'],
			});

			// No commands were registered.
			expect(pi.commands.size).toBe(0);
		});

		it('registered renderer does not require React/Ink', () => {
			const pi = createFakePiWithMessageRenderer();

			registerLogosRenderers({
				core: createFakeCore(),
				pi: pi as unknown as LogosPiExtensionDependencies['pi'],
			});

			const renderer = pi.registerMessageRenderer.mock.calls[0]?.[1] as (
				msg: unknown,
			) => unknown;

			// The renderer is a pass-through — no React/Ink.
			const testMessage = { body: 'Test.', kind: 'question', type: 'logos' };
			const result = renderer(testMessage);

			// Pass-through renderer returns the message as-is.
			expect(result).toBe(testMessage);
		});

		it('does not register duplicate renderers on same Pi instance', () => {
			const pi = createFakePiWithMessageRenderer();
			const deps: LogosPiExtensionDependencies = {
				core: createFakeCore(),
				pi: pi as unknown as LogosPiExtensionDependencies['pi'],
			};

			registerLogosRenderers(deps);
			registerLogosRenderers(deps);
			registerLogosRenderers(deps);

			// Only one registration should have occurred.
			expect(pi.registerMessageRenderer).toHaveBeenCalledTimes(1);
		});

		it('does not throw when called multiple times', () => {
			const pi = createFakePiWithMessageRenderer();
			const deps: LogosPiExtensionDependencies = {
				core: createFakeCore(),
				pi: pi as unknown as LogosPiExtensionDependencies['pi'],
			};

			expect(() => {
				registerLogosRenderers(deps);
				registerLogosRenderers(deps);
			}).not.toThrow();
		});
	});

	describe('extension factory integration', () => {
		it('calls registerLogosRenderers during extension creation', () => {
			const registerMessageRenderer = vi.fn();
			const pi = {
				commands: new Map(),
				on() {},
				registerCommand(name: string, options: unknown) {
					(pi as Record<string, unknown>).commands.set(name, options);
				},
				registerMessageRenderer,
			};

			createLogosPiExtension({
				core: createFakeCore(),
				getProjectRoot: () => '/test',
				pi: pi as unknown as LogosPiExtensionDependencies['pi'],
			});

			// Extension factory must have called registerLogosRenderers.
			expect(registerMessageRenderer).toHaveBeenCalledWith(
				'logos',
				expect.any(Function),
			);
		});

		it('extension factory does not throw when registerMessageRenderer is absent', () => {
			const pi = createFakePi();

			expect(() =>
				createLogosPiExtension({
					core: createFakeCore(),
					getProjectRoot: () => '/test',
					pi: pi as unknown as LogosPiExtensionDependencies['pi'],
				}),
			).not.toThrow();
		});
	});
});
