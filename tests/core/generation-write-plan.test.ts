/**
 * Step 6.3 — Generation write plan tests.
 *
 * Tests:
 * 1. Write plan derives operations from active profile contracts.
 * 2. Write plan includes canonical Markdown operations when profile defines
 *    canonical outputs.
 * 3. Write plan includes derived artifact operations when profile defines
 *    artifacts.
 * 4. Operations have deterministic ids.
 * 5. Operations include output kind and authority.
 * 6. Dry-run write plan writes no files.
 * 7. Blocked preflight prevents ready-to-write final plan.
 * 8. Write plan returns blocked when preflight has blockers in final mode.
 * 9. Write plan operations are sorted deterministically.
 * 10. Missing canonical path produces blocked operation.
 */

import { describe, expect, it } from 'vitest';
import type {
	GenerationPreflightMode,
	GenerationPreflightResult,
} from '../../src/core/generation/preflight-result.js';
import { buildGenerationWritePlan } from '../../src/core/generation/write-plan.js';
import type { LoadedProfileContracts } from '../../src/core/profiles/profile-contracts.js';
import type { LogosQuestionRegistry } from '../../src/core/questions/question-registry.js';
import { createFakeFilesystem } from './helpers/fake-filesystem.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePreflightResult(
	overrides: Partial<GenerationPreflightResult> & {
		mode: GenerationPreflightMode;
		ready: boolean;
	},
): GenerationPreflightResult {
	return {
		blockers: [],
		canGeneratePartialDraft: true,
		checkedAt: '2026-05-22T00:00:00.000Z',
		completenessScore: 1,
		contradictions: [],
		missingCriticalQuestions: [],
		mode: overrides.mode,
		optionalMissingQuestions: [],
		optionalSkippedQuestions: [],
		partialCriticalQuestions: [],
		ready: overrides.ready,
		requiredSkippedQuestions: [],
		requiresExplicitConfirmation: false,
		status: overrides.ready ? 'ready' : 'blocked',
		warnings: [],
		...overrides,
	};
}

function makeEmptyRegistry(): LogosQuestionRegistry {
	return { profileId: 'test', questions: [], warnings: [] };
}

