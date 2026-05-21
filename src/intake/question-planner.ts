/** Question Planner — selects small, relevant next-question clusters from profile contracts */

import type { ContractGraph } from '../profiles/contract-graph.js';
import type {
	CanonicalDocumentId,
	DocumentationContract,
	LoadedDocumentDescriptor,
	LoadedPhaseDescriptor,
	PhaseId,
} from '../profiles/documentation-contract.js';
import type {
	WorkspaceAssumption,
	WorkspaceDecision,
	WorkspaceOpenQuestion,
	WorkspaceState,
} from '../state/workspace-state.schema.js';
import type {
	QuestionBlockingLevel,
	QuestionCandidate,
	QuestionCluster,
	QuestionGap,
	QuestionPlanningDiagnostic,
	QuestionPlanningInput,
	QuestionPlanningOptions,
	QuestionPlanningResult,
	QuestionPlanReason,
	QuestionPlanStatus,
	QuestionPriority,
} from './question-planner-types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_CLUSTER_SIZE = 5;

// Statuses that imply a document needs input
const INCOMPLETE_STATUSES = new Set([
	'not_started',
	'drafting',
	'needs_review',
	'needs_revision',
]);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function planNextQuestions(
	input: QuestionPlanningInput,
	options: QuestionPlanningOptions = {},
): QuestionPlanningResult {
	const diagnostics: QuestionPlanningDiagnostic[] = [];

	// Validate inputs
	if (!input.contract) {
		diagnostics.push({
			code: 'E_PLAN_MISSING_CONTRACT',
			fieldPointer: undefined,
			message: 'Documentation contract is required for question planning',
			recoveryHint: 'Load the active profile documentation contract first',
			severity: 'error',
			sourcePath: undefined,
		});
		return {
			allCandidates: undefined,
			cluster: undefined,
			diagnostics,
			success: false,
		};
	}

	if (!input.state) {
		diagnostics.push({
			code: 'E_PLAN_MISSING_STATE',
			fieldPointer: undefined,
			message: 'Workspace state is required for question planning',
			recoveryHint:
				'Initialize the workspace with /init before planning questions',
			severity: 'error',
			sourcePath: undefined,
		});
		return {
			allCandidates: undefined,
			cluster: undefined,
			diagnostics,
			success: false,
		};
	}

	const candidates = collectQuestionCandidates(
		input.contract,
		input.graph,
		input.state,
		options,
		diagnostics,
	);

	if (candidates.length === 0) {
		diagnostics.push({
			code: 'I_PLAN_NO_QUESTIONS',
			fieldPointer: undefined,
			message: 'No questions available for the current workspace state',
			recoveryHint:
				'The workspace may be complete or the profile may not define questions for the current state',
			severity: 'info',
			sourcePath: undefined,
		});
		return {
			allCandidates: [],
			cluster: undefined,
			diagnostics,
			success: true,
		};
	}

	const maxSize = options.maxClusterSize ?? DEFAULT_MAX_CLUSTER_SIZE;
	const clusterQuestions = buildCluster(candidates, maxSize, input.contract);

	return {
		allCandidates: candidates,
		cluster: clusterQuestions,
		diagnostics,
		success: true,
	};
}

