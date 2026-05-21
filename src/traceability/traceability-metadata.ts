/** Step 8.4 — Traceability metadata builders for specific output kinds */

import type {
	ClaimRecord,
	SourceRecord,
} from '../provenance/provenance-types.js';
import type { RegisterCollections } from '../registers/register-types.js';
import type { ValidationFinding } from '../validation/validation-finding.js';
import {
	buildTraceabilityResult,
	getBoundaryLabel,
	getOutputKindLabel,
} from './traceability-renderer.js';
import type {
	OutputTraceabilityOptions,
	TraceabilityMetadata,
} from './traceability-types.js';

// ---------------------------------------------------------------------------
// Canonical Markdown
// ---------------------------------------------------------------------------

export interface CanonicalMarkdownTraceabilityInput {
	profileId: string;
	documentCanonicalId: string;
	phaseId: string;
	outputPath: string;
	generationRunId?: string | undefined;
	generatedAt?: string | undefined;
	sources: SourceRecord[];
	claims: ClaimRecord[];
	registers?: RegisterCollections | undefined;
}

export function buildCanonicalMarkdownTraceabilityMetadata(
	input: CanonicalMarkdownTraceabilityInput,
	options?: OutputTraceabilityOptions,
): TraceabilityMetadata {
	const result = buildTraceabilityResult(
		{
			boundary: 'canonical',
			claims: input.claims,
			documentCanonicalId: input.documentCanonicalId,
			generatedAt: input.generatedAt,
			generationRunId: input.generationRunId,
			outputKind: 'canonical_markdown',
			outputPath: input.outputPath,
			phaseId: input.phaseId,
			profileId: input.profileId,
			registers: input.registers,
			sources: input.sources,
		},
		options,
	);
	return result.metadata;
}

// ---------------------------------------------------------------------------
// Validation Report
// ---------------------------------------------------------------------------

export interface ValidationReportTraceabilityInput {
	profileId: string;
	validationRunId: string;
	generatedAt?: string | undefined;
	outputPath?: string | undefined;
	sources?: SourceRecord[] | undefined;
	claims?: ClaimRecord[] | undefined;
	findings?: ValidationFinding[] | undefined;
	registers?: RegisterCollections | undefined;
}

export function buildValidationReportTraceabilityMetadata(
	input: ValidationReportTraceabilityInput,
	options?: OutputTraceabilityOptions,
): TraceabilityMetadata {
	const result = buildTraceabilityResult(
		{
			boundary: 'non_canonical',
			claims: input.claims ?? [],
			findings: input.findings,
			generatedAt: input.generatedAt,
			outputKind: 'validation_report',
			outputPath: input.outputPath,
			profileId: input.profileId,
			registers: input.registers,
			sources: input.sources ?? [],
			validationRunId: input.validationRunId,
		},
		options,
	);
	return result.metadata;
}

// ---------------------------------------------------------------------------
// Diagnostic Report
// ---------------------------------------------------------------------------

export interface DiagnosticReportTraceabilityInput {
	profileId: string;
	validationRunId: string;
	generatedAt?: string | undefined;
	outputPath?: string | undefined;
	sources?: SourceRecord[] | undefined;
	claims?: ClaimRecord[] | undefined;
	findings?: ValidationFinding[] | undefined;
	registers?: RegisterCollections | undefined;
}

export function buildDiagnosticReportTraceabilityMetadata(
	input: DiagnosticReportTraceabilityInput,
	options?: OutputTraceabilityOptions,
): TraceabilityMetadata {
	const result = buildTraceabilityResult(
		{
			boundary: 'non_canonical',
			claims: input.claims ?? [],
			findings: input.findings,
			generatedAt: input.generatedAt,
			outputKind: 'diagnostic_report',
			outputPath: input.outputPath,
			profileId: input.profileId,
			registers: input.registers,
			sources: input.sources ?? [],
			validationRunId: input.validationRunId,
		},
		options,
	);
	return result.metadata;
}

