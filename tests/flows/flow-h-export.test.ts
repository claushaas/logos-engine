/**
 * Flow H — Export Outcomes
 *
 * Validates export and outcome generation:
 *   1. Export Markdown for a ready document.
 *   2. Export is blocked for incomplete/stale documents.
 *
 * Tests use temporary directories for output files — no repository
 * filesystem pollution.  No LLM credentials required.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §4.8}
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { openDocumentPreviewUseCase } from '../../src/application/use-cases/open-document-preview.js';
import type {
	CanonicalAnswer,
	DocumentMaterializationRule,
	LogosProfile,
	LogosRuntimeState,
	NodeRuntimeState,
} from '../../src/contracts/index.js';
import { exportMarkdown } from '../../src/outputs/markdown-exporter.js';
import type { DocumentId, NodeId, ProfileId } from '../../src/shared/index.js';
import { nowIso } from '../../src/shared/index.js';
import { dispatch } from '../../src/state-engine/dispatch.js';
import { recomputeAllDocumentReadiness } from '../../src/state-engine/document-readiness.js';
import { createSession } from '../../src/state-engine/state-engine.js';

// ═══════════════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a single-node profile with a materialization rule for export testing.
 *
 * @param outputPath - The output path for the materialization rule
 *   (typically a path inside a temporary directory).
 */
function createExportProfile(outputPath: string): LogosProfile {
	return {
		description: 'Export test profile — single node.',
		documents: [
			{
				id: 'doc-thesis' as DocumentId,
				optionalNodeIds: [],
				order: 1,
				outputPath,
				phaseId: 'phase-foundation',
				purpose: 'Testing',
				requiredNodeIds: ['node-thesis' as NodeId],
				title: 'Thesis Document',
			},
		],
		id: 'export-profile' as ProfileId,
		materializationRules: [
			{
				documentId: 'doc-thesis' as DocumentId,
				outputPath,
				requiredNodeIds: ['node-thesis' as NodeId],
				sections: [
					{
						required: true,
						sectionId: 's-thesis',
						sourceNodeIds: ['node-thesis' as NodeId],
						title: 'Core Thesis',
					},
				],
				sourceNodeIds: ['node-thesis' as NodeId],
				title: 'Thesis Document',
			} as DocumentMaterializationRule,
		],
		nodes: [
			{
				canonicalQuestion: 'What conviction makes this project necessary?',
				coverageTopics: ['thesis'],
				dependencies: { recommendedNodeIds: [], requiredNodeIds: [] },
				documentId: 'doc-thesis' as DocumentId,
				id: 'node-thesis' as NodeId,
				order: 1,
				phaseId: 'phase-foundation',
				promptRefs: {},
				sufficiencyCriteria: [],
				title: 'Core Thesis',
			},
		],
		phases: [
			{
				id: 'phase-foundation',
				order: 1,
				purpose: 'Foundation',
				title: 'Foundation',
			},
		],
		title: 'Export Test Profile',
		version: '1.0.0',
	};
}

function makeAcceptedAnswer(content: string): CanonicalAnswer {
	return {
		accepted: true,
		confidence: 'high',
		content,
		format: 'markdown',
		generatedAt: nowIso(),
		generatedFromMessageIds: [],
		stale: false,
	};
}

function patchNodeState(
	state: LogosRuntimeState,
	nodeId: NodeId,
	overrides: Partial<NodeRuntimeState>,
): LogosRuntimeState {
	const existing = state.nodeStates[nodeId];
	if (!existing) throw new Error(`Node "${nodeId}" not found in state`);

	const updated: NodeRuntimeState = {
		...existing,
		...overrides,
		updatedAt: nowIso(),
	};

	return {
		...state,
		nodeStates: {
			...state.nodeStates,
			[nodeId]: updated,
		},
		updatedAt: nowIso(),
	};
}

/**
 * Build a state with the node accepted and non-stale.
 */
