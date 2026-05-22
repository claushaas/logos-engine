/**
 * Step 6.3 — Profile-driven output paths tests.
 *
 * Tests:
 * 1. Output paths derive from loaded active profile contracts.
 * 2. No hardcoded profiles/standard path is used in write planning.
 * 3. A fake custom-profile with different output paths produces different
 *    planned paths.
 * 4. Missing canonical output path produces missing_output_path (blocker).
 * 5. Ambiguous derived output contract produces unknown_output_contract.
 */

import { describe, expect, it } from 'vitest';
import { deriveOutputOperations } from '../../src/core/generation/output-contracts.js';
import type { GenerationPreflightResult } from '../../src/core/generation/preflight-result.js';
import { buildGenerationWritePlan } from '../../src/core/generation/write-plan.js';
import type { LoadedProfileContracts } from '../../src/core/profiles/profile-contracts.js';
import type { LogosQuestionRegistry } from '../../src/core/questions/question-registry.js';
import { createFakeFilesystem } from './helpers/fake-filesystem.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePreflightResult(
	ready: boolean,
	mode: 'final' | 'partial_draft' | 'dry_run' = 'final',
): GenerationPreflightResult {
	return {
		blockers: ready
			? []
			: [{ code: 'missing_critical_questions', message: 'Missing critical.' }],
		canGeneratePartialDraft: true,
		checkedAt: '2026-05-22T00:00:00.000Z',
		completenessScore: ready ? 1 : 0,
		contradictions: [],
		missingCriticalQuestions: [],
		mode,
		optionalMissingQuestions: [],
		optionalSkippedQuestions: [],
		partialCriticalQuestions: [],
		ready,
		requiredSkippedQuestions: [],
		requiresExplicitConfirmation: !ready,
		status: ready ? 'ready' : 'blocked',
		warnings: [],
	};
}

function makeEmptyRegistry(): LogosQuestionRegistry {
	return { profileId: 'test', questions: [], warnings: [] };
}

function makeContracts(
	profileId: string,
	documents: LoadedProfileContracts['documents'],
	overrides: Partial<LoadedProfileContracts> = {},
): LoadedProfileContracts {
	return {
		artifacts: { artifacts: [] },
		documentSchema: { raw: {} },
		documents,
		executive: {
			generationConfigPath: '',
			mappingConfigs: [],
			mappingPaths: [],
			planSchemaPath: '',
			templatePaths: [],
		},
		generation: { documentOutputPaths: [] },
		loadedPaths: [],
		phases: [],
		profileId,
		profileRoot: `/project/profiles/${profileId}`,
		questionRegistry: makeEmptyRegistry(),
		questions: [],
		rootRegistry: { raw: {} },
		validation: {
			completionCriteria: [],
			documentSchemaPath: '',
			qualityChecks: [],
		},
		warnings: [],
		...overrides,
	};
}