export function collectQuestionCandidates(
	contract: DocumentationContract,
	graph: ContractGraph | undefined,
	state: WorkspaceState,
	options: QuestionPlanningOptions = {},
	diagnostics: QuestionPlanningDiagnostic[] = [],
): QuestionCandidate[] {
	const candidates: QuestionCandidate[] = [];
	const seenKeys = new Set<string>();
	const _maxSize = options.maxClusterSize ?? DEFAULT_MAX_CLUSTER_SIZE;

	// Index existing open questions by normalized text for deduplication
	const openQuestionIndex = buildOpenQuestionIndex(state.openQuestions);

	// Index confirmed decisions by affected document IDs
	const decisionIndex = buildDecisionIndex(state.decisions);

	// Index assumptions by affected document IDs
	const assumptionIndex = buildAssumptionIndex(state.assumptions);

	// Track which phases/documents are in scope
	const focusPhases = options.focusPhaseIds
		? new Set(options.focusPhaseIds)
		: undefined;
	const focusDocs = options.focusDocumentIds
		? new Set(options.focusDocumentIds)
		: undefined;

	// Build dependency depth map for ordering
	const dependencyDepth = buildDependencyDepthMap(contract, graph);

	// Build downstream dependency map (which docs depend on each doc)
	const downstreamMap = buildDownstreamMap(contract, graph);

	// Process documents in deterministic order
	for (const doc of contract.documents) {
		// Skip if not in focus
		if (focusDocs && !focusDocs.has(doc.canonicalId)) continue;
		if (focusPhases && !focusPhases.has(doc.phaseId)) continue;

		const phase = contract.phases.find((p) => p.id === doc.phaseId);
		if (!phase) continue;

		// Extract questions from this document
		const docCandidates = extractDocumentQuestions(
			doc,
			phase,
			contract,
			state,
			openQuestionIndex,
			decisionIndex,
			assumptionIndex,
			downstreamMap,
			dependencyDepth,
			options,
			diagnostics,
		);

		for (const candidate of docCandidates) {
			const key = makeDuplicateKey(candidate);
			if (seenKeys.has(key)) {
				diagnostics.push({
					code: 'W_PLAN_DUPLICATE_QUESTION',
					fieldPointer: candidate.source.fieldPointer,
					message: `Duplicate question detected: ${candidate.id}`,
					recoveryHint: 'Check descriptor for duplicate question definitions',
					severity: 'warning',
					sourcePath: candidate.source.descriptorPath,
				});
				continue;
			}
			seenKeys.add(key);
			candidates.push(candidate);
		}
	}

	// Sort deterministically
	sortCandidates(candidates, contract, dependencyDepth);

	return candidates;
}

// ---------------------------------------------------------------------------
// Document question extraction
// ---------------------------------------------------------------------------

