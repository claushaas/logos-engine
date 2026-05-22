import { describe, expect, it } from 'vitest';
import {
	createLogosCore,
	type GenerateInput,
	type GetStatusInput,
	type HandleIntakeCommandInput,
	type HandleIntakeMessageInput,
	type InitProjectInput,
	type LogosCore,
	type LogosLifecycleCommand,
	type StartIntakeInput,
	type StopIntakeInput,
} from '../../src/core/api.js';

describe('public Core API', () => {
	it('exposes all public Core methods', () => {
		const core = createLogosCore();
		expect(typeof core.initProject).toBe('function');
		expect(typeof core.startIntake).toBe('function');
		expect(typeof core.handleIntakeMessage).toBe('function');
		expect(typeof core.handleIntakeCommand).toBe('function');
		expect(typeof core.stopIntake).toBe('function');
		expect(typeof core.getStatus).toBe('function');
		expect(typeof core.generate).toBe('function');
	});

	describe('initProject', () => {
		it('is callable with minimal valid input and returns a CoreResult', async () => {
			const core = createLogosCore();
			const input: InitProjectInput = { projectRoot: '/tmp/test' };
			const result = await core.initProject(input);

			expect(result).toHaveProperty('status');
			expect(result).toHaveProperty('message');
			expect(result).toHaveProperty('warnings');
			expect(result).toHaveProperty('blockers');
			expect(result).toHaveProperty('errors');
			expect(result).toHaveProperty('changedPaths');
			expect(result).toHaveProperty('dryRun');
			expect(Array.isArray(result.warnings)).toBe(true);
			expect(Array.isArray(result.blockers)).toBe(true);
			expect(Array.isArray(result.errors)).toBe(true);
			expect(Array.isArray(result.changedPaths)).toBe(true);
		});

		it('preserves dryRun: true', async () => {
			const core = createLogosCore();
			const result = await core.initProject({
				dryRun: true,
				projectRoot: '/tmp/test',
			});
			expect(result.dryRun).toBe(true);
		});
	});

	describe('startIntake', () => {
		it('is callable with minimal valid input and returns a CoreResult', async () => {
			const core = createLogosCore();
			const input: StartIntakeInput = { projectRoot: '/tmp/test' };
			const result = await core.startIntake(input);

			expect(result).toHaveProperty('status');
			expect(result).toHaveProperty('message');
			expect(result).toHaveProperty('warnings');
			expect(result).toHaveProperty('blockers');
			expect(result).toHaveProperty('errors');
			expect(result).toHaveProperty('changedPaths');
			expect(result).toHaveProperty('dryRun');
		});

		it('result data supports mode and optional activeQuestionId', async () => {
			const core = createLogosCore();
			const result = await core.startIntake({ projectRoot: '/tmp/test' });
			expect(result.data).toBeDefined();
			expect(result.data).toHaveProperty('mode');
			expect(result.data).toHaveProperty('activeQuestionId');
		});

		it('preserves dryRun: true', async () => {
			const core = createLogosCore();
			const result = await core.startIntake({
				dryRun: true,
				projectRoot: '/tmp/test',
			});
			expect(result.dryRun).toBe(true);
		});
	});

	describe('handleIntakeMessage', () => {
		it('is callable with minimal valid input and returns a CoreResult', async () => {
			const core = createLogosCore();
			const input: HandleIntakeMessageInput = {
				message: 'This is an answer.',
				projectRoot: '/tmp/test',
			};
			const result = await core.handleIntakeMessage(input);

			expect(result).toHaveProperty('status');
			expect(result).toHaveProperty('message');
			expect(result).toHaveProperty('warnings');
			expect(result).toHaveProperty('blockers');
			expect(result).toHaveProperty('errors');
			expect(result).toHaveProperty('changedPaths');
			expect(result).toHaveProperty('dryRun');
		});

		it('preserves dryRun: true', async () => {
			const core = createLogosCore();
			const result = await core.handleIntakeMessage({
				dryRun: true,
				message: 'test',
				projectRoot: '/tmp/test',
			});
			expect(result.dryRun).toBe(true);
		});
	});

	describe('handleIntakeCommand', () => {
		it('is callable with all allowed lifecycle commands and returns structured results', async () => {
			const core = createLogosCore();
			const commands: LogosLifecycleCommand[] = [
				'logos-init',
				'logos-start',
				'logos-stop',
				'logos-status',
				'logos-generate',
			];

			for (const command of commands) {
				const input: HandleIntakeCommandInput = {
					command,
					projectRoot: '/tmp/test',
				};
				const result = await core.handleIntakeCommand(input);

				expect(result).toHaveProperty('status');
				expect(result).toHaveProperty('message');
				expect(result).toHaveProperty('warnings');
				expect(result).toHaveProperty('blockers');
				expect(result).toHaveProperty('errors');
				expect(result).toHaveProperty('changedPaths');
				expect(result).toHaveProperty('dryRun');
			}
		});

		it('preserves dryRun: true', async () => {
			const core = createLogosCore();
			const result = await core.handleIntakeCommand({
				command: 'logos-status',
				dryRun: true,
				projectRoot: '/tmp/test',
			});
			expect(result.dryRun).toBe(true);
		});
	});

	describe('stopIntake', () => {
		it('is callable with minimal valid input and returns a CoreResult', async () => {
			const core = createLogosCore();
			const input: StopIntakeInput = { projectRoot: '/tmp/test' };
			const result = await core.stopIntake(input);

			expect(result).toHaveProperty('status');
			expect(result).toHaveProperty('message');
			expect(result).toHaveProperty('warnings');
			expect(result).toHaveProperty('blockers');
			expect(result).toHaveProperty('errors');
			expect(result).toHaveProperty('changedPaths');
			expect(result).toHaveProperty('dryRun');
		});

		it('preserves dryRun: true', async () => {
			const core = createLogosCore();
			const result = await core.stopIntake({
				dryRun: true,
				projectRoot: '/tmp/test',
			});
			expect(result.dryRun).toBe(true);
		});
	});

	describe('getStatus', () => {
		it('is callable with minimal valid input and returns a CoreResult', async () => {
			const core = createLogosCore();
			const input: GetStatusInput = { projectRoot: '/tmp/test' };
			const result = await core.getStatus(input);

			expect(result).toHaveProperty('status');
			expect(result).toHaveProperty('message');
			expect(result).toHaveProperty('warnings');
			expect(result).toHaveProperty('blockers');
			expect(result).toHaveProperty('errors');
			expect(result).toHaveProperty('changedPaths');
			expect(result).toHaveProperty('dryRun');
		});

		it('preserves dryRun: true', async () => {
			const core = createLogosCore();
			const result = await core.getStatus({
				dryRun: true,
				projectRoot: '/tmp/test',
			});
			expect(result.dryRun).toBe(true);
		});
	});

	describe('generate', () => {
		it('is callable with minimal valid input and returns a CoreResult', async () => {
			const core = createLogosCore();
			const input: GenerateInput = { projectRoot: '/tmp/test' };
			const result = await core.generate(input);

			expect(result).toHaveProperty('status');
			expect(result).toHaveProperty('message');
			expect(result).toHaveProperty('warnings');
			expect(result).toHaveProperty('blockers');
			expect(result).toHaveProperty('errors');
			expect(result).toHaveProperty('changedPaths');
			expect(result).toHaveProperty('dryRun');
		});

		it('preserves dryRun: true', async () => {
			const core = createLogosCore();
			const result = await core.generate({
				dryRun: true,
				projectRoot: '/tmp/test',
			});
			expect(result.dryRun).toBe(true);
		});
	});

	it('does not require Pi runtime to import and use', () => {
		// This test verifies by construction that the public API can be imported
		// and instantiated without any Pi extension, Ink, React, or TUI modules.
		const core: LogosCore = createLogosCore();
		expect(core).toBeDefined();
		expect(typeof core.initProject).toBe('function');
	});
});
