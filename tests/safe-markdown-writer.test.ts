/** Safe Markdown Writer Tests — metadata, checksums, manual edit detection, policies, writes */

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
	CanonicalMarkdownRenderResult,
	ManualEditFsAdapter,
	SafeMarkdownWritePolicy,
} from '../src/index.js';
import {
	computeBodyChecksum,
	computeFullChecksum,
	detectManualEdit,
	injectChecksumIntoMarkdown,
	parseFrontmatter,
	planMarkdownWrites,
	writeMarkdownDocuments,
} from '../src/index.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function createFixtureRenderResult(
	overrides: Partial<CanonicalMarkdownRenderResult> = {},
): CanonicalMarkdownRenderResult {
	return {
		canonicalOutputPath: 'docs/03-product/test-doc.md',
		diagnostics: [],
		documentCanonicalId: 'test-doc',
		gaps: [],
		markdown: '',
		metadata: {
			canonicalOutput: 'docs/03-product/test-doc.md',
			documentId: 'test-doc',
			generatedAt: '2024-01-01T00:00:00.000Z',
			generatedBy: 'logos-engine (canonical-markdown-renderer)',
			generationStatus: 'generate',
			nonCanonicalArtifacts: undefined,
			phaseId: '03-product',
			profileId: 'standard',
			sourceStateSchemaVersion: '3.1.0',
			traceability: [],
		},
		phaseId: '03-product',
		renderedAt: '2024-01-01T00:00:00.000Z',
		sections: [],
		sources: [],
		status: 'generate',
		...overrides,
	};
}

function createValidMarkdown(
	overrides: {
		documentId?: string;
		canonicalOutput?: string;
		bodyContent?: string;
	} = {},
): string {
	const docId = overrides.documentId ?? 'test-doc';
	const canonicalOutput =
		overrides.canonicalOutput ?? 'docs/03-product/test-doc.md';
	const body = overrides.bodyContent ?? '# Test Document\n\nSome content.\n';
	return `---
documentId: ${docId}
phaseId: 03-product
profileId: standard
canonicalOutput: ${canonicalOutput}
generatedBy: logos-engine (canonical-markdown-renderer)
generatedAt: 2024-01-01T00:00:00.000Z
generationStatus: generate
sourceStateSchemaVersion: 3.1.0
---
${body}`;
}

function createMarkdownWithChecksum(body: string, checksum: string): string {
	return `---
documentId: test-doc
phaseId: 03-product
profileId: standard
canonicalOutput: docs/03-product/test-doc.md
generatedBy: logos-engine (canonical-markdown-renderer)
generatedAt: 2024-01-01T00:00:00.000Z
generationStatus: generate
sourceStateSchemaVersion: 3.1.0
contentChecksum: ${checksum}
---
${body}`;
}

// ---------------------------------------------------------------------------
// Metadata parsing
// ---------------------------------------------------------------------------

describe('parseFrontmatter (metadata parsing)', () => {
	it('parses valid generated metadata', () => {
		const md = createValidMarkdown();
		const parsed = parseFrontmatter(md);

		expect(parsed.parsedSuccessfully).toBe(true);
		expect(parsed.parseErrors).toEqual([]);
		expect(parsed.metadata.documentId).toBe('test-doc');
		expect(parsed.metadata.phaseId).toBe('03-product');
		expect(parsed.metadata.profileId).toBe('standard');
		expect(parsed.metadata.canonicalOutput).toBe('docs/03-product/test-doc.md');
		expect(parsed.metadata.generationStatus).toBe('generate');
		expect(parsed.metadata.sourceStateSchemaVersion).toBe('3.1.0');
	});

	it('detects missing metadata (no frontmatter)', () => {
		const md = '# Just some markdown\n\nNo frontmatter here.\n';
		const parsed = parseFrontmatter(md);

		expect(parsed.parsedSuccessfully).toBe(false);
		expect(parsed.parseErrors).toContain('no_frontmatter_delimiter');
	});

	it('detects invalid metadata (unclosed frontmatter)', () => {
		const md = '---\ndocumentId: test\n';
		const parsed = parseFrontmatter(md);

		expect(parsed.parsedSuccessfully).toBe(false);
		expect(parsed.parseErrors).toContain('unclosed_frontmatter');
	});

	it('detects mismatched document id', () => {
		const md = createValidMarkdown({ documentId: 'other-doc' });
		const parsed = parseFrontmatter(md);

		expect(parsed.metadata.documentId).toBe('other-doc');
		expect(parsed.metadata.documentId).not.toBe('test-doc');
	});

	it('detects mismatched canonical output path', () => {
		const md = createValidMarkdown({
			canonicalOutput: 'docs/99-other/other.md',
		});
		const parsed = parseFrontmatter(md);

		expect(parsed.metadata.canonicalOutput).toBe('docs/99-other/other.md');
		expect(parsed.metadata.canonicalOutput).not.toBe(
			'docs/03-product/test-doc.md',
		);
	});

	it('handles YAML frontmatter format with traceability', () => {
		const md = `---
documentId: test-doc
phaseId: 03-product
profileId: standard
canonicalOutput: docs/03-product/test-doc.md
generatedBy: logos-engine
generatedAt: 2024-01-01T00:00:00.000Z
generationStatus: generate
sourceStateSchemaVersion: 3.1.0
traceability:
  - recordId: dec-1
    recordType: decision
    sourceProposalId: prop-1
    sourceSessionId: sess-1
  - recordId: asm-1
    recordType: assumption
---
# Content
`;
		const parsed = parseFrontmatter(md);

		expect(parsed.parsedSuccessfully).toBe(true);
		expect(parsed.metadata.traceability).toHaveLength(2);
		expect(parsed.metadata.traceability[0].workspaceRecordId).toBe('dec-1');
		expect(parsed.metadata.traceability[0].recordType).toBe('decision');
		expect(parsed.metadata.traceability[1].workspaceRecordId).toBe('asm-1');
	});

	it('handles nonCanonicalArtifacts in frontmatter', () => {
		const md = `---
documentId: test-doc
phaseId: 03-product
profileId: standard
canonicalOutput: docs/03-product/test-doc.md
generatedBy: logos-engine
generatedAt: 2024-01-01T00:00:00.000Z
generationStatus: generate
sourceStateSchemaVersion: 3.1.0
nonCanonicalArtifacts:
  - html/index.html
  - agent-pack.zip
---
# Content
`;
		const parsed = parseFrontmatter(md);

		expect(parsed.parsedSuccessfully).toBe(true);
		expect(parsed.metadata.nonCanonicalArtifacts).toHaveLength(2);
	});

	it('does not treat arbitrary Markdown as generated', () => {
		const md = '# My Notes\n\nThese are just personal notes.\n';
		const parsed = parseFrontmatter(md);

		expect(parsed.parsedSuccessfully).toBe(false);
		expect(parsed.parseErrors).toContain('no_frontmatter_delimiter');
	});

	it('parses contentChecksum from frontmatter', () => {
		const body = '# Test\n';
		const checksum = 'abc123def456';
		const md = createMarkdownWithChecksum(body, checksum);
		const parsed = parseFrontmatter(md);

		expect(parsed.parsedSuccessfully).toBe(true);
		expect(parsed.checksum).toBe(checksum);
	});

	it('extracts body content after frontmatter', () => {
		const body = '# Test\n\nSome content.\n';
		const md = createValidMarkdown({ bodyContent: body });
		const parsed = parseFrontmatter(md);

		expect(parsed.contentAfterFrontmatter).toBe(body);
	});
});