function buildReadyState(profile: LogosProfile): LogosRuntimeState {
	const state = createSession();

	const r0 = dispatch(
		state,
		{ profileId: profile.id, type: 'SELECT_PROFILE' },
		profile,
	);
	expect(r0.ok).toBe(true);
	let s = r0.state!;

	const r1 = dispatch(
		s,
		{ nodeId: 'node-thesis' as NodeId, type: 'SELECT_NODE' },
		profile,
	);
	expect(r1.ok).toBe(true);
	s = r1.state!;

	s = patchNodeState(s, 'node-thesis' as NodeId, {
		canonicalAnswer: makeAcceptedAnswer(
			'The hiring industry evaluates credentials over competence. This project redefines evaluation to be skill-based.',
		),
		lifecycle: 'accepted',
		promptState: 'accepted',
	});

	// Recompute document readiness
	return recomputeAllDocumentReadiness(s, profile);
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Flow H — Export Outcomes', () => {
	const documentId = 'doc-thesis' as DocumentId;

	it('exports Markdown for a ready document', async () => {
		const tempDir = await mkdtemp(join(tmpdir(), 'logos-flow-h-ready-'));
		try {
			const outputPath = join(tempDir, 'thesis.md');
			const profile = createExportProfile(outputPath);
			const state = buildReadyState(profile);

			// Verify document is ready
			expect(state.documentStates[documentId]).toBeDefined();

			// ── Export Markdown ────────────────────────────────────
			const result = await exportMarkdown(documentId, state, profile);

			expect(result.ok).toBe(true);
			if (!result.ok) throw new Error(`Export failed: ${result.error.message}`);

			const artifact = result.value;

			// Generated artifact should have correct type and metadata
			expect(artifact.type).toBe('markdown');
			expect(artifact.path).toBeDefined();
			expect(artifact.generatedAt).toBeDefined();
			expect(artifact.sourceDocumentIds).toContain(documentId);
			expect(artifact.path).toBe(outputPath);
		} finally {
			await rm(tempDir, { force: true, recursive: true });
		}
	});

	it('blocks export for stale document', async () => {
		const tempDir = await mkdtemp(join(tmpdir(), 'logos-flow-h-stale-'));
		try {
			const outputPath = join(tempDir, 'thesis.md');
			const profile = createExportProfile(outputPath);
			let state = buildReadyState(profile);

			// Make the canonical answer stale
			state = patchNodeState(state, 'node-thesis' as NodeId, {
				canonicalAnswer: {
					...makeAcceptedAnswer(
						'The hiring industry evaluates credentials over competence. This project redefines evaluation to be skill-based.',
					),
					stale: true,
				},
			});

			// Recompute: the document should now be stale
			state = recomputeAllDocumentReadiness(state, profile);

			// Export should fail
			const result = await exportMarkdown(documentId, state, profile);
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe('DOCUMENT_STALE');
			}
		} finally {
			await rm(tempDir, { force: true, recursive: true });
		}
	});

	it('blocks export when no materialization rule exists', async () => {
		const tempDir = await mkdtemp(join(tmpdir(), 'logos-flow-h-no-rule-'));
		try {
			const outputPath = join(tempDir, 'thesis.md');
			const profile = createExportProfile(outputPath);
			const state = buildReadyState(profile);

			// Export a document that has no rule
			const result = await exportMarkdown(
				'non-existent-doc' as DocumentId,
				state,
				profile,
			);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe('RULE_NOT_FOUND');
			}
		} finally {
			await rm(tempDir, { force: true, recursive: true });
		}
	});

	it('blocks export for incomplete document (not all nodes accepted)', async () => {
		const tempDir = await mkdtemp(join(tmpdir(), 'logos-flow-h-incomplete-'));
		try {
			const outputPath = join(tempDir, 'thesis.md');
			const profile = createExportProfile(outputPath);
			const state = createSession();

			// Select profile but don't accept any nodes
			const r0 = dispatch(
				state,
				{ profileId: profile.id, type: 'SELECT_PROFILE' },
				profile,
			);
			expect(r0.ok).toBe(true);
			let s = r0.state!;

			// Recompute readiness — document should be not_ready
			s = recomputeAllDocumentReadiness(s, profile);

			const result = await exportMarkdown(documentId, s, profile);
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(
					result.error.code === 'DOCUMENT_INCOMPLETE' ||
						result.error.code === 'DOCUMENT_NOT_READY',
				).toBe(true);
			}
		} finally {
			await rm(tempDir, { force: true, recursive: true });
		}
	});

	it('document preview shows export eligibility consistent with export', async () => {
		const tempDir = await mkdtemp(join(tmpdir(), 'logos-flow-h-preview-'));
		try {
			const outputPath = join(tempDir, 'thesis.md');
			const profile = createExportProfile(outputPath);
			const state = buildReadyState(profile);

			// Document preview should show export as eligible
			const previewResult = openDocumentPreviewUseCase(state, {
				profile,
			});
			expect(previewResult.ok).toBe(true);

			if (
				previewResult.ok &&
				previewResult.snapshot.mainPanel.kind === 'document_preview'
			) {
				expect(previewResult.snapshot.mainPanel.exportEligible).toBe(true);
			}
		} finally {
			await rm(tempDir, { force: true, recursive: true });
		}
	});
});