function extractDocumentQuestions(
	doc: LoadedDocumentDescriptor,
	phase: LoadedPhaseDescriptor,
	contract: DocumentationContract,
	state: WorkspaceState,
	openQuestionIndex: Map<string, WorkspaceOpenQuestion>,
	_decisionIndex: Map<string, WorkspaceDecision[]>,
	_assumptionIndex: Map<string, WorkspaceAssumption[]>,
	downstreamMap: Map<CanonicalDocumentId, CanonicalDocumentId[]>,
	dependencyDepth: Map<CanonicalDocumentId, number>,
	options: QuestionPlanningOptions,
	_diagnostics: QuestionPlanningDiagnostic[],
): QuestionCandidate[] {
	const candidates: QuestionCandidate[] = [];
	const descriptor = doc.descriptor;

	// Check if this document has dependencies that are not satisfied
	const unresolvedDeps = getUnresolvedDependencies(doc, state);
	const hasUnresolvedDeps = unresolvedDeps.length > 0;

	// Determine document incompleteness from status
	const isIncomplete = INCOMPLETE_STATUSES.has(descriptor.status);

	// Determine if downstream documents depend on this
	const downstreamDocs = downstreamMap.get(doc.canonicalId) ?? [];
	const hasDownstreamDependents = downstreamDocs.length > 0;

	// 1. Extract explicit section questions
	for (
		let sectionIdx = 0;
		sectionIdx < descriptor.sections.length;
		sectionIdx++
	) {
		const section = descriptor.sections[sectionIdx];
		if (!section) continue;

		const isRequired = section.required === true;

		for (let qIdx = 0; qIdx < section.questions.length; qIdx++) {
			const questionText = section.questions[qIdx];
			if (!questionText || typeof questionText !== 'string') continue;

			const questionId = `${doc.canonicalId}::section::${section.id}::q${qIdx}`;

			// Check for existing open question
			const existingOpen = findExistingOpenQuestion(
				openQuestionIndex,
				questionText,
				doc.canonicalId,
			);

			// Determine blocking level
			let blockingLevel: QuestionBlockingLevel;
			let reason: QuestionPlanReason;
			let priority: QuestionPriority;

			if (isRequired && hasDownstreamDependents) {
				blockingLevel = 'blocking';
				reason = 'downstream_blocking';
				priority = 'critical';
			} else if (isRequired) {
				blockingLevel = 'blocking';
				reason = 'missing_required_section';
				priority = 'high';
			} else {
				blockingLevel = 'non-blocking';
				reason = 'explicit_descriptor_question';
				priority = 'medium';
			}

			// If there are unresolved dependencies, this document may be blocked
			if (hasUnresolvedDeps && blockingLevel === 'blocking') {
				// Still blocking but lower priority if dependencies unresolved
				priority = 'medium';
			}

			const candidate = createCandidate(
				questionId,
				questionText,
				doc,
				phase,
				section.id,
				section.title,
				`sections[${sectionIdx}].questions[${qIdx}]`,
				blockingLevel,
				priority,
				reason,
				existingOpen?.id,
				false,
				dependencyDepth.get(doc.canonicalId) ?? 0,
				getSortKey(
					phase.order,
					doc.documentOrder,
					sectionIdx,
					qIdx,
					blockingLevel,
					priority,
				),
			);

			candidates.push(candidate);
		}

		// If required section has no questions, generate a schema-derived question
		if (
			isRequired &&
			section.questions.length === 0 &&
			options.includeSchemaDerivedQuestions !== false
		) {
			const questionId = `${doc.canonicalId}::section::${section.id}::schema-derived`;
			const questionText = `Complete the "${section.title}" section${section.intent ? `: ${section.intent}` : ''}`;

			const existingOpen = findExistingOpenQuestion(
				openQuestionIndex,
				questionText,
				doc.canonicalId,
			);

			const blockingLevel: QuestionBlockingLevel = 'blocking';
			const reason: QuestionPlanReason = 'missing_required_section';
			let priority: QuestionPriority = hasDownstreamDependents
				? 'critical'
				: 'high';

			if (hasUnresolvedDeps) {
				priority = 'medium';
			}

			const candidate = createCandidate(
				questionId,
				questionText,
				doc,
				phase,
				section.id,
				section.title,
				`sections[${sectionIdx}]`,
				blockingLevel,
				priority,
				reason,
				existingOpen?.id,
				true,
				dependencyDepth.get(doc.canonicalId) ?? 0,
				getSortKey(
					phase.order,
					doc.documentOrder,
					sectionIdx,
					999,
					blockingLevel,
					priority,
				),
			);

			candidates.push(candidate);
		}
	}

	// 2. Extract central question if document is incomplete
	if (isIncomplete && descriptor.centralQuestion) {
		const questionId = `${doc.canonicalId}::centralQuestion`;
		const existingOpen = findExistingOpenQuestion(
			openQuestionIndex,
			descriptor.centralQuestion,
			doc.canonicalId,
		);

		const blockingLevel: QuestionBlockingLevel = 'blocking';
		let priority: QuestionPriority = hasDownstreamDependents
			? 'critical'
			: 'high';

		if (hasUnresolvedDeps) {
			priority = 'medium';
		}

		const candidate = createCandidate(
			questionId,
			descriptor.centralQuestion,
			doc,
			phase,
			undefined,
			undefined,
			'centralQuestion',
			blockingLevel,
			priority,
			'document_status_incomplete',
			existingOpen?.id,
			false,
			dependencyDepth.get(doc.canonicalId) ?? 0,
			getSortKey(
				phase.order,
				doc.documentOrder,
				0,
				-1,
				blockingLevel,
				priority,
			),
		);

		// Only add if not already covered by section questions
		if (!isQuestionRedundant(candidate, candidates)) {
			candidates.push(candidate);
		}
	}

	// 3. Extract questions from required inputs
	if (descriptor.inputs) {
		for (let inputIdx = 0; inputIdx < descriptor.inputs.length; inputIdx++) {
			const input = descriptor.inputs[inputIdx];
			if (!input) continue;

			if (input.required === true) {
				const questionId = `${doc.canonicalId}::input::${input.id}`;
				const questionText = input.description
					? `Provide required input "${input.id}": ${input.description}`
					: `Provide required input: ${input.id}`;

				const existingOpen = findExistingOpenQuestion(
					openQuestionIndex,
					questionText,
					doc.canonicalId,
				);

				const blockingLevel: QuestionBlockingLevel = 'blocking';
				let priority: QuestionPriority = hasDownstreamDependents
					? 'critical'
					: 'high';

				if (hasUnresolvedDeps) {
					priority = 'medium';
				}

				const candidate = createCandidate(
					questionId,
					questionText,
					doc,
					phase,
					undefined,
					undefined,
					`inputs[${inputIdx}]`,
					blockingLevel,
					priority,
					'missing_required_input',
					existingOpen?.id,
					input.description === undefined,
					dependencyDepth.get(doc.canonicalId) ?? 0,
					getSortKey(
						phase.order,
						doc.documentOrder,
						0,
						100 + inputIdx,
						blockingLevel,
						priority,
					),
				);

				if (!isQuestionRedundant(candidate, candidates)) {
					candidates.push(candidate);
				}
			}
		}
	}

	// 4. Extract questions from completion criteria when document is incomplete
	if (
		isIncomplete &&
		descriptor.completionCriteria &&
		descriptor.completionCriteria.length > 0
	) {
		for (let ccIdx = 0; ccIdx < descriptor.completionCriteria.length; ccIdx++) {
			const criterion = descriptor.completionCriteria[ccIdx];
			if (!criterion) continue;

			const questionId = `${doc.canonicalId}::completion::${ccIdx}`;
			const questionText = `Address completion criterion: ${criterion}`;

			const existingOpen = findExistingOpenQuestion(
				openQuestionIndex,
				questionText,
				doc.canonicalId,
			);

			const blockingLevel: QuestionBlockingLevel = 'blocking';
			let priority: QuestionPriority = hasDownstreamDependents
				? 'critical'
				: 'high';

			if (hasUnresolvedDeps) {
				priority = 'medium';
			}

			const candidate = createCandidate(
				questionId,
				questionText,
				doc,
				phase,
				undefined,
				undefined,
				`completionCriteria[${ccIdx}]`,
				blockingLevel,
				priority,
				'incomplete_completion_criteria',
				existingOpen?.id,
				true,
				dependencyDepth.get(doc.canonicalId) ?? 0,
				getSortKey(
					phase.order,
					doc.documentOrder,
					0,
					200 + ccIdx,
					blockingLevel,
					priority,
				),
			);

			if (!isQuestionRedundant(candidate, candidates)) {
				candidates.push(candidate);
			}
		}
	}

	// 5. Preserve existing open questions that are not already represented
	for (const openQ of state.openQuestions) {
		if (openQ.status !== 'open') continue;

		// Check if this open question relates to this document
		const relatesToDoc =
			openQ.affectedDocumentIds.includes(doc.canonicalId) ||
			openQ.affectedDocumentIds.length === 0;
		if (!relatesToDoc) continue;

		const questionId = `open::${openQ.id}`;

		// Check if already covered
		const alreadyCovered = candidates.some(
			(c) =>
				c.existingOpenQuestionId === openQ.id ||
				normalizeText(c.text) === normalizeText(openQ.question),
		);

		if (!alreadyCovered) {
			const candidate = createCandidate(
				questionId,
				openQ.question,
				doc,
				phase,
				undefined,
				undefined,
				undefined,
				'non-blocking',
				'medium',
				'existing_open_question',
				openQ.id,
				false,
				dependencyDepth.get(doc.canonicalId) ?? 0,
				getSortKey(
					phase.order,
					doc.documentOrder,
					0,
					300,
					'non-blocking',
					'medium',
				),
			);
			candidates.push(candidate);
		}
	}

	// 6. If document has unresolved dependencies, add dependency questions
	for (const depId of unresolvedDeps) {
		const depDoc = contract.documentsByCanonicalId.get(depId);
		if (!depDoc) continue;

		const questionId = `${doc.canonicalId}::dependsOn::${depId}`;
		const questionText = `Complete prerequisite document "${depDoc.descriptor.title}" (${depId}) before proceeding with "${descriptor.title}"`;

		const existingOpen = findExistingOpenQuestion(
			openQuestionIndex,
			questionText,
			doc.canonicalId,
		);

		const candidate = createCandidate(
			questionId,
			questionText,
			doc,
			phase,
			undefined,
			undefined,
			'dependsOn',
			'blocking',
			'critical',
			'unresolved_dependency',
			existingOpen?.id,
			true,
			dependencyDepth.get(doc.canonicalId) ?? 0,
			getSortKey(
				phase.order,
				doc.documentOrder,
				0,
				-10,
				'blocking',
				'critical',
			),
			depId,
		);

		if (!isQuestionRedundant(candidate, candidates)) {
			candidates.push(candidate);
		}
	}

	return candidates;
}