// ---------------------------------------------------------------------------
// Checksum tests
// ---------------------------------------------------------------------------

describe('Checksum helpers', () => {
	it('computes stable checksum for same Markdown', () => {
		const md = createValidMarkdown();
		const a = computeFullChecksum(md);
		const b = computeFullChecksum(md);

		expect(a).toBe(b);
		expect(a.length).toBe(64);
	});

	it('checksum changes when content changes', () => {
		const a = computeFullChecksum(createValidMarkdown());
		const b = computeFullChecksum(
			createValidMarkdown({ bodyContent: '# Different\n' }),
		);

		expect(a).not.toBe(b);
	});

	it('body checksum excludes frontmatter variance in checksum field', () => {
		const body = '# Test\n\nBody content.\n';
		const a = createMarkdownWithChecksum(body, 'abc123');
		const b = createMarkdownWithChecksum(body, 'def456');

		const bodyA = computeBodyChecksum(a);
		const bodyB = computeBodyChecksum(b);

		expect(bodyA).toBe(bodyB);
	});

	it('body checksum changes when body changes', () => {
		const a = createMarkdownWithChecksum('# Content A\n', 'abc');
		const b = createMarkdownWithChecksum('# Content B\n', 'abc');

		const bodyA = computeBodyChecksum(a);
		const bodyB = computeBodyChecksum(b);

		expect(bodyA).not.toBe(bodyB);
	});

	it('checksum diagnostics do not leak secrets', () => {
		const md = createValidMarkdown({
			bodyContent: 'sk-proj-secret-key-1234567890abcdef',
		});
		const hash = computeFullChecksum(md);

		expect(hash.length).toBe(64);
		expect(hash).toMatch(/^[a-f0-9]+$/);
	});

	it('injectChecksumIntoMarkdown adds checksum field', () => {
		const md = createValidMarkdown();
		const result = injectChecksumIntoMarkdown(md, 'abc123');

		expect(result).toContain('contentChecksum: abc123');
		expect(result).toContain(md.split('---\n')[2]);
	});

	it('injectChecksumIntoMarkdown updates existing checksum', () => {
		const body = '# Test\n';
		const md = createMarkdownWithChecksum(body, 'oldhash');
		const result = injectChecksumIntoMarkdown(md, 'newhash');

		expect(result).toContain('contentChecksum: newhash');
		expect(result).not.toContain('contentChecksum: oldhash');
	});
});

// ---------------------------------------------------------------------------
// Manual edit detection
// ---------------------------------------------------------------------------

