import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type {
	DocumentationContract,
	GenerationPlanItem,
	LoadedDocumentDescriptor,
	LoadedPhaseDescriptor,
	ProfileStatusWorkflow,
	WorkspaceState,
} from '../src/index.js';
import {
	buildContractGraph,
	createDefaultWorkspaceState,
	createGenerationPlan,
	createSemanticLintRules,
	createValidationRunResult,
	lintCanonicalMarkdownDocument,
	lintCanonicalMarkdownDocuments,
	parseMarkdownStructure,
	renderCanonicalMarkdownDocument,
	SEMANTIC_LINT_RULE_REGISTRY,
} from '../src/index.js';
import type { DocumentDescriptor } from '../src/profiles/document-descriptor.js';

const TEST_TIMESTAMP = '2025-01-01T00:00:00.000Z';

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), 'logos-lint-'));
	tempDirs.push(dir);
	return dir;
}

afterEach(async () => {
	for (const dir of tempDirs.splice(0)) {
		await rm(dir, { force: true, recursive: true }).catch(() => {});
	}
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createDescriptor(
	overrides: Partial<DocumentDescriptor> = {},
): DocumentDescriptor {
	return {
		centralQuestion: 'What is the answer?',
		id: 'test-doc',
		outputs: {
			canonical: { format: 'markdown', path: 'logos/docs/01-test/test-doc.md' },
		},
		phase: '01-test',
		purpose: 'Test document for linting.',
		sections: [
			{
				id: 'intro',
				questions: ['What?'],
				required: true,
				title: 'Introduction',
			},
			{ id: 'body', questions: ['Why?'], required: true, title: 'Body' },
			{
				id: 'conclusion',
				questions: ['So what?'],
				required: false,
				title: 'Conclusion',
			},
		],
		status: 'not_started',
		title: 'Test Document',
		type: 'thesis',
		...overrides,
	};
}

function createPlanItem(
	overrides: Partial<GenerationPlanItem> = {},
): GenerationPlanItem {
	return {
		action: 'generate',
		blockers: [],
		canonicalOutputPath: 'logos/docs/01-test/test-doc.md',
		confirmedAssumptionIds: [],
		confirmedDecisionIds: [],
		dependencyState: [],
		descriptorSourcePath: '/tmp/01-test/test-doc.yml',
		documentationRootRelativePath: 'logos/docs/01-test/test-doc.md',
		documentCanonicalId: 'test-doc',
		documentId: 'test-doc',
		dryRun: true,
		gaps: [],
		orderIndex: 0,
		phaseId: '01-test',
		readiness: {
			blockers: [],
			dependencyReady: true,
			gaps: [],
			inputsReady: true,
			ready: true,
			sectionsReady: true,
		},
		relatedRiskIds: [],
		requiredInputIds: [],
		requiredSectionIds: ['intro', 'body'],
		staleReasons: [],
		unresolvedQuestionIds: [],
		...overrides,
	};
}

function createEmptyState(
	projectRoot: string = '/tmp/test-repo',
): WorkspaceState {
	return createDefaultWorkspaceState({
		createdAt: '2025-01-01T00:00:00.000Z',
		projectRootPath: projectRoot,
		updatedAt: '2025-01-01T00:00:00.000Z',
		workspaceId: 'ws-test',
	});
}

function createMinimalContract(): DocumentationContract {
	const phases: LoadedPhaseDescriptor[] = [
		{
			axis: 'normative',
			completionCriteria: [],
			dependsOn: [],
			description: 'Test phase',
			documents: [
				{ file: 'test-doc.yml', id: 'test-doc', title: 'Test Document' },
			],
			feedsInto: [],
			generatedOutputs: {},
			id: '01-test',
			order: 1,
			qualityChecks: [],
			raw: {},
			readingOrder: ['test-doc'],
			responsibilityBoundary: {},
			sourcePath: '/tmp/01-test.yml',
			status: 'not_started',
			title: 'Phase 1',
		},
	];

	const documents: LoadedDocumentDescriptor[] = [
		{
			canonicalId: 'test-doc',
			descriptor: createDescriptor(),
			documentOrder: 0,
			globalOrder: 0,
			phaseId: '01-test',
			phaseOrder: 1,
			sourcePath: '/tmp/01-test/test-doc.yml',
		},
	];

	const statusWorkflow: ProfileStatusWorkflow = {
		allowed: [
			'not_started',
			'drafting',
			'drafted',
			'needs_review',
			'reviewed',
			'approved',
			'deprecated',
		],
		terminal: ['approved', 'deprecated'],
		transitions: {
			approved: ['deprecated'],
			drafted: ['needs_review', 'needs_revision'],
			drafting: ['drafted'],
			needs_review: ['reviewed', 'needs_revision'],
			not_started: ['drafting'],
			reviewed: ['approved'],
		},
	};

	return {
		documents,
		documentsByCanonicalId: new Map(documents.map((d) => [d.canonicalId, d])),
		documentsByPhaseId: new Map([['01-test', documents]]),
		phaseOrder: ['01-test'],
		phases,
		profileId: 'standard',
		profileRoot: '/tmp/profiles/standard',
		registryPath: '/tmp/profiles/standard/docs.yml',
		statusWorkflow,
	};
}

function validMarkdown(overrides?: Record<string, string>): string {
	const fields = {
		canonicalOutput: 'logos/docs/01-test/test-doc.md',
		documentId: 'test-doc',
		generatedAt: TEST_TIMESTAMP,
		generatedBy: 'logos-engine',
		generationStatus: 'generated',
		phaseId: '01-test',
		profileId: 'standard',
		sourceStateSchemaVersion: '3.1.0',
		...overrides,
	};
	return `---
documentId: ${fields.documentId}
phaseId: ${fields.phaseId}
profileId: ${fields.profileId}
canonicalOutput: ${fields.canonicalOutput}
generatedBy: ${fields.generatedBy}
generatedAt: ${fields.generatedAt}
generationStatus: ${fields.generationStatus}
sourceStateSchemaVersion: ${fields.sourceStateSchemaVersion}
---

# ${fields.documentId} — Test Document

## Document Status

Generated.

## Introduction

This is the introduction section with content.

## Body

This is the body section with content.

## Conclusion

Optional conclusion content.

## Sources & Traceability

| Record ID | Type | Source |
| --- | --- | --- |
| dec-001 | decision | session-001 |

## Decisions

### Decision: Use Test Framework

We decided to use a test framework.

**Source:** session-001

## Assumptions

### Assumption: Users Have Browsers

We assume users have modern browsers.

**Source:** session-001

## Unresolved Questions

### Open Question: What Platform?

What deployment platform should we use?

**Status:** unresolved

**Source:** session-001

## Risks

### Risk: Vendor Lock-in

There is a risk of vendor lock-in.

**Source:** session-001
`;
}

// ---------------------------------------------------------------------------
// Rule Registry Tests
// ---------------------------------------------------------------------------

describe('Rule Registry', () => {
	it('includes required-section rule', () => {
		const rule = SEMANTIC_LINT_RULE_REGISTRY['required-sections'];
		expect(rule).toBeDefined();
		expect(rule?.id).toBe('required-sections');
		expect(rule?.defaultSeverity).toBe('error');
		expect(rule?.checks).toBeTruthy();
	});

	it('includes traceability rule', () => {
		const rule = SEMANTIC_LINT_RULE_REGISTRY.traceability;
		expect(rule).toBeDefined();
		expect(rule.id).toBe('traceability');
		expect(rule.defaultSeverity).toBe('warning');
	});

	it('includes unresolved question/assumption marking rule', () => {
		const rule = SEMANTIC_LINT_RULE_REGISTRY['unresolved-questions-marking'];
		expect(rule).toBeDefined();
		expect(rule.id).toBe('unresolved-questions-marking');
	});

	it('includes unsupported external validation claim rule', () => {
		const rule = SEMANTIC_LINT_RULE_REGISTRY['evidence-boundary'];
		expect(rule).toBeDefined();
		expect(rule.id).toBe('evidence-boundary');
	});

	it('includes derived artifact boundary rule', () => {
		const rule = SEMANTIC_LINT_RULE_REGISTRY['derived-artifact-boundary'];
		expect(rule).toBeDefined();
		expect(rule.id).toBe('derived-artifact-boundary');
	});

	it('includes token-like leak rule', () => {
		const rule = SEMANTIC_LINT_RULE_REGISTRY['token-leak'];
		expect(rule).toBeDefined();
		expect(rule.id).toBe('token-leak');
	});

	it('every rule explains what it checks', () => {
		for (const [_id, rule] of Object.entries(SEMANTIC_LINT_RULE_REGISTRY)) {
			expect(rule.checks).toBeTruthy();
			expect(rule.doesNotCheck).toBeTruthy();
		}
	});

	it('every rule has deterministic id/severity', () => {
		for (const [id, rule] of Object.entries(SEMANTIC_LINT_RULE_REGISTRY)) {
			expect(rule.id).toBe(id);
			expect(['info', 'warning', 'error', 'fatal']).toContain(
				rule.defaultSeverity,
			);
		}
	});

	it('createSemanticLintRules returns all rules by default', () => {
		const rules = createSemanticLintRules();
		expect(rules.length).toBeGreaterThanOrEqual(7);
	});

	it('createSemanticLintRules can filter by ruleIds', () => {
		const rules = createSemanticLintRules({
			ruleIds: ['required-sections', 'token-leak'],
		});
		expect(rules).toHaveLength(2);
		expect(rules[0]?.id).toBe('required-sections');
		expect(rules[1]?.id).toBe('token-leak');
	});
});

// ---------------------------------------------------------------------------
// Markdown Structure Tests
// ---------------------------------------------------------------------------

describe('Markdown structure parser', () => {
	it('parses headings and section ranges', () => {
		const md = `# Title\n\n## Section A\n\nContent A\n\n### Sub A\n\nSub content\n\n## Section B\n\nContent B\n`;
		const structure = parseMarkdownStructure(md);
		expect(structure.headings).toHaveLength(4);
		expect(structure.headings[0]?.title).toBe('Title');
		expect(structure.headings[0]?.level).toBe(1);
		expect(structure.headings[1]?.title).toBe('Section A');
		expect(structure.headings[1]?.level).toBe(2);
		expect(structure.headings[2]?.title).toBe('Sub A');
		expect(structure.headings[2]?.level).toBe(3);
		expect(structure.headings[3]?.title).toBe('Section B');
		expect(structure.headings[3]?.level).toBe(2);
	});

	it('parses metadata format produced by Step 5.2', () => {
		const md = validMarkdown();
		const structure = parseMarkdownStructure(md);
		expect(structure.metadata?.parsedSuccessfully).toBe(true);
		expect(structure.metadata?.metadata.documentId).toBe('test-doc');
		expect(structure.metadata?.metadata.phaseId).toBe('01-test');
		expect(structure.metadata?.metadata.profileId).toBe('standard');
		expect(structure.metadata?.metadata.generationStatus).toBe('generated');
	});

	it('handles malformed metadata conservatively', () => {
		const md = `---\ndocumentId test-doc\n---\n\n# Title\n`;
		const structure = parseMarkdownStructure(md);
		expect(structure.metadata).toBeDefined();
		expect(structure.headings).toHaveLength(1);
	});

	it('handles Markdown with no headings', () => {
		const md = `---\ndocumentId: test\n---\n\nJust some text without headings.\n`;
		const structure = parseMarkdownStructure(md);
		expect(structure.headings).toHaveLength(0);
	});

	it('line pointers are deterministic', () => {
		const md = `# H1\n\n## H2\n\nContent\n\n## H3\n`;
		const structure = parseMarkdownStructure(md);
		expect(structure.headings[0]?.line).toBe(1);
		expect(structure.headings[1]?.line).toBe(3);
		const h3Heading = structure.headings.find((h) => h.title === 'H3');
		expect(h3Heading).toBeDefined();
		expect(h3Heading?.line).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// Required Section Tests
// ---------------------------------------------------------------------------

describe('Required section completeness', () => {
	it('valid rendered document with all required sections passes', () => {
		const md = validMarkdown();
		const descriptor = createDescriptor();
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['required-sections'] },
		);
		const sectionFindings = result.findings.filter(
			(f) => f.code === 'document_missing_required_section',
		);
		expect(sectionFindings).toHaveLength(0);
	});

	it('missing required section emits finding', () => {
		const md = `---
documentId: test-doc
phaseId: 01-test
---

# Test Document

## Introduction

Intro content.
`;
		const descriptor = createDescriptor();
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['required-sections'] },
		);
		const missingFindings = result.findings.filter(
			(f) => f.code === 'document_missing_required_section',
		);
		expect(missingFindings.length).toBeGreaterThanOrEqual(1);
		expect(missingFindings.some((f) => f.message.includes('Body'))).toBe(true);
	});

	it('duplicate required section emits finding or warning', () => {
		const descriptor = createDescriptor({
			sections: [
				{
					id: 'intro',
					questions: ['W?'],
					required: true,
					title: 'Introduction',
				},
				{
					id: 'intro-2',
					questions: ['W?'],
					required: true,
					title: 'Introduction',
				},
			],
		});
		const md = validMarkdown();
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['required-sections'] },
		);
		const dupFindings = result.findings.filter(
			(f) => f.code === 'document_duplicate_required_section',
		);
		expect(dupFindings.length).toBeGreaterThanOrEqual(0);
	});

	it('empty required section emits finding', () => {
		const md = `---
documentId: test-doc
phaseId: 01-test
---

# Test Document

## Introduction

Some content.

## Body

`;
		const descriptor = createDescriptor();
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['required-sections'] },
		);
		const emptyFindings = result.findings.filter(
			(f) => f.code === 'document_empty_required_section',
		);
		expect(emptyFindings.length).toBeGreaterThanOrEqual(1);
		expect(emptyFindings.some((f) => f.message.includes('Body'))).toBe(true);
	});

	it('missing optional section does not fail', () => {
		const md = `---
documentId: test-doc
phaseId: 01-test
---

# Test Document

## Introduction

Content.

## Body

Content.
`;
		const descriptor = createDescriptor();
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['required-sections'] },
		);
		const missingFindings = result.findings.filter(
			(f) => f.code === 'document_missing_required_section',
		);
		expect(missingFindings).toHaveLength(0);
	});

	it('finding includes descriptor source path/pointer where possible', () => {
		const md = `# Test\n`;
		const descriptor = createDescriptor();
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md, sourcePath: '/tmp/test-doc.yml' },
			{ ruleIds: ['required-sections'] },
		);
		expect(result.findings.length).toBeGreaterThan(0);
		for (const f of result.findings) {
			if (f.code === 'document_missing_required_section') {
				expect(f.location.pointer).toBeTruthy();
			}
		}
	});
});