// ---------------------------------------------------------------------------
// HTML Artifact (future)
// ---------------------------------------------------------------------------

export interface HtmlArtifactTraceabilityInput {
	profileId: string;
	canonicalMarkdownSources: SourceRecord[];
	stateSources?: SourceRecord[] | undefined;
	generationRunId?: string | undefined;
	generatedAt?: string | undefined;
	outputPath?: string | undefined;
	claims?: ClaimRecord[] | undefined;
	registers?: RegisterCollections | undefined;
}

export function buildHtmlArtifactTraceabilityMetadata(
	input: HtmlArtifactTraceabilityInput,
	options?: OutputTraceabilityOptions,
): TraceabilityMetadata {
	const sources = [
		...input.canonicalMarkdownSources,
		...(input.stateSources ?? []),
	];
	const result = buildTraceabilityResult(
		{
			boundary: 'derived',
			claims: input.claims ?? [],
			generatedAt: input.generatedAt,
			generationRunId: input.generationRunId,
			outputKind: 'html_artifact',
			outputPath: input.outputPath,
			profileId: input.profileId,
			registers: input.registers,
			sources,
		},
		options,
	);
	return result.metadata;
}

// ---------------------------------------------------------------------------
// Agent Pack (future)
// ---------------------------------------------------------------------------

export interface AgentPackTraceabilityInput {
	profileId: string;
	canonicalMarkdownSources: SourceRecord[];
	registerSources?: SourceRecord[] | undefined;
	constraintSources?: SourceRecord[] | undefined;
	generationRunId?: string | undefined;
	generatedAt?: string | undefined;
	outputPath?: string | undefined;
	claims?: ClaimRecord[] | undefined;
	registers?: RegisterCollections | undefined;
}

export function buildAgentPackTraceabilityMetadata(
	input: AgentPackTraceabilityInput,
	options?: OutputTraceabilityOptions,
): TraceabilityMetadata {
	const sources = [
		...input.canonicalMarkdownSources,
		...(input.registerSources ?? []),
		...(input.constraintSources ?? []),
	];
	const result = buildTraceabilityResult(
		{
			boundary: 'execution_aid',
			claims: input.claims ?? [],
			generatedAt: input.generatedAt,
			generationRunId: input.generationRunId,
			outputKind: 'agent_pack',
			outputPath: input.outputPath,
			profileId: input.profileId,
			registers: input.registers,
			sources,
		},
		options,
	);
	return result.metadata;
}

// ---------------------------------------------------------------------------
// Executive Export (future)
// ---------------------------------------------------------------------------

export interface ExecutiveExportTraceabilityInput {
	profileId: string;
	normativeDocumentSources: SourceRecord[];
	registerSources?: SourceRecord[] | undefined;
	validationFindingSources?: SourceRecord[] | undefined;
	generationRunId?: string | undefined;
	generatedAt?: string | undefined;
	outputPath?: string | undefined;
	claims?: ClaimRecord[] | undefined;
	registers?: RegisterCollections | undefined;
}

export function buildExecutiveExportTraceabilityMetadata(
	input: ExecutiveExportTraceabilityInput,
	options?: OutputTraceabilityOptions,
): TraceabilityMetadata {
	const sources = [
		...input.normativeDocumentSources,
		...(input.registerSources ?? []),
		...(input.validationFindingSources ?? []),
	];
	const result = buildTraceabilityResult(
		{
			boundary: 'derived',
			claims: input.claims ?? [],
			generatedAt: input.generatedAt,
			generationRunId: input.generationRunId,
			outputKind: 'executive_json',
			outputPath: input.outputPath,
			profileId: input.profileId,
			registers: input.registers,
			sources,
		},
		options,
	);
	return result.metadata;
}

// ---------------------------------------------------------------------------
// Re-export labels
// ---------------------------------------------------------------------------

export { getBoundaryLabel, getOutputKindLabel };