// ---------------------------------------------------------------------------
// Helper: create candidate
// ---------------------------------------------------------------------------

function createCandidate(
	id: string,
	text: string,
	doc: LoadedDocumentDescriptor,
	phase: LoadedPhaseDescriptor,
	sectionId: string | undefined,
	sectionTitle: string | undefined,
	fieldPointer: string | undefined,
	blockingLevel: QuestionBlockingLevel,
	priority: QuestionPriority,
	reason: QuestionPlanReason,
	existingOpenQuestionId: string | undefined,
	isSchemaDerived: boolean,
	_dependencyDepth: number,
	sortKey: number,
	relatedDependencyId?: CanonicalDocumentId,
): QuestionCandidate {
	const planStatus: QuestionPlanStatus = existingOpenQuestionId
		? 'preserved'
		: 'planned';

	return {
		blockingLevel,
		documentOrder: doc.documentOrder,
		existingOpenQuestionId,
		globalOrder: doc.globalOrder,
		id,
		isSchemaDerived,
		phaseOrder: phase.order,
		planStatus,
		priority,
		reason,
		reasonDescription: getReasonDescription(reason),
		relatedDependencyId: relatedDependencyId ?? undefined,
		relatedSectionId: sectionId,
		sortKey,
		source: {
			descriptorPath: doc.sourcePath,
			documentCanonicalId: doc.canonicalId,
			documentTitle: doc.descriptor.title,
			fieldPointer,
			phaseId: doc.phaseId,
			sectionId,
			sectionTitle,
		},
		text,
	};
}