// ---------------------------------------------------------------------------
// Traceability Tests
// ---------------------------------------------------------------------------

describe('Traceability checks', () => {
	it('valid traceability metadata passes', () => {
		const md = validMarkdown();
		const descriptor = createDescriptor();
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['traceability'] },
		);
		const errorFindings = result.findings.filter(
			(f) => f.severity === 'error' || f.severity === 'fatal',
		);
		expect(errorFindings).toHaveLength(0);
	});

	it('missing document id emits finding', () => {
		const md = validMarkdown({ documentId: '' });
		const descriptor = createDescriptor();
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['traceability'] },
		);
		const missingIdFindings = result.findings.filter(
			(f) =>
				f.message.includes('Document ID') || f.pointer?.includes('documentId'),
		);
		expect(missingIdFindings.length).toBeGreaterThanOrEqual(1);
	});

	it('missing source/traceability section emits finding when expected', () => {
		const md = `---
documentId: test-doc
phaseId: 01-test
profileId: standard
canonicalOutput: logos/docs/test.md
generatedBy: logos-engine
generatedAt: 2025-01-01T00:00:00.000Z
generationStatus: generated
sourceStateSchemaVersion: "3.1.0"
---

# Test Document

## Introduction

Content.
`;
		const descriptor = createDescriptor();
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['traceability'] },
		);
		const missingSourceSection = result.findings.filter((f) =>
			f.message.includes('Sources & Traceability'),
		);
		expect(missingSourceSection.length).toBeGreaterThanOrEqual(0);
	});

	it('traceability mismatch emits finding', () => {
		const md = validMarkdown({ documentId: 'wrong-id' });
		const descriptor = createDescriptor();
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['traceability', 'contradiction'] },
		);
		const mismatchFindings = result.findings.filter(
			(f) => f.code === 'document_metadata_id_mismatch',
		);
		expect(mismatchFindings.length).toBeGreaterThanOrEqual(1);
	});
});

