/**
 * Tests for Step 16.2 — Markdown exporter.
 *
 * Covers:
 *  - Export ready document → file created with correct content.
 *  - Export incomplete document → blocked with reason.
 *  - Export stale document → blocked.
 *  - File collision → blocked.
 *  - Missing materialization rule → blocked.
 *  - Artifact metadata correctness.
 *
 * The tests use a real filesystem with `os.tmpdir()` so file I/O is
 * verified end-to-end.  After each test the output file is cleaned up.
 *
 * @see {@link https://logos-engine/docs/07-document-materialization-spec.md}
 * @see {@link https://logos-engine/docs/13-prototypes.md §4.8}
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type {
	DocumentMaterializationRule,
	LogosProfile,
	LogosRuntimeState,
	NodeRuntimeState,
} from '../../src/contracts/index.js';
import { exportMarkdown } from '../../src/outputs/index.js';
import type { ExportError } from '../../src/outputs/index.js';
import type { DocumentId, NodeId, ProfileId } from '../../src/shared/index.js';
import { nowIso } from '../../src/shared/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Test helpers
// ═══════════════════════════════════════════════════════════════════════════

let tempDir: string;
let outputPath: string;

beforeEach(() => {
	tempDir = mkdtempSync(join(tmpdir(), 'logos-export-test-'));
	outputPath = join(tempDir, 'test-doc.md');
});

afterEach(() => {
	try {
		rmSync(tempDir, { force: true, recursive: true });
	} catch {
		// Best effort cleanup.
	}
});

// ─── Node state factories (reusing proven patterns from materializer tests) ─

function acceptedNodeState(
	nodeId: NodeId,
	content?: string,
): NodeRuntimeState {
	return {
		allowedActions: ['continue_next', 'reopen', 'open_document_preview'],
		canonicalAnswer: {
			accepted: true,
			acceptedAt: nowIso(),
			confidence: 'high',
			content: content ?? `Canonical answer for ${nodeId}.`,
			format: 'markdown',
			generatedAt: nowIso(),
			generatedFromMessageIds: ['msg-1', 'msg-2'],
			stale: false,
		},
		completeness: {
			blockingIssues: [],
			complete: true,
			coverage: {},
			missing: [],
			weak: [],
		},
		conversation: [],
		dependencies: { blockedBy: [], requiredNodeIds: [], unlocks: [] },
		extracted: {
			assumptions: [],
			decisions: [],
			facts: [],
			openQuestions: [],
			risks: [],
		},
		lifecycle: 'accepted',
		nodeId,
		promptState: 'accepted',
		updatedAt: nowIso(),
	};
}

function staleNodeState(
	nodeId: NodeId,
	content?: string,
): NodeRuntimeState {
	const base = acceptedNodeState(nodeId, content);
	return {
		...base,
		canonicalAnswer: {
			...base.canonicalAnswer!,
			stale: true,
		},
	};
}

function activeNodeState(nodeId: NodeId): NodeRuntimeState {
	return {
		allowedActions: ['answer', 'defer'],
		canonicalAnswer: null,
		completeness: {
			blockingIssues: [],
			complete: false,
			coverage: {},
			missing: [],
			weak: [],
		},
		conversation: [],
		dependencies: { blockedBy: [], requiredNodeIds: [], unlocks: [] },
		extracted: {
			assumptions: [],
			decisions: [],
			facts: [],
			openQuestions: [],
			risks: [],
		},
		lifecycle: 'active',
		nodeId,
		promptState: 'follow_up',
		updatedAt: nowIso(),
	};
}

// ─── Profile / state factories ─────────────────────────────────────────────

function testRule(
	documentId: DocumentId,
	opts?: { outputPath?: string },
): DocumentMaterializationRule {
	return {
		documentId,
		optionalNodeIds: [],
		outputPath: opts?.outputPath ?? outputPath,
		requiredNodeIds: ['node-a' as NodeId],
		sections: [
			{
				id: 'section-1',
				required: true,
				sourceNodeIds: ['node-a' as NodeId],
				title: 'Section One',
			},
		],
		sourceNodeIds: ['node-a' as NodeId],
		title: 'Test Document',
	};
}

function testProfile(
	rule?: DocumentMaterializationRule,
): LogosProfile {
	const effectiveRule = rule ?? testRule('test-doc' as DocumentId);
	return {
		description: 'Test profile',
		documents: [
			{
				id: 'test-doc' as DocumentId,
				optionalNodeIds: [],
				order: 1,
				outputPath: effectiveRule.outputPath,
				phaseId: 'phase-1',
				purpose: 'Testing',
				requiredNodeIds: ['node-a' as NodeId],
				title: 'Test Document',
			},
		],
		id: 'test-profile' as ProfileId,
		materializationRules: [effectiveRule],
		nodes: [
			{
				canonicalQuestion: 'Question A?',
				coverageTopics: ['Topic A'],
				documentId: 'test-doc' as DocumentId,
				id: 'node-a' as NodeId,
				order: 1,
				phaseId: 'phase-1',
				promptRefs: {},
				sufficiencyCriteria: ['Clear answer'],
				title: 'Node A',
			},
		],
		phases: [
			{ id: 'phase-1', order: 1, purpose: 'Test', title: 'Phase 1' },
		],
		title: 'Test Profile',
		version: '1.0.0',
	};
}

function stateWithNodes(
	nodes: NodeRuntimeState[],
): LogosRuntimeState {
	const nodeStates: Record<NodeId, NodeRuntimeState> = {};
	for (const n of nodes) {
		nodeStates[n.nodeId] = n;
	}

	return {
		activeNodeId: null,
		documentStates: {},
		exportState: { artifacts: [] },
		globalContext: {
			preferences: {},
			projectName: null,
			summary: null,
		},
		lastActiveNodeId: null,
		mode: 'structure_overview',
		nodeStates,
		selectedProfileId: 'test-profile' as ProfileId,
		sessionId: 'test-session',
		updatedAt: nowIso(),
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('exportMarkdown', () => {
	// ── AC: Ready document → file created with content ──────────────

	it('exports a ready document to a Markdown file', async () => {
		const profile = testProfile();
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, '## The Answer\n\nThis is the content.'),
		]);

		const result = await exportMarkdown(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected success');

		const artifact = result.value;
		expect(artifact.type).toBe('markdown');
		expect(artifact.path).toBe(outputPath);
		expect(artifact.sessionId).toBe('test-session');
		expect(artifact.sourceDocumentIds).toEqual(['test-doc']);
		expect(artifact.sourceNodeIds).toEqual(['node-a']);
		expect(artifact.stale).toBe(false);
		expect(artifact.id).toBeTruthy();

		// Verify file was written.
		const fileContent = readFileSync(outputPath, 'utf-8');
		expect(fileContent).toContain('# Test Document');
		expect(fileContent).toContain('## Section One');
		expect(fileContent).toContain('The Answer');
		expect(fileContent).toContain('This is the content.');
	});

	// ── AC: Incomplete document → blocked ──────────────────────────

	it('blocks export for an incomplete document (missing required node)', async () => {
		const profile = testProfile();
		// node-a is not accepted (active, no canonical answer).
		const state = stateWithNodes([activeNodeState('node-a' as NodeId)]);

		const result = await exportMarkdown(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected failure');

		const error: ExportError = result.error;
		expect(error.code).toBe('DOCUMENT_NOT_READY');
		expect(error.documentId).toBe('test-doc');
		expect(error.message).toContain('test-doc');
	});

	// ── AC: Stale document → blocked ──────────────────────────────

	it('blocks export for a stale document', async () => {
		const profile = testProfile();
		const state = stateWithNodes([
			staleNodeState('node-a' as NodeId, 'Stale content.'),
		]);

		const result = await exportMarkdown(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected failure');

		const error: ExportError = result.error;
		expect(error.code).toBe('DOCUMENT_STALE');
		expect(error.message).toContain('stale');
	});

	// ── AC: File collision → blocked ──────────────────────────────

	it('blocks export when the output file already exists', async () => {
		// Pre-create the output file.
		const { writeFileSync } = await import('node:fs');
		writeFileSync(outputPath, 'existing content', 'utf-8');

		const profile = testProfile();
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, 'Content.'),
		]);

		const result = await exportMarkdown(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected failure');

		const error: ExportError = result.error;
		expect(error.code).toBe('FILE_COLLISION');
		expect(error.message).toContain(outputPath);

		// Verify original file was NOT overwritten.
		const fileContent = readFileSync(outputPath, 'utf-8');
		expect(fileContent).toBe('existing content');
	});

	// ── AC: Missing materialization rule → blocked ────────────────

	it('blocks export when no materialization rule exists', async () => {
		// Profile with no rules and a document that has no matching rule.
		const profile: LogosProfile = {
			...testProfile(),
			materializationRules: [],
		};
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, 'Content.'),
		]);

		const result = await exportMarkdown(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected failure');

		const error: ExportError = result.error;
		expect(error.code).toBe('RULE_NOT_FOUND');
	});

	// ── Edge: Non-existent document ID → blocked ──────────────────

	it('blocks export for a non-existent document ID', async () => {
		const profile = testProfile();
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, 'Content.'),
		]);

		const result = await exportMarkdown(
			'no-such-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected failure');

		const error: ExportError = result.error;
		expect(error.code).toBe('RULE_NOT_FOUND');
	});

	// ── Edge: Materialized draft has missing sections → blocked ───

	it('blocks export when the materialized draft has missing sections', async () => {
		// Create a rule that requires two nodes but only one is accepted.
		const rule = testRule('test-doc' as DocumentId);
		const profile = testProfile({
			...rule,
			requiredNodeIds: ['node-a' as NodeId, 'node-b' as NodeId],
			sections: [
				{
					id: 'section-1',
					required: true,
					sourceNodeIds: ['node-a' as NodeId],
					title: 'Section One',
				},
				{
					id: 'section-2',
					required: true,
					sourceNodeIds: ['node-b' as NodeId],
					title: 'Section Two',
				},
			],
			sourceNodeIds: ['node-a' as NodeId, 'node-b' as NodeId],
		});

		// Only node-a is accepted; node-b is active (not accepted).
		// readiness is "partially_ready" — should catch at the readiness gate.
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, 'Content A.'),
			activeNodeState('node-b' as NodeId),
		]);

		const result = await exportMarkdown(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected failure');

		const error: ExportError = result.error;
		expect(error.code).toBe('DOCUMENT_INCOMPLETE');
	});

	// ── Edge: File path without .md extension gets .md appended ───

	it('appends .md extension to output path when missing', async () => {
		const noExtPath = join(tempDir, 'no-ext-output');
		const rule = testRule('test-doc' as DocumentId, {
			outputPath: noExtPath,
		});
		const profile = testProfile(rule);
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, 'Content.'),
		]);

		const result = await exportMarkdown(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected success');

		expect(result.value.path).toBe(`${noExtPath}.md`);
		expect(readFileSync(`${noExtPath}.md`, 'utf-8')).toContain(
			'# Test Document',
		);
	});

	// ── AC: Export metadata stored in session ────────────────────

	it('returns artifact with complete metadata for session storage', async () => {
		const profile = testProfile();
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, '## Content\n\nAnswer body.'),
		]);

		const result = await exportMarkdown(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected success');

		const artifact = result.value;

		// Every field required by GeneratedArtifact must be present.
		expect(typeof artifact.id).toBe('string');
		expect(artifact.id.length).toBeGreaterThan(0);
		expect(artifact.sessionId).toBe(state.sessionId);
		expect(artifact.type).toBe('markdown');
		expect(artifact.path).toBe(outputPath);
		expect(artifact.sourceDocumentIds).toEqual([
			'test-doc' as DocumentId,
		]);
		expect(artifact.sourceNodeIds).toEqual(['node-a' as NodeId]);
		expect(artifact.stale).toBe(false);
		expect(artifact.generatedAt).toBeTruthy();

		// The generatedAt should be a valid ISO-8601 timestamp.
		expect(() => new Date(artifact.generatedAt)).not.toThrow();
		expect(new Date(artifact.generatedAt).getTime()).toBeGreaterThan(0);

		// The artifact id and generatedAt should differ across exports.
		const result2 = await exportMarkdown(
			'test-doc' as DocumentId,
			state,
			// Use a different output path so FILE_COLLISION is not triggered.
			testProfile(
				testRule('test-doc' as DocumentId, {
					outputPath: join(tempDir, 'test-doc-2.md'),
				}),
			),
		);
		expect(result2.ok).toBe(true);
		if (!result2.ok) throw new Error('Expected success');
		expect(result2.value.id).not.toBe(artifact.id);
	});
});
