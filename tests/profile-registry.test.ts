import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	loadProfileRegistry,
	ProfileRegistryError,
	validateProfileRegistry,
} from '../src/profiles/profile-registry.js';

const FIXTURES_ROOT = resolve(process.cwd(), 'tests', 'fixtures', 'profiles');
const STANDARD_PROFILE_ROOT = resolve(process.cwd(), 'profiles', 'standard');

function createValidRegistryFixture(): Record<string, unknown> {
	return {
		agentPolicy: {
			defaultMode: 'test',
			requiredAgentOutputs: ['test'],
			rules: ['test'],
		},
		axes: [
			{
				description: 'Test',
				id: 'normative',
				phases: ['01-test'],
				title: 'Normative',
			},
		],
		contentVersion: '0.1.0',
		dependencyPolicy: {
			circularDependency: 'block',
			crossPhaseDependency: 'allow',
			missingOptionalInput: 'continue',
			missingRequiredInput: 'block',
			staleDependency: 'warn',
		},
		documentationSystem: {
			id: 'test-docs',
			purpose: 'Test purpose',
			title: 'Test Docs',
		},
		globalRules: {
			agentPackRole: 'test',
			antiDuplicationRule: 'test',
			assumptionRule: 'test',
			boundaryRule: 'test',
			decisionRule: 'test',
			htmlRole: 'test',
			markdownRole: 'test',
			questionsLocation: 'test',
			regenerationRule: 'test',
			traceabilityRule: 'test',
			yamlRole: 'test',
		},
		outputModel: {
			agentPacks: { editable: false, format: 'markdown', role: 'test' },
			canonical: { editable: true, format: 'markdown', role: 'test' },
			presentation: { editable: false, format: 'html', role: 'test' },
			structure: { editable: true, format: 'yaml', role: 'test' },
		},
		phaseDefinitions: {
			'01-test': { purpose: 'Test' },
		},
		phaseRegistry: {
			directory: 'phases',
			files: [{ id: '01-test', path: 'phases/01-test.yml', required: true }],
		},
		project: { id: 'test', purpose: 'Test purpose', title: 'Test' },
		qualityModel: {
			failurePolicy: { incompleteRequiredSection: 'block' },
			requiredChecks: ['completeness'],
		},
		registryType: 'documentation_registry',
		roadmapIntegration: {
			enabled: true,
			outputs: ['test.md'],
			role: 'test',
			sources: ['01-test'],
		},
		schemaVersion: 1,
		statusWorkflow: {
			allowed: ['not_started', 'drafting'],
			terminal: ['not_started'],
			transitions: { not_started: ['drafting'] },
		},
	};
}