// ---------------------------------------------------------------------------
// Helper: reason description
// ---------------------------------------------------------------------------

function getReasonDescription(reason: QuestionPlanReason): string {
	switch (reason) {
		case 'missing_required_section':
			return 'Required section is incomplete or unanswered';
		case 'missing_required_input':
			return 'Required input is missing';
		case 'incomplete_completion_criteria':
			return 'Completion criterion is not satisfied';
		case 'unresolved_dependency':
			return 'Prerequisite document is incomplete';
		case 'document_status_incomplete':
			return 'Document status indicates incomplete state';
		case 'explicit_descriptor_question':
			return 'Question explicitly defined in document descriptor';
		case 'schema_derived_gap':
			return 'Gap inferred from descriptor schema';
		case 'existing_open_question':
			return 'Existing open question from workspace state';
		case 'downstream_blocking':
			return 'Downstream documents depend on this answer';
		default:
			return 'Selected by question planner';
	}
}

// ---------------------------------------------------------------------------
// Helper: sort key
// ---------------------------------------------------------------------------

function getSortKey(
	phaseOrder: number,
	documentOrder: number,
	sectionOrder: number,
	questionOrder: number,
	blockingLevel: QuestionBlockingLevel,
	priority: QuestionPriority,
): number {
	const blockingWeight = blockingLevel === 'blocking' ? 0 : 1000;
	const priorityWeight =
		priority === 'critical'
			? 0
			: priority === 'high'
				? 100
				: priority === 'medium'
					? 200
					: 300;

	return (
		phaseOrder * 1000000 +
		documentOrder * 10000 +
		blockingWeight * 1000 +
		priorityWeight * 10 +
		sectionOrder * 100 +
		questionOrder
	);
}

// ---------------------------------------------------------------------------
// Helper: dependency depth map
// ---------------------------------------------------------------------------