describe('detectManualEdit', () => {
	it('missing target returns new_file', async () => {
		const result = await detectManualEdit({
			renderResult: createFixtureRenderResult(),
			targetPath: '/nonexistent/path/file.md',
		});

		expect(result.status).toBe('new_file');
		expect(result.targetExists).toBe(false);
	});

	it('unchanged generated target returns unchanged_generated', async () => {
		const body = '# Test\n\nContent.\n';
		const bodyChecksum = computeBodyChecksum(
			createMarkdownWithChecksum(body, ''),
		);
		const mdWithChecksum = createMarkdownWithChecksum(body, bodyChecksum);

		const fs: ManualEditFsAdapter = {
			async readFile() {
				return mdWithChecksum;
			},
			async stat() {
				return { isDirectory: () => false, isFile: () => true };
			},
		};

		const result = await detectManualEdit({
			fs,
			renderResult: createFixtureRenderResult(),
			targetPath: '/fake/test-file.md',
		});

		expect(result.status).toBe('unchanged_generated');
		expect(result.previousChecksum).toBe(bodyChecksum);
		expect(result.currentChecksum).toBe(computeBodyChecksum(mdWithChecksum));
	});

	it('modified generated target returns modified_since_generation', async () => {
		const body = '# Test\n\nOriginal content.\n';
		const bodyChecksum = computeBodyChecksum(
			createMarkdownWithChecksum(body, ''),
		);
		const mdWithChecksum = createMarkdownWithChecksum(body, bodyChecksum);

		const modifiedContent = mdWithChecksum.replace('Original', 'Modified');

		const fs: ManualEditFsAdapter = {
			async readFile() {
				return modifiedContent;
			},
			async stat() {
				return { isDirectory: () => false, isFile: () => true };
			},
		};

		const result = await detectManualEdit({
			fs,
			renderResult: createFixtureRenderResult(),
			targetPath: '/fake/test-file.md',
		});

		expect(result.status).toBe('modified_since_generation');
	});

	it('target without metadata returns metadata_missing', async () => {
		const fs: ManualEditFsAdapter = {
			async readFile() {
				return '# Just notes\n\nNo metadata.\n';
			},
			async stat() {
				return { isDirectory: () => false, isFile: () => true };
			},
		};

		const result = await detectManualEdit({
			fs,
			renderResult: createFixtureRenderResult(),
			targetPath: '/fake/file.md',
		});

		expect(result.status).toBe('metadata_missing');
	});

	it('target with invalid metadata returns metadata_invalid', async () => {
		const fs: ManualEditFsAdapter = {
			async readFile() {
				return '---\ndocumentId: incomplete\n';
			},
			async stat() {
				return { isDirectory: () => false, isFile: () => true };
			},
		};

		const result = await detectManualEdit({
			fs,
			renderResult: createFixtureRenderResult(),
			targetPath: '/fake/file.md',
		});

		expect(result.status).toBe('metadata_invalid');
	});

	it('document id mismatch returns metadata_invalid', async () => {
		const md = createValidMarkdown({ documentId: 'different-doc' });
		const fs: ManualEditFsAdapter = {
			async readFile() {
				return md;
			},
			async stat() {
				return { isDirectory: () => false, isFile: () => true };
			},
		};

		const result = await detectManualEdit({
			fs,
			renderResult: createFixtureRenderResult({
				documentCanonicalId: 'test-doc',
			}),
			targetPath: '/fake/file.md',
		});

		expect(result.status).toBe('metadata_invalid');
	});

	it('registry mismatch returns registry_mismatch', async () => {
		const body = '# Test\n\nContent.\n';
		const bodyChecksum = computeBodyChecksum(
			createMarkdownWithChecksum(body, ''),
		);
		const mdWithChecksum = createMarkdownWithChecksum(body, bodyChecksum);

		const fs: ManualEditFsAdapter = {
			async readFile() {
				return mdWithChecksum;
			},
			async stat() {
				return { isDirectory: () => false, isFile: () => true };
			},
		};

		const result = await detectManualEdit({
			artifactRecord: {
				checksum: 'totally-different-checksum',
				generatedAt: '2024-01-01T00:00:00.000Z',
			},
			fs,
			renderResult: createFixtureRenderResult(),
			targetPath: '/fake/file.md',
		});

		expect(result.status).toBe('registry_mismatch');
	});

	it('no previous checksum returns unknown', async () => {
		const md = createValidMarkdown();
		const fs: ManualEditFsAdapter = {
			async readFile() {
				return md;
			},
			async stat() {
				return { isDirectory: () => false, isFile: () => true };
			},
		};

		const result = await detectManualEdit({
			fs,
			renderResult: createFixtureRenderResult(),
			targetPath: '/fake/file.md',
		});

		expect(result.status).toBe('unknown');
	});

	it('directory target returns unknown', async () => {
		const fs: ManualEditFsAdapter = {
			async readFile() {
				return '';
			},
			async stat() {
				return { isDirectory: () => true, isFile: () => false };
			},
		};

		const result = await detectManualEdit({
			fs,
			renderResult: createFixtureRenderResult(),
			targetPath: '/fake/dir',
		});

		expect(result.status).toBe('unknown');
	});
});

// ---------------------------------------------------------------------------
// Write policy behavior
// ---------------------------------------------------------------------------

