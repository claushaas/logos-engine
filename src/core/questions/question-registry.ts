/**
 * LOGOS Core — Profile-driven question registry builder (Step 3.2).
 *
 * Converts active profile document/section questions into structured,
 * stable LogosQuestion records and deterministic indexes.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import type { ProfileDocumentContract } from '../profiles/profile-contracts.js';
import { createQuestionId } from './question-id.js';
import type { LogosQuestion, QuestionPriority } from './question-types.js';
import { DEFAULT_FOLLOW_UP_POLICY } from './question-types.js';

// ---------------------------------------------------------------------------
// Registry types
// ---------------------------------------------------------------------------

export type LogosQuestionRegistry = {
	profileId: string;
	questions: LogosQuestion[];
	byId: Record<string, LogosQuestion>;
	byPhase: Record<string, string[]>;
	byDocument: Record<string, string[]>;
	bySection: Record<string, string[]>;
	warnings: string[];
};

export type BuildQuestionRegistryResult =
	| {
			ok: true;
			registry: LogosQuestionRegistry;
			warnings: string[];
	  }
	| {
			ok: false;
			errors: string[];
			warnings: string[];
	  };

export type BuildQuestionRegistryInput = {
	profileId: string;
	documents: ProfileDocumentContract[];
};

// ---------------------------------------------------------------------------
// Derivation helpers
// ---------------------------------------------------------------------------

function derivePriority(
	_doc: ProfileDocumentContract,
	sectionRequired: boolean,
): QuestionPriority {
	// Deterministic fallback: optional sections are always optional.
	if (!sectionRequired) {
		return 'optional';
	}

	// Foundation-phase documents are treated as critical because they
	// establish the normative base for all downstream work.
	if (_doc.phaseId === '01-foundation' || _doc.phaseId.startsWith('01-')) {
		return 'critical';
	}

	return 'important';
}

function derivePurpose(
	doc: ProfileDocumentContract,
	sectionTitle: string | undefined,
	sectionId: string,
): string {
	if (sectionTitle !== undefined && sectionTitle.length > 0) {
		return sectionTitle;
	}
	if (doc.centralQuestion !== undefined && doc.centralQuestion.length > 0) {
		return doc.centralQuestion;
	}
	if (doc.title !== undefined && doc.title.length > 0) {
		return doc.title;
	}
	return `Clarify ${doc.id}.${sectionId}`;
}

function deriveAcceptanceCriteria(doc: ProfileDocumentContract): string[] {
	if (
		doc.completionCriteria !== undefined &&
		doc.completionCriteria.length > 0
	) {
		return doc.completionCriteria;
	}
	return [];
}

function deriveCompletionSignals(doc: ProfileDocumentContract): string[] {
	if (doc.qualityChecks !== undefined && doc.qualityChecks.length > 0) {
		return doc.qualityChecks;
	}
	return [];
}

function deriveDependencies(
	doc: ProfileDocumentContract,
): string[] | undefined {
	if (doc.dependsOn !== undefined && doc.dependsOn.length > 0) {
		return doc.dependsOn;
	}
	return undefined;
}

type MetadataInput = {
	centralQuestion: string | undefined;
	documentTitle: string | undefined;
	questionIndex: number;
	rawDependsOn: string[] | undefined;
	rawOutputs: Record<string, unknown> | undefined;
	sectionQuestionCount: number;
	sectionRequired: boolean;
	sectionTitle: string | undefined;
};

function buildMetadata(input: MetadataInput): Record<string, unknown> {
	const metadata: Record<string, unknown> = {
		questionIndex: input.questionIndex,
		sectionQuestionCount: input.sectionQuestionCount,
		sectionRequired: input.sectionRequired,
	};
	if (input.centralQuestion !== undefined) {
		metadata.centralQuestion = input.centralQuestion;
	}
	if (input.documentTitle !== undefined) {
		metadata.documentTitle = input.documentTitle;
	}
	if (input.rawDependsOn !== undefined) {
		metadata.rawDependsOn = input.rawDependsOn;
	}
	if (input.rawOutputs !== undefined) {
		metadata.rawOutputs = input.rawOutputs;
	}
	if (input.sectionTitle !== undefined) {
		metadata.sectionTitle = input.sectionTitle;
	}
	return metadata;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Build a deterministic {@link LogosQuestionRegistry} from loaded profile
 * document contracts.
 *
 * Rules:
 * - Iterates documents in the order provided (must already be deterministic).
 * - Generates stable question ids from phase, document, section, and index.
 * - Detects duplicate ids and returns a structured error.
 * - Builds byId, byPhase, byDocument, and bySection indexes.
 * - Returns warnings for documents or sections that contain no questions.
 */