function buildDependencyDepthMap(
	contract: DocumentationContract,
	graph: ContractGraph | undefined,
): Map<CanonicalDocumentId, number> {
	const depthMap = new Map<CanonicalDocumentId, number>();

	if (!graph) {
		// Without graph, use raw descriptor dependsOn
		for (const doc of contract.documents) {
			depthMap.set(doc.canonicalId, 0);
		}
		return depthMap;
	}

	// Initialize all docs to 0
	for (const doc of contract.documents) {
		depthMap.set(doc.canonicalId, 0);
	}

	// Iteratively compute depth using only dependsOn edges
	// Safety: cap iterations to document count to prevent infinite loops
	const maxIterations = contract.documents.length;
	for (let iteration = 0; iteration < maxIterations; iteration++) {
		let changed = false;
		for (const doc of contract.documents) {
			const deps = graph.getDependenciesBySourceDocumentId(doc.canonicalId);
			let maxDepDepth = -1;
			for (const dep of deps) {
				// Only count dependsOn edges for depth; feeds edges go the other direction
				if (
					dep.kind === 'dependsOn' &&
					dep.targetDocumentCanonicalId !== undefined
				) {
					const depDepth = depthMap.get(dep.targetDocumentCanonicalId) ?? 0;
					maxDepDepth = Math.max(maxDepDepth, depDepth);
				}
			}
			if (maxDepDepth >= 0) {
				const newDepth = maxDepDepth + 1;
				const currentDepth = depthMap.get(doc.canonicalId) ?? 0;
				if (newDepth > currentDepth) {
					depthMap.set(doc.canonicalId, newDepth);
					changed = true;
				}
			}
		}
		if (!changed) break;
	}

	return depthMap;
}

// ---------------------------------------------------------------------------
// Helper: downstream map
// ---------------------------------------------------------------------------

function buildDownstreamMap(
	contract: DocumentationContract,
	graph: ContractGraph | undefined,
): Map<CanonicalDocumentId, CanonicalDocumentId[]> {
	const downstreamMap = new Map<CanonicalDocumentId, CanonicalDocumentId[]>();

	// Initialize
	for (const doc of contract.documents) {
		downstreamMap.set(doc.canonicalId, []);
	}

	if (!graph) {
		return downstreamMap;
	}

	for (const doc of contract.documents) {
		const dependents = graph.getDependentsByTargetDocumentId(doc.canonicalId);
		const dependentIds = dependents
			.map((d) => d.sourceDocumentCanonicalId)
			.filter((id): id is string => id !== undefined);

		// Remove duplicates while preserving order
		const uniqueDependents: CanonicalDocumentId[] = [];
		const seen = new Set<string>();
		for (const id of dependentIds) {
			if (!seen.has(id)) {
				seen.add(id);
				uniqueDependents.push(id);
			}
		}

		downstreamMap.set(doc.canonicalId, uniqueDependents);
	}

	return downstreamMap;
}

// ---------------------------------------------------------------------------
// Helper: unresolved dependencies
// ---------------------------------------------------------------------------

function getUnresolvedDependencies(
	doc: LoadedDocumentDescriptor,
	state: WorkspaceState,
): CanonicalDocumentId[] {
	const unresolved: CanonicalDocumentId[] = [];

	if (!doc.descriptor.dependsOn) return unresolved;

	for (const depRef of doc.descriptor.dependsOn) {
		// Parse the dependency reference
		// Standard profile uses "<phase>/<document-id>" notation
		const depId = depRef.includes('/') ? depRef.split('/').pop() : depRef;
		if (!depId) continue;

		// Artifact metadata is not canonical proof that a prerequisite is satisfied.
		const hasConfirmedDecision = state.decisions.some(
			(d) =>
				d.status === 'confirmed' &&
				(d.affectedDocumentIds.includes(depId) ||
					d.affectedDocumentIds.length === 0),
		);

		// A dependency is unresolved if the document is not marked as reviewed/approved
		// and there's no confirmed decision that explicitly covers it.
		// Conservative: treat as unresolved unless we have strong evidence
		if (!hasConfirmedDecision) {
			unresolved.push(depId);
		}
	}

	return unresolved;
}

// ---------------------------------------------------------------------------
// Helper: open question index
// ---------------------------------------------------------------------------

