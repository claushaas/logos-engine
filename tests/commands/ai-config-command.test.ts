import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	createLogosApplicationServices,
	handleSlashCommand,
	initializeWorkspace,
	loadCommandContext,
	parseSlashCommand,
	readWorkspaceState,
} from '../../src/index.js';

const tokenEnvVar = 'LOGOS_TEST_AI_KEY';

describe('/config ai command', () => {
	afterEach(() => {
		delete process.env[tokenEnvVar];
	});

	it('shows redacted provider configuration and preset disclosure metadata', async () => {
		const projectRoot = createProjectRoot();
		initializeWorkspace(projectRoot);

		const result = await runCommand(projectRoot, '/config ai --show');

		expect(result.status).toBe('ok');
		expect(result.body.join('\n')).toContain('Available presets:');
		expect(result.body.join('\n')).toContain('Raw tokens are not stored');
	});

	it('writes explicit non-secret provider settings without persisting raw tokens', async () => {
		const projectRoot = createProjectRoot();
		initializeWorkspace(projectRoot);
		process.env[tokenEnvVar] = 'sk-test-secret-value';

		const result = await runCommand(
			projectRoot,
			`/config ai --provider openai --endpoint https://api.example.test/v1 --model gpt-test --token-env ${tokenEnvVar} --allow-remote`,
		);

		expect(result.status).toBe('ok');

		const configText = readFileSync(
			join(projectRoot, '.logos', 'config.json'),
			'utf8',
		);
		const state = readWorkspaceState(projectRoot);

		expect(state.config.ai).toMatchObject({
			enabled: true,
			endpoint: 'https://api.example.test/v1',
			model: 'gpt-test',
			provider: 'openai',
			remoteContextDisclosureAccepted: true,
			tokenSource: {
				envVar: tokenEnvVar,
				type: 'environment',
			},
		});
		expect(configText).not.toContain('sk-test-secret-value');
	});

	it('checks provider configuration deterministically without live model calls', async () => {
		const projectRoot = createProjectRoot();
		initializeWorkspace(projectRoot);
		process.env[tokenEnvVar] = 'sk-test-secret-value';
		await runCommand(
			projectRoot,
			`/config ai --provider openai --endpoint https://api.example.test/v1 --model gpt-test --token-env ${tokenEnvVar} --allow-remote`,
		);

		const result = await runCommand(projectRoot, '/config ai --test');

		expect(result.status).toBe('ok');
		expect(result.body.join('\n')).toContain(
			'No live model call was made by this deterministic configuration check.',
		);
		expect(result.body.join('\n')).toContain('sk-t...[redacted]...alue');
	});

	it('fails remote config checks until transmission is acknowledged', async () => {
		const projectRoot = createProjectRoot();
		initializeWorkspace(projectRoot);
		process.env[tokenEnvVar] = 'sk-test-secret-value';
		await runCommand(
			projectRoot,
			`/config ai --provider openai --endpoint https://api.example.test/v1 --model gpt-test --token-env ${tokenEnvVar}`,
		);

		const result = await runCommand(projectRoot, '/config ai --test');

		expect(result.status).toBe('error');
		expect(result.body.join('\n')).toContain(
			'Remote provider usage requires explicit acknowledgement',
		);
	});
});

async function runCommand(projectRoot: string, input: string) {
	const parsed = parseSlashCommand(input);
	expect(parsed.ok).toBe(true);
	if (!parsed.ok) {
		throw new Error(parsed.error.message);
	}

	return await handleSlashCommand(
		parsed.command,
		loadCommandContext(projectRoot),
		createLogosApplicationServices(),
	);
}

function createProjectRoot(): string {
	const projectRoot = mkdtempSync(join(tmpdir(), 'logos-ai-config-'));
	mkdirSync(join(projectRoot, '.git'));

	return projectRoot;
}