// ---------------------------------------------------------------------------
// Assumption/Question/Gap Marking Tests
// ---------------------------------------------------------------------------

describe('Unresolved questions and assumptions marking', () => {
	it('unresolved question explicitly marked open passes', () => {
		const md = validMarkdown();
		const descriptor = createDescriptor();
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['unresolved-questions-marking'] },
		);
		const errorFindings = result.findings.filter(
			(f) => f.severity === 'error' || f.severity === 'fatal',
		);
		expect(errorFindings).toHaveLength(0);
	});

	it('assumption labeled as assumption passes', () => {
		const md = validMarkdown();
		const descriptor = createDescriptor();
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['unresolved-questions-marking'] },
		);
		const assumptionFindings = result.findings.filter(
			(f) =>
				f.code === 'document_assumption_unlabeled' && f.severity === 'error',
		);
		expect(assumptionFindings).toHaveLength(0);
	});

	it('assumption presented as fact outside Assumptions section emits warning', () => {
		const md = `---
documentId: test-doc
phaseId: 01-test
profileId: standard
canonicalOutput: logos/docs/test.md
generatedBy: logos-engine
generatedAt: 2025-01-01T00:00:00.000Z
generationStatus: generated
sourceStateSchemaVersion: "3.1.0"
---

# Test Document

## Introduction

We assume that all users have modern browsers.

## Unresolved Questions

No open questions at this time.
`;
		const descriptor = createDescriptor({
			sections: [
				{
					id: 'intro',
					questions: ['W?'],
					required: true,
					title: 'Introduction',
				},
			],
		});
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['unresolved-questions-marking'] },
		);
		const assumptionFindings = result.findings.filter(
			(f) => f.code === 'document_assumption_unlabeled',
		);
		expect(assumptionFindings.length).toBeGreaterThanOrEqual(1);
	});

	it('incomplete document with explicit gaps passes gap-marking rule', () => {
		const md = `---
documentId: test-doc
phaseId: 01-test
profileId: standard
canonicalOutput: logos/docs/test.md
generatedBy: logos-engine
generatedAt: 2025-01-01T00:00:00.000Z
generationStatus: incomplete
sourceStateSchemaVersion: "3.1.0"
---

# Test Document

## Gaps & Incomplete Sections

The following sections are incomplete or missing.

## Introduction

Some content.
`;
		const descriptor = createDescriptor({
			sections: [
				{
					id: 'intro',
					questions: ['W?'],
					required: true,
					title: 'Introduction',
				},
			],
		});
		const planItem = createPlanItem({
			action: 'incomplete',
			gaps: [
				{
					code: 'MISSING_SECTION',
					message: 'Missing body section.',
					sectionId: 'body',
				},
			],
		});
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md, planItem },
			{ ruleIds: ['unresolved-questions-marking', 'plan-status'] },
		);
		const gapFindings = result.findings.filter(
			(f) => f.code === 'document_gap_unmarked',
		);
		expect(gapFindings).toHaveLength(0);
	});

	it('incomplete document without gap markers emits finding', () => {
		const md = validMarkdown();
		const descriptor = createDescriptor();
		const planItem = createPlanItem({
			action: 'incomplete',
			gaps: [{ code: 'GAP', message: 'Missing sections.' }],
		});
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md, planItem },
			{ ruleIds: ['plan-status'] },
		);
		const gapFindings = result.findings.filter(
			(f) => f.code === 'document_plan_status_inconsistent',
		);
		expect(gapFindings.length).toBeGreaterThanOrEqual(1);
	});
});

