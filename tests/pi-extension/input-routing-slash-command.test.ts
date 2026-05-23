import { describe, expect, it, vi } from 'vitest';
import { FORBIDDEN_LOGOS_COMMANDS } from '../../src/core/index.js';
import { routePiInput } from '../../src/pi-extension/input/input-router.js';
import {
	createFakeCore,
	ctx,
	inputEvent,
	makeDeps,
	statusResultForMode,
} from './input-routing-test-helpers.js';

/**
 * All slash inputs that must be treated as commands (never answers):
 * - Allowed lifecycle commands
 * - Forbidden command-first patterns
 * - Unknown slash commands
 * - Whitespace-padded variants
 */
const ALL_SLASH_INPUTS = [
	// Allowed lifecycle commands
	'/logos-init',
	'/logos-start',
	'/logos-stop',
	'/logos-status',
	'/logos-generate',
	// Forbidden command-first patterns (all nine)
	'/logos-next',
	'/logos-answer',
	'/logos-continue',
	'/logos-question',
	'/logos-phase',
	'/logos-doc',
	'/logos-set-answer',
	'/logos-skip',
	'/logos-followup',
	// Unknown slash commands
	'/unknown',
	'/help',
	'/some-random-command',
	// Whitespace-padded variants
	'   /logos-status',
	'  /logos-next  ',
] as const;

describe('Pi input routing slash-command safety', () => {
	describe('all slash inputs return continue (never routed as answers)', () => {
		it.each(
			ALL_SLASH_INPUTS,
		)('%s returns { action: "continue" } and never calls Core', async (text) => {
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
	});

	describe('each forbidden command is individually tested as slash input', () => {
		it.each(
			FORBIDDEN_LOGOS_COMMANDS.map((c) => `/${c}`),
		)('%s is not routed to answer evaluation', async (text) => {
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
			expect(fakeCore.handleIntakeMessage).not.toHaveBeenCalled();
			expect(fakeCore.getStatus).not.toHaveBeenCalled();
			expect(renderCoreResult).not.toHaveBeenCalled();
		});
	});

	describe('unknown slash commands are never routed as answers', () => {
		const unknownSlashCommands = [
			'/help',
			'/unknown',
			'/next',
			'/skip',
			'/continue',
			'/answer',
			'/logos-help',
			'/logos-reset',
			'/logos-export',
			'/some-future-command',
		] as const;

		it.each(
			unknownSlashCommands,
		)('%s returns { action: "continue" } and does not call handleIntakeMessage', async (text) => {
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
			expect(fakeCore.handleIntakeMessage).not.toHaveBeenCalled();
		});
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

	it('slash command guard prevents status lookup and message handling', async () => {
		// Prove the short-circuit: slash commands never reach getStatus or handleIntakeMessage
		for (const cmd of FORBIDDEN_LOGOS_COMMANDS) {
			const slashCmd = `/${cmd}`;
			const fakeCore = createFakeCore({
				statusResult: statusResultForMode('intake_active'),
			});
			const renderCoreResult = vi.fn();

			await routePiInput({
				ctx: ctx(),
				deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
				event: inputEvent(slashCmd),
			});

			expect(
				fakeCore.getStatus,
				`/${cmd} must not trigger getStatus`,
			).not.toHaveBeenCalled();
			expect(
				fakeCore.handleIntakeMessage,
				`/${cmd} must not trigger handleIntakeMessage`,
			).not.toHaveBeenCalled();
		}
	});

	it('extension-source slash messages are also skipped', async () => {
		const fakeCore = createFakeCore({
			statusResult: statusResultForMode('intake_active'),
		});
		const renderCoreResult = vi.fn();

		const result = await routePiInput({
			ctx: ctx(),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('/logos-next', 'extension'),
		});

		expect(result).toEqual({ action: 'continue' });
		expect(fakeCore.handleIntakeMessage).not.toHaveBeenCalled();
	});
});