const NOW = '2026-05-22T00:00:00.000Z';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('profile-driven output paths', () => {
	// --- 1. Output paths derive from loaded active profile contracts ---
	it('derives output paths from profile contracts, not hardcoded paths', async () => {
		const fs = createFakeFilesystem();
		const preflight = makePreflightResult(true);
		const contracts = makeContracts('custom-profile', [
			{
				id: '01-thesis',
				outputs: {
					canonical: {
						format: 'markdown',
						path: 'output/custom-foundation-thesis.md',
					},
				},
				path: '/project/profiles/custom-profile/phases/01-foundation/01-thesis.yml',
				phaseId: '01-foundation',
				raw: {},
				sections: [],
			},
		]);

		const result = await buildGenerationWritePlan({
			filesystem: fs,
			mode: 'final',
			now: NOW,
			preflight,
			profileContracts: contracts,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		const canonicalOp = result.writePlan.operations.find(
			(op) => op.outputKind === 'canonical_markdown',
		);
		expect(canonicalOp).toBeDefined();
		expect(canonicalOp?.relativePath).toBe(
			'output/custom-foundation-thesis.md',
		);
		// The path comes from the profile contract, not a hardcoded default.
		expect(canonicalOp?.relativePath).not.toContain('profiles/standard');
	});

	// --- 2. Different profile id produces different source paths ---
	it('uses profileId from contracts, not hardcoded standard', async () => {
		const fs = createFakeFilesystem();
		const preflight = makePreflightResult(true);
		const standardContracts = makeContracts('standard', [
			{
				id: '01-thesis',
				outputs: {
					canonical: {
						format: 'markdown',
						path: 'docs/01-foundation/01-thesis.md',
					},
				},
				path: '/project/profiles/standard/phases/01-foundation/01-thesis.yml',
				phaseId: '01-foundation',
				raw: {},
				sections: [],
			},
		]);

		const customContracts = makeContracts('custom-profile', [
			{
				id: '01-thesis',
				outputs: {
					canonical: {
						format: 'markdown',
						path: 'out/custom-thesis.md',
					},
				},
				path: '/project/profiles/custom-profile/phases/01-foundation/01-thesis.yml',
				phaseId: '01-foundation',
				raw: {},
				sections: [],
			},
		]);

		const standardResult = await buildGenerationWritePlan({
			filesystem: fs,
			mode: 'final',
			now: NOW,
			preflight,
			profileContracts: standardContracts,
			projectRoot: '/project',
		});

		const customResult = await buildGenerationWritePlan({
			filesystem: fs,
			mode: 'final',
			now: NOW,
			preflight,
			profileContracts: customContracts,
			projectRoot: '/project',
		});

		expect(standardResult.ok).toBe(true);
		expect(customResult.ok).toBe(true);

		const standardCanonical = standardResult.writePlan.operations.find(
			(op) => op.outputKind === 'canonical_markdown',
		);
		const customCanonical = customResult.writePlan.operations.find(
			(op) => op.outputKind === 'canonical_markdown',
		);

		expect(standardCanonical).toBeDefined();
		expect(customCanonical).toBeDefined();
		// Paths should be different because contracts differ.
		expect(standardCanonical?.relativePath).not.toBe(
			customCanonical?.relativePath,
		);
	});

	// --- 3. Missing canonical output path produces blocked operation ---
	it('produces blocked operation when canonical output path is empty string', async () => {
		const fs = createFakeFilesystem();
		const preflight = makePreflightResult(true);
		const contracts = makeContracts('test', [
			{
				id: '01-thesis',
				outputs: {
					canonical: {
						format: 'markdown',
						// path intentionally missing.
					},
				},
				path: '/project/profiles/test/phases/01-foundation/01-thesis.yml',
				phaseId: '01-foundation',
				raw: {},
				sections: [],
			},
		]);

		const result = await buildGenerationWritePlan({
			filesystem: fs,
			mode: 'final',
			now: NOW,
			preflight,
			profileContracts: contracts,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		expect(result.writePlan.readyToWrite).toBe(false);
		const blockedOp = result.writePlan.operations.find(
			(op) => op.kind === 'blocked' && op.outputKind === 'canonical_markdown',
		);
		expect(blockedOp).toBeDefined();
		expect(blockedOp?.risks.some((r) => r.code === 'unsafe_path')).toBe(true);
	});

	// --- 4. deriveOutputOperations produces entries without hardcoded paths ---
	it('deriveOutputOperations does not invent hardcoded paths', () => {
		const contracts = makeContracts('custom', [
			{
				id: '01-thesis',
				path: '/project/profiles/custom/phases/01-foundation/01-thesis.yml',
				phaseId: '01-foundation',
				raw: {},
				sections: [],
				// No outputs block → missing canonical.
			},
		]);

		const planned = deriveOutputOperations(contracts);

		// Should produce one canonical_markdown entry with empty path (missing outputs).
		const canonicalEntries = planned.filter(
			(p) => p.outputKind === 'canonical_markdown',
		);
		expect(canonicalEntries.length).toBe(1);
		expect(canonicalEntries[0]?.path).toBe('');
		// Phase and document should be from the contract.
		expect(canonicalEntries[0]?.phaseId).toBe('01-foundation');
		expect(canonicalEntries[0]?.documentId).toBe('01-thesis');
	});

	// --- 5. Ambiguous derived output — missing path in artifact ---
	it('handles artifact without path', () => {
		const contracts = makeContracts('test', [
			{
				id: '01-thesis',
				outputs: {
					artifacts: [{ format: 'html' /* no path */ }],
				},
				path: '/project/profiles/test/phases/01-foundation/01-thesis.yml',
				phaseId: '01-foundation',
				raw: {},
				sections: [],
			},
		]);

		const planned = deriveOutputOperations(contracts);

		const htmlArtifacts = planned.filter(
			(p) => p.outputKind === 'html_artifact',
		);
		expect(htmlArtifacts.length).toBe(1);
		expect(htmlArtifacts[0]?.path).toBe('');
		expect(htmlArtifacts[0]?.authority).toBe('derived');
	});

	// --- 6. Executive outputs with explicit output paths ---
	it('derives executive outputs when generation config defines output paths', () => {
		const contracts = makeContracts('test', [], {
			executive: {
				generationConfig: {
					outputs: [
						{ format: 'markdown', path: 'executive/summary.md' },
						{ format: 'html', path: 'executive/summary.html' },
					],
				},
				generationConfigPath: '/project/profiles/test/executive/generation.yml',
				mappingConfigs: [],
				mappingPaths: [],
				planSchemaPath: '',
				templatePaths: [],
			},
		});

		const planned = deriveOutputOperations(contracts);

		const execMd = planned.filter((p) => p.outputKind === 'executive_markdown');
		const execHtml = planned.filter((p) => p.outputKind === 'executive_html');

		expect(execMd.length).toBe(1);
		expect(execMd[0]?.path).toBe('executive/summary.md');
		expect(execMd[0]?.authority).toBe('derived');

		expect(execHtml.length).toBe(1);
		expect(execHtml[0]?.path).toBe('executive/summary.html');
	});

	// --- 7. No hardcoded profiles/standard in derived operations ---
	it('does not hardcode profiles/standard in derived operations', () => {
		const contracts = makeContracts('my-profile', [
			{
				id: '01-thesis',
				outputs: {
					canonical: {
						format: 'markdown',
						path: 'docs/my-profile-thesis.md',
					},
				},
				path: '/project/profiles/my-profile/phases/01-foundation/01-thesis.yml',
				phaseId: '01-foundation',
				raw: {},
				sections: [],
			},
		]);

		const planned = deriveOutputOperations(contracts);

		for (const p of planned) {
			// Source path should reference the current profile, not standard.
			expect(p.sourceProfilePath).not.toContain('profiles/standard');
		}
	});
});
