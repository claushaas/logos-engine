/** Step 9.1 — HTML Artifact Declaration Discovery */

import type {
	HtmlArtifactDeclaration,
	HtmlArtifactDiagnostic,
	HtmlArtifactKind,
	HtmlArtifactPlanInput,
} from './html-artifact-types.js';
import { HTML_ARTIFACT_KIND_ORDER } from './html-artifact-types.js';

// ---------------------------------------------------------------------------
// Artifact kind inference
// ---------------------------------------------------------------------------

const HEURISTIC_KIND_MAP: Record<string, HtmlArtifactKind> = {
	application: 'custom',
	change_log: 'custom',
	compliance: 'custom',
	consistency: 'validation_summary',
	dashboard: 'dashboard',
	decision: 'decision_map',
	diagnostic: 'validation_summary',
	executive: 'executive_readiness',
	findings: 'validation_summary',
	html_mapping: 'executive_export_preview',
	insight: 'custom',
	map: 'document_view',
	overview: 'document_view',
	phase: 'phase_map',
	readiness: 'readiness_view',
	report: 'validation_summary',
	review: 'validation_summary',
	risk: 'risk_map',
	roadmap: 'phase_map',
	staleness: 'readiness_view',
	status: 'readiness_view',
	summary: 'document_view',
	traceability: 'readiness_view',
	validation: 'validation_summary',
};

function wordMatches(text: string, word: string): boolean {
	const lower = text.toLowerCase();
	const idx = lower.indexOf(word.toLowerCase());
	if (idx === -1) return false;
	const before = idx === 0 || /[\s_-]/.test(lower[idx - 1] ?? '');
	const after =
		idx + word.length >= lower.length ||
		/[\s_-]/.test(lower[idx + word.length] ?? '');
	return before && after;
}