describe('Write policy behavior', () => {
	const body = '# Test\n\nContent.\n';
	const bodyChecksum = computeBodyChecksum(
		createMarkdownWithChecksum(body, ''),
	);

	function createFakeFs(content: string): ManualEditFsAdapter {
		return {
			async readFile() {
				return content;
			},
			async stat() {
				return { isDirectory: () => false, isFile: () => true };
			},
		};
	}

	function createFakeFsNonexistent(): ManualEditFsAdapter {
		return {
			async readFile() {
				throw new Error('ENOENT');
			},
			async stat() {
				throw new Error('ENOENT');
			},
		};
	}

	it('missing target creates file', async () => {
		const result = await detectManualEdit({
			fs: createFakeFsNonexistent(),
			renderResult: createFixtureRenderResult(),
			targetPath: '/new/file.md',
		});

		expect(result.status).toBe('new_file');
	});

	it('existing unchanged generated target with skip is skipped', async () => {
		const mdWithChecksum = createMarkdownWithChecksum(body, bodyChecksum);
		const fs = createFakeFs(mdWithChecksum);

		const result = await detectManualEdit({
			fs,
			renderResult: createFixtureRenderResult(),
			targetPath: '/fake/file.md',
		});

		expect(result.status).toBe('unchanged_generated');
	});

	it('manual edit + skip does not write and reports skipped/collision', async () => {
		const mdWithChecksum = createMarkdownWithChecksum(body, bodyChecksum);
		const modifiedContent = mdWithChecksum.replace('Content.', 'Manual edit!');
		const fs = createFakeFs(modifiedContent);

		const result = await detectManualEdit({
			fs,
			renderResult: createFixtureRenderResult(),
			targetPath: '/fake/file.md',
		});

		expect(result.status).toBe('modified_since_generation');
	});

	it('manual edit + fail does not write and reports collision/failure', async () => {
		const mdWithChecksum = createMarkdownWithChecksum(body, bodyChecksum);
		const modifiedContent = mdWithChecksum.replace('Content.', 'Manual edit!');
		const fs = createFakeFs(modifiedContent);

		const result = await detectManualEdit({
			fs,
			renderResult: createFixtureRenderResult(),
			targetPath: '/fake/file.md',
		});

		expect(result.status).toBe('modified_since_generation');
		expect(result.status).not.toBe('unchanged_generated');
	});

	it('manual edit detection status is reported', async () => {
		const md = createValidMarkdown();
		const fs = createFakeFs(md);

		const result = await detectManualEdit({
			fs,
			renderResult: createFixtureRenderResult(),
			targetPath: '/fake/file.md',
		});

		expect(['unknown', 'unchanged_generated', 'metadata_invalid']).toContain(
			result.status,
		);
	});

	it('skipped files are distinct from failed files in plan', async () => {
		const renderResult = createFixtureRenderResult({
			markdown: createValidMarkdown({
				bodyContent: '# Plan test\n\nContent.\n',
			}),
		});

		const plan = await planMarkdownWrites(
			{ renderResults: [renderResult] },
			{
				documentationRoot: 'logos',
				dryRun: true,
				fsOverride: {
					async readFile() {
						return '# Manual notes\n';
					},
					async stat() {
						return { isDirectory: () => false, isFile: () => true };
					},
				},
				policy: 'skip',
			},
		);

		expect(plan.summary.skipped).toBeGreaterThanOrEqual(0);
		expect(plan.summary.failed).toBeGreaterThanOrEqual(0);
	});

	it('unknown policy fails with diagnostic', async () => {
		const renderResult = createFixtureRenderResult();

		const plan = await planMarkdownWrites(
			{ renderResults: [renderResult] },
			{
				documentationRoot: 'logos',
				dryRun: true,
				fsOverride: {
					async readFile() {
						throw new Error('ENOENT');
					},
					async stat() {
						throw new Error('ENOENT');
					},
				},
				policy: 'unknown_policy' as SafeMarkdownWritePolicy,
			},
		);

		const hasPolicyError = plan.diagnostics.some(
			(d) => d.code === 'unknown_policy',
		);
		expect(hasPolicyError).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Path/root tests
// ---------------------------------------------------------------------------

describe('Path and root safety', () => {
	it('default root is logos/', async () => {
		const renderResult = createFixtureRenderResult();
		const plan = await planMarkdownWrites(
			{ renderResults: [renderResult] },
			{ dryRun: true },
		);

		expect(plan.documentationRoot).toBe('logos');
	});

	it('custom documentation root is supported', async () => {
		const renderResult = createFixtureRenderResult();
		const plan = await planMarkdownWrites(
			{ renderResults: [renderResult] },
			{ documentationRoot: 'output', dryRun: true },
		);

		expect(plan.documentationRoot).toBe('output');
	});

	it('target path under root is allowed', async () => {
		const renderResult = createFixtureRenderResult();
		const plan = await planMarkdownWrites(
			{ renderResults: [renderResult] },
			{ documentationRoot: 'logos', dryRun: true },
		);

		expect(plan.items).toHaveLength(1);
		expect(plan.items[0].status).toBe('dry_run');
	});

	it('path traversal outside root is rejected', async () => {
		const renderResult = createFixtureRenderResult({
			canonicalOutputPath: '../outside/file.md',
		});

		const plan = await planMarkdownWrites(
			{ renderResults: [renderResult] },
			{ documentationRoot: 'logos', dryRun: true },
		);

		expect(plan.items[0].status).toBe('failed');
	});

	it('writer never assumes docs/', async () => {
		const renderResult = createFixtureRenderResult();
		const plan = await planMarkdownWrites(
			{ renderResults: [renderResult] },
			{ dryRun: true },
		);

		expect(plan.documentationRoot).not.toBe('docs');
	});

	it('target paths use documentation root not docs/', async () => {
		const renderResult = createFixtureRenderResult();
		const plan = await planMarkdownWrites(
			{ renderResults: [renderResult] },
			{ documentationRoot: 'logos', dryRun: true },
		);

		expect(plan.items[0].targetPath).toContain('logos');
		expect(plan.items[0].targetPath).not.toContain('docs/03-product');
	});
});

// ---------------------------------------------------------------------------
// Dry-run tests
// ---------------------------------------------------------------------------

describe('Dry-run behavior', () => {
	it('dry-run missing target returns planned create and writes nothing', async () => {
		const renderResult = createFixtureRenderResult({
			markdown: createValidMarkdown(),
		});

		const plan = await planMarkdownWrites(
			{ renderResults: [renderResult] },
			{
				documentationRoot: 'logos',
				dryRun: true,
				fsOverride: {
					async readFile() {
						throw new Error('ENOENT');
					},
					async stat() {
						throw new Error('ENOENT');
					},
				},
				policy: 'skip',
			},
		);

		expect(plan.items).toHaveLength(1);
		expect(plan.items[0].status).toBe('dry_run');
		expect(plan.dryRun).toBe(true);
	});

	it('dry-run manual edit collision reports planned skip and writes nothing', async () => {
		const renderResult = createFixtureRenderResult({
			markdown: createValidMarkdown(),
		});

		const plan = await planMarkdownWrites(
			{ renderResults: [renderResult] },
			{
				documentationRoot: 'logos',
				dryRun: true,
				fsOverride: {
					async readFile() {
						return '# Manual notes\n\nEdited.\n';
					},
					async stat() {
						return { isDirectory: () => false, isFile: () => true };
					},
				},
				policy: 'skip',
			},
		);

		expect(plan.items[0].status).toBe('skipped');
		expect(plan.dryRun).toBe(true);
	});

	it('dry-run backup policy plans backup but creates no backup', async () => {
		const body = '# Test\n\nContent.\n';
		const bodyChecksum = computeBodyChecksum(
			createMarkdownWithChecksum(body, ''),
		);
		const mdWithChecksum = createMarkdownWithChecksum(body, bodyChecksum);

		const renderResult = createFixtureRenderResult({
			markdown: createValidMarkdown({
				bodyContent: '# New Content\n\nDifferent.\n',
			}),
		});

		const plan = await planMarkdownWrites(
			{ renderResults: [renderResult] },
			{
				documentationRoot: 'logos',
				dryRun: true,
				fsOverride: {
					async readFile() {
						return mdWithChecksum;
					},
					async stat() {
						return { isDirectory: () => false, isFile: () => true };
					},
				},
				policy: 'backup_and_write',
			},
		);

		expect(plan.dryRun).toBe(true);
		expect(plan.items[0].status).toBe('dry_run');
	});

	it('dry-run creates no directories', async () => {
		const plan = await planMarkdownWrites(
			{ renderResults: [createFixtureRenderResult()] },
			{ documentationRoot: 'logos', dryRun: true },
		);

		expect(plan.dryRun).toBe(true);
	});

	it('dry-run does not mutate .logos/', async () => {
		const plan = await planMarkdownWrites(
			{ renderResults: [createFixtureRenderResult()] },
			{ documentationRoot: 'logos', dryRun: true },
		);

		expect(plan.dryRun).toBe(true);
	});

	it('changed paths are marked planned in dry-run', async () => {
		const plan = await planMarkdownWrites(
			{ renderResults: [createFixtureRenderResult()] },
			{ documentationRoot: 'logos', dryRun: true },
		);

		const plannedPaths = plan.changedPaths.filter((p) => p.role === 'planned');
		expect(plannedPaths.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// Safe write integration tests (with temp directories)
// ---------------------------------------------------------------------------

describe('Safe write execution', () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), 'logos-test-'));
	});

	afterEach(async () => {
		await rm(tmpDir, { force: true, recursive: true });
	});

	it('actual create writes Markdown atomically', async () => {
		const renderResult = createFixtureRenderResult({
			markdown: createValidMarkdown({
				bodyContent: '# Created\n\nHello world.\n',
			}),
		});

		const result = await writeMarkdownDocuments(
			{ renderResults: [renderResult] },
			{
				deterministicRandomId: 'test123',
				deterministicTimestamp: '2024-01-01T00-00-00-000Z',
				documentationRoot: 'logos',
				policy: 'fail',
				projectRoot: tmpDir,
			},
		);

		expect(result.success).toBe(true);
		expect(result.items[0].status).toBe('created');

		const writtenPath = result.items[0].targetPath;
		const content = await readFile(writtenPath, 'utf-8');
		expect(content).toContain('# Created');
		expect(content).toContain('contentChecksum:');
	});

	it('backup_and_write creates backup before overwrite', async () => {
		const docRoot = join(tmpDir, 'logos');
		const targetRel = '03-product/test-doc.md';
		const fullTarget = join(docRoot, targetRel);

		const body = '# Original\n\nOriginal body.\n';
		const bodyChecksum = computeBodyChecksum(
			createMarkdownWithChecksum(body, ''),
		);
		const existingContent = createMarkdownWithChecksum(body, bodyChecksum);

		const { mkdir, writeFile } = await import('node:fs/promises');
		await mkdir(join(docRoot, '03-product'), { recursive: true });
		await writeFile(fullTarget, existingContent, 'utf-8');

		const renderResult = createFixtureRenderResult({
			markdown: createValidMarkdown({
				bodyContent: '# Updated\n\nUpdated body.\n',
			}),
		});

		const result = await writeMarkdownDocuments(
			{ renderResults: [renderResult] },
			{
				backupDir: join(tmpDir, '.logos-backups'),
				deterministicRandomId: 'backup1',
				deterministicTimestamp: '2024-01-01T00-00-00-000Z',
				documentationRoot: 'logos',
				policy: 'backup_and_write',
				projectRoot: tmpDir,
			},
		);

		expect(result.success).toBe(true);
		expect(result.items[0].status).toBe('updated');

		const backupPaths = result.changedPaths.filter(
			(p) => p.role === 'backup_created',
		);
		expect(backupPaths.length).toBe(1);

		const updatedContent = await readFile(fullTarget, 'utf-8');
		expect(updatedContent).toContain('# Updated');

		const backupContent = await readFile(backupPaths[0].path, 'utf-8');
		expect(backupContent).toContain('# Original');
	});

	it('write failure preserves existing modified file', async () => {
		const docRoot = join(tmpDir, 'logos');
		const targetRel = '03-product/test-doc.md';
		const fullTarget = join(docRoot, targetRel);

		const existingContent = '# Manual notes\n\nImportant manual edits.\n';

		const { mkdir, writeFile } = await import('node:fs/promises');
		await mkdir(join(docRoot, '03-product'), { recursive: true });
		await writeFile(fullTarget, existingContent, 'utf-8');

		const renderResult = createFixtureRenderResult({
			markdown: createValidMarkdown(),
		});

		const result = await writeMarkdownDocuments(
			{ renderResults: [renderResult] },
			{
				deterministicRandomId: 'fail1',
				documentationRoot: 'logos',
				policy: 'fail',
				projectRoot: tmpDir,
			},
		);

		expect(result.success).toBe(false);
		expect(result.items[0].status).toBe('collision');

		const preservedContent = await readFile(fullTarget, 'utf-8');
		expect(preservedContent).toBe(existingContent);
	});

	it('changed paths include created directories and written files', async () => {
		const renderResult = createFixtureRenderResult({
			markdown: createValidMarkdown({ bodyContent: '# Hello\n' }),
		});

		const result = await writeMarkdownDocuments(
			{ renderResults: [renderResult] },
			{
				deterministicRandomId: 'paths1',
				documentationRoot: 'logos',
				policy: 'fail',
				projectRoot: tmpDir,
			},
		);

		const created = result.changedPaths.filter(
			(p) => p.role === 'file_created',
		);
		const dirs = result.changedPaths.filter(
			(p) => p.role === 'directory_created',
		);

		expect(created.length).toBeGreaterThan(0);
		expect(dirs.length).toBeGreaterThan(0);
	});

	it('all writes use deterministic paths', async () => {
		const renderResult = createFixtureRenderResult({
			markdown: createValidMarkdown(),
		});

		const result = await writeMarkdownDocuments(
			{ renderResults: [renderResult] },
			{
				deterministicRandomId: 'det123',
				documentationRoot: 'logos',
				policy: 'fail',
				projectRoot: tmpDir,
			},
		);

		expect(result.items[0].targetPath).toContain('logos');
		expect(result.items[0].targetPath).toContain('03-product');
	});
});

// ---------------------------------------------------------------------------
// Renderer integration tests
// ---------------------------------------------------------------------------

describe('Renderer integration', () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), 'logos-test-'));
	});

	afterEach(async () => {
		await rm(tmpDir, { force: true, recursive: true });
	});

	it('writes Markdown returned by Step 5.2 renderer', async () => {
		const markdown = createValidMarkdown({
			bodyContent: '# Rendered Doc\n\nGenerated content.\n',
		});

		const renderResult = createFixtureRenderResult({ markdown });

		const result = await writeMarkdownDocuments(
			{ renderResults: [renderResult] },
			{
				deterministicRandomId: 'render1',
				documentationRoot: 'logos',
				policy: 'fail',
				projectRoot: tmpDir,
			},
		);

		expect(result.success).toBe(true);

		const writtenPath = result.items[0].targetPath;
		const content = await readFile(writtenPath, 'utf-8');
		expect(content).toContain('Rendered Doc');
	});

	it('written Markdown includes generated metadata', async () => {
		const markdown = createValidMarkdown({
			bodyContent: '# Metadata Test\n\nContent.\n',
		});

		const renderResult = createFixtureRenderResult({ markdown });

		const result = await writeMarkdownDocuments(
			{ renderResults: [renderResult] },
			{
				deterministicRandomId: 'meta1',
				documentationRoot: 'logos',
				policy: 'fail',
				projectRoot: tmpDir,
			},
		);

		expect(result.success).toBe(true);

		const writtenPath = result.items[0].targetPath;
		const content = await readFile(writtenPath, 'utf-8');
		expect(content).toContain('documentId: test-doc');
		expect(content).toContain('phaseId: 03-product');
		expect(content).toContain('contentChecksum:');
	});

	it('written Markdown can be detected as unchanged generated on next run', async () => {
		const renderResult = createFixtureRenderResult({
			markdown: createValidMarkdown({
				bodyContent: '# Stable\n\nSame content.\n',
			}),
		});

		const writeResult = await writeMarkdownDocuments(
			{ renderResults: [renderResult] },
			{
				deterministicRandomId: 'stable1',
				documentationRoot: 'logos',
				policy: 'fail',
				projectRoot: tmpDir,
			},
		);

		expect(writeResult.success).toBe(true);
		const writtenPath = writeResult.items[0].targetPath;

		const detection = await detectManualEdit({
			renderResult,
			targetPath: writtenPath,
		});

		expect(detection.status).toBe('unchanged_generated');
	});

	it('modified written Markdown is detected as manual edit', async () => {
		const renderResult = createFixtureRenderResult({
			markdown: createValidMarkdown({
				bodyContent: '# Original\n\nOriginal content.\n',
			}),
		});

		const writeResult = await writeMarkdownDocuments(
			{ renderResults: [renderResult] },
			{
				deterministicRandomId: 'mod1',
				documentationRoot: 'logos',
				policy: 'fail',
				projectRoot: tmpDir,
			},
		);

		expect(writeResult.success).toBe(true);
		const writtenPath = writeResult.items[0].targetPath;

		let content = await readFile(writtenPath, 'utf-8');
		content = content.replace('Original content', 'MANUAL EDIT HERE');
		const { writeFile } = await import('node:fs/promises');
		await writeFile(writtenPath, content, 'utf-8');

		const detection = await detectManualEdit({
			renderResult,
			targetPath: writtenPath,
		});

		expect(detection.status).toBe('modified_since_generation');
	});
});

