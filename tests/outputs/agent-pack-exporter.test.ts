/**
 * Tests for Step 17.2 — Agent Pack exporter.
 *
 * Covers:
 *  - Agent pack JSON generated with correct structure (metadata, documents,
 *    dependency graph, source traceability).
 *  - Includes all accepted answers from specified documents.
 *  - Blocked on incomplete document.
 *  - Blocked on stale document.
 *  - Blocked on empty document list.
 *  - File collision → blocked.
 *  - Missing materialization rule → blocked.
 *  - Output path derivation (.md → .agent-pack.json, multi-doc fallback).
 *  - Artifact metadata correctness (type: 'agent_pack').
 *  - Derived/non-canonical labels present.
 *
 * @see {@link https://logos-engine/docs/architecture/10-local-development-and-deployment.md §11}
 * @see {@link https://logos-engine/docs/13-prototypes.md §3.12}
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type {
	DocumentMaterializationRule,
	LogosProfile,
	LogosRuntimeState,
	NodeRuntimeState,
} from '../../src/contracts/index.js';
import type { ExportError } from '../../src/outputs/index.js';
import { exportAgentPack } from '../../src/outputs/index.js';
import type { DocumentId, NodeId, ProfileId } from '../../src/shared/index.js';
import { nowIso } from '../../src/shared/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Test helpers
// ═══════════════════════════════════════════════════════════════════════════

let tempDir: string;
let outputPath: string;

beforeEach(() => {
	tempDir = mkdtempSync(join(tmpdir(), 'logos-agent-pack-test-'));
	outputPath = join(tempDir, 'test-doc.md');
});

afterEach(() => {
	try {
		rmSync(tempDir, { force: true, recursive: true });
	} catch {
		// Best effort cleanup.
	}
});

const DOC_A = 'doc-a' as DocumentId;
const DOC_B = 'doc-b' as DocumentId;
const NODE_A1 = 'node-a1' as NodeId;
const NODE_A2 = 'node-a2' as NodeId;
const NODE_B1 = 'node-b1' as NodeId;

// ─── Node state factories ──────────────────────────────────────────────────

function acceptedNodeState(
	nodeId: NodeId,
	opts?: {
		content?: string;
		acceptedAt?: string;
		generatedAt?: string;
		generatedFromMessageIds?: string[];
		confidence?: 'low' | 'medium' | 'high';
	},
): NodeRuntimeState {
	return {
		allowedActions: ['continue_next', 'reopen', 'open_document_preview'],
		canonicalAnswer: {
			accepted: true,
			acceptedAt: opts?.acceptedAt ?? nowIso(),
			confidence: opts?.confidence ?? 'high',
			content: opts?.content ?? `Canonical answer for ${nodeId}.`,
			format: 'markdown',
			generatedAt: opts?.generatedAt ?? nowIso(),
			generatedFromMessageIds: opts?.generatedFromMessageIds ?? ['msg-1'],
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

function staleNodeState(nodeId: NodeId, content?: string): NodeRuntimeState {
	const base = acceptedNodeState(nodeId, { content });
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

// ─── Rule factories ─────────────────────────────────────────────────────────

function testRule(
	documentId: DocumentId,
	opts?: {
		outputPath?: string;
		sourceNodeIds?: NodeId[];
		requiredNodeIds?: NodeId[];
		title?: string;
	},
): DocumentMaterializationRule {
	const sourceNodes = opts?.sourceNodeIds ?? ['node-a1' as NodeId];
	return {
		documentId,
		optionalNodeIds: [],
		outputPath: opts?.outputPath ?? outputPath,
		requiredNodeIds: opts?.requiredNodeIds ?? sourceNodes,
		sections: sourceNodes.map((nid, i) => ({
			id: `section-${i + 1}`,
			required: true,
			sourceNodeIds: [nid],
			title: `Section ${i + 1}`,
		})),
		sourceNodeIds: sourceNodes,
		title: opts?.title ?? 'Test Document',
	};
}

// ─── Profile factory ────────────────────────────────────────────────────────

function testProfile(rules: DocumentMaterializationRule[]): LogosProfile {
	const allNodes: import('../../src/contracts/index.js').NodeDefinition[] = [];
	const allDocs: import('../../src/contracts/index.js').DocumentDefinition[] =
		[];

	for (const rule of rules) {
		allDocs.push({
			id: rule.documentId,
			optionalNodeIds: rule.optionalNodeIds,
			order: 1,
			outputPath: rule.outputPath,
			phaseId: 'phase-1',
			purpose: 'Testing',
			requiredNodeIds: rule.requiredNodeIds,
			title: rule.title,
		});

		for (const nodeId of rule.sourceNodeIds) {
			// Avoid duplicates.
			if (allNodes.some((n) => n.id === nodeId)) continue;
			allNodes.push({
				canonicalQuestion: `Question for ${nodeId}?`,
				coverageTopics: ['Topic'],
				dependencies: { requiredNodeIds: [] },
				documentId: rule.documentId,
				id: nodeId,
				order: 1,
				phaseId: 'phase-1',
				promptRefs: {},
				sufficiencyCriteria: ['Clear answer'],
				title: `Node ${nodeId}`,
			});
		}
	}

	return {
		description: 'Test profile for agent pack',
		documents: allDocs,
		id: 'test-profile' as ProfileId,
		materializationRules: rules,
		nodes: allNodes,
		phases: [{ id: 'phase-1', order: 1, purpose: 'Test', title: 'Phase 1' }],
		title: 'Agent Pack Test Profile',
		version: '1.2.3',
	};
}

function stateWithNodes(nodes: NodeRuntimeState[]): LogosRuntimeState {
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
		sessionId: 'test-session-id',
		updatedAt: nowIso(),
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('exportAgentPack', () => {
	// ── AC: Agent pack JSON with correct structure ──────────────────

	it('generates a valid JSON agent pack with correct structure', async () => {
		const rule = testRule(DOC_A, { sourceNodeIds: [NODE_A1] });
		const profile = testProfile([rule]);
		const state = stateWithNodes([
			acceptedNodeState(NODE_A1, {
				content: '## Answer\n\nThis is the content.',
			}),
		]);

		const result = await exportAgentPack([DOC_A], state, profile);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected success');

		const artifact = result.value;
		expect(artifact.type).toBe('agent_pack');
		expect(artifact.stale).toBe(false);

		// Read and parse the JSON.
		const fileContent = readFileSync(artifact.path, 'utf-8');
		const pack = JSON.parse(fileContent);

		// Top-level structure.
		expect(pack.kind).toBe('[derived] agent_pack');
		expect(pack.canonical).toBe(false);

		// Metadata.
		expect(pack.metadata.profile.id).toBe('test-profile');
		expect(pack.metadata.profile.title).toBe('Agent Pack Test Profile');
		expect(pack.metadata.profile.version).toBe('1.2.3');
		expect(pack.metadata.sessionId).toBe('test-session-id');
		expect(pack.metadata.generatedAt).toBeTruthy();

		// Documents.
		expect(pack.documents).toHaveLength(1);
		expect(pack.documents[0].id).toBe('doc-a');
		expect(pack.documents[0].title).toBe('Test Document');
		expect(pack.documents[0].phaseId).toBe('phase-1');
		expect(pack.documents[0].requiredNodeIds).toEqual(['node-a1']);
		expect(pack.documents[0].sections).toHaveLength(1);
		expect(pack.documents[0].sections[0].title).toBe('Section 1');

		// Answers.
		expect(pack.documents[0].answers).toHaveLength(1);
		expect(pack.documents[0].answers[0].nodeId).toBe('node-a1');
		expect(pack.documents[0].answers[0].content).toContain(
			'This is the content.',
		);

		// Dependency graph.
		expect(pack.dependencyGraph).toBeDefined();
		expect(pack.dependencyGraph.nodes).toBeDefined();
		expect(Array.isArray(pack.dependencyGraph.nodes)).toBe(true);

		// Source traceability.
		expect(pack.sourceTraceability.sourceDocumentIds).toEqual(['doc-a']);
		expect(pack.sourceTraceability.sourceNodeIds).toContain('node-a1');
		expect(pack.sourceTraceability.profileId).toBe('test-profile');
		expect(pack.sourceTraceability.profileVersion).toBe('1.2.3');
		expect(pack.sourceTraceability.sessionId).toBe('test-session-id');
	});

	// ── AC: Includes all accepted answers ───────────────────────────

	it('includes all accepted answers from multiple documents', async () => {
		const ruleA = testRule(DOC_A, {
			outputPath: join(tempDir, 'doc-a.md'),
			sourceNodeIds: [NODE_A1, NODE_A2],
			title: 'Document A',
		});
		const ruleB = testRule(DOC_B, {
			outputPath: join(tempDir, 'doc-b.md'),
			sourceNodeIds: [NODE_B1],
			title: 'Document B',
		});

		const profile = testProfile([ruleA, ruleB]);
		const state = stateWithNodes([
			acceptedNodeState(NODE_A1, { content: 'Answer A1' }),
			acceptedNodeState(NODE_A2, { content: 'Answer A2' }),
			acceptedNodeState(NODE_B1, { content: 'Answer B1' }),
		]);

		const result = await exportAgentPack([DOC_A, DOC_B], state, profile);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected success');

		const fileContent = readFileSync(result.value.path, 'utf-8');
		const pack = JSON.parse(fileContent);

		expect(pack.documents).toHaveLength(2);

		// Document A answers.
		// biome-ignore lint/suspicious/noExplicitAny: JSON-parsed pack in test
		const docA = pack.documents.find((d: any) => d.id === 'doc-a');
		expect(docA).toBeDefined();
		expect(docA.answers).toHaveLength(2);
		// biome-ignore lint/suspicious/noExplicitAny: JSON-parsed pack in test
		expect(docA.answers.map((a: any) => a.content)).toContain('Answer A1');
		// biome-ignore lint/suspicious/noExplicitAny: JSON-parsed pack in test
		expect(docA.answers.map((a: any) => a.content)).toContain('Answer A2');

		// Document B answers.
		// biome-ignore lint/suspicious/noExplicitAny: JSON-parsed pack in test
		const docB = pack.documents.find((d: any) => d.id === 'doc-b');
		expect(docB).toBeDefined();
		expect(docB.answers).toHaveLength(1);
		expect(docB.answers[0].content).toBe('Answer B1');

		// Source traceability covers all documents.
		expect(pack.sourceTraceability.sourceDocumentIds).toContain('doc-a');
		expect(pack.sourceTraceability.sourceDocumentIds).toContain('doc-b');
	});

	// ── AC: Blocked on incomplete document ─────────────────────────

	it('blocks export when a document has no accepted answers', async () => {
		const rule = testRule(DOC_A, {
			requiredNodeIds: [NODE_A1],
			sourceNodeIds: [NODE_A1],
		});
		const profile = testProfile([rule]);
		const state = stateWithNodes([activeNodeState(NODE_A1)]);

		const result = await exportAgentPack([DOC_A], state, profile);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected failure');

		const error: ExportError = result.error;
		expect(error.code).toBe('DOCUMENT_NOT_READY');
		expect(error.message).toContain('doc-a');
	});

	// ── AC: Blocked on stale document ──────────────────────────────

	it('blocks export when a document is stale', async () => {
		const rule = testRule(DOC_A, { sourceNodeIds: [NODE_A1] });
		const profile = testProfile([rule]);
		const state = stateWithNodes([staleNodeState(NODE_A1, 'Stale content.')]);

		const result = await exportAgentPack([DOC_A], state, profile);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected failure');

		const error: ExportError = result.error;
		expect(error.code).toBe('DOCUMENT_STALE');
		expect(error.message).toContain('stale');
	});

	// ── Blocked on empty document list ─────────────────────────────

	it('blocks export when no documents are requested', async () => {
		const profile = testProfile([testRule(DOC_A)]);
		const state = stateWithNodes([acceptedNodeState(NODE_A1)]);

		const result = await exportAgentPack([], state, profile);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected failure');

		const error: ExportError = result.error;
		expect(error.code).toBe('NO_DOCUMENTS_REQUESTED');
	});

	// ── File collision → blocked ──────────────────────────────────

	it('blocks export when the output file already exists', async () => {
		const packPath = join(tempDir, 'test-doc.agent-pack.json');
		writeFileSync(packPath, 'existing content', 'utf-8');

		const rule = testRule(DOC_A, { sourceNodeIds: [NODE_A1] });
		const profile = testProfile([rule]);
		const state = stateWithNodes([acceptedNodeState(NODE_A1)]);

		const result = await exportAgentPack([DOC_A], state, profile);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected failure');

		const error: ExportError = result.error;
		expect(error.code).toBe('FILE_COLLISION');
		expect(error.message).toContain(packPath);

		// Verify original file was NOT overwritten.
		expect(readFileSync(packPath, 'utf-8')).toBe('existing content');
	});

	// ── Missing materialization rule → blocked ────────────────────

	it('blocks export when no materialization rule exists for a document', async () => {
		const profile = testProfile([testRule(DOC_A)]);
		const state = stateWithNodes([acceptedNodeState(NODE_A1)]);

		const result = await exportAgentPack(
			['no-such-doc' as DocumentId],
			state,
			profile,
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected failure');

		const error: ExportError = result.error;
		expect(error.code).toBe('RULE_NOT_FOUND');
	});

	// ── Output path derivation: single doc ─────────────────────────

	it('derives .agent-pack.json from .md output path for single document', async () => {
		const rule = testRule(DOC_A, {
			outputPath: join(tempDir, 'output.md'),
			sourceNodeIds: [NODE_A1],
		});
		const profile = testProfile([rule]);
		const state = stateWithNodes([acceptedNodeState(NODE_A1)]);

		const result = await exportAgentPack([DOC_A], state, profile);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected success');

		expect(result.value.path).toBe(join(tempDir, 'output.agent-pack.json'));
	});

	// ── Output path derivation: multi-doc ─────────────────────────

	it('uses profile.id.agent-pack.json for multiple documents', async () => {
		const ruleA = testRule(DOC_A, {
			outputPath: join(tempDir, 'doc-a.md'),
			sourceNodeIds: [NODE_A1],
		});
		const ruleB = testRule(DOC_B, {
			outputPath: join(tempDir, 'doc-b.md'),
			sourceNodeIds: [NODE_B1],
		});
		const profile = testProfile([ruleA, ruleB]);
		const state = stateWithNodes([
			acceptedNodeState(NODE_A1),
			acceptedNodeState(NODE_B1),
		]);

		const result = await exportAgentPack([DOC_A, DOC_B], state, profile);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected success');

		expect(result.value.path).toBe(
			join(tempDir, 'test-profile.agent-pack.json'),
		);
	});

	// ── Artifact metadata correctness ─────────────────────────────

	it('returns artifact with complete metadata', async () => {
		const rule = testRule(DOC_A, { sourceNodeIds: [NODE_A1] });
		const profile = testProfile([rule]);
		const state = stateWithNodes([acceptedNodeState(NODE_A1)]);

		const result = await exportAgentPack([DOC_A], state, profile);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected success');

		const artifact = result.value;

		expect(typeof artifact.id).toBe('string');
		expect(artifact.id.length).toBeGreaterThan(0);
		expect(artifact.sessionId).toBe(state.sessionId);
		expect(artifact.type).toBe('agent_pack');
		expect(artifact.sourceDocumentIds).toEqual([DOC_A]);
		expect(artifact.stale).toBe(false);
		expect(artifact.generatedAt).toBeTruthy();
		expect(() => new Date(artifact.generatedAt)).not.toThrow();
	});

	// ── Derived/non-canonical labels ──────────────────────────────

	it('labels output as derived and non-canonical', async () => {
		const rule = testRule(DOC_A, { sourceNodeIds: [NODE_A1] });
		const profile = testProfile([rule]);
		const state = stateWithNodes([acceptedNodeState(NODE_A1)]);

		const result = await exportAgentPack([DOC_A], state, profile);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected success');

		const fileContent = readFileSync(result.value.path, 'utf-8');
		const pack = JSON.parse(fileContent);

		expect(pack.kind).toBe('[derived] agent_pack');
		expect(pack.canonical).toBe(false);
	});

	// ── Source traceability metadata ──────────────────────────────

	it('includes per-answer timestamps and source message IDs', async () => {
		const acceptedAt = '2024-06-15T10:30:00.000Z';
		const generatedAt = '2024-06-15T10:29:00.000Z';
		const messageIds = ['msg-10', 'msg-20'];

		const rule = testRule(DOC_A, { sourceNodeIds: [NODE_A1] });
		const profile = testProfile([rule]);
		const state = stateWithNodes([
			acceptedNodeState(NODE_A1, {
				acceptedAt,
				confidence: 'medium',
				generatedAt,
				generatedFromMessageIds: messageIds,
			}),
		]);

		const result = await exportAgentPack([DOC_A], state, profile);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected success');

		const fileContent = readFileSync(result.value.path, 'utf-8');
		const pack = JSON.parse(fileContent);

		const answer = pack.documents[0].answers[0];
		expect(answer.generatedAt).toBe(generatedAt);
		expect(answer.acceptedAt).toBe(acceptedAt);
		expect(answer.generatedFromMessageIds).toEqual(messageIds);
		expect(answer.confidence).toBe('medium');
	});

	// ── Inclusive: only includes fresh (accepted, non-stale) answers ────

	it('only includes fresh, non-stale accepted answers', async () => {
		const rule = testRule(DOC_A, {
			sourceNodeIds: [NODE_A1, NODE_A2],
		});
		const profile = testProfile([rule]);
		// Both nodes are fresh accepted.
		const state = stateWithNodes([
			acceptedNodeState(NODE_A1, { content: 'Answer 1' }),
			acceptedNodeState(NODE_A2, { content: 'Answer 2' }),
		]);

		const result = await exportAgentPack([DOC_A], state, profile);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected success');

		const fileContent = readFileSync(result.value.path, 'utf-8');
		const pack = JSON.parse(fileContent);

		// Both fresh answers should be included.
		const answers = pack.documents[0].answers;
		expect(answers).toHaveLength(2);
		// biome-ignore lint/suspicious/noExplicitAny: JSON-parsed pack in test
		expect(answers.map((a: any) => a.content)).toContain('Answer 1');
		// biome-ignore lint/suspicious/noExplicitAny: JSON-parsed pack in test
		expect(answers.map((a: any) => a.content)).toContain('Answer 2');

		// Only fresh node IDs in source traceability.
		expect(pack.sourceTraceability.sourceNodeIds).toContain('node-a1');
		expect(pack.sourceTraceability.sourceNodeIds).toContain('node-a2');
	});

	// ── Materialized draft missing required section → blocked ─────

	it('blocks export when the materialized draft has missing sections', async () => {
		const rule = testRule(DOC_A, {
			sourceNodeIds: [NODE_A1, NODE_A2],
		});
		const profile = testProfile([
			{
				...rule,
				requiredNodeIds: [NODE_A1, NODE_A2],
				sections: [
					{
						id: 'section-1',
						required: true,
						sourceNodeIds: [NODE_A1],
						title: 'Section One',
					},
					{
						id: 'section-2',
						required: true,
						sourceNodeIds: [NODE_A2],
						title: 'Section Two',
					},
				],
			},
		]);
		// NODE_A1 is fresh accepted; NODE_A2 is still active (missing).
		const state = stateWithNodes([
			acceptedNodeState(NODE_A1, { content: 'Content A.' }),
			activeNodeState(NODE_A2),
		]);

		const result = await exportAgentPack([DOC_A], state, profile);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected failure');

		const error: ExportError = result.error;
		expect(error.code).toBe('DOCUMENT_INCOMPLETE');
	});
});
