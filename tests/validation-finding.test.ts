import { describe, expect, it } from 'vitest';
import {
	createValidationFinding,
	determineValidationGateStatus,
	redactValidationValue,
	sortValidationFindings,
} from '../src/index.js';

describe('validation finding model', () => {
	it('creates a structured finding with location and recovery hint', () => {
		const finding = createValidationFinding({
			code: 'workspace_schema_invalid',
			location: { path: '.logos/workspace.json', pointer: '/schemaVersion' },
			message: 'Invalid workspace schema.',
			order: 0,
			recoveryHint: { message: 'Run /init to recreate state.' },
			severity: 'error',
			source: { kind: 'workspace_state', path: '.logos/workspace.json' },
		});

		expect(finding.id).toContain('workspace_schema_invalid');
		expect(finding.severity).toBe('error');
		expect(finding.location.pointer).toBe('/schemaVersion');
		expect(finding.recoveryHint?.message).toContain('/init');
	});

	it('sorts findings deterministically', () => {
		const findings = [
			createValidationFinding({
				code: 'artifact_file_missing',
				location: { path: 'b.md', pointer: '/path' },
				message: 'Missing.',
				order: 2,
				severity: 'warning',
				source: { kind: 'artifact_registry', path: 'b.md' },
			}),
			createValidationFinding({
				code: 'profile_registry_invalid',
				location: { path: 'docs.yml' },
				message: 'Invalid.',
				order: 1,
				severity: 'error',
				source: { kind: 'profile_registry', path: 'docs.yml' },
			}),
			createValidationFinding({
				code: 'document_missing_dependency',
				documentCanonicalId: 'b',
				location: { path: 'a.yml', pointer: '/dependsOn/0' },
				message: 'Unknown dependency.',
				order: 0,
				severity: 'info',
				source: { kind: 'contract_graph', path: 'a.yml' },
			}),
		];

		expect(sortValidationFindings(findings).map((f) => f.code)).toEqual([
			'profile_registry_invalid',
			'artifact_file_missing',
			'document_missing_dependency',
		]);
	});

	it('computes deterministic gate statuses', () => {
		expect(
			determineValidationGateStatus([
				createValidationFinding({
					code: 'artifact_invalid',
					location: {},
					message: 'Invalid.',
					order: 0,
					severity: 'fatal',
					source: { kind: 'artifact_registry' },
				}),
			]),
		).toBe('fail');
		expect(
			determineValidationGateStatus([
				createValidationFinding({
					code: 'artifact_file_missing',
					location: {},
					message: 'Missing.',
					order: 0,
					severity: 'warning',
					source: { kind: 'artifact_registry' },
				}),
			]),
		).toBe('pass_with_warnings');
		expect(determineValidationGateStatus([])).toBe('pass');
		expect(
			determineValidationGateStatus([
				createValidationFinding({
					code: 'document_missing_dependency',
					location: {},
					message: 'Informational dependency drift.',
					order: 0,
					severity: 'info',
					source: { kind: 'contract_graph' },
				}),
			]),
		).toBe('pass');
	});

	it('redacts fake secret values in received metadata', () => {
		const fakeSecret = 'sk-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLM';
		const finding = createValidationFinding({
			code: 'secret_like_value',
			location: {
				path: '.logos/workspace.json',
				pointer: '/provider/tokenEnvVarName',
			},
			message: 'Secret found.',
			order: 0,
			received: fakeSecret,
			severity: 'error',
			source: { kind: 'secret_scan', path: '.logos/workspace.json' },
		});

		expect(finding.received).toBe('[redacted-secret-like-value]');
		expect(JSON.stringify(finding)).not.toContain(fakeSecret);
		expect(redactValidationValue({ token: fakeSecret })).toEqual({
			token: '[redacted-secret-like-value]',
		});
	});
});