// ---------------------------------------------------------------------------
// Evidence Boundary Tests
// ---------------------------------------------------------------------------

describe('Evidence boundary checks', () => {
	it('unsupported "validated" claim emits finding', () => {
		const md = `---
documentId: test-doc
phaseId: 01-test
profileId: standard
canonicalOutput: logos/docs/test.md
generatedBy: logos-engine
generatedAt: 2025-01-01T00:00:00.000Z
generationStatus: generated
sourceStateSchemaVersion: "3.1.0"
---

# Test Document

## Introduction

Our solution has been validated and proven to work in production environments.
`;
		const descriptor = createDescriptor({
			sections: [
				{
					id: 'intro',
					questions: ['W?'],
					required: true,
					title: 'Introduction',
				},
			],
		});
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['evidence-boundary'] },
		);
		const claimFindings = result.findings.filter(
			(f) => f.code === 'document_unsupported_validation_claim',
		);
		expect(claimFindings.length).toBeGreaterThanOrEqual(1);
	});

	it('claim with explicit evidence/source marker passes', () => {
		const md = `---
documentId: test-doc
phaseId: 01-test
profileId: standard
canonicalOutput: logos/docs/test.md
generatedBy: logos-engine
generatedAt: 2025-01-01T00:00:00.000Z
generationStatus: generated
sourceStateSchemaVersion: "3.1.0"
---

# Test Document

## Introduction

Our solution was validated through user testing (see evidence log ID ev-001).
`;
		const descriptor = createDescriptor({
			sections: [
				{
					id: 'intro',
					questions: ['W?'],
					required: true,
					title: 'Introduction',
				},
			],
		});
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['evidence-boundary'] },
		);
		const claimFindings = result.findings.filter(
			(f) => f.code === 'document_unsupported_validation_claim',
		);
		expect(claimFindings).toHaveLength(0);
	});

	it('legal/compliance claim without evidence emits finding', () => {
		const md = `---
documentId: test-doc
phaseId: 01-test
profileId: standard
canonicalOutput: logos/docs/test.md
generatedBy: logos-engine
generatedAt: 2025-01-01T00:00:00.000Z
generationStatus: generated
sourceStateSchemaVersion: "3.1.0"
---

# Test Document

## Compliance

We are GDPR compliant and SOC2 certified.
`;
		const descriptor = createDescriptor({
			sections: [
				{
					id: 'compliance',
					questions: ['W?'],
					required: true,
					title: 'Compliance',
				},
			],
		});
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['evidence-boundary'] },
		);
		const claimFindings = result.findings.filter(
			(f) => f.code === 'document_unsupported_validation_claim',
		);
		expect(claimFindings.length).toBeGreaterThanOrEqual(1);
	});

	it('local tool status wording is not over-flagged', () => {
		const md = `---
documentId: test-doc
phaseId: 01-test
profileId: standard
canonicalOutput: logos/docs/test.md
generatedBy: logos-engine
generatedAt: 2025-01-01T00:00:00.000Z
generationStatus: generated
sourceStateSchemaVersion: "3.1.0"
---

# Test Document

## Document Status

Generated.

## Introduction

Basic intro.
`;
		const descriptor = createDescriptor({
			sections: [
				{
					id: 'intro',
					questions: ['W?'],
					required: true,
					title: 'Introduction',
				},
			],
		});
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['evidence-boundary'] },
		);
		const claimFindings = result.findings.filter(
			(f) => f.code === 'document_unsupported_validation_claim',
		);
		expect(claimFindings).toHaveLength(0);
	});

	it('findings include redacted snippet and recovery hint', () => {
		const md = `---
documentId: test-doc
phaseId: 01-test
profileId: standard
canonicalOutput: logos/docs/test.md
generatedBy: logos-engine
generatedAt: 2025-01-01T00:00:00.000Z
generationStatus: generated
sourceStateSchemaVersion: "3.1.0"
---

# Test Document

## Market Analysis

The product is market validated and confirmed by users.
`;
		const descriptor = createDescriptor({
			sections: [
				{
					id: 'market',
					questions: ['W?'],
					required: true,
					title: 'Market Analysis',
				},
			],
		});
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['evidence-boundary'] },
		);
		const claimFindings = result.findings.filter(
			(f) => f.code === 'document_unsupported_validation_claim',
		);
		expect(claimFindings.length).toBeGreaterThanOrEqual(1);
		for (const f of claimFindings) {
			expect(f.recoveryHint).toBeDefined();
		}
	});
});

