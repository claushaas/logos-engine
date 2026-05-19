/** Step 12.1 — Candidate classification: deterministic kind assignment */

import type {
	DocumentationImportCandidate,
	DocumentationImportCandidateKind,
	DocumentationImportDiagnostic,
} from './import-model.js';
import {
	contentLooksLikeDerivedArtifact,
	contentLooksLikeTranscript,
	pathLooksLikeDerivedArtifact,
} from './import-model.js';

// ---------------------------------------------------------------------------
// Classification input
// ---------------------------------------------------------------------------

export interface ImportClassificationInput {
	candidates: DocumentationImportCandidate[];
}

export interface ImportClassificationResult {
	candidates: DocumentationImportCandidate[];
	diagnostics: DocumentationImportDiagnostic[];
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * Classify import candidates by their likely role based on extension,
 * filename, frontmatter, and content markers.
 *
 * This is deterministic and does not use AI or semantic inference.
 */
export function classifyImportCandidates(
	input: ImportClassificationInput,
): ImportClassificationResult {
	const results: DocumentationImportCandidate[] = [];
	const diagnostics: DocumentationImportDiagnostic[] = [];

	for (const candidate of input.candidates) {
		const classified = classifySingleCandidate(candidate);
		results.push(classified.candidate);
		diagnostics.push(...classified.diagnostics);

		// After classification, re-check status for unsupported/unknown
		recheckCandidateStatus(classified.candidate, diagnostics);
	}

	return { candidates: results, diagnostics };
}

// ---------------------------------------------------------------------------
// Single candidate classification
// ---------------------------------------------------------------------------

interface SingleClassificationResult {
	candidate: DocumentationImportCandidate;
	diagnostics: DocumentationImportDiagnostic[];
}

function classifySingleCandidate(
	candidate: DocumentationImportCandidate,
): SingleClassificationResult {
	const diagnostics: DocumentationImportDiagnostic[] = [];
	const ext = candidate.extension.toLowerCase();
	const baseNameLower = candidate.relativePath.toLowerCase();
	const fileName = baseNameLower.split('/').pop() ?? '';

	// Already classified during discovery (e.g., unsupported extension)
	if (candidate.kind === 'unsupported') {
		return { candidate, diagnostics };
	}

	// Determine kind
	const kind = determineCandidateKind(
		candidate,
		ext,
		fileName,
		baseNameLower,
		diagnostics,
	);

	const classified: DocumentationImportCandidate = {
		...candidate,
		kind,
		metadata: {
			...candidate.metadata,
			kind,
		},
		status:
			kind === 'unsupported'
				? 'unsupported'
				: candidate.status === 'unsafe' || candidate.status === 'blocked'
					? candidate.status
					: 'unknown',
	};

	return { candidate: classified, diagnostics };
}

// ---------------------------------------------------------------------------
// Kind determination
// ---------------------------------------------------------------------------

function determineCandidateKind(
	candidate: DocumentationImportCandidate,
	ext: string,
	fileName: string,
	baseNameLower: string,
	diagnostics: DocumentationImportDiagnostic[],
): DocumentationImportCandidateKind {
	const content = candidate.contentSnippet ?? '';

	// 1. Check for known profile/descriptor filenames first
	if (ext === '.yml' || ext === '.yaml') {
		return classifyYamlCandidate(
			candidate,
			fileName,
			baseNameLower,
			content,
			diagnostics,
		);
	}

	if (ext === '.json') {
		return classifyJsonCandidate(
			candidate,
			fileName,
			baseNameLower,
			content,
			diagnostics,
		);
	}

	// 2. Markdown files
	if (ext === '.md' || ext === '.markdown') {
		return classifyMarkdownCandidate(
			candidate,
			fileName,
			baseNameLower,
			content,
			diagnostics,
		);
	}

	// 3. Unsupported extension (shouldn't reach here due to discovery filter)
	diagnostics.push({
		candidateId: candidate.id,
		candidateKind: 'unsupported',
		code: 'import_unsupported_extension',
		message: `Unsupported extension "${ext}" for candidate: "${candidate.relativePath}"`,
		severity: 'info',
		sourcePath: candidate.relativePath,
	});
	return 'unsupported';
}

// ---------------------------------------------------------------------------
// YAML classification
// ---------------------------------------------------------------------------

function classifyYamlCandidate(
	candidate: DocumentationImportCandidate,
	fileName: string,
	baseNameLower: string,
	content: string,
	diagnostics: DocumentationImportDiagnostic[],
): DocumentationImportCandidateKind {
	// Phase descriptor: check BEFORE profile_registry to handle
	// paths like profiles/standard/phases/01-foundation/docs.yml
	if (baseNameLower.includes('/phases/')) {
		return 'phase_descriptor';
	}

	// Profile registry: docs.yml at root or profile/standard/docs.yml
	if (fileName === 'docs.yml' || baseNameLower.endsWith('/docs.yml')) {
		if (
			baseNameLower.includes('profile') ||
			baseNameLower.includes('profiles')
		) {
			return 'profile_registry';
		}
		// Generic docs.yml without profile path hints → ambiguous
		diagnostics.push({
			candidateId: candidate.id,
			candidateKind: 'profile_registry',
			code: 'import_ambiguous_yaml_kind',
			message: `"${candidate.relativePath}" looks like a profile registry but cannot be confirmed`,
			severity: 'warning',
			sourcePath: candidate.relativePath,
		});
		return 'profile_registry';
	}

	// Document descriptor
	if (
		fileName.includes('document') ||
		fileName.includes('descriptor') ||
		baseNameLower.includes('document.')
	) {
		return 'document_descriptor';
	}

	// Executive descriptor
	if (
		baseNameLower.includes('executive') ||
		fileName.includes('executive-') ||
		fileName === 'executive-generation.yml' ||
		baseNameLower.includes('executive-plan.') ||
		baseNameLower.includes('/mappings/')
	) {
		return 'executive_descriptor';
	}

	// Try to inspect content for phase/document/executive markers
	if (content) {
		const lowerContent = content.toLowerCase();

		if (lowerContent.includes('phase_id:') || lowerContent.includes('phase:')) {
			return 'phase_descriptor';
		}
		if (
			lowerContent.includes('document_id:') ||
			lowerContent.includes('canonical_id:') ||
			lowerContent.includes('outputs:')
		) {
			return 'document_descriptor';
		}
		if (
			lowerContent.includes('executive_') ||
			lowerContent.includes('mapping:') ||
			lowerContent.includes('export_target:')
		) {
			return 'executive_descriptor';
		}
		if (
			lowerContent.includes('profile_id:') ||
			lowerContent.includes('profile:')
		) {
			return 'profile_registry';
		}
	}

	// Unknown YAML
	diagnostics.push({
		candidateId: candidate.id,
		candidateKind: 'unknown',
		code: 'import_unknown_yaml_kind',
		message: `Could not determine YAML kind for: "${candidate.relativePath}"`,
		severity: 'info',
		sourcePath: candidate.relativePath,
	});
	return 'unknown';
}

// ---------------------------------------------------------------------------
// JSON classification
// ---------------------------------------------------------------------------

function classifyJsonCandidate(
	_candidate: DocumentationImportCandidate,
	fileName: string,
	baseNameLower: string,
	content: string,
	_diagnostics: DocumentationImportDiagnostic[],
): DocumentationImportCandidateKind {
	// Executive plan schema
	if (
		fileName.includes('executive-plan') ||
		baseNameLower.includes('executive-plan')
	) {
		return 'executive_descriptor';
	}

	// Document schema
	if (
		fileName.includes('document.schema') ||
		baseNameLower.includes('document.schema')
	) {
		return 'document_descriptor';
	}

	// Generic JSON — try content inspection
	if (content) {
		const lowerContent = content.toLowerCase();
		if (
			lowerContent.includes('executive') &&
			(lowerContent.includes('plan') ||
				lowerContent.includes('item') ||
				lowerContent.includes('roadmap'))
		) {
			return 'executive_descriptor';
		}
		if (
			lowerContent.includes('document_id') ||
			lowerContent.includes('canonical_id')
		) {
			return 'document_descriptor';
		}
	}

	return 'unknown';
}

// ---------------------------------------------------------------------------
// Markdown classification
// ---------------------------------------------------------------------------

function classifyMarkdownCandidate(
	candidate: DocumentationImportCandidate,
	fileName: string,
	_baseNameLower: string,
	content: string,
	diagnostics: DocumentationImportDiagnostic[],
): DocumentationImportCandidateKind {
	// Check for derived artifact markers first
	if (pathLooksLikeDerivedArtifact(candidate.relativePath)) {
		diagnostics.push({
			candidateId: candidate.id,
			candidateKind: 'markdown_document',
			code: 'import_derived_artifact_detected',
			message: `Derived artifact path pattern detected: "${candidate.relativePath}"`,
			severity: 'warning',
			sourcePath: candidate.relativePath,
		});
	}

	if (content && contentLooksLikeDerivedArtifact(content)) {
		diagnostics.push({
			candidateId: candidate.id,
			candidateKind: 'markdown_document',
			code: 'import_derived_content_marker',
			message: `Derived artifact content markers detected in: "${candidate.relativePath}"`,
			severity: 'warning',
			sourcePath: candidate.relativePath,
		});
		// Still classify as markdown_document but will be flagged in conflict detection
		// Return early to avoid confusing with transcript
	}

	// Check for transcript markers
	if (content && contentLooksLikeTranscript(content)) {
		diagnostics.push({
			candidateId: candidate.id,
			candidateKind: 'transcript',
			code: 'import_transcript_detected',
			message: `Transcript content markers detected in: "${candidate.relativePath}"`,
			severity: 'info',
			sourcePath: candidate.relativePath,
		});
		return 'transcript';
	}

	// Check if filename suggests transcript
	if (
		fileName.includes('transcript') ||
		fileName.includes('conversation') ||
		fileName.includes('chat-log') ||
		fileName.includes('session-log')
	) {
		diagnostics.push({
			candidateId: candidate.id,
			candidateKind: 'transcript',
			code: 'import_transcript_filename',
			message: `Transcript filename pattern detected: "${candidate.relativePath}"`,
			severity: 'info',
			sourcePath: candidate.relativePath,
		});
		return 'transcript';
	}

	// Check for LOGOS frontmatter markers (indicating a structured LOGOS document)
	if (content) {
		const hasLogosFrontmatter =
			content.includes('canonical_document_id:') ||
			content.includes('document_id:') ||
			content.includes('profile_id:') ||
			content.includes('phase_id:');

		if (hasLogosFrontmatter) {
			return 'markdown_document';
		}

		// Check for generic frontmatter
		if (content.startsWith('---') && content.indexOf('---', 3) > 0) {
			return 'markdown_document';
		}

		// Check for headings (indicates structured document)
		if (/^#+\s/m.test(content)) {
			// Has headings — likely a structured document, but check content further
			if (content.length < 200 && !content.includes('#')) {
				return 'raw_note';
			}
			return 'markdown_document';
		}

		// Plain content without headings or frontmatter → raw note
		return 'raw_note';
	}

	return 'unknown';
}

// ---------------------------------------------------------------------------
// Post-classification status recheck
// ---------------------------------------------------------------------------

function recheckCandidateStatus(
	candidate: DocumentationImportCandidate,
	_diagnostics_: DocumentationImportDiagnostic[],
): void {
	// If candidate was classified as unsupported, set status
	if (candidate.kind === 'unsupported') {
		candidate.status = 'unsupported';
	}

	// Check for existing secret blockers (set during discovery)
	const hasSecretBlocker = candidate.blockers.some(
		(b) => b.code === 'import_secret_content',
	);
	if (hasSecretBlocker && candidate.status !== 'unsupported') {
		candidate.status = 'unsafe';
	}
}

// ---------------------------------------------------------------------------
// Metadata extraction from content
// ---------------------------------------------------------------------------

export interface ImportMetadataExtractionInput {
	candidate: DocumentationImportCandidate;
	/** Full file content (redacted) */
	content: string;
}

/**
 * Extract metadata from a candidate's content for enhanced classification and mapping.
 **/
export function extractCandidateMetadata(
	candidate: DocumentationImportCandidate,
	content: string,
): DocumentationImportCandidate {
	const metadata = { ...candidate.metadata };

	// Extract from Markdown
	if (candidate.extension === '.md' || candidate.extension === '.markdown') {
		extractMarkdownMetadata(content, metadata);
	}

	// Extract from YAML
	if (candidate.extension === '.yml' || candidate.extension === '.yaml') {
		extractYamlMetadata(content, metadata);
	}

	// Extract from JSON
	if (candidate.extension === '.json') {
		extractJsonMetadata(content, metadata);
	}

	return {
		...candidate,
		metadata,
	};
}

function extractMarkdownMetadata(
	content: string,
	metadata: Record<string, unknown>,
): void {
	// Extract frontmatter keys
	const fmKeys = extractFrontmatterKeys(content);
	if (fmKeys.length > 0) {
		metadata.frontmatterKeys = fmKeys;
	}

	// Extract frontmatter id/documentId/phaseId
	for (const key of fmKeys) {
		const lower = key.toLowerCase();
		if (
			lower === 'id' ||
			lower === 'document_id' ||
			lower === 'documentid' ||
			lower === 'canonical_document_id'
		) {
			const val = extractFrontmatterValue(content, key);
			if (val && !metadata.declaredId) {
				metadata.declaredId = val;
			}
			if (
				val &&
				(lower === 'document_id' ||
					lower === 'documentid' ||
					lower === 'canonical_document_id')
			) {
				metadata.declaredDocumentId = val;
			}
		}
		if (lower === 'phase_id' || lower === 'phaseid') {
			const val = extractFrontmatterValue(content, key);
			if (val) metadata.declaredPhaseId = val;
		}
		if (lower === 'profile_id' || lower === 'profileid') {
			const val = extractFrontmatterValue(content, key);
			if (val) metadata.declaredProfileId = val;
		}
	}

	// Extract title from first heading
	const headingMatch = content.match(/^#\s+(.+)$/m);
	if (headingMatch?.[1]) {
		metadata.title = headingMatch[1].trim();
	}

	// Extract all headings
	const headings = extractHeadings(content);
	if (headings.length > 0) {
		metadata.headings = headings.map((h) => h.trim());
	}
}

function extractFrontmatterKeys(content: string): string[] {
	const fm = parseFrontmatterRaw(content);
	if (!fm) return [];

	const keys: string[] = [];
	const lines = fm.split('\n');
	for (const line of lines) {
		const match = line.match(/^(\w[\w-]*)\s*:/);
		if (match?.[1]) {
			keys.push(match[1]);
		}
	}
	return keys;
}

function extractFrontmatterValue(
	content: string,
	key: string,
): string | undefined {
	const fm = parseFrontmatterRaw(content);
	if (!fm) return undefined;

	const regex = new RegExp(`^${key}\\s*:\\s*(.+)$`, 'm');
	const match = fm.match(regex);
	if (match?.[1]) {
		return match[1].trim().replace(/^["']|["']$/g, '');
	}
	return undefined;
}

function parseFrontmatterRaw(content: string): string | undefined {
	if (!content.startsWith('---')) return undefined;
	const endIdx = content.indexOf('---', 3);
	if (endIdx === -1) return undefined;
	return content.slice(3, endIdx);
}

function extractHeadings(content: string): string[] {
	const headings: string[] = [];
	const regex = /^#{1,6}\s+(.+)$/gm;
	let match = regex.exec(content);
	while (match !== null) {
		if (match[1]) headings.push(match[1]);
		match = regex.exec(content);
	}
	return headings;
}

function extractYamlMetadata(
	content: string,
	metadata: Record<string, unknown>,
): void {
	// Extract top-level keys
	const keys = extractYamlTopLevelKeys(content);
	if (keys.length > 0) {
		metadata.topLevelKeys = keys;
	}

	// Look for id/document/phase fields
	const idVal = extractYamlValue(content, 'id');
	if (idVal) metadata.declaredId = idVal;

	const docIdVal =
		extractYamlValue(content, 'document_id') ||
		extractYamlValue(content, 'documentId') ||
		extractYamlValue(content, 'canonical_id');
	if (docIdVal) metadata.declaredDocumentId = docIdVal;

	const phaseVal =
		extractYamlValue(content, 'phase_id') ||
		extractYamlValue(content, 'phaseId');
	if (phaseVal) metadata.declaredPhaseId = phaseVal;

	const profileVal =
		extractYamlValue(content, 'profile_id') ||
		extractYamlValue(content, 'profileId');
	if (profileVal) metadata.declaredProfileId = profileVal;

	// Check for title
	const titleVal = extractYamlValue(content, 'title');
	if (titleVal) metadata.title = titleVal;

	// Check for output declarations
	if (
		content.includes('canonical_output:') ||
		content.includes('canonical:') ||
		content.includes('outputs:')
	) {
		metadata.outputDeclarations = ['canonical'];
	}
}

function extractYamlTopLevelKeys(content: string): string[] {
	const keys: string[] = [];
	const lines = content.split('\n');
	for (const line of lines) {
		// Only capture top-level (no indentation) keys
		const match = line.match(/^(\w[\w-]*)\s*:/);
		if (match?.[1]) {
			keys.push(match[1]);
		}
	}
	return keys;
}

function extractYamlValue(content: string, key: string): string | undefined {
	const regex = new RegExp(`^${key}\\s*:\\s*(.+)$`, 'm');
	const match = content.match(regex);
	if (match?.[1]) {
		return match[1].trim().replace(/^["']|["']$/g, '');
	}
	return undefined;
}

function extractJsonMetadata(
	content: string,
	metadata: Record<string, unknown>,
): void {
	let parsed: unknown;
	try {
		parsed = JSON.parse(content);
	} catch {
		return;
	}

	if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
		const obj = parsed as Record<string, unknown>;
		const keys = Object.keys(obj);
		metadata.topLevelKeys = keys;

		if (typeof obj.id === 'string') metadata.declaredId = obj.id;
		if (typeof obj.document_id === 'string')
			metadata.declaredDocumentId = obj.document_id;
		if (typeof obj.documentId === 'string')
			metadata.declaredDocumentId = obj.documentId;
		if (typeof obj.canonical_id === 'string')
			metadata.declaredDocumentId = obj.canonical_id;
		if (typeof obj.phase_id === 'string')
			metadata.declaredPhaseId = obj.phase_id;
		if (typeof obj.phaseId === 'string') metadata.declaredPhaseId = obj.phaseId;
		if (typeof obj.profile_id === 'string')
			metadata.declaredProfileId = obj.profile_id;
		if (typeof obj.title === 'string') metadata.title = obj.title;

		// Check for schema-ish fields
		if (
			keys.some(
				(k) =>
					k === '$schema' ||
					k === 'type' ||
					k === 'properties' ||
					k === 'required' ||
					k === 'definitions',
			)
		) {
			metadata.schemaFields = keys.filter(
				(k) =>
					k === '$schema' ||
					k === 'type' ||
					k === 'properties' ||
					k === 'required' ||
					k === 'definitions',
			);
		}
	}
}
