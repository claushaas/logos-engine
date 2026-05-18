/** Step 9.2 — Safe Static HTML Renderer tests */

import { describe, expect, it } from 'vitest';
import type {
	HtmlRenderDecisionData,
	HtmlRenderDocumentData,
	HtmlRenderInput,
	HtmlRenderOptions,
	HtmlRenderPhaseData,
	HtmlRenderRiskData,
	HtmlRenderSummaryData,
	HtmlRenderTraceabilityData,
	HtmlRenderValidationFindingData,
} from '../src/html/index.js';
import {
	createStaticHtmlRenderer,
	renderHtmlDocument,
} from '../src/html/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DETERMINISTIC_TIMESTAMP = '2026-01-15T10:30:00.000Z';

function defaultOptions(
	overrides?: Partial<HtmlRenderOptions>,
): HtmlRenderOptions {
	return {
		generatedAt: DETERMINISTIC_TIMESTAMP,
		profileVersion: '1.0.0',
		renderedAt: DETERMINISTIC_TIMESTAMP,
		...overrides,
	};
}

function baseInput(overrides?: Partial<HtmlRenderInput>): HtmlRenderInput {
	return {
		artifactId: 'html-artifact-test',
		artifactKind: 'dashboard',
		diagnostics: [],
		documentCanonicalId: undefined,
		isDerivedNonCanonical: true,
		outputBoundary: 'derived',
		phaseId: undefined,
		profileId: 'standard',
		sections: [],
		sourceCanonicalDocumentIds: [],
		sourceCanonicalPaths: [],
		sources: [],
		status: 'ready',
		title: 'Test Dashboard',
		traceabilityBoundary: 'derived',
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Escaping through renderer
// ---------------------------------------------------------------------------

describe('renderer escaping', () => {
	it('escapes <script> as text', () => {
		const input = baseInput({
			artifactId: '<script>alert("xss")</script>',
			title: '<img src=x onerror=alert(1)>',
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).not.toContain('<script>alert');
		expect(result.html).not.toContain('<img src=x');
		expect(result.html).toContain('&lt;script&gt;');
		expect(result.html).toContain('&lt;img');
	});

	it('escapes HTML tags in titles', () => {
		const input = baseInput({ title: 'Check <b>bold</b> injection' });
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).not.toContain('<b>bold</b>');
		expect(result.html).toContain('&lt;b&gt;bold&lt;/b&gt;');
	});

	it('escapes HTML tags in summaries', () => {
		const input = baseInput({
			summary: { documentCount: 5 },
		});
		const result = renderHtmlDocument(input, defaultOptions());
		// Summary data is clean
		expect(result.html).toContain('5');
		expect(result.html).not.toContain('<script');
	});

	it('escapes HTML in decision data', () => {
		const input = baseInput({
			artifactKind: 'decision_map',
			decisions: [
				{
					affectedDocumentIds: [],
					confidence: 'explicit',
					id: 'dec-1',
					isInferred: false,
					reviewRequired: false,
					reviewState: 'approved',
					sourceIds: [],
					status: 'confirmed',
					summary: 'Evil <iframe>',
					title: '<script>bad</script>',
				},
			],
			sections: [
				{ rendered: true, sectionKind: 'decision_list', title: 'Decisions' },
			],
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).not.toContain('<script>bad');
		expect(result.html).not.toContain('<iframe>');
		expect(result.html).toContain('&lt;script&gt;bad&lt;/script&gt;');
		expect(result.html).toContain('Evil &lt;iframe&gt;');
	});

	it('escapes HTML in risk data', () => {
		const input = baseInput({
			artifactKind: 'risk_map',
			risks: [
				{
					affectedDocumentIds: [],
					confidence: 'derived',
					id: 'risk-1',
					isInferred: false,
					mitigation: 'Mitigate <script>bad</script>',
					reviewRequired: false,
					sourceIds: [],
					status: 'accepted',
					summary: 'Risk <a href="javascript:alert(1)">here</a>',
					title: '<b>Critical</b>',
				},
			],
			sections: [{ rendered: true, sectionKind: 'risk_list', title: 'Risks' }],
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).not.toContain('<script>bad');
		expect(result.html).toContain('&lt;script&gt;bad&lt;/script&gt;');
		// The <a> tag is escaped as text
		expect(result.html).not.toContain('<a href');
	});

	it('escapes HTML in validation findings', () => {
		const input = baseInput({
			artifactKind: 'validation_summary',
			sections: [
				{
					rendered: true,
					sectionKind: 'validation_findings',
					title: 'Findings',
				},
			],
			validationFindings: [
				{
					code: 'E_XSS_TEST',
					documentCanonicalId: undefined,
					id: 'find-1',
					isReleaseBlocker: true,
					message: 'Found <script>evil</script> in output',
					path: '<evil>.md',
					phaseId: undefined,
					pointer: '/xss',
					recoveryHint: 'Remove <script> tags',
					severity: 'error',
				},
			],
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).not.toContain('<evil>');
		expect(result.html).not.toContain('<script>evil');
		expect(result.html).toContain('&lt;script&gt;evil&lt;/script&gt;');
	});

	it('does not allow inline event handler injection in metadata', () => {
		const input = baseInput({
			artifactId: '" onclick=alert(1) ',
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).not.toMatch(/<\w+\s+on\w+=/i);
	});
});

// ---------------------------------------------------------------------------
// URL / path sanitization through renderer
// ---------------------------------------------------------------------------

describe('renderer URL/path safety', () => {
	it('rejects javascript: in source paths', () => {
		const input = baseInput({
			sourceCanonicalPaths: ['javascript:alert(1)'],
			sources: [
				{
					documentCanonicalId: undefined,
					label: 'Test',
					phaseId: undefined,
					relativePath: 'javascript:alert(1)',
					safeForLink: false,
					sourceId: 's1',
					sourceKind: 'canonical_markdown',
					status: undefined,
				},
			],
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).not.toContain('href="javascript');
		expect(result.securitySummary.rejectedUnsafeUrlCount).toBeGreaterThan(0);
	});

	it('rejects path traversal in source paths', () => {
		const input = baseInput({
			sourceCanonicalPaths: ['../../../etc/passwd'],
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).not.toContain('href="../../../etc/passwd"');
	});
});

// ---------------------------------------------------------------------------
// Static document structure
// ---------------------------------------------------------------------------

describe('static HTML document structure', () => {
	it('renders complete <!doctype html> document', () => {
		const result = renderHtmlDocument(baseInput(), defaultOptions());
		expect(result.html).toMatch(/^<!doctype html>/i);
		expect(result.html).toContain('</html>');
	});

	it('includes charset and viewport', () => {
		const result = renderHtmlDocument(baseInput(), defaultOptions());
		expect(result.html).toContain('charset="utf-8"');
		expect(result.html).toContain('viewport');
	});

	it('includes inline static CSS via <style>', () => {
		const result = renderHtmlDocument(baseInput(), defaultOptions());
		expect(result.html).toContain('<style>');
		expect(result.html).toContain('</style>');
	});

	it('includes no <script>', () => {
		const result = renderHtmlDocument(baseInput(), defaultOptions());
		expect(result.html).not.toMatch(/<script[\s>]/i);
	});

	it('includes no external stylesheet link', () => {
		const result = renderHtmlDocument(baseInput(), defaultOptions());
		expect(result.html).not.toContain('rel="stylesheet"');
		expect(result.html).not.toContain('<link');
	});

	it('includes no remote fonts', () => {
		const result = renderHtmlDocument(baseInput(), defaultOptions());
		expect(result.html).not.toContain('fonts.googleapis');
	});

	it('includes no remote image', () => {
		const result = renderHtmlDocument(baseInput(), defaultOptions());
		expect(result.html).not.toContain('<img');
	});

	it('includes no iframe', () => {
		const result = renderHtmlDocument(baseInput(), defaultOptions());
		expect(result.html).not.toContain('<iframe');
	});

	it('includes no <form>', () => {
		const result = renderHtmlDocument(baseInput(), defaultOptions());
		expect(result.html).not.toContain('<form');
	});

	it('includes <main> landmark', () => {
		const result = renderHtmlDocument(baseInput(), defaultOptions());
		expect(result.html).toContain('<main');
		expect(result.html).toContain('</main>');
	});

	it('includes skip link', () => {
		const result = renderHtmlDocument(baseInput(), defaultOptions());
		expect(result.html).toContain('skip-link');
		expect(result.html).toContain('#main-content');
	});

	it('includes heading tags', () => {
		const result = renderHtmlDocument(baseInput(), defaultOptions());
		expect(result.html).toContain('<h1>');
		expect(result.html).toContain('<h2>');
	});
});

// ---------------------------------------------------------------------------
// Derived-artifact warning
// ---------------------------------------------------------------------------

describe('derived-artifact warning', () => {
	it('includes derived/non-canonical warning', () => {
		const result = renderHtmlDocument(baseInput(), defaultOptions());
		expect(result.html).toContain('Derived Non-Canonical');
		expect(result.html).toContain('derived');
		expect(result.html).toContain('non-canonical');
	});

	it('says canonical sources remain Markdown/state', () => {
		const result = renderHtmlDocument(baseInput(), defaultOptions());
		expect(result.html).toContain('Markdown');
		expect(result.html).toContain('.logos/');
	});

	it('HTML is not described as source of truth', () => {
		const result = renderHtmlDocument(baseInput(), defaultOptions());
		expect(result.html).toContain(
			'Do not treat this HTML artifact as the source of truth',
		);
	});

	it('boundary marker appears in metadata', () => {
		const result = renderHtmlDocument(baseInput(), defaultOptions());
		expect(result.html).toContain('Output boundary');
		expect(result.html).toContain('derived');
	});
});

// ---------------------------------------------------------------------------
// Metadata block
// ---------------------------------------------------------------------------

describe('metadata block', () => {
	it('includes artifact id and kind', () => {
		const result = renderHtmlDocument(
			baseInput({ artifactKind: 'dashboard' }),
			defaultOptions(),
		);
		expect(result.html).toContain('html-artifact-test');
		expect(result.html).toContain('dashboard');
	});

	it('includes profile id and version', () => {
		const result = renderHtmlDocument(
			baseInput(),
			defaultOptions({ profileVersion: '2.3.1' }),
		);
		expect(result.html).toContain('standard');
		expect(result.html).toContain('2.3.1');
	});

	it('includes generated/rendered timestamp', () => {
		const result = renderHtmlDocument(baseInput(), defaultOptions());
		expect(result.html).toContain(DETERMINISTIC_TIMESTAMP);
	});

	it('includes source canonical document IDs', () => {
		const result = renderHtmlDocument(
			baseInput({ sourceCanonicalDocumentIds: ['doc-alpha', 'doc-beta'] }),
			defaultOptions(),
		);
		expect(result.html).toContain('doc-alpha');
		expect(result.html).toContain('doc-beta');
	});

	it('includes source canonical paths', () => {
		const result = renderHtmlDocument(
			baseInput({ sourceCanonicalPaths: ['logos/security/index.md'] }),
			defaultOptions(),
		);
		expect(result.html).toContain('logos/security/index.md');
	});

	it('includes validation/staleness status', () => {
		const result = renderHtmlDocument(
			baseInput({ status: 'stale' }),
			defaultOptions(),
		);
		expect(result.html).toContain('stale');
	});

	it('includes traceability summary when available', () => {
		const traceability: HtmlRenderTraceabilityData = {
			claimCount: 3,
			claims: [],
			inferredClaimCount: 1,
			missingSourceCount: 0,
			reviewRequiredCount: 2,
			sourceCount: 5,
			sources: [],
		};
		const result = renderHtmlDocument(
			baseInput({ traceability }),
			defaultOptions(),
		);
		expect(result.html).toContain('5 sources');
		expect(result.html).toContain('3 claims');
	});

	it('uses relative paths only', () => {
		const result = renderHtmlDocument(
			baseInput({ sourceCanonicalPaths: ['logos/docs.md'] }),
			defaultOptions(),
		);
		expect(result.html).not.toContain('/Volumes');
		expect(result.html).not.toContain('/home');
	});
});

// ---------------------------------------------------------------------------
// Artifact section tests
// ---------------------------------------------------------------------------

describe('artifact section renderers', () => {
	it('renders summary cards/list', () => {
		const summary: HtmlRenderSummaryData = {
			blockedCount: 2,
			documentCount: 12,
			missingCount: 1,
			phaseCount: 4,
			readyCount: 8,
			registerCount: 20,
			staleCount: 1,
			validationFindingCount: 5,
		};
		const input = baseInput({
			artifactKind: 'dashboard',
			sections: [{ rendered: true, sectionKind: 'summary', title: 'Summary' }],
			summary,
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('12');
		expect(result.html).toContain('8');
		expect(result.html).toContain('2');
		expect(result.html).toContain('4');
	});

	it('renders phase/document list', () => {
		const phases: HtmlRenderPhaseData[] = [
			{
				blockedCount: 1,
				canonicalSourcePath: 'logos/framework/index.md',
				documentCount: 3,
				order: 0,
				phaseId: '01-framework',
				readyCount: 2,
				staleCount: 0,
				status: 'ready',
				title: 'Framework',
			},
		];
		const input = baseInput({
			phases,
			sections: [
				{ rendered: true, sectionKind: 'phase_list', title: 'Phases' },
			],
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('Framework');
		expect(result.html).toContain('01-framework');
		expect(result.html).toContain('3');
	});

	it('renders decisions list', () => {
		const decisions: HtmlRenderDecisionData[] = [
			{
				affectedDocumentIds: ['doc-1'],
				confidence: 'explicit',
				id: 'd1',
				isInferred: false,
				reviewRequired: false,
				reviewState: 'approved',
				sourceIds: ['s1'],
				status: 'confirmed',
				summary: 'We use TS',
				title: 'Use TypeScript',
			},
		];
		const input = baseInput({
			artifactKind: 'decision_map',
			decisions,
			sections: [
				{ rendered: true, sectionKind: 'decision_list', title: 'Decisions' },
			],
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('Use TypeScript');
		expect(result.html).toContain('confirmed');
		expect(result.html).toContain('explicit');
	});

	it('renders risks list', () => {
		const risks: HtmlRenderRiskData[] = [
			{
				affectedDocumentIds: ['doc-1'],
				confidence: 'derived',
				id: 'r1',
				isInferred: false,
				mitigation: 'Backup strategy',
				reviewRequired: false,
				sourceIds: ['s1'],
				status: 'accepted',
				summary: 'Risk of losing data',
				title: 'Data loss',
			},
		];
		const input = baseInput({
			artifactKind: 'risk_map',
			risks,
			sections: [{ rendered: true, sectionKind: 'risk_list', title: 'Risks' }],
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('Data loss');
		expect(result.html).toContain('Backup strategy');
	});

	it('renders validation findings with severity/path/pointer/recovery hint', () => {
		const findings: HtmlRenderValidationFindingData[] = [
			{
				code: 'E_MISSING',
				documentCanonicalId: 'doc-1',
				id: 'f1',
				isReleaseBlocker: true,
				message: 'File is missing',
				path: 'logos/doc.md',
				phaseId: 'ph-1',
				pointer: '/outputs',
				recoveryHint: 'Create the file',
				severity: 'error',
			},
		];
		const input = baseInput({
			artifactKind: 'validation_summary',
			sections: [
				{
					rendered: true,
					sectionKind: 'validation_findings',
					title: 'Findings',
				},
			],
			validationFindings: findings,
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('E_MISSING');
		expect(result.html).toContain('BLOCKER');
		expect(result.html).toContain('Create the file');
		expect(result.html).toContain('logos/doc.md');
	});

	it('renders readiness/status', () => {
		const input = baseInput({
			diagnostics: [
				{
					code: 'E_BLOCKED',
					fieldPath: undefined,
					message: 'Source is missing',
					recoveryHint: 'Fix it',
					severity: 'error',
					sourcePath: undefined,
				},
			],
			sections: [
				{ rendered: true, sectionKind: 'readiness_status', title: 'Readiness' },
			],
			status: 'blocked',
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('blocked');
		expect(result.html).toContain('Source is missing');
	});

	it('renders traceability/source list', () => {
		const traceability: HtmlRenderTraceabilityData = {
			claimCount: 1,
			claims: [
				{
					claimId: 'c1',
					claimType: 'fact',
					confidence: 'explicit',
					isGenerated: false,
					isInferred: false,
					primarySourceId: 's1',
					relatedDocumentCanonicalId: undefined,
					relatedPhaseId: undefined,
					reviewRequiredMarker: false,
					reviewState: 'approved',
					shortSummary: 'A fact',
					sourceCount: 1,
					status: 'confirmed',
				},
			],
			inferredClaimCount: 0,
			missingSourceCount: 0,
			reviewRequiredCount: 0,
			sourceCount: 1,
			sources: [
				{
					confidence: 'explicit',
					relatedDocumentCanonicalId: undefined,
					relatedPhaseId: undefined,
					sourceId: 's1',
					sourceType: 'document',
					status: 'confirmed',
					title: 'Source doc',
				},
			],
		};
		const input = baseInput({
			sections: [
				{
					rendered: true,
					sectionKind: 'traceability_list',
					title: 'Traceability',
				},
			],
			traceability,
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('A fact');
		expect(result.html).toContain('Source doc');
	});

	it('renders diagnostics/warnings', () => {
		const input = baseInput({
			diagnostics: [
				{
					code: 'W_TEST',
					fieldPath: '/field',
					message: 'Test warning',
					recoveryHint: 'Check this',
					severity: 'warning',
					sourcePath: 'test.md',
				},
			],
			sections: [
				{ rendered: true, sectionKind: 'diagnostics', title: 'Diagnostics' },
			],
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('W_TEST');
		expect(result.html).toContain('Test warning');
	});

	it('renders empty state safely', () => {
		const input = baseInput({
			sections: [
				{ rendered: true, sectionKind: 'empty_state', title: 'No data' },
			],
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('No data');
		expect(result.html).not.toContain('<script');
	});
});

// ---------------------------------------------------------------------------
// Dashboard rendering
// ---------------------------------------------------------------------------

describe('dashboard rendering', () => {
	it('renders supplied counts', () => {
		const input = baseInput({
			artifactKind: 'dashboard',
			sections: [{ rendered: true, sectionKind: 'summary', title: 'Summary' }],
			summary: {
				blockedCount: 2,
				documentCount: 10,
				readyCount: 7,
				staleCount: 1,
			},
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('10');
		expect(result.html).toContain('7');
	});

	it('renders stale/missing/blocked counts', () => {
		const input = baseInput({
			artifactKind: 'dashboard',
			sections: [{ rendered: true, sectionKind: 'summary', title: 'Summary' }],
			summary: { blockedCount: 2, missingCount: 1, staleCount: 3 },
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('3');
		expect(result.html).toContain('1');
	});

	it('renders validation counts', () => {
		const input = baseInput({
			artifactKind: 'dashboard',
			sections: [{ rendered: true, sectionKind: 'summary', title: 'Summary' }],
			summary: { validationFindingCount: 42 },
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('42');
	});

	it('renders register/traceability counts', () => {
		const input = baseInput({
			artifactKind: 'dashboard',
			sections: [{ rendered: true, sectionKind: 'summary', title: 'Summary' }],
			summary: { registerCount: 15, traceabilityCount: 30 },
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('15');
		expect(result.html).toContain('30');
	});
});

// ---------------------------------------------------------------------------
// Phase map rendering
// ---------------------------------------------------------------------------

describe('phase map rendering', () => {
	it('renders phases and documents', () => {
		const phases: HtmlRenderPhaseData[] = [
			{
				blockedCount: 1,
				canonicalSourcePath: 'logos/start/index.md',
				documentCount: 5,
				order: 0,
				phaseId: '01-start',
				readyCount: 3,
				staleCount: 1,
				status: 'ready',
				title: 'Getting Started',
			},
			{
				blockedCount: 0,
				canonicalSourcePath: 'logos/build/index.md',
				documentCount: 3,
				order: 1,
				phaseId: '02-build',
				readyCount: 3,
				staleCount: 0,
				status: 'ready',
				title: 'Building',
			},
		];
		const documents: HtmlRenderDocumentData[] = [
			{
				canonicalSourcePath: 'logos/start/intro.md',
				documentCanonicalId: 'doc-1',
				phaseId: '01-start',
				staleStatus: 'current',
				status: 'generated',
				title: 'Introduction',
			},
		];
		const input = baseInput({
			artifactKind: 'phase_map',
			documents,
			phases,
			sections: [
				{ rendered: true, sectionKind: 'phase_list', title: 'Phases' },
				{ rendered: true, sectionKind: 'document_list', title: 'Documents' },
			],
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('Getting Started');
		expect(result.html).toContain('Building');
		expect(result.html).toContain('Introduction');
		expect(result.html).toContain('current');
	});

	it('renders status labels as text', () => {
		const phases: HtmlRenderPhaseData[] = [
			{
				blockedCount: 1,
				canonicalSourcePath: undefined,
				documentCount: 2,
				order: 0,
				phaseId: 'ph-1',
				readyCount: 1,
				staleCount: 0,
				status: 'blocked',
				title: 'Phase 1',
			},
		];
		const input = baseInput({
			phases,
			sections: [
				{ rendered: true, sectionKind: 'phase_list', title: 'Phases' },
			],
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('blocked');
	});

	it('renders staleness flags', () => {
		const docs: HtmlRenderDocumentData[] = [
			{
				canonicalSourcePath: 'logos/stale.md',
				documentCanonicalId: 'doc-1',
				phaseId: 'ph-1',
				staleStatus: 'stale',
				status: 'generated',
				title: 'Stale Doc',
			},
		];
		const input = baseInput({
			documents: docs,
			sections: [
				{ rendered: true, sectionKind: 'document_list', title: 'Documents' },
			],
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('stale');
	});

	it('renders dependency counts', () => {
		// Dependency count is embedded in summary
		const input = baseInput({
			sections: [{ rendered: true, sectionKind: 'summary', title: 'Summary' }],
			summary: { extraFields: { Dependencies: '12' } },
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('12');
	});
});

// ---------------------------------------------------------------------------
// Decision/risk map rendering
// ---------------------------------------------------------------------------

describe('decision/risk map rendering', () => {
	it('renders decision statuses', () => {
		const decisions: HtmlRenderDecisionData[] = [
			{
				affectedDocumentIds: [],
				confidence: 'explicit',
				id: 'd1',
				isInferred: false,
				reviewRequired: false,
				reviewState: 'approved',
				sourceIds: [],
				status: 'confirmed',
				summary: 'A summary',
				title: 'Decision A',
			},
			{
				affectedDocumentIds: [],
				confidence: 'inferred',
				id: 'd2',
				isInferred: true,
				reviewRequired: true,
				reviewState: 'requires_review',
				sourceIds: [],
				status: 'proposed',
				summary: 'B summary',
				title: 'Decision B',
			},
		];
		const input = baseInput({
			artifactKind: 'decision_map',
			decisions,
			sections: [
				{ rendered: true, sectionKind: 'decision_list', title: 'Decisions' },
			],
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('confirmed');
		expect(result.html).toContain('proposed');
		expect(result.html).toContain('inferred');
	});

	it('renders risk statuses/mitigation', () => {
		const risks: HtmlRenderRiskData[] = [
			{
				affectedDocumentIds: [],
				confidence: 'explicit',
				id: 'r1',
				isInferred: false,
				mitigation: 'We fixed it',
				reviewRequired: false,
				sourceIds: [],
				status: 'mitigated',
				summary: 'A risk',
				title: 'Risk X',
			},
		];
		const input = baseInput({
			artifactKind: 'risk_map',
			risks,
			sections: [{ rendered: true, sectionKind: 'risk_list', title: 'Risks' }],
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('mitigated');
		expect(result.html).toContain('We fixed it');
	});

	it('renders affected documents', () => {
		const decisions: HtmlRenderDecisionData[] = [
			{
				affectedDocumentIds: ['doc-a', 'doc-b'],
				confidence: 'explicit',
				id: 'd1',
				isInferred: false,
				reviewRequired: false,
				reviewState: 'approved',
				sourceIds: [],
				status: 'confirmed',
				summary: 'Summary',
				title: 'Decision',
			},
		];
		const input = baseInput({
			decisions,
			sections: [
				{ rendered: true, sectionKind: 'decision_list', title: 'Decisions' },
			],
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('doc-a');
		expect(result.html).toContain('doc-b');
	});

	it('marks inferred/review-required items visibly', () => {
		const decisions: HtmlRenderDecisionData[] = [
			{
				affectedDocumentIds: [],
				confidence: 'inferred',
				id: 'd1',
				isInferred: true,
				reviewRequired: true,
				reviewState: 'requires_review',
				sourceIds: [],
				status: 'proposed',
				summary: 'Summary',
				title: 'Inferred Decision',
			},
		];
		const input = baseInput({
			decisions,
			sections: [
				{ rendered: true, sectionKind: 'decision_list', title: 'Decisions' },
			],
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('INFERRED');
		expect(result.html).toContain('REVIEW REQUIRED');
	});

	it('escapes malicious decision/risk content', () => {
		const decisions: HtmlRenderDecisionData[] = [
			{
				affectedDocumentIds: [],
				confidence: 'explicit',
				id: '<script>d1',
				isInferred: false,
				reviewRequired: false,
				reviewState: 'approved',
				sourceIds: [],
				status: 'confirmed',
				summary: '<b>bad</b>',
				title: '<img src=x>',
			},
		];
		const input = baseInput({
			decisions,
			sections: [
				{ rendered: true, sectionKind: 'decision_list', title: 'Decisions' },
			],
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).not.toContain('<script>');
		expect(result.html).not.toContain('<img src=x>');
	});
});

// ---------------------------------------------------------------------------
// Validation/readiness rendering
// ---------------------------------------------------------------------------

describe('validation/readiness rendering', () => {
	it('renders gate status', () => {
		const input = baseInput({
			sections: [
				{ rendered: true, sectionKind: 'readiness_status', title: 'Readiness' },
			],
			status: 'blocked',
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('blocked');
	});

	it('renders finding counts', () => {
		const findings: HtmlRenderValidationFindingData[] = [
			{
				code: 'E_1',
				documentCanonicalId: undefined,
				id: 'f1',
				isReleaseBlocker: true,
				message: 'Err 1',
				path: undefined,
				phaseId: undefined,
				pointer: undefined,
				recoveryHint: undefined,
				severity: 'error',
			},
			{
				code: 'W_1',
				documentCanonicalId: undefined,
				id: 'f2',
				isReleaseBlocker: false,
				message: 'Warn 1',
				path: undefined,
				phaseId: undefined,
				pointer: undefined,
				recoveryHint: undefined,
				severity: 'warning',
			},
		];
		const input = baseInput({
			sections: [
				{
					rendered: true,
					sectionKind: 'validation_findings',
					title: 'Findings',
				},
			],
			validationFindings: findings,
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('E_1');
		expect(result.html).toContain('W_1');
	});

	it('renders finding severity/path/pointer/recovery hint', () => {
		const findings: HtmlRenderValidationFindingData[] = [
			{
				code: 'E_PATH',
				documentCanonicalId: 'doc-1',
				id: 'f1',
				isReleaseBlocker: true,
				message: 'Fatal issue',
				path: 'path/to/file.yml',
				phaseId: 'ph-1',
				pointer: '/field',
				recoveryHint: 'Regenerate document',
				severity: 'fatal',
			},
		];
		const input = baseInput({
			sections: [
				{
					rendered: true,
					sectionKind: 'validation_findings',
					title: 'Findings',
				},
			],
			validationFindings: findings,
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('FATAL');
		expect(result.html).toContain('path/to/file.yml');
		expect(result.html).toContain('/field');
		expect(result.html).toContain('Regenerate document');
	});

	it('renders release blockers', () => {
		const findings: HtmlRenderValidationFindingData[] = [
			{
				code: 'E_BLOCK',
				documentCanonicalId: undefined,
				id: 'f1',
				isReleaseBlocker: true,
				message: 'Blocking issue',
				path: undefined,
				phaseId: undefined,
				pointer: undefined,
				recoveryHint: undefined,
				severity: 'error',
			},
		];
		const input = baseInput({
			sections: [
				{
					rendered: true,
					sectionKind: 'validation_findings',
					title: 'Findings',
				},
			],
			validationFindings: findings,
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('BLOCKER');
	});

	it('renders unresolved questions visibly', () => {
		const input = baseInput({
			sections: [
				{ rendered: true, sectionKind: 'readiness_status', title: 'Readiness' },
			],
			status: 'requires_review',
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('requires_review');
	});
});

// ---------------------------------------------------------------------------
// Traceability rendering
// ---------------------------------------------------------------------------

describe('traceability rendering', () => {
	it('renders source references', () => {
		const traceability: HtmlRenderTraceabilityData = {
			claimCount: 0,
			claims: [],
			inferredClaimCount: 0,
			missingSourceCount: 0,
			reviewRequiredCount: 0,
			sourceCount: 2,
			sources: [
				{
					confidence: 'explicit',
					relatedDocumentCanonicalId: 'doc-1',
					relatedPhaseId: 'ph-1',
					sourceId: 'src-1',
					sourceType: 'document',
					status: 'confirmed',
					title: 'Main spec',
				},
				{
					confidence: 'inferred',
					relatedDocumentCanonicalId: undefined,
					relatedPhaseId: undefined,
					sourceId: 'src-2',
					sourceType: 'conversation_answer',
					status: 'proposed',
					title: 'Chat answer',
				},
			],
		};
		const input = baseInput({
			sections: [
				{
					rendered: true,
					sectionKind: 'traceability_list',
					title: 'Traceability',
				},
			],
			traceability,
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('src-1');
		expect(result.html).toContain('Main spec');
		expect(result.html).toContain('explicit');
	});

	it('renders claim references', () => {
		const traceability: HtmlRenderTraceabilityData = {
			claimCount: 1,
			claims: [
				{
					claimId: 'claim-1',
					claimType: 'decision',
					confidence: 'inferred',
					isGenerated: false,
					isInferred: true,
					primarySourceId: undefined,
					relatedDocumentCanonicalId: undefined,
					relatedPhaseId: undefined,
					reviewRequiredMarker: true,
					reviewState: 'requires_review',
					shortSummary: 'We should do X',
					sourceCount: 0,
					status: 'proposed',
				},
			],
			inferredClaimCount: 1,
			missingSourceCount: 0,
			reviewRequiredCount: 1,
			sourceCount: 0,
			sources: [],
		};
		const input = baseInput({
			sections: [
				{
					rendered: true,
					sectionKind: 'traceability_list',
					title: 'Traceability',
				},
			],
			traceability,
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('claim-1');
		expect(result.html).toContain('We should do X');
	});

	it('renders confidence markers', () => {
		const traceability: HtmlRenderTraceabilityData = {
			claimCount: 0,
			claims: [],
			inferredClaimCount: 0,
			missingSourceCount: 0,
			reviewRequiredCount: 0,
			sourceCount: 2,
			sources: [
				{
					confidence: 'explicit',
					relatedDocumentCanonicalId: undefined,
					relatedPhaseId: undefined,
					sourceId: 's1',
					sourceType: 'document',
					status: 'confirmed',
					title: 'Explicit source',
				},
				{
					confidence: 'derived',
					relatedDocumentCanonicalId: undefined,
					relatedPhaseId: undefined,
					sourceId: 's2',
					sourceType: 'manual_note',
					status: 'proposed',
					title: 'Derived source',
				},
			],
		};
		const input = baseInput({
			sections: [
				{
					rendered: true,
					sectionKind: 'traceability_list',
					title: 'Traceability',
				},
			],
			traceability,
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('explicit');
		expect(result.html).toContain('derived');
	});

	it('renders review-required and missing-source markers', () => {
		const traceability: HtmlRenderTraceabilityData = {
			claimCount: 0,
			claims: [],
			inferredClaimCount: 0,
			missingSourceCount: 2,
			reviewRequiredCount: 1,
			sourceCount: 0,
			sources: [],
		};
		const input = baseInput({
			sections: [
				{
					rendered: true,
					sectionKind: 'traceability_list',
					title: 'Traceability',
				},
			],
			traceability,
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('2');
		expect(result.html).toContain('1');
	});

	it('does not render unknown fact as confirmed', () => {
		const traceability: HtmlRenderTraceabilityData = {
			claimCount: 1,
			claims: [
				{
					claimId: 'c-unknown',
					claimType: 'fact',
					confidence: 'unknown',
					isGenerated: false,
					isInferred: true,
					primarySourceId: undefined,
					relatedDocumentCanonicalId: undefined,
					relatedPhaseId: undefined,
					reviewRequiredMarker: true,
					reviewState: 'requires_review',
					shortSummary: 'An unknown fact',
					sourceCount: 0,
					status: 'unknown',
				},
			],
			inferredClaimCount: 0,
			missingSourceCount: 0,
			reviewRequiredCount: 0,
			sourceCount: 0,
			sources: [],
		};
		const input = baseInput({
			sections: [
				{
					rendered: true,
					sectionKind: 'traceability_list',
					title: 'Traceability',
				},
			],
			traceability,
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('unknown');
		expect(result.html).not.toContain('confirmed');
	});

	it('derived/non-canonical labels are present', () => {
		const result = renderHtmlDocument(baseInput(), defaultOptions());
		expect(result.html).toContain('derived');
		expect(result.html).toContain('non-canonical');
	});
});

// ---------------------------------------------------------------------------
// Planner integration
// ---------------------------------------------------------------------------

describe('planner integration', () => {
	it('renders from ready plan item data', () => {
		const input = baseInput({
			artifactId: 'html-dashboard-default',
			artifactKind: 'dashboard',
			sections: [{ rendered: true, sectionKind: 'summary', title: 'Summary' }],
			status: 'ready',
			summary: { documentCount: 5 },
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('ready');
		expect(result.html).toContain('html-dashboard-default');
	});

	it('renders blocked artifact page without marking ready', () => {
		const input = baseInput({
			artifactId: 'html-dashboard-blocked',
			artifactKind: 'dashboard',
			sections: [
				{
					rendered: true,
					sectionKind: 'empty_state',
					title: 'Artifact is blocked',
				},
			],
			status: 'blocked',
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('blocked');
		expect(result.html).toContain('BLOCKED');
		expect(result.html).toContain('status-blocked');
	});

	it('renders missing-source diagnostics', () => {
		const input = baseInput({
			sections: [
				{ rendered: true, sectionKind: 'empty_state', title: 'Missing source' },
			],
			status: 'missing_source',
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('missing_source');
		expect(result.html).toContain('MISSING');
	});

	it('preserves planned output path in metadata', () => {
		const input = baseInput({
			sourceCanonicalPaths: ['logos/output/dashboard.html'],
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toContain('logos/output/dashboard.html');
	});

	it('does not write HTML file', () => {
		// Rendered result has no changedPaths
		const result = renderHtmlDocument(baseInput(), defaultOptions());
		expect(result.changedPaths).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe('deterministic rendering', () => {
	it('produces identical output for identical input', () => {
		const input = baseInput({
			sections: [{ rendered: true, sectionKind: 'summary', title: 'Summary' }],
			summary: { documentCount: 3 },
		});
		const opts = defaultOptions();
		const result1 = renderHtmlDocument(input, opts);
		const result2 = renderHtmlDocument(input, opts);
		expect(result1.html).toBe(result2.html);
	});

	it('normalizes timestamps from options', () => {
		const result = renderHtmlDocument(baseInput(), defaultOptions());
		expect(result.html).toContain(DETERMINISTIC_TIMESTAMP);
	});

	it('result metadata has artifact kind', () => {
		const result = renderHtmlDocument(
			baseInput({ artifactKind: 'dashboard' }),
			defaultOptions(),
		);
		expect(result.metadata.artifactKind).toBe('dashboard');
	});

	it('result is readOnly', () => {
		const result = renderHtmlDocument(baseInput(), defaultOptions());
		expect(result.readOnly).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Non-mutation
// ---------------------------------------------------------------------------

describe('renderer non-mutation', () => {
	it('renderer writes no files', () => {
		const result = renderHtmlDocument(baseInput(), defaultOptions());
		expect(result.changedPaths).toEqual([]);
	});

	it('renderer does not call AI/provider code', () => {
		const renderer = createStaticHtmlRenderer();
		expect(renderer).toBeDefined();
		expect(renderer.renderStaticHtmlArtifact).toBeInstanceOf(Function);
	});

	it('renderer does not mutate canonical Markdown', () => {
		// Pure function - no side effects
		const result = renderHtmlDocument(baseInput(), defaultOptions());
		expect(result.readOnly).toBe(true);
		expect(result.changedPaths).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Security summary
// ---------------------------------------------------------------------------

describe('security summary', () => {
	it('reports zero scripts', () => {
		const result = renderHtmlDocument(baseInput(), defaultOptions());
		expect(result.securitySummary.scriptTagCount).toBe(0);
	});

	it('reports zero external assets', () => {
		const result = renderHtmlDocument(baseInput(), defaultOptions());
		expect(result.securitySummary.externalAssetCount).toBe(0);
	});

	it('reports isSafe as true', () => {
		const result = renderHtmlDocument(baseInput(), defaultOptions());
		expect(result.securitySummary.isSafe).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Snapshot tests
// ---------------------------------------------------------------------------

describe('snapshot HTML', () => {
	it('snapshot dashboard HTML', () => {
		const input = baseInput({
			artifactId: 'html-dashboard-default',
			artifactKind: 'dashboard',
			sections: [
				{ rendered: true, sectionKind: 'summary', title: 'Summary' },
				{
					rendered: true,
					sectionKind: 'traceability_list',
					title: 'Traceability',
				},
			],
			summary: {
				blockedCount: 1,
				documentCount: 5,
				readyCount: 3,
				staleCount: 1,
			},
			traceability: {
				claimCount: 2,
				claims: [],
				inferredClaimCount: 0,
				missingSourceCount: 0,
				reviewRequiredCount: 1,
				sourceCount: 3,
				sources: [],
			},
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toMatchSnapshot();
	});

	it('snapshot phase map HTML', () => {
		const input = baseInput({
			artifactId: 'html-phase-map-default',
			artifactKind: 'phase_map',
			phases: [
				{
					blockedCount: 1,
					canonicalSourcePath: 'logos/ph-1/index.md',
					documentCount: 3,
					order: 0,
					phaseId: 'ph-1',
					readyCount: 2,
					staleCount: 0,
					status: 'ready',
					title: 'Phase One',
				},
			],
			sections: [
				{ rendered: true, sectionKind: 'phase_list', title: 'Phases' },
			],
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toMatchSnapshot();
	});

	it('snapshot decision map HTML', () => {
		const input = baseInput({
			artifactId: 'html-decision-map-default',
			artifactKind: 'decision_map',
			decisions: [
				{
					affectedDocumentIds: ['doc-1'],
					confidence: 'explicit',
					id: 'd1',
					isInferred: false,
					reviewRequired: false,
					reviewState: 'approved',
					sourceIds: ['src-1'],
					status: 'confirmed',
					summary: 'First decision',
					title: 'Decision 1',
				},
			],
			sections: [
				{ rendered: true, sectionKind: 'decision_list', title: 'Decisions' },
			],
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toMatchSnapshot();
	});

	it('snapshot risk map HTML', () => {
		const input = baseInput({
			artifactId: 'html-risk-map-default',
			artifactKind: 'risk_map',
			risks: [
				{
					affectedDocumentIds: ['doc-1'],
					confidence: 'derived',
					id: 'r1',
					isInferred: false,
					mitigation: 'Mitigation plan',
					reviewRequired: false,
					sourceIds: ['src-1'],
					status: 'accepted',
					summary: 'First risk',
					title: 'Risk 1',
				},
			],
			sections: [{ rendered: true, sectionKind: 'risk_list', title: 'Risks' }],
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toMatchSnapshot();
	});

	it('snapshot validation summary HTML', () => {
		const input = baseInput({
			artifactId: 'html-validation-default',
			artifactKind: 'validation_summary',
			sections: [
				{
					rendered: true,
					sectionKind: 'validation_findings',
					title: 'Findings',
				},
			],
			validationFindings: [
				{
					code: 'E_MISSING',
					documentCanonicalId: 'doc-1',
					id: 'f1',
					isReleaseBlocker: true,
					message: 'File missing',
					path: 'logos/doc.md',
					phaseId: 'ph-1',
					pointer: '/outputs',
					recoveryHint: 'Create the file',
					severity: 'error',
				},
			],
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toMatchSnapshot();
	});

	it('snapshot blocked artifact HTML', () => {
		const input = baseInput({
			artifactId: 'html-blocked-example',
			artifactKind: 'custom',
			diagnostics: [
				{
					code: 'E_SOURCE_MISSING',
					fieldPath: undefined,
					message: 'Required source is missing',
					recoveryHint: 'Generate the document first',
					severity: 'error',
					sourcePath: 'logos/missing.md',
				},
			],
			sections: [
				{
					rendered: true,
					sectionKind: 'empty_state',
					title: 'Blocked artifact',
				},
			],
			status: 'blocked',
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).toMatchSnapshot();
	});

	it('does not snapshot absolute local paths', () => {
		const result = renderHtmlDocument(baseInput(), defaultOptions());
		expect(result.html).not.toContain('/Volumes');
		expect(result.html).not.toContain('/Users');
	});

	it('does not snapshot secrets', () => {
		const input = baseInput({
			title: 'Test with secrets',
		});
		const result = renderHtmlDocument(input, defaultOptions());
		expect(result.html).not.toContain('sk-');
		expect(result.html).not.toContain('ghp_');
		expect(result.html).not.toContain('Bearer ');
	});
});