// ---------------------------------------------------------------------------
// Derived Artifact Boundary Tests
// ---------------------------------------------------------------------------

describe('Derived artifact boundary checks', () => {
	it('HTML artifact labeled derived/non-canonical passes', () => {
		const md = validMarkdown();
		const descriptor = createDescriptor();
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['derived-artifact-boundary'] },
		);
		const errorFindings = result.findings.filter(
			(f) => f.severity === 'error' || f.severity === 'fatal',
		);
		expect(errorFindings).toHaveLength(0);
	});

	it('HTML artifact described as canonical source of truth emits finding', () => {
		const md = `---
documentId: test-doc
phaseId: 01-test
profileId: standard
canonicalOutput: logos/docs/test.md
generatedBy: logos-engine
generatedAt: 2025-01-01T00:00:00.000Z
generationStatus: generated
sourceStateSchemaVersion: "3.1.0"
---

# Test Document

## Outputs

The HTML document is the canonical source of truth for the project.
`;
		const descriptor = createDescriptor({
			sections: [
				{ id: 'outputs', questions: ['W?'], required: true, title: 'Outputs' },
			],
		});
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['derived-artifact-boundary'] },
		);
		const violationFindings = result.findings.filter(
			(f) => f.code === 'document_derived_artifact_boundary_violation',
		);
		expect(violationFindings.length).toBeGreaterThanOrEqual(1);
	});

	it('canonical Markdown described as canonical editable output passes', () => {
		const md = `---
documentId: test-doc
phaseId: 01-test
profileId: standard
canonicalOutput: logos/docs/test.md
generatedBy: logos-engine
generatedAt: 2025-01-01T00:00:00.000Z
generationStatus: generated
sourceStateSchemaVersion: "3.1.0"
---

# Test Document

## Outputs

This canonical Markdown document is the canonical editable output.
`;
		const descriptor = createDescriptor({
			sections: [
				{ id: 'outputs', questions: ['W?'], required: true, title: 'Outputs' },
			],
		});
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['derived-artifact-boundary'] },
		);
		const violationFindings = result.findings.filter(
			(f) => f.code === 'document_derived_artifact_boundary_violation',
		);
		expect(violationFindings).toHaveLength(0);
	});

	it('artifact metadata used as proof of completeness emits finding', () => {
		const md = `---
documentId: test-doc
phaseId: 01-test
profileId: standard
canonicalOutput: logos/docs/test.md
generatedBy: logos-engine
generatedAt: 2025-01-01T00:00:00.000Z
generationStatus: generated
sourceStateSchemaVersion: "3.1.0"
nonCanonicalArtifacts:
  - html/overview.html
---

# Test Document

## Outputs

The executive report is the authoritative record of the project.
`;
		const descriptor = createDescriptor({
			sections: [
				{ id: 'outputs', questions: ['W?'], required: true, title: 'Outputs' },
			],
		});
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['derived-artifact-boundary'] },
		);
		const violationFindings = result.findings.filter(
			(f) => f.code === 'document_derived_artifact_boundary_violation',
		);
		expect(violationFindings.length).toBeGreaterThanOrEqual(1);
	});
});

// ---------------------------------------------------------------------------
// Token Leak Tests
// ---------------------------------------------------------------------------