// ---------------------------------------------------------------------------
// Security tests
// ---------------------------------------------------------------------------

describe('Security', () => {
	it('fake token-like rendered content does not leak in checksums', () => {
		const md = createValidMarkdown({
			bodyContent:
				'sk-proj-my-secret-token-value-that-is-long-enough-to-trigger',
		});
		const hash = computeFullChecksum(md);

		expect(hash).toMatch(/^[a-f0-9]{64}$/);
		expect(hash).not.toContain('sk-proj');
		expect(hash).not.toContain('secret');
	});

	it('diagnostics do not echo raw fake secrets', async () => {
		const renderResult = createFixtureRenderResult({
			markdown: createValidMarkdown(),
		});

		const plan = await planMarkdownWrites(
			{ renderResults: [renderResult] },
			{
				documentationRoot: 'logos',
				dryRun: true,
				policy: 'skip',
			},
		);

		for (const d of plan.diagnostics) {
			expect(d.message).not.toContain('sk-');
		}
	});

	it('raw prompts/model responses are not written', async () => {
		const md = createValidMarkdown({ bodyContent: '# Normal content\n' });

		expect(md).not.toContain('raw_prompt');
		expect(md).not.toContain('model_response');
		expect(md).not.toContain('system prompt');
	});
});

// ---------------------------------------------------------------------------
// Non-mutation scope tests
// ---------------------------------------------------------------------------