function buildOpenQuestionIndex(
	openQuestions: WorkspaceOpenQuestion[],
): Map<string, WorkspaceOpenQuestion> {
	const index = new Map<string, WorkspaceOpenQuestion>();

	for (const q of openQuestions) {
		if (q.status !== 'open') continue;

		// Index by ID
		index.set(q.id, q);

		// Index by normalized text
		index.set(normalizeText(q.question), q);

		// Index by document + text combinations
		for (const docId of q.affectedDocumentIds) {
			index.set(`${docId}::${normalizeText(q.question)}`, q);
		}
	}

	return index;
}

function findExistingOpenQuestion(
	index: Map<string, WorkspaceOpenQuestion>,
	questionText: string,
	documentId: CanonicalDocumentId,
): WorkspaceOpenQuestion | undefined {
	const normalized = normalizeText(questionText);
	return (
		index.get(`${documentId}::${normalized}`) ??
		index.get(normalized) ??
		undefined
	);
}

// ---------------------------------------------------------------------------
// Helper: decision index
// ---------------------------------------------------------------------------

function buildDecisionIndex(
	decisions: WorkspaceDecision[],
): Map<string, WorkspaceDecision[]> {
	const index = new Map<string, WorkspaceDecision[]>();

	for (const d of decisions) {
		if (d.status !== 'confirmed') continue;

		for (const docId of d.affectedDocumentIds) {
			const list = index.get(docId) ?? [];
			list.push(d);
			index.set(docId, list);
		}

		// Also index by source refs
		for (const ref of d.sourceRefs) {
			const list = index.get(ref) ?? [];
			list.push(d);
			index.set(ref, list);
		}
	}

	return index;
}

// ---------------------------------------------------------------------------
// Helper: assumption index
// ---------------------------------------------------------------------------

function buildAssumptionIndex(
	assumptions: WorkspaceAssumption[],
): Map<string, WorkspaceAssumption[]> {
	const index = new Map<string, WorkspaceAssumption[]>();

	for (const a of assumptions) {
		if (a.status !== 'active' && a.status !== 'proposed') continue;

		for (const docId of a.affectedDocumentIds) {
			const list = index.get(docId) ?? [];
			list.push(a);
			index.set(docId, list);
		}
	}

	return index;
}

// ---------------------------------------------------------------------------
// Helper: duplicate key
// ---------------------------------------------------------------------------

function makeDuplicateKey(candidate: QuestionCandidate): string {
	return `${candidate.id}|${candidate.source.documentCanonicalId}|${candidate.source.fieldPointer ?? ''}|${normalizeText(candidate.text)}`;
}

// ---------------------------------------------------------------------------
// Helper: normalize text
// ---------------------------------------------------------------------------

function normalizeText(text: string): string {
	return text
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/[^a-z0-9 ]/g, '');
}

// ---------------------------------------------------------------------------
// Helper: check if question is redundant with existing candidates
// ---------------------------------------------------------------------------

function isQuestionRedundant(
	candidate: QuestionCandidate,
	existingCandidates: QuestionCandidate[],
): boolean {
	const normalizedText = normalizeText(candidate.text);

	return existingCandidates.some(
		(c) =>
			c.source.documentCanonicalId === candidate.source.documentCanonicalId &&
			normalizeText(c.text) === normalizedText,
	);
}

// ---------------------------------------------------------------------------
// Helper: sort candidates
// ---------------------------------------------------------------------------

function sortCandidates(
	candidates: QuestionCandidate[],
	_contract: DocumentationContract,
	dependencyDepth: Map<CanonicalDocumentId, number>,
): void {
	candidates.sort((a, b) => {
		// 1. Phase order
		if (a.phaseOrder !== b.phaseOrder) {
			return a.phaseOrder - b.phaseOrder;
		}

		// 2. Dependency depth (lower depth first)
		const depthA = dependencyDepth.get(a.source.documentCanonicalId) ?? 0;
		const depthB = dependencyDepth.get(b.source.documentCanonicalId) ?? 0;
		if (depthA !== depthB) {
			return depthA - depthB;
		}

		// 3. Blocking before non-blocking
		if (a.blockingLevel !== b.blockingLevel) {
			return a.blockingLevel === 'blocking' ? -1 : 1;
		}

		// 4. Priority
		const priorityOrder = { critical: 0, high: 1, low: 3, medium: 2 };
		const prioA = priorityOrder[a.priority];
		const prioB = priorityOrder[b.priority];
		if (prioA !== prioB) {
			return prioA - prioB;
		}

		// 5. Preserved (existing open) before new
		if (a.planStatus === 'preserved' && b.planStatus !== 'preserved') {
			return -1;
		}
		if (b.planStatus === 'preserved' && a.planStatus !== 'preserved') {
			return 1;
		}

		// 6. Document order
		if (a.documentOrder !== b.documentOrder) {
			return a.documentOrder - b.documentOrder;
		}

		// 7. Pre-computed sort key as final tie-breaker
		return a.sortKey - b.sortKey;
	});
}

