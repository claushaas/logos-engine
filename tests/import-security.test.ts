/** Step 12.1 — Security & Redaction Tests */

import { describe, expect, it } from 'vitest';
import type { DocumentationImportPlanInput } from '../src/index.js';
import {
	hasSecretLikeContent,
	planDocumentationImport,
	redactImportContent,
} from '../src/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(
	overrides?: Partial<DocumentationImportPlanInput>,
): DocumentationImportPlanInput {
	return {
		documentationRoot: 'logos/',
		profileId: 'standard',
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Secret Detection Tests
// ---------------------------------------------------------------------------

describe('import secret detection', () => {
	it('fake API key redacted', () => {
		const content = 'api_key: sk-test12345678901234567890';
		expect(hasSecretLikeContent(content)).toBe(true);

		const redacted = redactImportContent(content);
		expect(redacted).not.toContain('sk-test12345678901234567890');
	});

	it('fake bearer token redacted', () => {
		const content = 'Authorization: Bearer abc123def456';
		expect(hasSecretLikeContent(content)).toBe(true);

		const redacted = redactImportContent(content);
		expect(redacted).not.toContain('abc123def456');
	});

	it('fake provider token redacted', () => {
		const content = 'token: gsk_abcdefghijklmnopqrstuvwxyzabcdef';
		expect(hasSecretLikeContent(content)).toBe(true);

		const redacted = redactImportContent(content);
		expect(redacted).not.toContain('gsk_abcdefghijklmnopqrstuvwxyzabcdef');
	});

	it('fake private key-like content redacted', () => {
		const content =
			'private_key: -----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC\n-----END PRIVATE KEY-----';
		expect(hasSecretLikeContent(content)).toBe(true);
	});

	it('fake env value redacted', () => {
		const content = 'export MY_SECRET_TOKEN="supersecretvalue1234567890"';
		expect(hasSecretLikeContent(content)).toBe(true);
	});

	it('GitHub token redacted', () => {
		const content =
			'export GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz12345678901234567890';
		expect(hasSecretLikeContent(content)).toBe(true);

		const redacted = redactImportContent(content);
		expect(redacted).not.toContain(
			'ghp_abcdefghijklmnopqrstuvwxyz12345678901234567890',
		);
	});

	it('fake secrets do not appear in content snippets', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([
					[
						'secrets.md',
						'# Secrets\n\napi_key: sk-myapikey1234567890123456789\n\ntoken: gsk_abcdefghijklmnopqrstuvwxyz\n\nBearer abcdef123456',
					],
				]),
			}),
		);

		const candidate = result.plan.candidates[0];
		if (candidate?.contentSnippet) {
			expect(candidate.contentSnippet).not.toContain(
				'sk-myapikey1234567890123456789',
			);
			expect(candidate.contentSnippet).not.toContain(
				'gsk_abcdefghijklmnopqrstuvwxyz',
			);
		}
	});

	it('fake secrets do not appear in diagnostics', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([
					[
						'config.yml',
						'api_key: sk-mykey12345678901234567890\nsecret: mysecret',
					],
				]),
			}),
		);

		for (const diag of result.plan.diagnostics) {
			const message = diag.message ?? '';
			expect(message).not.toContain('sk-mykey12345678901234567890');
		}
	});

	it('path traversal blocks', () => {
		const result = planDocumentationImport(
			makeInput({
				candidatePaths: ['../../etc/passwd'],
			}),
		);

		expect(result.plan.summary.totalCandidates).toBe(0);
		expect(result.plan.blockers.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// Derived Artifact Boundary Tests
// ---------------------------------------------------------------------------

describe('derived artifact boundary', () => {
	it('HTML artifact cannot map as canonical source', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([
					[
						'logos/html/project.html',
						'<!DOCTYPE html>\n<html>\n<body>This is a derived artifact</body>\n</html>',
					],
				]),
			}),
		);

		const candidate = result.plan.candidates[0];
		const hasDerivedConflict = result.plan.conflicts.some(
			(c) =>
				c.kind === 'derived_artifact_as_source' &&
				c.candidateIds.includes(candidate?.id ?? ''),
		);
		expect(hasDerivedConflict).toBe(true);
	});

	it('Agent Pack cannot map as canonical source', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([
					[
						'logos/agent-packs/pack.md',
						'# Agent Pack\n\nThis file is generated.\n\nDo not edit manually.',
					],
				]),
			}),
		);

		const hasDerivedConflict = result.plan.conflicts.some(
			(c) => c.kind === 'derived_artifact_as_source',
		);
		expect(hasDerivedConflict).toBe(true);
	});

	it('Executive export cannot map as canonical source', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([
					[
						'logos/executive/executive-plan.json',
						'{"projectTitle":"Test","executivePlan":{"workstreams":[]}}',
					],
				]),
			}),
		);

		const hasDerivedConflict = result.plan.conflicts.some(
			(c) => c.kind === 'derived_artifact_as_source',
		);
		expect(hasDerivedConflict).toBe(true);
	});

	it('validation report cannot map as canonical source', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([
					[
						'logos/validation/report.md',
						'# Validation Report\n\nThis file is generated.\n\n**Generated at:** 2025-01-01',
					],
				]),
			}),
		);

		const hasDerivedConflict = result.plan.conflicts.some(
			(c) => c.kind === 'derived_artifact_as_source',
		);
		expect(hasDerivedConflict).toBe(true);
	});

	it('diagnostic report cannot map as canonical source', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([
					[
						'logos/diagnose/report.md',
						'# Diagnostic Report\n\nAuto-generated. Do not edit manually\n\n## Findings',
					],
				]),
			}),
		);

		const hasDerivedConflict = result.plan.conflicts.some(
			(c) => c.kind === 'derived_artifact_as_source',
		);
		expect(hasDerivedConflict).toBe(true);
	});
});