describe('loadProfileRegistry', () => {
	it('loads the Standard profile successfully from disk', async () => {
		const registry = await loadProfileRegistry({
			profileId: 'standard',
			repoRoot: process.cwd(),
		});

		expect(registry.id).toBe('standard');
		expect(registry.schemaVersion).toBe(1);
		expect(registry.registryType).toBe('documentation_registry');
	});

	it('loaded Standard registry includes resolved registry path metadata', async () => {
		const registry = await loadProfileRegistry({
			profileId: 'standard',
			repoRoot: process.cwd(),
		});

		expect(registry.paths.profileRoot).toBe(STANDARD_PROFILE_ROOT);
		expect(registry.paths.registryPath).toBe(
			join(STANDARD_PROFILE_ROOT, 'docs.yml'),
		);
		expect(registry.paths.phaseRegistryDirectory).toBe(
			join(STANDARD_PROFILE_ROOT, 'phases'),
		);
	});

	it('defaults to standard when useDefault is true', async () => {
		const registry = await loadProfileRegistry({ useDefault: true });
		expect(registry.id).toBe('standard');
	});

	it('supports loading via explicit profileRoot', async () => {
		const registry = await loadProfileRegistry({
			profileId: 'standard',
			profileRoot: STANDARD_PROFILE_ROOT,
		});
		expect(registry.id).toBe('standard');
	});

	it('fails with path-aware diagnostic when registry file is missing', async () => {
		try {
			await loadProfileRegistry({
				profileId: 'nonexistent-profile-12345',
				repoRoot: process.cwd(),
			});
			expect.fail('Expected loadProfileRegistry to throw');
		} catch (err) {
			expect(err).toBeInstanceOf(ProfileRegistryError);
			const error = err as ProfileRegistryError;
			expect(error.diagnostics).toHaveLength(1);
			expect(error.diagnostics[0].code).toBe('E_PROFILE_MISSING_FILE');
			expect(error.diagnostics[0].path).toContain('nonexistent-profile-12345');
			expect(error.diagnostics[0].path).toContain('docs.yml');
			expect(error.diagnostics[0].message).toContain('not found');
		}
	});

	it('fails with path-aware diagnostic when YAML is invalid', async () => {
		try {
			await loadProfileRegistry({
				profileId: 'invalid-yaml',
				profileRoot: join(FIXTURES_ROOT, 'invalid-yaml'),
			});
			expect.fail('Expected loadProfileRegistry to throw');
		} catch (err) {
			expect(err).toBeInstanceOf(ProfileRegistryError);
			const error = err as ProfileRegistryError;
			expect(error.diagnostics).toHaveLength(1);
			expect(error.diagnostics[0].code).toBe('E_PROFILE_PARSE_ERROR');
			expect(error.diagnostics[0].path).toContain('invalid-yaml');
			expect(error.diagnostics[0].path).toContain('docs.yml');
			expect(error.diagnostics[0].message).toContain('Failed to parse YAML');
		}
	});

	it('fails with field-path diagnostic when phase registry files is empty', async () => {
		try {
			await loadProfileRegistry({
				profileId: 'missing-phase-registry',
				profileRoot: join(FIXTURES_ROOT, 'missing-phase-registry'),
			});
			expect.fail('Expected loadProfileRegistry to throw');
		} catch (err) {
			expect(err).toBeInstanceOf(ProfileRegistryError);
			const error = err as ProfileRegistryError;
			const diag = error.diagnostics.find(
				(d) => d.fieldPath === 'phaseRegistry.files',
			);
			expect(diag).toBeDefined();
			expect(diag?.code).toBe('E_PROFILE_EMPTY_ARRAY');
			expect(diag?.message).toContain('phaseRegistry.files must not be empty');
		}
	});

	it('fails with field-path diagnostic when axes is not an array', async () => {
		try {
			await loadProfileRegistry({
				profileId: 'invalid-axis',
				profileRoot: join(FIXTURES_ROOT, 'invalid-axis'),
			});
			expect.fail('Expected loadProfileRegistry to throw');
		} catch (err) {
			expect(err).toBeInstanceOf(ProfileRegistryError);
			const error = err as ProfileRegistryError;
			const diag = error.diagnostics.find((d) => d.fieldPath === 'axes');
			expect(diag).toBeDefined();
			expect(diag?.code).toBe('E_PROFILE_FIELD_TYPE');
			expect(diag?.message).toContain('Expected axes to be an array');
		}
	});

	it('fails with field-path diagnostic when output model entry is not an object', async () => {
		try {
			await loadProfileRegistry({
				profileId: 'invalid-output-role',
				profileRoot: join(FIXTURES_ROOT, 'invalid-output-role'),
			});
			expect.fail('Expected loadProfileRegistry to throw');
		} catch (err) {
			expect(err).toBeInstanceOf(ProfileRegistryError);
			const error = err as ProfileRegistryError;
			const diag = error.diagnostics.find(
				(d) => d.fieldPath === 'outputModel.structure',
			);
			expect(diag).toBeDefined();
			expect(diag?.code).toBe('E_PROFILE_FIELD_TYPE');
			expect(diag?.message).toContain(
				'Expected outputModel.structure to be an object',
			);
		}
	});

	it('fails when no options are provided and useDefault is not set', async () => {
		try {
			await loadProfileRegistry({});
			expect.fail('Expected loadProfileRegistry to throw');
		} catch (err) {
			expect(err).toBeInstanceOf(ProfileRegistryError);
			const error = err as ProfileRegistryError;
			expect(error.diagnostics[0].code).toBe('E_PROFILE_MISSING_OPTIONS');
		}
	});

	it('fails when axis phase entries are not strings', () => {
		const raw = createValidRegistryFixture();
		(raw.axes as Array<Record<string, unknown>>)[0].phases = ['01-test', 42];

		expect(() =>
			validateProfileRegistry('test', raw, '/tmp/docs.yml', '/tmp'),
		).toThrow(ProfileRegistryError);

		try {
			validateProfileRegistry('test', raw, '/tmp/docs.yml', '/tmp');
			expect.fail('Expected validateProfileRegistry to throw');
		} catch (err) {
			expect(err).toBeInstanceOf(ProfileRegistryError);
			const error = err as ProfileRegistryError;
			const diag = error.diagnostics.find(
				(d) => d.fieldPath === 'axes[0].phases[1]',
			);
			expect(diag).toBeDefined();
			expect(diag?.code).toBe('E_PROFILE_FIELD_TYPE');
		}
	});

	it('fails when status transitions reference unknown statuses', () => {
		const raw = createValidRegistryFixture();
		(raw.statusWorkflow as Record<string, unknown>).transitions = {
			not_started: ['missing_status'],
		};

		try {
			validateProfileRegistry('test', raw, '/tmp/docs.yml', '/tmp');
			expect.fail('Expected validateProfileRegistry to throw');
		} catch (err) {
			expect(err).toBeInstanceOf(ProfileRegistryError);
			const error = err as ProfileRegistryError;
			const diag = error.diagnostics.find(
				(d) => d.fieldPath === 'statusWorkflow.transitions.not_started[0]',
			);
			expect(diag).toBeDefined();
			expect(diag?.code).toBe('E_PROFILE_DISALLOWED_VALUE');
		}
	});
});