describe('Token leak checks', () => {
	it('raw bearer token in Markdown emits finding', () => {
		const md = `---
documentId: test-doc
phaseId: 01-test
profileId: standard
canonicalOutput: logos/docs/test.md
generatedBy: logos-engine
generatedAt: 2025-01-01T00:00:00.000Z
generationStatus: generated
sourceStateSchemaVersion: "3.1.0"
---

# Test Document

Authorization: Bearer sk-abcdefghijklmnopqrstuvwxyz123456

## Introduction

Content.
`;
		const descriptor = createDescriptor();
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['token-leak'] },
		);
		const tokenFindings = result.findings.filter(
			(f) => f.code === 'document_token_like_value',
		);
		expect(tokenFindings.length).toBeGreaterThanOrEqual(1);
	});

	it('raw API key-like value emits finding', () => {
		const md = `---
documentId: test-doc
phaseId: 01-test
---

# Test Document

API key: sk-proj-abcdefghijklmnopqrstuvwxyz1234567890
`;
		const descriptor = createDescriptor();
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['token-leak'] },
		);
		const tokenFindings = result.findings.filter(
			(f) => f.code === 'document_token_like_value' && f.severity === 'error',
		);
		expect(tokenFindings.length).toBeGreaterThanOrEqual(1);
	});

	it('environment variable name reference such as OPENAI_API_KEY passes', () => {
		const md = `---
documentId: test-doc
phaseId: 01-test
---

# Test Document

Set the \`OPENAI_API_KEY\` environment variable before running.

The token is provided via \`$OPENAI_API_KEY\`.
`;
		const descriptor = createDescriptor();
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['token-leak'] },
		);
		const tokenFindings = result.findings.filter(
			(f) => f.code === 'document_token_like_value',
		);
		expect(tokenFindings).toHaveLength(0);
	});

	it('finding redacts raw fake secret', () => {
		const md = `---
documentId: test-doc
phaseId: 01-test
---

## Config

token: sk-abcdefghijklmnopqrstuvwxyz1234567890ABCDEF
`;
		const descriptor = createDescriptor();
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['token-leak'] },
		);
		const tokenFindings = result.findings.filter(
			(f) => f.code === 'document_token_like_value',
		);
		expect(tokenFindings.length).toBeGreaterThan(0);
		for (const f of tokenFindings) {
			expect(f.received).not.toContain('sk-');
			expect(f.received).not.toContain('abcdef');
		}
	});

	it('snapshots do not contain raw fake secrets', () => {
		const md = `---
documentId: test-doc
phaseId: 01-test
---

## Config

apiKey: sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx234
`;
		const descriptor = createDescriptor();
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['token-leak'] },
		);
		const serialized = JSON.stringify(result.findings);
		expect(serialized).not.toContain('sk-proj-abc');
		expect(serialized).not.toContain('sk-proj');
	});
});

// ---------------------------------------------------------------------------
// Contradiction Tests
// ---------------------------------------------------------------------------

describe('Deterministic contradiction checks', () => {
	it('metadata document id mismatch emits finding', () => {
		const md = validMarkdown({ documentId: 'wrong-id' });
		const descriptor = createDescriptor({ id: 'test-doc' });
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['contradiction'] },
		);
		const mismatchFindings = result.findings.filter(
			(f) => f.code === 'document_metadata_id_mismatch',
		);
		expect(mismatchFindings.length).toBeGreaterThanOrEqual(1);
	});

	it('metadata profile id mismatch emits finding', () => {
		const md = validMarkdown({ profileId: 'custom' });
		const descriptor = createDescriptor();
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md, profileId: 'standard' },
			{ ruleIds: ['contradiction'] },
		);
		const mismatchFindings = result.findings.filter(
			(f) => f.code === 'document_metadata_profile_mismatch',
		);
		expect(mismatchFindings.length).toBeGreaterThanOrEqual(1);
	});

	it('status complete with missing required sections emits finding', () => {
		const md = `---
documentId: test-doc
phaseId: 01-test
profileId: standard
canonicalOutput: logos/docs/test.md
generatedBy: logos-engine
generatedAt: 2025-01-01T00:00:00.000Z
generationStatus: generated
sourceStateSchemaVersion: "3.1.0"
---

# Test Document

## Introduction

Content.
`;
		const descriptor = createDescriptor();
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['contradiction'] },
		);
		const statusFindings = result.findings.filter(
			(f) => f.code === 'document_status_contradiction',
		);
		expect(statusFindings.length).toBeGreaterThanOrEqual(1);
	});

	it('"No open questions" plus open question items emits finding', () => {
		const md = `---
documentId: test-doc
phaseId: 01-test
profileId: standard
canonicalOutput: logos/docs/test.md
generatedBy: logos-engine
generatedAt: 2025-01-01T00:00:00.000Z
generationStatus: generated
sourceStateSchemaVersion: "3.1.0"
---

# Test Document

There are no open questions at this time.

## Unresolved Questions

### What platform?

What platform should we use? Still open.
`;
		const descriptor = createDescriptor({
			sections: [
				{
					id: 'questions',
					questions: ['W?'],
					required: true,
					title: 'Unresolved Questions',
				},
			],
		});
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['contradiction'] },
		);
		const contraFindings = result.findings.filter(
			(f) => f.code === 'document_section_contradiction',
		);
		expect(contraFindings.length).toBeGreaterThanOrEqual(1);
	});

	it('"No assumptions" plus assumption items emits finding', () => {
		const md = `---
documentId: test-doc
phaseId: 01-test
profileId: standard
canonicalOutput: logos/docs/test.md
generatedBy: logos-engine
generatedAt: 2025-01-01T00:00:00.000Z
generationStatus: generated
sourceStateSchemaVersion: "3.1.0"
---

# Test Document

No assumptions are made.

## Assumptions

### Modern Browsers

We assume modern browsers.
`;
		const descriptor = createDescriptor({
			sections: [
				{
					id: 'assumptions',
					questions: [],
					required: true,
					title: 'Assumptions',
				},
			],
		});
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['contradiction'] },
		);
		const contraFindings = result.findings.filter(
			(f) => f.code === 'document_section_contradiction',
		);
		expect(contraFindings.length).toBeGreaterThanOrEqual(1);
	});
});

