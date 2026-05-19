/** Step 12.1 — Import mapping: match candidates to profile documents */

import type {
	DocumentationContract,
	LoadedDocumentDescriptor,
} from '../profiles/documentation-contract.js';
import type {
	DocumentationImportCandidate,
	DocumentationImportCandidateStatus,
	DocumentationImportDiagnostic,
	DocumentationImportMapping,
	DocumentationImportMappingEvidence,
	DocumentationImportMappingStatus,
} from './import-model.js';

// ---------------------------------------------------------------------------
// Mapping input
// ---------------------------------------------------------------------------

export interface ImportMappingInput {
	candidates: DocumentationImportCandidate[];
	documentationContract?: DocumentationContract | undefined;
	existingCanonicalOutputs?: string[] | undefined;
	documentationRoot: string;
	idCounter?: number | undefined;
}

export interface ImportMappingResult {
	candidates: DocumentationImportCandidate[];
	mappings: DocumentationImportMapping[];
	diagnostics: DocumentationImportDiagnostic[];
}

// ---------------------------------------------------------------------------
// Scoring thresholds
// ---------------------------------------------------------------------------

const HIGH_CONFIDENCE_THRESHOLD = 0.8;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.5;
const LOW_CONFIDENCE_THRESHOLD = 0.25;

// ---------------------------------------------------------------------------
// Main mapping function
// ---------------------------------------------------------------------------

/**
 * Map import candidates to known profile documents using deterministic heuristics.
 * Returns candidates with updated statuses and a list of mappings.
 */
export function mapImportCandidates(
	input: ImportMappingInput,
): ImportMappingResult {
	const results: DocumentationImportCandidate[] = [];
	const mappings: DocumentationImportMapping[] = [];
	const diagnostics: DocumentationImportDiagnostic[] = [];
	let nextId = input.idCounter ?? 1;

	if (!input.documentationContract) {
		// No contract available — all candidates remain unmapped
		// But preserve unsafe/blocked/unsupported statuses
		for (const candidate of input.candidates) {
			const preservedStatuses: DocumentationImportCandidateStatus[] = [
				'blocked',
				'unsafe',
				'unsupported',
			];
			const status = preservedStatuses.includes(candidate.status)
				? candidate.status
				: 'unmapped';
			results.push({
				...candidate,
				status,
			});
		}
		diagnostics.push({
			code: 'import_no_contract',
			message: 'No documentation contract available for mapping',
			severity: 'warning',
		});
		return { candidates: results, diagnostics, mappings };
	}

	const descriptors = input.documentationContract.documents;
	const allCanonicalOutputs = new Set<string>();
	if (input.existingCanonicalOutputs) {
		for (const out of input.existingCanonicalOutputs) {
			allCanonicalOutputs.add(out);
		}
	}

	// Track which descriptors have been mapped to (for duplicate detection)
	const mappedDescriptorIds = new Set<string>();

	for (const candidate of input.candidates) {
		if (candidate.kind === 'unsupported' || candidate.status === 'blocked') {
			results.push(candidate);
			continue;
		}

		const candidateMappings = mapSingleCandidate(
			candidate,
			descriptors,
			allCanonicalOutputs,
			input.documentationRoot,
			mappedDescriptorIds,
			diagnostics,
			nextId,
		);

		mappings.push(...candidateMappings);
		nextId += candidateMappings.length || 1;

		// Determine candidate status based on mapping results
		const updatedCandidate = determineCandidateStatusFromMappings(
			candidate,
			candidateMappings,
		);
		results.push(updatedCandidate);

		// Track mapped descriptor IDs for duplicate detection
		for (const m of candidateMappings) {
			if (m.targetDocumentCanonicalId) {
				mappedDescriptorIds.add(m.targetDocumentCanonicalId);
			}
		}
	}

	return { candidates: results, diagnostics, mappings };
}

// ---------------------------------------------------------------------------
// Single candidate mapping
// ---------------------------------------------------------------------------

