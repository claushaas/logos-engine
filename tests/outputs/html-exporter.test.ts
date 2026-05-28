/**
 * Tests for Step 17.1 — HTML exporter.
 *
 * Covers:
 *  - Export ready document → HTML file created with valid structure.
 *  - Content is properly escaped (XSS-safe).
 *  - Metadata header present.
 *  - Export incomplete document → blocked.
 *  - Export stale document → blocked.
 *  - File collision → blocked.
 *  - Missing materialization rule → blocked.
 *  - Output path derivation (.md → .html, .markdown → .html, append).
 *  - Artifact metadata correctness (type: 'html').
 *
 * @see {@link https://logos-engine/docs/architecture/10-local-development-and-deployment.md §11}
 * @see {@link https://logos-engine/docs/13-prototypes.md §3.12}
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
import { exportHtml } from '../../src/outputs/index.js';
import type { ExportError } from '../../src/outputs/index.js';
import type { DocumentId, NodeId, ProfileId } from '../../src/shared/index.js';
import { nowIso } from '../../src/shared/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Test helpers
// ═══════════════════════════════════════════════════════════════════════════

let tempDir: string;
let outputPath: string;

beforeEach(() => {
	tempDir = mkdtempSync(join(tmpdir(), 'logos-html-export-test-'));
	// Default output path ends with .md so deriveHtmlPath produces .html.
	outputPath = join(tempDir, 'test-doc.md');
});

afterEach(() => {
	try {
		rmSync(tempDir, { force: true, recursive: true });
	} catch {
		// Best effort cleanup.
	}
});

// ─── Node state factories ──────────────────────────────────────────────────

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

describe('exportHtml', () => {
	// ── AC: Ready document → HTML file created with valid structure ─

	it('exports a ready document to an HTML file', async () => {
		const profile = testProfile();
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, '## The Answer\n\nThis is the content.'),
		]);

		const result = await exportHtml(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected success');

		const artifact = result.value;
		expect(artifact.type).toBe('html');
		expect(artifact.path).toBe(outputPath.replace(/\.md$/, '.html'));
		expect(artifact.sessionId).toBe('test-session');
		expect(artifact.sourceDocumentIds).toEqual(['test-doc']);
		expect(artifact.sourceNodeIds).toEqual(['node-a']);
		expect(artifact.stale).toBe(false);
		expect(artifact.id).toBeTruthy();

		// Verify file was written with valid HTML structure.
		const fileContent = readFileSync(artifact.path, 'utf-8');
		expect(fileContent).toContain('<!doctype html>');
		expect(fileContent).toContain('<html lang="en">');
		expect(fileContent).toContain('<meta charset="utf-8">');
		expect(fileContent).toContain('<title>Test Document</title>');
		expect(fileContent).toContain('<h1>Test Document</h1>');
		expect(fileContent).toContain('This is the content.');
		expect(fileContent).toContain('derived artifact');
		expect(fileContent).toContain('</html>');
	});

	// ── AC: Content is properly escaped (XSS-safe) ─────────────────

	it('escapes HTML special characters in document content', async () => {
		const dangerousContent = '<script>alert("XSS")</script> & "quotes" \'single\'';
		const profile = testProfile();
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, dangerousContent),
		]);

		const result = await exportHtml(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected success');

		const fileContent = readFileSync(result.value.path, 'utf-8');

		// The escaped content should NOT contain raw HTML tags or unescaped chars.
		expect(fileContent).not.toContain('<script>alert');
		expect(fileContent).toContain('&lt;script&gt;alert');
		expect(fileContent).toContain('&quot;XSS&quot;');
		expect(fileContent).toContain('&amp;');
		expect(fileContent).toContain('&quot;quotes&quot;');
		expect(fileContent).toContain('&#39;single&#39;');
	});

	it('escapes HTML special characters in document title', async () => {
		const dangerousTitle = 'Test <b>Bold</b> & "Special"';
		const rule: DocumentMaterializationRule = {
			...testRule('test-doc' as DocumentId),
			title: dangerousTitle,
		};
		const profile = testProfile(rule);
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, 'Safe content.'),
		]);

		const result = await exportHtml(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected success');

		const fileContent = readFileSync(result.value.path, 'utf-8');

		// Title should be escaped in both <title> and <h1>.
		expect(fileContent).toContain('&lt;b&gt;Bold&lt;/b&gt;');
		expect(fileContent).toContain('&amp;');
		expect(fileContent).toContain('&quot;Special&quot;');
		expect(fileContent).not.toContain('<b>Bold</b>');
	});

	// ── AC: Metadata header present ───────────────────────────────

	it('includes a metadata header with document info', async () => {
		const profile = testProfile();
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, 'Content.'),
		]);

		const result = await exportHtml(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected success');

		const fileContent = readFileSync(result.value.path, 'utf-8');

		// Metadata block should contain the document title and ID.
		expect(fileContent).toContain('class="metadata"');
		expect(fileContent).toContain('<dt>Document</dt>');
		expect(fileContent).toContain('<dd>Test Document</dd>');
		expect(fileContent).toContain('<dt>Document ID</dt>');
		expect(fileContent).toContain('<dd>test-doc</dd>');
		expect(fileContent).toContain('<dt>Generated</dt>');
		expect(fileContent).toContain('<dt>Source Nodes</dt>');
		expect(fileContent).toContain('<dd>node-a</dd>');
	});

	// ── AC: Incomplete document → blocked ──────────────────────────

	it('blocks export for an incomplete document (missing required node)', async () => {
		const profile = testProfile();
		const state = stateWithNodes([activeNodeState('node-a' as NodeId)]);

		const result = await exportHtml(
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

		const result = await exportHtml(
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
		const { writeFileSync } = await import('node:fs');
		const htmlPath = outputPath.replace(/\.md$/, '.html');
		writeFileSync(htmlPath, 'existing content', 'utf-8');

		const profile = testProfile();
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, 'Content.'),
		]);

		const result = await exportHtml(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected failure');

		const error: ExportError = result.error;
		expect(error.code).toBe('FILE_COLLISION');
		expect(error.message).toContain(htmlPath);

		// Verify original file was NOT overwritten.
		const fileContent = readFileSync(htmlPath, 'utf-8');
		expect(fileContent).toBe('existing content');
	});

	// ── AC: Missing materialization rule → blocked ────────────────

	it('blocks export when no materialization rule exists', async () => {
		const profile: LogosProfile = {
			...testProfile(),
			materializationRules: [],
		};
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, 'Content.'),
		]);

		const result = await exportHtml(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected failure');

		const error: ExportError = result.error;
		expect(error.code).toBe('RULE_NOT_FOUND');
	});

	// ── Path derivation: .md → .html ──────────────────────────────

	it('replaces .md extension with .html', async () => {
		const rule = testRule('test-doc' as DocumentId, {
			outputPath: join(tempDir, 'output.md'),
		});
		const profile = testProfile(rule);
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, 'Content.'),
		]);

		const result = await exportHtml(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected success');

		expect(result.value.path).toBe(join(tempDir, 'output.html'));
		expect(readFileSync(join(tempDir, 'output.html'), 'utf-8')).toContain(
			'<!doctype html>',
		);
	});

	// ── Path derivation: .markdown → .html ────────────────────────

	it('replaces .markdown extension with .html', async () => {
		const rule = testRule('test-doc' as DocumentId, {
			outputPath: join(tempDir, 'output.markdown'),
		});
		const profile = testProfile(rule);
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, 'Content.'),
		]);

		const result = await exportHtml(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected success');

		expect(result.value.path).toBe(join(tempDir, 'output.html'));
	});

	// ── Path derivation: no extension → append .html ──────────────

	it('appends .html when output path has no recognized extension', async () => {
		const rule = testRule('test-doc' as DocumentId, {
			outputPath: join(tempDir, 'no-ext-output'),
		});
		const profile = testProfile(rule);
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, 'Content.'),
		]);

		const result = await exportHtml(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected success');

		expect(result.value.path).toBe(join(tempDir, 'no-ext-output.html'));
	});

	// ── AC: Artifact metadata correctness ─────────────────────────

	it('returns artifact with complete metadata for session storage', async () => {
		const profile = testProfile();
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, '## Content\n\nAnswer body.'),
		]);

		const result = await exportHtml(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected success');

		const artifact = result.value;

		expect(typeof artifact.id).toBe('string');
		expect(artifact.id.length).toBeGreaterThan(0);
		expect(artifact.sessionId).toBe(state.sessionId);
		expect(artifact.type).toBe('html');
		expect(artifact.path).toBe(outputPath.replace(/\.md$/, '.html'));
		expect(artifact.sourceDocumentIds).toEqual([
			'test-doc' as DocumentId,
		]);
		expect(artifact.sourceNodeIds).toEqual(['node-a' as NodeId]);
		expect(artifact.stale).toBe(false);
		expect(artifact.generatedAt).toBeTruthy();
		expect(() => new Date(artifact.generatedAt)).not.toThrow();
	});

	// ── Edge: Non-existent document ID → blocked ──────────────────

	it('blocks export for a non-existent document ID', async () => {
		const profile = testProfile();
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, 'Content.'),
		]);

		const result = await exportHtml(
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

		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, 'Content A.'),
			activeNodeState('node-b' as NodeId),
		]);

		const result = await exportHtml(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected failure');

		const error: ExportError = result.error;
		expect(error.code).toBe('DOCUMENT_INCOMPLETE');
	});

	// ── Edge: HTML does not overwrite the Markdown output path ─────

	it('does not overwrite the Markdown output path (.md file)', async () => {
		const { writeFileSync } = await import('node:fs');
		// Pre-create the .md file with content.
		writeFileSync(outputPath, 'original markdown', 'utf-8');

		const profile = testProfile();
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, 'HTML content.'),
		]);

		const result = await exportHtml(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected success');

		// The .md file should remain unchanged.
		expect(readFileSync(outputPath, 'utf-8')).toBe('original markdown');

		// The .html file should be separate.
		const htmlPath = outputPath.replace(/\.md$/, '.html');
		expect(readFileSync(htmlPath, 'utf-8')).toContain('<!doctype html>');
		expect(readFileSync(htmlPath, 'utf-8')).toContain('HTML content.');
	});

	// ── Edge: HTML generation timestamp differs across exports ────

	it('generates unique artifact IDs and timestamps across exports', async () => {
		const profile = testProfile();
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, 'Content.'),
		]);

		const result1 = await exportHtml(
			'test-doc' as DocumentId,
			state,
			profile,
		);
		expect(result1.ok).toBe(true);
		if (!result1.ok) throw new Error('Expected success');

		// Use a different output path so FILE_COLLISION is not triggered.
		const result2 = await exportHtml(
			'test-doc' as DocumentId,
			state,
			testProfile(
				testRule('test-doc' as DocumentId, {
					outputPath: join(tempDir, 'test-doc-2.md'),
				}),
			),
		);
		expect(result2.ok).toBe(true);
		if (!result2.ok) throw new Error('Expected success');

		expect(result2.value.id).not.toBe(result1.value.id);
		// Both artifacts should have valid ISO-8601 timestamps.
		expect(() => new Date(result2.value.generatedAt)).not.toThrow();
	});
});