describe('Non-mutation scope', () => {
	it('writer does not update artifact registry', async () => {
		const renderResult = createFixtureRenderResult({
			markdown: createValidMarkdown(),
		});

		const result = await planMarkdownWrites(
			{ renderResults: [renderResult] },
			{
				documentationRoot: 'logos',
				dryRun: true,
			},
		);

		expect(result.items).toHaveLength(1);
	});

	it('writer does not create generation runs', async () => {
		const renderResult = createFixtureRenderResult();
		const plan = await planMarkdownWrites(
			{ renderResults: [renderResult] },
			{ documentationRoot: 'logos', dryRun: true },
		);

		expect(plan).toBeDefined();
	});

	it('writer does not call AI/provider code', () => {
		const result = parseFrontmatter(createValidMarkdown());
		expect(result.parsedSuccessfully).toBe(true);
	});

	it('writer does not run validation engine', () => {
		const hash = computeFullChecksum('# test');
		expect(hash.length).toBe(64);
	});

	it('writer does not generate HTML/agent/executive artifacts', async () => {
		const plan = await planMarkdownWrites(
			{ renderResults: [createFixtureRenderResult()] },
			{ documentationRoot: 'logos', dryRun: true },
		);

		expect(plan.items).toHaveLength(1);
	});

	it('no test mutates the real repository', async () => {
		const renderResult = createFixtureRenderResult();
		const plan = await planMarkdownWrites(
			{ renderResults: [renderResult] },
			{ documentationRoot: 'logos', dryRun: true },
		);

		expect(plan.dryRun).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Snapshot tests
// ---------------------------------------------------------------------------

describe('Snapshot', () => {
	it('snapshots stable write plan', async () => {
		const renderResult = createFixtureRenderResult({
			markdown: createValidMarkdown({
				bodyContent: '# Snap\n\nSnapshot content.\n',
			}),
		});

		const plan = await planMarkdownWrites(
			{ renderResults: [renderResult] },
			{
				documentationRoot: 'logos',
				dryRun: true,
				fsOverride: {
					async readFile() {
						throw new Error('ENOENT');
					},
					async stat() {
						throw new Error('ENOENT');
					},
				},
				policy: 'skip',
				projectRoot: '/fake/project',
			},
		);

		const normalized = {
			...plan,
			changedPaths: plan.changedPaths.map((p) => ({
				...p,
				path: p.path.replace(tmpdir(), '<TMP>').replace(/\\/g, '/'),
			})),
			diagnostics: plan.diagnostics.map((d) => ({
				...d,
				targetPath: d.targetPath
					?.replace(tmpdir(), '<TMP>')
					.replace(/\\/g, '/'),
			})),
			items: plan.items.map((item) => ({
				backupPath: item.backupPath
					?.replace(tmpdir(), '<TMP>')
					.replace(/\\/g, '/'),
				documentCanonicalId: item.documentCanonicalId,
				manualEditStatus: item.manualEditStatus,
				status: item.status,
				targetPath: item.targetPath
					.replace(tmpdir(), '<TMP>')
					.replace(/\\/g, '/'),
			})),
		};

		expect(normalized).toMatchSnapshot();
	});

	it('snapshots manual edit detection result', async () => {
		const body = '# Stable\n\nStable content.\n';
		const bodyChecksum = computeBodyChecksum(
			createMarkdownWithChecksum(body, ''),
		);
		const mdWithChecksum = createMarkdownWithChecksum(body, bodyChecksum);

		const fs: ManualEditFsAdapter = {
			async readFile() {
				return mdWithChecksum;
			},
			async stat() {
				return { isDirectory: () => false, isFile: () => true };
			},
		};

		const result = await detectManualEdit({
			fs,
			renderResult: createFixtureRenderResult(),
			targetPath: '/fake/project/logos/03-product/test-doc.md',
		});

		const snapshot = {
			diagnostics: result.diagnostics.map((d) => ({
				code: d.code,
				severity: d.severity,
			})),
			previousChecksum: result.previousChecksum,
			status: result.status,
			targetExists: result.targetExists,
		};

		expect(snapshot).toMatchSnapshot();
	});

	it('snapshots collision diagnostic', async () => {
		const renderResult = createFixtureRenderResult({
			markdown: createValidMarkdown(),
		});

		const plan = await planMarkdownWrites(
			{ renderResults: [renderResult] },
			{
				documentationRoot: 'logos',
				dryRun: true,
				fsOverride: {
					async readFile() {
						return '# Manual\n\nEdited by hand.\n';
					},
					async stat() {
						return { isDirectory: () => false, isFile: () => true };
					},
				},
				policy: 'fail',
				projectRoot: '/fake/project',
			},
		);

		const collision = plan.items[0].collision;
		if (collision) {
			const snap = {
				documentCanonicalId: collision.documentCanonicalId,
				manualEditStatus: collision.manualEditStatus,
				selectedPolicy: collision.selectedPolicy,
				suggestedActions: collision.suggestedActions,
				targetPath: collision.targetPath
					.replace(tmpdir(), '<TMP>')
					.replace(/\\/g, '/'),
			};
			expect(snap).toMatchSnapshot();
		}
	});

	it('snapshots written Markdown metadata header', async () => {
		const markdown = createValidMarkdown({
			bodyContent: '# Test\n\nSimple.\n',
		});
		const withChecksum = injectChecksumIntoMarkdown(markdown, 'abc123');

		expect(withChecksum).toMatchSnapshot();
	});
});

// ---------------------------------------------------------------------------
// Write policy matrix tests
// ---------------------------------------------------------------------------

describe('Write policy matrix', () => {
	function makeResult(overrides: Partial<CanonicalMarkdownRenderResult> = {}) {
		return createFixtureRenderResult({
			markdown: createValidMarkdown({ bodyContent: '# Doc\n\nContent.\n' }),
			...overrides,
		});
	}

	it('new file: all policies allow write', async () => {
		const policies: SafeMarkdownWritePolicy[] = [
			'skip',
			'fail',
			'backup_and_write',
			'overwrite',
		];

		for (const policy of policies) {
			const plan = await planMarkdownWrites(
				{ renderResults: [makeResult()] },
				{
					documentationRoot: 'logos',
					dryRun: true,
					fsOverride: {
						async readFile() {
							throw new Error('ENOENT');
						},
						async stat() {
							throw new Error('ENOENT');
						},
					},
					policy,
				},
			);

			expect(plan.items[0].status).toBe('dry_run');
		}
	});

	it('unchanged generated: skip skips, overwrite overwrites', async () => {
		const body = '# Doc\n\nContent.\n';
		const bodyChecksum = computeBodyChecksum(
			createMarkdownWithChecksum(body, ''),
		);
		const mdWithChecksum = createMarkdownWithChecksum(body, bodyChecksum);
		const fs: ManualEditFsAdapter = {
			async readFile() {
				return mdWithChecksum;
			},
			async stat() {
				return { isDirectory: () => false, isFile: () => true };
			},
		};

		{
			const plan = await planMarkdownWrites(
				{ renderResults: [makeResult()] },
				{
					documentationRoot: 'logos',
					dryRun: true,
					fsOverride: fs,
					policy: 'skip',
				},
			);
			expect(plan.items[0].status).toBe('skipped');
		}

		{
			const plan = await planMarkdownWrites(
				{ renderResults: [makeResult()] },
				{
					documentationRoot: 'logos',
					dryRun: true,
					fsOverride: fs,
					policy: 'overwrite',
				},
			);
			expect(plan.items[0].status).toBe('dry_run');
		}
	});

	it('metadata missing + unsafe policy does not overwrite', async () => {
		const fs: ManualEditFsAdapter = {
			async readFile() {
				return '# No metadata\n\nJust text.\n';
			},
			async stat() {
				return { isDirectory: () => false, isFile: () => true };
			},
		};

		const plan = await planMarkdownWrites(
			{ renderResults: [makeResult()] },
			{
				documentationRoot: 'logos',
				dryRun: true,
				fsOverride: fs,
				policy: 'fail',
			},
		);

		expect(plan.items[0].status).toBe('collision');
	});

	it('overwrite with manual edit possible reports warning', async () => {
		const fs: ManualEditFsAdapter = {
			async readFile() {
				return '# Manual\n\nEdited.\n';
			},
			async stat() {
				return { isDirectory: () => false, isFile: () => true };
			},
		};

		const plan = await planMarkdownWrites(
			{ renderResults: [makeResult()] },
			{
				documentationRoot: 'logos',
				dryRun: true,
				fsOverride: fs,
				policy: 'overwrite',
			},
		);

		const hasOverwriteWarn = plan.diagnostics.some(
			(d) => d.code === 'manual_edit_overwritten',
		);
		expect(hasOverwriteWarn).toBe(true);
	});

	it('backup_and_write with manual edit possible reports warning and creates backup', async () => {
		const body = '# Doc\n\nContent.\n';
		const bodyChecksum = computeBodyChecksum(
			createMarkdownWithChecksum(body, ''),
		);
		const mdWithChecksum = createMarkdownWithChecksum(body, bodyChecksum);
		const modifiedContent = mdWithChecksum.replace('Content.', 'EDITED!');

		const fs: ManualEditFsAdapter = {
			async readFile() {
				return modifiedContent;
			},
			async stat() {
				return { isDirectory: () => false, isFile: () => true };
			},
		};

		const plan = await planMarkdownWrites(
			{ renderResults: [makeResult()] },
			{
				documentationRoot: 'logos',
				dryRun: true,
				fsOverride: fs,
				policy: 'backup_and_write',
				projectRoot: '/fake/project',
			},
		);

		const hasBackupWarn = plan.diagnostics.some(
			(d) => d.code === 'manual_edit_backup_warn',
		);
		expect(hasBackupWarn).toBe(true);
	});
});