function mapSingleCandidate(
	candidate: DocumentationImportCandidate,
	descriptors: LoadedDocumentDescriptor[],
	existingOutputs: Set<string>,
	documentationRoot: string,
	mappedDescriptorIds: Set<string>,
	diagnostics: DocumentationImportDiagnostic[],
	startId: number,
): DocumentationImportMapping[] {
	const mappings: DocumentationImportMapping[] = [];
	let nextId = startId;

	// For raw notes, transcripts, and unsupported kinds — don't try to map
	if (
		candidate.kind === 'raw_note' ||
		candidate.kind === 'transcript' ||
		candidate.kind === 'unsupported'
	) {
		const mapping: DocumentationImportMapping = {
			blockers: [],
			candidateId: candidate.id,
			confidence: 0,
			evidence: [
				{
					reason: `Candidate kind "${candidate.kind}" is not mappable to a specific document`,
					signal: 'kind_not_mappable',
				},
			],
			id: `import-mapping-${nextId}`,
			requiresManualReview: true,
			score: 0,
			status: 'not_applicable',
			warnings: [],
		};
		mappings.push(mapping);
		return mappings;
	}

	// For profile/phase/document/executive descriptors — create reference mappings
	if (
		candidate.kind === 'profile_registry' ||
		candidate.kind === 'phase_descriptor' ||
		candidate.kind === 'document_descriptor' ||
		candidate.kind === 'executive_descriptor'
	) {
		const mapping = createDescriptorMapping(candidate, diagnostics, nextId);
		mappings.push(mapping);
		return mappings;
	}

	// For markdown_document and unknown markdown files — attempt document mapping
	const scored = scoreAgainstDescriptors(
		candidate,
		descriptors,
		existingOutputs,
		documentationRoot,
		mappedDescriptorIds,
	);

	if (scored.length === 0) {
		const mapping: DocumentationImportMapping = {
			blockers: [],
			candidateId: candidate.id,
			confidence: 0,
			evidence: [
				{
					reason: 'No matching profile documents found',
					signal: 'no_match',
				},
			],
			id: `import-mapping-${nextId}`,
			requiresManualReview: true,
			score: 0,
			status: 'not_applicable',
			warnings: [],
		};
		mappings.push(mapping);
		return mappings;
	}

	// Sort by score descending
	scored.sort((a, b) => b.score - a.score);

	// Check for ambiguity
	const bestScore = scored[0]?.score ?? 0;
	const secondScore = scored[1]?.score ?? 0;
	const scoreGap = bestScore - secondScore;

	const isAmbiguous = bestScore > 0 && scoreGap < 0.15 && scored.length > 1;

	if (isAmbiguous) {
		// Mark top contenders as ambiguous
		const topContenders = scored.filter((s) => s.score >= bestScore - 0.15);
		for (const contender of topContenders) {
			const mapping = buildMappingFromScore(
				contender,
				candidate,
				nextId,
				true, // ambiguous
			);
			mappings.push(mapping);
			nextId++;
		}

		diagnostics.push({
			candidateId: candidate.id,
			code: 'import_ambiguous_mapping',
			message: `Candidate "${candidate.relativePath}" maps ambiguously to ${topContenders.length} documents`,
			severity: 'warning',
			sourcePath: candidate.relativePath,
			targetDocumentId: topContenders
				.map((s) => s.descriptor.descriptor.id)
				.join(', '),
		});
	} else {
		// Single best mapping
		const topScore = scored[0];
		if (!topScore) return mappings;
		const mapping = buildMappingFromScore(topScore, candidate, nextId, false);
		mappings.push(mapping);
	}

	return mappings;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

interface CandidateScore {
	descriptor: LoadedDocumentDescriptor;
	score: number;
	evidence: DocumentationImportMappingEvidence[];
}

function scoreAgainstDescriptors(
	candidate: DocumentationImportCandidate,
	descriptors: LoadedDocumentDescriptor[],
	_existingOutputs: Set<string>,
	documentationRoot: string,
	_mappedDescriptorIds: Set<string>,
): CandidateScore[] {
	const results: CandidateScore[] = [];
	const candidatePath = candidate.relativePath;
	const candidateTitle = candidate.metadata.title ?? '';
	const candidateHeadings = candidate.metadata.headings ?? [];
	const declaredDocId =
		candidate.metadata.declaredDocumentId ?? candidate.metadata.declaredId;
	const declaredPhaseId = candidate.metadata.declaredPhaseId;

	for (const descriptor of descriptors) {
		const evidence: DocumentationImportMappingEvidence[] = [];
		let score = 0;

		// 1. Exact document ID match (highest weight)
		if (declaredDocId && declaredDocId === descriptor.descriptor.id) {
			score += 0.4;
			evidence.push({
				reason: `Exact document ID match: "${declaredDocId}"`,
				score: 0.4,
				signal: 'exact_id_match',
			});
		}

		// 2. Canonical output path match
		const descriptorCanonicalPath =
			descriptor.descriptor.outputs.canonical.path;
		if (descriptorCanonicalPath) {
			const canonicalSegments = descriptorCanonicalPath
				.split('/')
				.slice(1)
				.join('/');
			const expectedOutput = `${documentationRoot.replace(/\/$/, '')}/${canonicalSegments}`;

			if (
				candidatePath === expectedOutput ||
				candidatePath === descriptorCanonicalPath
			) {
				score += 0.35;
				evidence.push({
					reason: 'Canonical output path matches descriptor output',
					score: 0.35,
					signal: 'output_path_match',
				});
			}
		}

		// 3. Frontmatter documentId match
		if (declaredDocId && declaredDocId === descriptor.canonicalId) {
			score += 0.3;
			evidence.push({
				reason: `Frontmatter documentId matches canonical ID: "${descriptor.canonicalId}"`,
				score: 0.3,
				signal: 'frontmatter_document_id_match',
			});
		}

		// 4. Phase ID match
		if (declaredPhaseId && declaredPhaseId === descriptor.phaseId) {
			score += 0.2;
			evidence.push({
				reason: `Phase ID match: "${declaredPhaseId}"`,
				score: 0.2,
				signal: 'phase_id_match',
			});
		}

		// 5. Filename/path similarity
		const filenameMatchScore = computeFilenameSimilarity(
			candidatePath,
			descriptor.descriptor.outputs.canonical.path ?? '',
			descriptor.descriptor.title ?? '',
		);
		if (filenameMatchScore > 0) {
			score += filenameMatchScore * 0.2;
			evidence.push({
				reason: `Filename similarity to descriptor output path`,
				score: filenameMatchScore * 0.2,
				signal: 'filename_similarity',
			});
		}

		// 6. Title similarity
		if (candidateTitle) {
			const titleScore = computeTitleSimilarity(
				candidateTitle,
				descriptor.descriptor.title ?? '',
			);
			if (titleScore > 0) {
				score += titleScore * 0.15;
				evidence.push({
					reason: `Title similarity: "${candidateTitle}" ~ "${descriptor.descriptor.title ?? ''}"`,
					score: titleScore * 0.15,
					signal: 'title_similarity',
				});
			}
		}

		// 7. Heading overlap with required sections
		if (candidateHeadings.length > 0 && descriptor.descriptor.sections) {
			const headingScore = computeHeadingOverlap(
				candidateHeadings,
				descriptor.descriptor.sections.map((s) => s.title),
			);
			if (headingScore > 0) {
				score += headingScore * 0.1;
				evidence.push({
					reason: `Heading overlap with document required sections`,
					score: headingScore * 0.1,
					signal: 'heading_overlap',
				});
			}
		}

		// 8. Phase path match
		if (candidatePath.includes(`/${descriptor.phaseId}/`)) {
			score += 0.05;
			evidence.push({
				reason: `Candidate path includes phase directory: "${descriptor.phaseId}"`,
				score: 0.05,
				signal: 'phase_path_match',
			});
		}

		if (score > 0) {
			results.push({ descriptor, evidence, score: Math.min(score, 1.0) });
		}
	}

	return results;
}

// ---------------------------------------------------------------------------
// Similarity helpers
// ---------------------------------------------------------------------------

function computeFilenameSimilarity(
	candidatePath: string,
	descriptorOutputPath: string,
	descriptorTitle: string,
): number {
	const candidateFile = candidatePath.split('/').pop() ?? '';
	const descriptorFile = descriptorOutputPath.split('/').pop() ?? '';

	if (candidateFile === descriptorFile) return 1.0;

	// Check if candidate file contains the document id
	if (candidateFile.length > 0 && descriptorFile.length > 0) {
		const candidateBase = candidateFile.replace(/\.(md|markdown)$/, '');
		const descBase = descriptorFile.replace(/\.(md|markdown)$/, '');

		if (candidateBase === descBase) return 1.0;

		// Partial match
		if (descBase.includes(candidateBase) || candidateBase.includes(descBase)) {
			return 0.5;
		}

		// Title-based filename match
		const titleSlug = descriptorTitle
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
		if (
			candidateBase.includes(titleSlug) ||
			titleSlug.includes(candidateBase)
		) {
			return 0.4;
		}
	}

	return 0;
}

function computeTitleSimilarity(
	candidateTitle: string,
	descriptorTitle: string,
): number {
	if (!descriptorTitle) return 0;

	const cn = candidateTitle.toLowerCase().trim();
	const dn = descriptorTitle.toLowerCase().trim();

	if (cn === dn) return 1.0;
	if (cn.includes(dn) || dn.includes(cn)) return 0.7;

	// Word-level overlap
	const cw = new Set(cn.split(/\s+/));
	const dw = new Set(dn.split(/\s+/));
	let overlap = 0;
	for (const w of cw) {
		if (dw.has(w)) overlap++;
	}
	if (overlap === 0) return 0;
	const maxLen = Math.max(cw.size, dw.size);
	return overlap / maxLen;
}

function computeHeadingOverlap(
	candidateHeadings: string[],
	descriptorSectionTitles: string[],
): number {
	if (descriptorSectionTitles.length === 0) return 0;

	const ch = new Set(candidateHeadings.map((h) => h.toLowerCase().trim()));
	const ds = new Set(
		descriptorSectionTitles.map((s) => s.toLowerCase().trim()),
	);

	let overlap = 0;
	for (const h of ch) {
		if (ds.has(h)) {
			overlap++;
			continue;
		}
		// Partial match
		for (const d of ds) {
			if (d.includes(h) || h.includes(d)) {
				overlap += 0.5;
				break;
			}
		}
	}

	return Math.min(overlap / descriptorSectionTitles.length, 1.0);
}

// ---------------------------------------------------------------------------
// Build mapping from score
// ---------------------------------------------------------------------------

function buildMappingFromScore(
	scored: CandidateScore,
	candidate: DocumentationImportCandidate,
	id: number,
	isAmbiguous: boolean,
): DocumentationImportMapping {
	const status = isAmbiguous ? 'ambiguous' : scoreToStatus(scored.score);

	const mapping: DocumentationImportMapping = {
		blockers: [],
		candidateId: candidate.id,
		confidence: scored.score,
		evidence: scored.evidence,
		id: `import-mapping-${id}`,
		requiresManualReview: status === 'low_confidence' || isAmbiguous,
		score: scored.score,
		status,
		targetDocumentCanonicalId: scored.descriptor.canonicalId,
		targetDocumentId: scored.descriptor.descriptor.id,
		targetPhaseId: scored.descriptor.phaseId,
		warnings: [],
	};

	if (isAmbiguous) {
		mapping.warnings.push({
			candidateId: candidate.id,
			code: 'import_ambiguous_mapping',
			message: `Mapping is ambiguous; multiple close matches exist`,
		});
	}

	return mapping;
}

function scoreToStatus(score: number): DocumentationImportMappingStatus {
	if (score >= HIGH_CONFIDENCE_THRESHOLD) return 'high_confidence';
	if (score >= MEDIUM_CONFIDENCE_THRESHOLD) return 'medium_confidence';
	if (score >= LOW_CONFIDENCE_THRESHOLD) return 'low_confidence';
	if (score > 0) return 'low_confidence';
	return 'not_applicable';
}

// ---------------------------------------------------------------------------
// Descriptor mapping (profile/phase/document/executive)
// ---------------------------------------------------------------------------

function createDescriptorMapping(
	candidate: DocumentationImportCandidate,
	diagnostics: DocumentationImportDiagnostic[],
	id: number,
): DocumentationImportMapping {
	const mapping: DocumentationImportMapping = {
		blockers: [],
		candidateId: candidate.id,
		confidence: 0.5,
		evidence: [
			{
				reason: `Profile/descriptor candidate of kind "${candidate.kind}" proposed for manual review`,
				score: 0.5,
				signal: 'descriptor_candidate',
			},
		],
		id: `import-mapping-${id}`,
		requiresManualReview: true,
		score: 0.5,
		status: 'low_confidence',
		warnings: [
			{
				candidateId: candidate.id,
				code: 'import_descriptor_candidate_review',
				message: `Descriptor candidate requires manual review before importing`,
			},
		],
	};

	diagnostics.push({
		candidateId: candidate.id,
		candidateKind: candidate.kind,
		code: 'import_descriptor_candidate',
		message: `Profile/descriptor candidate "${candidate.relativePath}" requires manual review`,
		severity: 'info',
		sourcePath: candidate.relativePath,
	});

	return mapping;
}

// ---------------------------------------------------------------------------
// Candidate status from mappings
// ---------------------------------------------------------------------------

function determineCandidateStatusFromMappings(
	candidate: DocumentationImportCandidate,
	mappings: DocumentationImportMapping[],
): DocumentationImportCandidate {
	if (mappings.length === 0) {
		return { ...candidate, status: 'unmapped' };
	}

	const hasNotApplicable = mappings.every((m) => m.status === 'not_applicable');
	if (hasNotApplicable) {
		return { ...candidate, status: 'unmapped' };
	}

	const hasAmbiguous = mappings.some((m) => m.status === 'ambiguous');
	if (hasAmbiguous) {
		return { ...candidate, status: 'ambiguous' };
	}

	const hasHighConfidence = mappings.some(
		(m) => m.status === 'high_confidence',
	);
	if (hasHighConfidence && mappings.length === 1) {
		return { ...candidate, status: 'mapped' };
	}

	const hasMediumConfidence = mappings.some(
		(m) => m.status === 'medium_confidence',
	);
	if (hasMediumConfidence && mappings.length === 1) {
		return { ...candidate, status: 'mapped' };
	}

	const hasBlocked = mappings.some((m) => m.status === 'blocked');
	if (hasBlocked) {
		return { ...candidate, status: 'blocked' };
	}

	return { ...candidate, status: 'unmapped' };
}