function makeMinimalContracts(
	overrides: Partial<LoadedProfileContracts>,
): LoadedProfileContracts {
	return {
		artifacts: { artifacts: [] },
		documentSchema: { raw: {} },
		documents: [],
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
		profileId: 'test',
		profileRoot: '',
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

describe('buildGenerationWritePlan', () => {
	// --- 1. Blocked preflight prevents ready-to-write final plan ---
	it('returns blocked plan when preflight is not ready and mode is final', async () => {
		const fs = createFakeFilesystem();
		const preflight = makePreflightResult({
			blockers: [
				{
					code: 'missing_critical_questions',
					message: 'Critical questions missing.',
				},
			],
			mode: 'final',
			ready: false,
		});
		const contracts = makeMinimalContracts({});

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
		expect(
			result.writePlan.blockers.some(
				(b) => b.code === 'write_plan_blocked_by_preflight',
			),
		).toBe(true);
		expect(result.writePlan.mode).toBe('final');
	});

	// --- 2. Write plan derives operations from active profile contracts ---
	it('derives canonical Markdown operation from document outputs', async () => {
		const fs = createFakeFilesystem();
		const preflight = makePreflightResult({ mode: 'final', ready: true });
		const contracts = makeMinimalContracts({
			documents: [
				{
					id: '01-thesis',
					outputs: {
						canonical: {
							format: 'markdown',
							path: 'docs/01-foundation/01-thesis.md',
						},
					},
					path: '/profiles/standard/phases/01-foundation/01-thesis.yml',
					phaseId: '01-foundation',
					raw: {},
					sections: [],
				},
			],
		});

		const result = await buildGenerationWritePlan({
			filesystem: fs,
			mode: 'final',
			now: NOW,
			preflight,
			profileContracts: contracts,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		expect(result.writePlan.operations.length).toBeGreaterThanOrEqual(1);

		const canonicalOp = result.writePlan.operations.find(
			(op) => op.outputKind === 'canonical_markdown',
		);
		expect(canonicalOp).toBeDefined();
		expect(canonicalOp?.authority).toBe('canonical');
		expect(canonicalOp?.kind).toBe('create');
		expect(canonicalOp?.relativePath).toBe('docs/01-foundation/01-thesis.md');
	});

	// --- 3. Operations have deterministic ids ---
	it('produces deterministic operation ids', async () => {
		const fs = createFakeFilesystem();
		const preflight = makePreflightResult({ mode: 'final', ready: true });
		const doc = {
			id: '01-thesis',
			outputs: {
				canonical: {
					format: 'markdown',
					path: 'docs/01-foundation/01-thesis.md',
				},
			},
			path: '/profiles/standard/phases/01-foundation/01-thesis.yml',
			phaseId: '01-foundation',
			raw: {},
			sections: [],
		};
		const contracts = makeMinimalContracts({ documents: [doc] });

		const result1 = await buildGenerationWritePlan({
			filesystem: fs,
			mode: 'final',
			now: NOW,
			preflight,
			profileContracts: contracts,
			projectRoot: '/project',
		});

		const result2 = await buildGenerationWritePlan({
			filesystem: fs,
			mode: 'final',
			now: NOW,
			preflight,
			profileContracts: contracts,
			projectRoot: '/project',
		});

		expect(result1.ok).toBe(true);
		expect(result2.ok).toBe(true);
		expect(result1.writePlan.operations.length).toBe(
			result2.writePlan.operations.length,
		);
		for (let i = 0; i < result1.writePlan.operations.length; i++) {
			expect(result1.writePlan.operations[i]?.id).toBe(
				result2.writePlan.operations[i]?.id,
			);
		}
	});

	// --- 4. Operations include output kind and authority ---
	it('every operation includes outputKind and authority', async () => {
		const fs = createFakeFilesystem();
		const preflight = makePreflightResult({ mode: 'final', ready: true });
		const contracts = makeMinimalContracts({
			documents: [
				{
					id: '01-thesis',
					outputs: {
						canonical: {
							format: 'markdown',
							path: 'docs/01-foundation/01-thesis.md',
						},
					},
					path: '/profiles/standard/phases/01-foundation/01-thesis.yml',
					phaseId: '01-foundation',
					raw: {},
					sections: [],
				},
			],
		});

		const result = await buildGenerationWritePlan({
			filesystem: fs,
			mode: 'final',
			now: NOW,
			preflight,
			profileContracts: contracts,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		for (const op of result.writePlan.operations) {
			expect(op.outputKind).toBeTruthy();
			expect(op.authority).toBeTruthy();
			expect(op.id).toBeTruthy();
			expect(op.relativePath).toBeDefined();
		}
	});

	// --- 5. Dry-run write plan writes no files ---
	it('dry-run mode writes no files', async () => {
		const fs = createFakeFilesystem();
		const preflight = makePreflightResult({ mode: 'dry_run', ready: true });
		const contracts = makeMinimalContracts({
			documents: [
				{
					id: '01-thesis',
					outputs: {
						canonical: {
							format: 'markdown',
							path: 'docs/01-foundation/01-thesis.md',
						},
					},
					path: '/profiles/standard/phases/01-foundation/01-thesis.yml',
					phaseId: '01-foundation',
					raw: {},
					sections: [],
				},
			],
		});

		const result = await buildGenerationWritePlan({
			filesystem: fs,
			mode: 'dry_run',
			now: NOW,
			preflight,
			profileContracts: contracts,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		expect(result.writePlan.dryRun).toBe(true);
		// The file should not have been written.
		expect(
			await fs.fileExists({ path: '/project/docs/01-foundation/01-thesis.md' }),
		).toBe(false);
	});

	// --- 6. Missing canonical path produces blocked operation ---
	it('blocks canonical write plan when canonical output path is empty', async () => {
		const fs = createFakeFilesystem();
		const preflight = makePreflightResult({ mode: 'final', ready: true });
		const contracts = makeMinimalContracts({
			documents: [
				{
					id: '01-thesis',
					outputs: {
						canonical: {
							format: 'markdown',
							// Missing path.
						},
					},
					path: '/profiles/standard/phases/01-foundation/01-thesis.yml',
					phaseId: '01-foundation',
					raw: {},
					sections: [],
				},
			],
		});

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
		expect(result.writePlan.blockers.length).toBeGreaterThanOrEqual(1);
		const blockedOp = result.writePlan.operations.find(
			(op) => op.kind === 'blocked',
		);
		expect(blockedOp).toBeDefined();
		expect(blockedOp?.outputKind).toBe('canonical_markdown');
	});

	// --- 7. Derived artifact operations when profile defines artifacts ---
	it('includes artifact operations when profile defines artifacts', async () => {
		const fs = createFakeFilesystem();
		const preflight = makePreflightResult({ mode: 'final', ready: true });
		const contracts = makeMinimalContracts({
			documents: [
				{
					id: '01-thesis',
					outputs: {
						artifacts: [
							{
								format: 'html',
								id: 'artifact.html',
								path: 'outcomes/html/01-foundation/01-thesis.html',
							},
						],
						canonical: {
							format: 'markdown',
							path: 'docs/01-foundation/01-thesis.md',
						},
					},
					path: '/profiles/standard/phases/01-foundation/01-thesis.yml',
					phaseId: '01-foundation',
					raw: {},
					sections: [],
				},
			],
		});

		const result = await buildGenerationWritePlan({
			filesystem: fs,
			mode: 'final',
			now: NOW,
			preflight,
			profileContracts: contracts,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		const artifactOps = result.writePlan.operations.filter(
			(op) => op.outputKind === 'html_artifact',
		);
		expect(artifactOps.length).toBe(1);
		expect(artifactOps[0]?.authority).toBe('derived');
	});

	// --- 8. Overwrite existing file risk detection ---
	it('detects overwrite risk when output file already exists', async () => {
		const fs = createFakeFilesystem();
		fs.addFile('/project/docs/01-foundation/01-thesis.md', '# Old content');

		const preflight = makePreflightResult({ mode: 'final', ready: true });
		const contracts = makeMinimalContracts({
			documents: [
				{
					id: '01-thesis',
					outputs: {
						canonical: {
							format: 'markdown',
							path: 'docs/01-foundation/01-thesis.md',
						},
					},
					path: '/profiles/standard/phases/01-foundation/01-thesis.yml',
					phaseId: '01-foundation',
					raw: {},
					sections: [],
				},
			],
		});

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
		expect(canonicalOp?.kind).toBe('update');
		expect(
			canonicalOp?.risks.some((r) => r.code === 'overwrite_existing_file'),
		).toBe(true);
	});

	// --- 9. Manual edit risk detection for existing manual file ---
	it('detects manual edit risk for existing file without LOGOS marker', async () => {
		const fs = createFakeFilesystem();
		fs.addFile(
			'/project/docs/01-foundation/01-thesis.md',
			'# Hand-written thesis document',
		);

		const preflight = makePreflightResult({ mode: 'final', ready: true });
		const contracts = makeMinimalContracts({
			documents: [
				{
					id: '01-thesis',
					outputs: {
						canonical: {
							format: 'markdown',
							path: 'docs/01-foundation/01-thesis.md',
						},
					},
					path: '/profiles/standard/phases/01-foundation/01-thesis.yml',
					phaseId: '01-foundation',
					raw: {},
					sections: [],
				},
			],
		});

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
		expect(
			canonicalOp?.risks.some((r) => r.code === 'manual_edit_detected'),
		).toBe(true);
	});

	// --- 10. No manual edit risk for existing LOGOS-generated file ---
	it('skips manual edit risk for existing LOGOS-generated file', async () => {
		const fs = createFakeFilesystem();
		fs.addFile(
			'/project/docs/01-foundation/01-thesis.md',
			'<!-- generated-by: logos-engine -->\n# Generated thesis',
		);

		const preflight = makePreflightResult({ mode: 'final', ready: true });
		const contracts = makeMinimalContracts({
			documents: [
				{
					id: '01-thesis',
					outputs: {
						canonical: {
							format: 'markdown',
							path: 'docs/01-foundation/01-thesis.md',
						},
					},
					path: '/profiles/standard/phases/01-foundation/01-thesis.yml',
					phaseId: '01-foundation',
					raw: {},
					sections: [],
				},
			],
		});

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
		expect(
			canonicalOp?.risks.some((r) => r.code === 'manual_edit_detected'),
		).toBe(false);
	});

	// --- 11. Partial draft mode works with preflight that allows it ---
	it('builds plan in partial_draft mode when preflight allows it', async () => {
		const fs = createFakeFilesystem();
		const preflight = makePreflightResult({
			blockers: [
				{
					code: 'missing_critical_questions',
					message: 'Critical questions missing.',
				},
			],
			canGeneratePartialDraft: true,
			mode: 'partial_draft',
			ready: false,
		});
		const contracts = makeMinimalContracts({
			documents: [
				{
					id: '01-thesis',
					outputs: {
						canonical: {
							format: 'markdown',
							path: 'docs/01-foundation/01-thesis.md',
						},
					},
					path: '/profiles/standard/phases/01-foundation/01-thesis.yml',
					phaseId: '01-foundation',
					raw: {},
					sections: [],
				},
			],
		});

		const result = await buildGenerationWritePlan({
			filesystem: fs,
			mode: 'partial_draft',
			now: NOW,
			preflight,
			profileContracts: contracts,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		expect(result.writePlan.mode).toBe('partial_draft');
		expect(result.writePlan.operations.length).toBeGreaterThanOrEqual(1);
	});

	// --- 12. partial_draft blocked when canGeneratePartialDraft is false ---
	it('blocks partial_draft when preflight.canGeneratePartialDraft is false', async () => {
		const fs = createFakeFilesystem();
		const preflight = makePreflightResult({
			canGeneratePartialDraft: false,
			mode: 'partial_draft',
			ready: false,
		});
		const contracts = makeMinimalContracts({});

		const result = await buildGenerationWritePlan({
			filesystem: fs,
			mode: 'partial_draft',
			now: NOW,
			preflight,
			profileContracts: contracts,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		expect(result.writePlan.readyToWrite).toBe(false);
		expect(
			result.writePlan.blockers.some(
				(b) => b.code === 'write_plan_blocked_by_preflight',
			),
		).toBe(true);
		expect(result.writePlan.operations.length).toBe(0);
	});
});