export function buildQuestionRegistry(
	input: BuildQuestionRegistryInput,
): BuildQuestionRegistryResult {
	const { profileId, documents } = input;
	const questions: LogosQuestion[] = [];
	const warnings: string[] = [];
	const errors: string[] = [];
	const seenIds = new Set<string>();

	for (const doc of documents) {
		if (doc.sections.length === 0) {
			warnings.push(
				`Document "${doc.id}" has no sections; no questions derived.`,
			);
			continue;
		}

		let docHasQuestions = false;

		for (const section of doc.sections) {
			if (section.questions.length === 0) {
				warnings.push(
					`Section "${section.id}" in document "${doc.id}" has no questions.`,
				);
				continue;
			}

			for (let idx = 0; idx < section.questions.length; idx++) {
				const questionText = section.questions[idx];
				if (questionText === undefined || questionText.trim().length === 0) {
					warnings.push(
						`Empty question at index ${idx} in section "${section.id}" of document "${doc.id}".`,
					);
					continue;
				}

				const id = createQuestionId({
					documentId: doc.id,
					phaseId: doc.phaseId,
					questionIndex: idx,
					sectionId: section.id,
				});

				if (seenIds.has(id)) {
					errors.push(
						`Duplicate question id "${id}" in document "${doc.id}", section "${section.id}", index ${idx}.`,
					);
					continue;
				}
				seenIds.add(id);

				const q: LogosQuestion = {
					acceptanceCriteria: deriveAcceptanceCriteria(doc),
					completionSignals: deriveCompletionSignals(doc),
					documentId: doc.id,
					followUpPolicy: DEFAULT_FOLLOW_UP_POLICY,
					id,
					insufficiencySignals: [],
					phaseId: doc.phaseId,
					priority: derivePriority(doc, section.required),
					profileId,
					purpose: derivePurpose(doc, section.title, section.id),
					question: questionText,
					required: section.required,
					sectionId: section.id,
					sourcePath: doc.path,
				};

				const deps = deriveDependencies(doc);
				if (deps !== undefined) q.dependsOn = deps;

				q.metadata = buildMetadata({
					centralQuestion: doc.centralQuestion,
					documentTitle: doc.title,
					questionIndex: idx,
					rawDependsOn: doc.dependsOn,
					rawOutputs: doc.outputs,
					sectionQuestionCount: section.questions.length,
					sectionRequired: section.required,
					sectionTitle: section.title,
				});

				questions.push(q);
				docHasQuestions = true;
			}
		}

		if (!docHasQuestions) {
			warnings.push(
				`Document "${doc.id}" produced no questions from any section.`,
			);
		}
	}

	if (errors.length > 0) {
		return { errors, ok: false, warnings };
	}

	// Build indexes
	const byId: Record<string, LogosQuestion> = {};
	const byPhase: Record<string, string[]> = {};
	const byDocument: Record<string, string[]> = {};
	const bySection: Record<string, string[]> = {};

	for (const q of questions) {
		byId[q.id] = q;

		let phaseList = byPhase[q.phaseId];
		if (phaseList === undefined) {
			phaseList = [];
			byPhase[q.phaseId] = phaseList;
		}
		phaseList.push(q.id);

		let docList = byDocument[q.documentId];
		if (docList === undefined) {
			docList = [];
			byDocument[q.documentId] = docList;
		}
		docList.push(q.id);

		const sectionKey = `${q.documentId}.${q.sectionId}`;
		let secList = bySection[sectionKey];
		if (secList === undefined) {
			secList = [];
			bySection[sectionKey] = secList;
		}
		secList.push(q.id);
	}

	const registry: LogosQuestionRegistry = {
		byDocument,
		byId,
		byPhase,
		bySection,
		profileId,
		questions,
		warnings,
	};

	return { ok: true, registry, warnings };
}