function inferArtifactKind(
	artifactId: string,
	purpose: string | undefined,
	outputId: string | undefined,
): HtmlArtifactKind {
	const lower = artifactId.toLowerCase();
	const idLower = (outputId ?? '').toLowerCase();
	const purposeLower = (purpose ?? '').toLowerCase();

	function hasAnyWord(w: string): boolean {
		return (
			wordMatches(artifactId, w) ||
			wordMatches(purpose ?? '', w) ||
			wordMatches(outputId ?? '', w)
		);
	}

	function hasAnySub(s: string): boolean {
		return lower.includes(s) || purposeLower.includes(s) || idLower.includes(s);
	}

	if (hasAnySub('executive') && !hasAnySub('executive_readiness'))
		return 'executive_readiness';
	if (hasAnySub('dashboard')) return 'dashboard';
	if (hasAnySub('readiness')) return 'readiness_view';
	if (hasAnyWord('risk') && !hasAnySub('risk_map')) return 'risk_map';
	if (hasAnyWord('decision') && !hasAnySub('decision_map'))
		return 'decision_map';
	if (hasAnySub('validation')) return 'validation_summary';
	if (hasAnySub('phase')) return 'phase_map';
	if (hasAnySub('document_view')) return 'document_view';
	if (
		hasAnySub('staleness') ||
		hasAnySub('consistency') ||
		hasAnySub('traceability')
	) {
		return 'readiness_view';
	}
	if (hasAnySub('view')) return 'document_view';
	if (hasAnyWord('map')) return 'document_view';
	if (hasAnyWord('report') || hasAnySub('report')) return 'validation_summary';
	if (hasAnySub('review')) return 'validation_summary';

	for (const [keyword, kind] of Object.entries(HEURISTIC_KIND_MAP)) {
		if (
			lower.includes(keyword) ||
			purposeLower.includes(keyword) ||
			idLower.includes(keyword)
		) {
			return kind;
		}
	}

	return 'custom';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createDiagnostic(
	code: string,
	severity: 'error' | 'warning' | 'info',
	message: string,
	overrides?: Partial<HtmlArtifactDiagnostic>,
): HtmlArtifactDiagnostic {
	return {
		code,
		expected: undefined,
		fieldPath: undefined,
		message,
		received: undefined,
		recoveryHint: undefined,
		relatedArtifactId: undefined,
		relatedArtifactKind: undefined,
		relatedGraphNodeId: undefined,
		relatedPhaseId: undefined,
		relatedSourceDocumentId: undefined,
		severity,
		sourcePath: undefined,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Path safety
// ---------------------------------------------------------------------------

const _UNSAFE_PATH_PATTERNS = [/\.\.\//, /^\/[^a-zA-Z]/, /\\/, /^[A-Za-z]:\\/];

function pathHasTraversal(p: string): boolean {
	return p.includes('../') || p.includes('..\\');
}

function pathIsUnsafeAbsolute(p: string): boolean {
	const trimmed = p.trim();
	if (trimmed.startsWith('/')) return true;
	if (/^[A-Za-z]:/.test(trimmed)) return true;
	return false;
}

/**
 * Resolve a declared output path into a documentation-root-relative path.
 */
export function resolveHtmlOutputPath(
	declaredPath: string,
	documentationRoot: string,
	artifactRoot: string | undefined,
): string {
	const baseRoot = artifactRoot ?? documentationRoot.replace(/\/$/, '');
	const normalizedRoot = baseRoot.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
	const normalizedPath = declaredPath.replace(/\\/g, '/');

	if (pathIsUnsafeAbsolute(normalizedPath)) return normalizedPath;

	const rootRelativePath = normalizedPath
		.replace(/^\.\/+/, '')
		.replace(/^\/+/, '');

	if (
		rootRelativePath === normalizedRoot ||
		rootRelativePath.startsWith(`${normalizedRoot}/`)
	) {
		return rootRelativePath;
	}

	return `${normalizedRoot}/${rootRelativePath}`;
}

/**
 * Check whether a resolved output path is safe.
 */
export function isHtmlOutputPathSafe(
	resolvedPath: string,
	documentationRoot: string,
): { safe: boolean; reason: string | undefined } {
	if (pathHasTraversal(resolvedPath)) {
		return {
			reason: 'Path traversal detected in HTML output path',
			safe: false,
		};
	}
	if (pathIsUnsafeAbsolute(resolvedPath)) {
		return { reason: 'Unsafe absolute path for HTML output', safe: false };
	}

	const normalizedRoot = documentationRoot
		.replace(/\\/g, '/')
		.replace(/\/+$/, '');
	const normalizedPath = resolvedPath.replace(/\\/g, '/');

	if (!normalizedPath.startsWith(normalizedRoot)) {
		return {
			reason: `HTML output path "${normalizedPath}" is outside the configured documentation root "${normalizedRoot}"`,
			safe: false,
		};
	}

	return { reason: undefined, safe: true };
}

// ---------------------------------------------------------------------------
// Main declaration discovery
// ---------------------------------------------------------------------------

export interface DiscoverDeclarationsResult {
	declarations: HtmlArtifactDeclaration[];
	diagnostics: HtmlArtifactDiagnostic[];
}

/**
 * Discover all HTML artifact declarations from:
 *   1. Document descriptor output artifacts (kind: 'artifact')
 *   2. Executive HTML mapping declarations
 */
export function discoverHtmlArtifactDeclarations(
	input: HtmlArtifactPlanInput,
): DiscoverDeclarationsResult {
	const declarations: HtmlArtifactDeclaration[] = [];
	const diagnostics: HtmlArtifactDiagnostic[] = [];
	let orderIndex = 0;

	const {
		contract,
		contractGraph,
		executiveConfig,
		documentationRoot,
		artifactRoot,
	} = input;

	// -------------------------------------------------------------------
	// 1. Document descriptor output artifacts
	// -------------------------------------------------------------------

	const artifactOutputs = contractGraph.outputs.filter(
		(o) => o.kind === 'artifact' && !o.isCanonical,
	);

	for (const output of artifactOutputs) {
		const doc = contract.documents.find(
			(d) => d.canonicalId === output.documentCanonicalId,
		);

		const _phase = contract.phases.find((p) => p.id === output.phaseId);

		if (output.path === undefined || output.path.length === 0) {
			diagnostics.push(
				createDiagnostic(
					'E_HTML_DECL_EMPTY_PATH',
					'error',
					`Artifact output declaration has an empty path for document "${output.documentCanonicalId}"`,
					{
						fieldPath: output.fieldPath,
						relatedPhaseId: output.phaseId,
						relatedSourceDocumentId: output.documentCanonicalId,
						sourcePath: output.sourcePath,
					},
				),
			);
			continue;
		}

		const artifactId =
			output.outputId ??
			`html_${output.documentCanonicalId}_${String(orderIndex)}`;
		const declaredKind = inferArtifactKind(
			artifactId,
			output.purpose,
			output.outputId,
		);

		if (!Object.hasOwn(HTML_ARTIFACT_KIND_ORDER, declaredKind)) {
			diagnostics.push(
				createDiagnostic(
					'E_HTML_DECL_UNSUPPORTED_KIND',
					'warning',
					`Unsupported HTML artifact kind "${declaredKind}" for artifact "${artifactId}"`,
					{
						fieldPath: output.fieldPath,
						recoveryHint: 'Artifact will be treated as custom',
						relatedArtifactId: artifactId,
						relatedArtifactKind: declaredKind,
						relatedPhaseId: output.phaseId,
						relatedSourceDocumentId: output.documentCanonicalId,
						sourcePath: output.sourcePath,
					},
				),
			);
		}

		const relativeOutputPath = resolveHtmlOutputPath(
			output.path,
			documentationRoot,
			artifactRoot,
		);

		const pathSafety = isHtmlOutputPathSafe(
			relativeOutputPath,
			documentationRoot,
		);
		if (!pathSafety.safe) {
			diagnostics.push(
				createDiagnostic(
					'E_HTML_DECL_UNSAFE_PATH',
					'error',
					pathSafety.reason ?? 'Unsafe HTML output path',
					{
						fieldPath: output.fieldPath,
						recoveryHint:
							'Correct the output path to be within the documentation root',
						relatedArtifactId: artifactId,
						relatedArtifactKind: declaredKind,
						relatedPhaseId: output.phaseId,
						relatedSourceDocumentId: output.documentCanonicalId,
						sourcePath: output.sourcePath,
					},
				),
			);
		}

		const declaration: HtmlArtifactDeclaration = {
			artifactId,
			artifactKind: declaredKind,
			audience: (output as { audience?: string }).audience,
			declarationSource: 'document_descriptor',
			deferred: false,
			descriptorPath: output.sourcePath,
			descriptorPointer: output.fieldPath,
			documentCanonicalId: output.documentCanonicalId,
			format: output.format,
			generationMode: (output as { generationMode?: string }).generationMode,
			includes: (output as { includes?: string[] }).includes,
			optional: false,
			orderIndex,
			outputPath: output.path,
			phaseId: output.phaseId,
			profilePath: doc?.sourcePath,
			purpose: output.purpose,
			relativeOutputPath,
			title: output.purpose ?? declaredKind.replace(/_/g, ' '),
		};

		declarations.push(declaration);
		orderIndex++;
	}

	// -------------------------------------------------------------------
	// 2. Phase-level generated outputs with HTML declarations
	// -------------------------------------------------------------------

	for (const phase of contract.phases) {
		const genOutputs = phase.generatedOutputs;
		if (genOutputs === undefined || typeof genOutputs !== 'object') continue;

		const htmlSection = genOutputs.html as Record<string, unknown> | undefined;
		if (htmlSection === undefined) continue;

		const artifacts = htmlSection.artifacts as
			| Array<Record<string, unknown>>
			| undefined;
		if (!Array.isArray(artifacts)) continue;

		for (const artifact of artifacts) {
			const id = typeof artifact.id === 'string' ? artifact.id : undefined;
			const path =
				typeof artifact.path === 'string' ? artifact.path : undefined;
			const purpose =
				typeof artifact.purpose === 'string' ? artifact.purpose : undefined;

			if (id === undefined || path === undefined) {
				diagnostics.push(
					createDiagnostic(
						'E_HTML_DECL_PHASE_MALFORMED',
						'error',
						`Phase-level HTML artifact declaration in "${phase.id}" has missing id or path`,
						{
							fieldPath: `generatedOutputs.html.artifacts`,
							recoveryHint:
								'Each artifact declaration must have id and path fields',
							relatedPhaseId: phase.id,
							sourcePath: phase.sourcePath,
						},
					),
				);
				continue;
			}

			const artifactId = `html_phase_${phase.id}_${id}`;
			const declaredKind = inferArtifactKind(artifactId, purpose, id);

			const relativeOutputPath = resolveHtmlOutputPath(
				path,
				documentationRoot,
				artifactRoot,
			);

			const pathSafety = isHtmlOutputPathSafe(
				relativeOutputPath,
				documentationRoot,
			);

			declarations.push({
				artifactId,
				artifactKind: declaredKind,
				audience: undefined,
				declarationSource: 'phase_descriptor',
				deferred: artifact.deferred === true || artifact.deferred === 'true',
				descriptorPath: phase.sourcePath,
				descriptorPointer: 'generatedOutputs.html.artifacts',
				documentCanonicalId: undefined,
				format: 'html',
				generationMode: undefined,
				includes: Array.isArray(artifact.includes)
					? (artifact.includes as string[])
					: undefined,
				optional: artifact.optional === true || artifact.optional === 'true',
				orderIndex,
				outputPath: path,
				phaseId: phase.id,
				profilePath: phase.sourcePath,
				purpose,
				relativeOutputPath,
				title: purpose ?? declaredKind.replace(/_/g, ' '),
			});

			if (!pathSafety.safe) {
				diagnostics.push(
					createDiagnostic(
						'E_HTML_DECL_UNSAFE_PATH',
						'error',
						pathSafety.reason ?? 'Unsafe HTML output path',
						{
							fieldPath: 'generatedOutputs.html.artifacts',
							recoveryHint: 'Correct the output path',
							relatedArtifactId: artifactId,
							relatedArtifactKind: declaredKind,
							relatedPhaseId: phase.id,
							sourcePath: phase.sourcePath,
						},
					),
				);
			}

			orderIndex++;
		}
	}

	// -------------------------------------------------------------------
	// 3. Executive HTML mapping declarations
	// -------------------------------------------------------------------

	if (executiveConfig?.exports?.html !== undefined) {
		const htmlConfig = executiveConfig.exports.html;
		const artifactId = 'executive_html_overview';

		const declaredKind: HtmlArtifactKind = 'executive_export_preview';
		const path =
			htmlConfig.path ||
			'logos/outcomes/executive/exports/html/executive-overview.html';
		const relativeOutputPath = resolveHtmlOutputPath(
			path,
			documentationRoot,
			artifactRoot,
		);

		const pathSafety = isHtmlOutputPathSafe(
			relativeOutputPath,
			documentationRoot,
		);

		declarations.push({
			artifactId,
			artifactKind: declaredKind,
			audience: undefined,
			declarationSource: 'executive_html_mapping',
			deferred: false,
			descriptorPath: undefined,
			descriptorPointer: 'executive.exports.html',
			documentCanonicalId: undefined,
			format: 'html',
			generationMode: undefined,
			includes: [
				'project_summary',
				'readiness_status',
				'confidence',
				'roadmap',
				'milestones',
				'initiatives',
				'workstreams',
				'execution_items',
				'risks',
				'decisions',
				'export_targets',
			],
			optional: htmlConfig.status === 'planned',
			orderIndex,
			outputPath: path,
			phaseId: undefined,
			profilePath: undefined,
			purpose: 'Executive HTML export preview',
			relativeOutputPath,
			title: 'Executive Overview',
		});

		if (!pathSafety.safe) {
			diagnostics.push(
				createDiagnostic(
					'E_HTML_DECL_UNSAFE_PATH',
					'error',
					pathSafety.reason ?? 'Unsafe HTML output path',
					{
						fieldPath: 'executive.exports.html',
						recoveryHint: 'Correct the output path',
						relatedArtifactId: artifactId,
						relatedArtifactKind: declaredKind,
						sourcePath: htmlConfig.mapping,
					},
				),
			);
		}

		orderIndex++;
	}

	return { declarations, diagnostics };
}