// ---------------------------------------------------------------------------
// Helper: build cluster
// ---------------------------------------------------------------------------

function buildCluster(
	candidates: QuestionCandidate[],
	maxSize: number,
	contract: DocumentationContract,
): QuestionCluster {
	// Select top questions
	const selected = candidates.slice(0, maxSize);

	// Compute source documents
	const sourceDocuments = Array.from(
		new Set(selected.map((q) => q.source.documentCanonicalId)),
	);

	// Compute phase coverage
	const phaseMap = new Map<
		PhaseId,
		{
			phaseId: PhaseId;
			phaseTitle: string;
			documentCount: number;
			questionCount: number;
		}
	>();

	for (const q of selected) {
		const phase = contract.phases.find((p) => p.id === q.source.phaseId);
		const phaseTitle = phase?.title ?? q.source.phaseId;

		const existing = phaseMap.get(q.source.phaseId);
		if (existing) {
			existing.questionCount++;
			if (!existing.documentCount) {
				existing.documentCount = 1;
			}
		} else {
			phaseMap.set(q.source.phaseId, {
				documentCount: 1,
				phaseId: q.source.phaseId,
				phaseTitle,
				questionCount: 1,
			});
		}
	}

	// Count unique documents per phase
	for (const [phaseId, info] of phaseMap) {
		const uniqueDocs = new Set(
			selected
				.filter((q) => q.source.phaseId === phaseId)
				.map((q) => q.source.documentCanonicalId),
		);
		info.documentCount = uniqueDocs.size;
	}

	const phaseCoverage = Array.from(phaseMap.values());
	phaseCoverage.sort((a, b) => {
		const phaseA = contract.phases.find((p) => p.id === a.phaseId);
		const phaseB = contract.phases.find((p) => p.id === b.phaseId);
		return (phaseA?.order ?? 0) - (phaseB?.order ?? 0);
	});

	// Identify gaps from candidates that were deferred
	const gapsConsidered: QuestionGap[] = [];
	const skippedCount = Math.max(0, candidates.length - maxSize);

	// Build reason summary
	const blockingCount = selected.filter(
		(q) => q.blockingLevel === 'blocking',
	).length;
	const nonBlockingCount = selected.filter(
		(q) => q.blockingLevel === 'non-blocking',
	).length;
	const preservedCount = selected.filter(
		(q) => q.planStatus === 'preserved',
	).length;

	let reasonSummary = `Selected ${selected.length} questions`;
	if (blockingCount > 0) reasonSummary += `, ${blockingCount} blocking`;
	if (nonBlockingCount > 0)
		reasonSummary += `, ${nonBlockingCount} non-blocking`;
	if (preservedCount > 0)
		reasonSummary += `, ${preservedCount} preserved from state`;
	if (skippedCount > 0) reasonSummary += `; ${skippedCount} questions deferred`;

	return {
		gapsConsidered,
		phaseCoverage,
		questions: selected.map((c) => ({
			blockingLevel: c.blockingLevel,
			existingOpenQuestionId: c.existingOpenQuestionId,
			id: c.id,
			isSchemaDerived: c.isSchemaDerived,
			planStatus: c.planStatus,
			priority: c.priority,
			reason: c.reason,
			reasonDescription: c.reasonDescription,
			relatedDependencyId: c.relatedDependencyId,
			relatedSectionId: c.relatedSectionId,
			source: c.source,
			text: c.text,
		})),
		reasonSummary,
		skippedCount,
		sourceDocuments,
	};
}