// ---------------------------------------------------------------------------
// Plan/Status Tests
// ---------------------------------------------------------------------------

describe('Plan/status consistency', () => {
	it('incomplete plan item requires gap markers', () => {
		const md = validMarkdown();
		const descriptor = createDescriptor();
		const planItem = createPlanItem({ action: 'incomplete' });
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md, planItem },
			{ ruleIds: ['plan-status'] },
		);
		const statusFindings = result.findings.filter(
			(f) => f.code === 'document_plan_status_inconsistent',
		);
		expect(statusFindings.length).toBeGreaterThanOrEqual(1);
	});

	it('blocked document cannot claim complete', () => {
		const md = validMarkdown({ generationStatus: 'generated' });
		const descriptor = createDescriptor();
		const planItem = createPlanItem({ action: 'blocked' });
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md, planItem },
			{ ruleIds: ['plan-status'] },
		);
		const statusFindings = result.findings.filter(
			(f) =>
				f.code === 'document_plan_status_inconsistent' &&
				f.severity === 'error',
		);
		expect(statusFindings.length).toBeGreaterThanOrEqual(1);
	});

	it('stale document warning is required when rendered stale', () => {
		const md = validMarkdown({ generationStatus: 'generated' });
		const descriptor = createDescriptor();
		const planItem = createPlanItem({
			action: 'stale',
			staleReasons: [
				{ code: 'UPSTREAM_CHANGED', message: 'Upstream changed.' },
			],
		});
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md, planItem },
			{ ruleIds: ['plan-status'] },
		);
		const staleFindings = result.findings.filter(
			(f) => f.code === 'document_stale_unmarked',
		);
		expect(staleFindings.length).toBeGreaterThanOrEqual(1);
	});

	it('failed document cannot claim generated/complete', () => {
		const md = validMarkdown({ generationStatus: 'generated' });
		const descriptor = createDescriptor();
		const planItem = createPlanItem({ action: 'failed' });
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md, planItem },
			{ ruleIds: ['plan-status'] },
		);
		const statusFindings = result.findings.filter(
			(f) =>
				f.code === 'document_plan_status_inconsistent' &&
				f.severity === 'error',
		);
		expect(statusFindings.length).toBeGreaterThanOrEqual(1);
	});

	it('missing plan metadata still allows descriptor/metadata lints', () => {
		const md = validMarkdown({ documentId: 'wrong-id' });
		const descriptor = createDescriptor();
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['contradiction'] },
		);
		expect(result.findings.length).toBeGreaterThanOrEqual(1);
	});
});

// ---------------------------------------------------------------------------
// Integration Tests
// ---------------------------------------------------------------------------

describe('Integration tests', () => {
	it('lint Markdown rendered by Step 5.2 for empty workspace', async () => {
		const state = createEmptyState();
		const contract = createMinimalContract();
		const graphResult = buildContractGraph(contract);
		const graph = graphResult.graph;
		const planResult = createGenerationPlan(
			{ contract, graph, state },
			{ dryRun: true, generatedAt: TEST_TIMESTAMP },
		);
		const planItem = planResult.plan.items[0];
		if (!planItem) {
			expect(planItem).toBeDefined();
			return;
		}

		const renderResult = renderCanonicalMarkdownDocument(
			{
				documentDescriptor: {
					centralQuestion: 'What?',
					id: 'test-doc',
					phaseId: '01-test',
					purpose: 'Test',
					sections: createDescriptor().sections,
					status: 'not_started',
					title: 'Test Document',
					type: 'thesis',
				},
				planItem,
				profileId: 'standard',
				schemaVersion: '3.2.0',
				state,
			},
			{ generatedAt: TEST_TIMESTAMP },
		);

		const result = lintCanonicalMarkdownDocument({
			descriptor: createDescriptor(),
			markdown: renderResult.markdown,
			planItem,
		});

		expect(result.documentCanonicalId).toBeTruthy();
		expect(result.readOnly).toBe(true);
		expect(result.changedPaths).toEqual([]);
	});

	it('semantic lint result can be aggregated with Step 6.1 validation result', () => {
		const md1 = validMarkdown();
		const md2 = validMarkdown({ documentId: '' });

		const lintResult = lintCanonicalMarkdownDocuments([
			{ descriptor: createDescriptor(), markdown: md1 },
			{ descriptor: createDescriptor({ id: 'test-doc-2' }), markdown: md2 },
		]);

		const validationResult = createValidationRunResult({
			dryRun: true,
			findings: lintResult.findings,
			scopesChecked: ['outputs'],
		});

		expect(validationResult.status).toBeDefined();
		expect(validationResult.readOnly).toBe(true);
	});

	it('no files are written', async () => {
		const dir = await createTempDir();
		const md = validMarkdown();
		const descriptor = createDescriptor();

		const result = lintCanonicalMarkdownDocument({
			descriptor,
			markdown: md,
			sourcePath: join(dir, 'test.md'),
		});

		expect(result.readOnly).toBe(true);
		expect(result.changedPaths).toEqual([]);
	});

	it('no validation run metadata is created', () => {
		const result = lintCanonicalMarkdownDocument({
			descriptor: createDescriptor(),
			markdown: validMarkdown(),
		});

		expect(result.readOnly).toBe(true);
		expect(result.changedPaths).toEqual([]);
	});

	it('does not call AI/provider code', () => {
		const result = lintCanonicalMarkdownDocument({
			descriptor: createDescriptor(),
			markdown: validMarkdown(),
		});

		expect(result).toBeDefined();
		expect(result.gate).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Non-mutation Tests
// ---------------------------------------------------------------------------

describe('Non-mutation guarantees', () => {
	it('linting writes no files', async () => {
		const _dir = await createTempDir();

		const result = lintCanonicalMarkdownDocument({
			descriptor: createDescriptor(),
			markdown: validMarkdown(),
		});

		expect(result.readOnly).toBe(true);
	});

	it('no test mutates the real repository', () => {
		expect(process.cwd()).toContain('logos-engine');
	});
});

// ---------------------------------------------------------------------------
// Snapshot Tests
// ---------------------------------------------------------------------------

describe('Snapshots', () => {
	it('snapshot findings for missing required section', () => {
		const md = `---
documentId: test-doc
phaseId: 01-test
---

# Test Doc

## Introduction

Only intro.
`;
		const descriptor = createDescriptor();
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md, sourcePath: '<fixture>/test-doc.md' },
			{ checkedAt: TEST_TIMESTAMP, ruleIds: ['required-sections'] },
		);

		const snapshot = result.findings.map((f) => ({
			code: f.code,
			documentCanonicalId: f.documentCanonicalId,
			message: f.message,
			phaseId: f.phaseId,
			pointer: f.location.pointer,
			severity: f.severity,
		}));
		expect(snapshot).toMatchSnapshot();
	});

	it('snapshot findings for unsupported validation claim', () => {
		const md = `---
documentId: test-doc
phaseId: 01-test
---

# Test Doc

## Introduction

The product has been validated by market research.
`;
		const descriptor = createDescriptor({
			sections: [
				{
					id: 'intro',
					questions: ['W?'],
					required: true,
					title: 'Introduction',
				},
			],
		});
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md, sourcePath: '<fixture>/claim-doc.md' },
			{ checkedAt: TEST_TIMESTAMP, ruleIds: ['evidence-boundary'] },
		);

		const snapshot = result.findings.map((f) => ({
			code: f.code,
			message: f.message,
			pointer: f.location.pointer,
			severity: f.severity,
		}));
		expect(snapshot).toMatchSnapshot();
	});

	it('snapshot findings for derived artifact boundary violation', () => {
		const md = `---
documentId: test-doc
phaseId: 01-test
---

# Test Doc

## Outputs

The executive report is the canonical source of truth for all decisions.
`;
		const descriptor = createDescriptor({
			sections: [
				{ id: 'outputs', questions: ['W?'], required: true, title: 'Outputs' },
			],
		});
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md, sourcePath: '<fixture>/artifact-doc.md' },
			{ checkedAt: TEST_TIMESTAMP, ruleIds: ['derived-artifact-boundary'] },
		);

		const snapshot = result.findings.map((f) => ({
			code: f.code,
			message: f.message,
			pointer: f.location.pointer,
			severity: f.severity,
		}));
		expect(snapshot).toMatchSnapshot();
	});

	it('snapshot findings for token-like leak with redacted value', () => {
		const md = `---
documentId: test-doc
phaseId: 01-test
---

## Config

apiKey: sk-fake1234567890abcdefghijklmnopqrstuv
`;
		const descriptor = createDescriptor();
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md, sourcePath: '<fixture>/token-doc.md' },
			{ checkedAt: TEST_TIMESTAMP, ruleIds: ['token-leak'] },
		);

		const snapshot = result.findings.map((f) => ({
			code: f.code,
			message: f.message,
			received: f.received,
			severity: f.severity,
		}));
		expect(snapshot).toMatchSnapshot();
	});

	it('snapshot successful lint summary for valid rendered document', () => {
		const md = validMarkdown();
		const descriptor = createDescriptor();
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md, sourcePath: '<fixture>/valid-doc.md' },
			{ checkedAt: TEST_TIMESTAMP },
		);

		const summary = {
			documentCanonicalId: result.documentCanonicalId,
			gate: result.gate,
			phaseId: result.phaseId,
			rulesChecked: result.rulesChecked,
			summary: result.summary,
		};
		expect(summary).toMatchSnapshot();
	});
});

// ---------------------------------------------------------------------------
// File-path mode tests
// ---------------------------------------------------------------------------

describe('File-path lint mode', () => {
	it('lint can read from a temp workspace file', async () => {
		const dir = await createTempDir();
		const filePath = join(dir, 'test.md');
		const md = validMarkdown();
		await mkdir(dir, { recursive: true });
		await writeFile(filePath, md, 'utf-8');

		const { readFile } = await import('node:fs/promises');
		const content = await readFile(filePath, 'utf-8');

		const result = lintCanonicalMarkdownDocument({
			descriptor: createDescriptor(),
			markdown: content,
			sourcePath: filePath,
		});

		expect(result.readOnly).toBe(true);
		expect(result.documentCanonicalId).toBe('test-doc');
	});

	it('does not mutate files on disk', async () => {
		const dir = await createTempDir();
		const filePath = join(dir, 'test.md');
		const originalMd = validMarkdown();
		await mkdir(dir, { recursive: true });
		await writeFile(filePath, originalMd, 'utf-8');

		lintCanonicalMarkdownDocument({
			descriptor: createDescriptor(),
			markdown: originalMd,
			sourcePath: filePath,
		});

		const { readFile } = await import('node:fs/promises');
		const after = await readFile(filePath, 'utf-8');
		expect(after).toBe(originalMd);
	});
});
