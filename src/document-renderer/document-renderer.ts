import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { ConversationTurn } from '../domain/conversation-model.js';
import type {
	CanonicalDocument,
	ProfileContract,
} from '../domain/profile-loader.js';
import type { WorkspaceState } from '../domain/workspace-state.js';
import type { RenderMode } from '../foundation/status-contracts.js';
import { readConversationSession } from '../storage/intake-state.js';
import {
	ensureDirectory,
	SafeWriteError,
} from '../storage/safe-file-writes.js';
import {
	type DocumentFrontmatter,
	generateFrontmatter,
} from './frontmatter.js';
import { extractManualSections, mergeManualSections } from './manual-notes.js';
import {
	createRenderSummary,
	type DocumentRenderResult,
	type DocumentRenderStatus,
	formatRenderSummary,
	type RenderSummary,
} from './render-result.js';
import {
	generateDefaultTemplate,
	loadTemplate,
	renderTemplate,
	resolveTemplatePath,
	type TemplateContext,
} from './template-renderer.js';

export type RenderOptions = {
	readonly forceConfirmed?: boolean;
	readonly mode: RenderMode;
	readonly profileDirectory: string;
	readonly projectRoot: string;
};

export class DocumentRenderError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'DocumentRenderError';
	}
}

export function renderDocuments(
	profile: ProfileContract,
	workspace: WorkspaceState,
	options: RenderOptions,
): RenderSummary {
	const results: DocumentRenderResult[] = [];

	for (const document of profile.documents) {
		const result = renderDocument(profile, workspace, document, options);
		results.push(result);
	}

	return createRenderSummary(results, options.mode);
}

export function renderDocument(
	profile: ProfileContract,
	workspace: WorkspaceState,
	document: CanonicalDocument,
	options: RenderOptions,
): DocumentRenderResult {
	const filePath = resolve(options.projectRoot, document.path);
	const fileExists = existsSync(filePath);

	if (options.mode === 'safe' && fileExists) {
		return {
			document,
			filePath,
			missingInputs: collectMissingInputs(document, workspace),
			missingRequiredSections: collectMissingRequiredSections(
				document,
				workspace,
			),
			status: 'skipped',
		};
	}

	if (options.mode === 'force' && !options.forceConfirmed) {
		return {
			document,
			filePath,
			missingInputs: collectMissingInputs(document, workspace),
			missingRequiredSections: collectMissingRequiredSections(
				document,
				workspace,
			),
			status: 'blocked',
		};
	}

	const content = generateDocumentContent(
		profile,
		workspace,
		document,
		options,
	);
	const status: DocumentRenderStatus = fileExists ? 'updated' : 'created';

	try {
		if (fileExists && options.mode === 'refresh') {
			const existingContent = readFileSync(filePath, 'utf8');
			const manualSections = extractManualSections(existingContent);
			const mergedContent = mergeManualSections(content, manualSections);
			writeDocumentFile(filePath, mergedContent);
		} else {
			writeDocumentFile(filePath, content);
		}
	} catch (error) {
		if (error instanceof SafeWriteError && options.mode === 'safe') {
			return {
				document,
				filePath,
				missingInputs: collectMissingInputs(document, workspace),
				missingRequiredSections: collectMissingRequiredSections(
					document,
					workspace,
				),
				status: 'skipped',
			};
		}

		throw new DocumentRenderError(
			`Failed to render document ${document.id}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	return {
		document,
		filePath,
		missingInputs: collectMissingInputs(document, workspace),
		missingRequiredSections: collectMissingRequiredSections(
			document,
			workspace,
		),
		status,
	};
}

export function generateDocumentContent(
	profile: ProfileContract,
	workspace: WorkspaceState,
	document: CanonicalDocument,
	options: RenderOptions,
): string {
	const conversationSession = readConversationSessionSafe(options.projectRoot);
	const frontmatter = generateFrontmatter({
		conversationId: conversationSession?.id,
		documentId: document.id,
		generatedAt: new Date().toISOString(),
		profile: profile.id,
		status: 'generated',
	});

	const templatePath = resolveTemplatePath(
		document.template,
		options.profileDirectory,
	);

	const template =
		templatePath && existsSync(templatePath)
			? loadTemplate(templatePath)
			: generateDefaultTemplate(document);

	const context = buildTemplateContext(
		document,
		workspace,
		conversationSession?.turns ?? [],
	);
	const renderedBody = renderTemplate(
		template,
		context,
		options.profileDirectory,
	);

	return `${frontmatter}\n\n${renderedBody}`;
}

export function buildTemplateContext(
	document: CanonicalDocument,
	workspace: WorkspaceState,
	conversationTurns: readonly ConversationTurn[] = [],
): TemplateContext {
	const decisions: Record<string, unknown> = {};
	const uncertainSections: Record<string, 'assumption' | 'unknown'> = {};
	const sourceTurnIds: Record<string, readonly string[]> = {};

	const answerToTurnIds = buildAnswerToTurnIds(conversationTurns);

	for (const decisionId of document.requiredInputs.decisions) {
		const decision = workspace.decisions.decisions.find(
			(d) => d.id === decisionId,
		);

		if (decision?.status === 'confirmed') {
			decisions[decisionId] = decision.value;
			for (const sourceId of decision.sourceAnswerIds) {
				const turns = answerToTurnIds.get(sourceId);
				if (turns) {
					const existing = sourceTurnIds[decisionId] ?? [];
					sourceTurnIds[decisionId] = [...existing, ...turns];
				}
			}
		} else if (decision?.status === 'assumed') {
			decisions[decisionId] = decision.value;
			uncertainSections[decisionId] = 'assumption';
			for (const sourceId of decision.sourceAnswerIds) {
				const turns = answerToTurnIds.get(sourceId);
				if (turns) {
					sourceTurnIds[decisionId] = [
						...(sourceTurnIds[decisionId] ?? []),
						...turns,
					];
				}
			}
		}
	}

	for (const answerId of document.requiredInputs.answers) {
		const answer = workspace.answers.answers.find((a) => a.id === answerId);

		if (answer?.status === 'answered') {
			decisions[answerId] = answer.answer;
			const turns = answerToTurnIds.get(answer.id);
			if (turns) {
				sourceTurnIds[answerId] = [...turns];
			}
		} else if (answer?.status === 'assumption') {
			decisions[answerId] = answer.answer;
			uncertainSections[answerId] = 'assumption';
			const turns = answerToTurnIds.get(answer.id);
			if (turns) {
				sourceTurnIds[answerId] = [...turns];
			}
		} else if (answer?.status === 'unknown') {
			decisions[answerId] = answer.answer ?? '[Unknown]';
			uncertainSections[answerId] = 'unknown';
		}
	}

	const assumptions = workspace.answers.answers
		.filter((a) => a.status === 'assumption')
		.map((a) => `${a.questionId}: ${String(a.answer)}`);

	const openQuestions = workspace.answers.answers
		.filter((a) => a.status === 'unknown')
		.map((a) => `${a.questionId}: ${String(a.answer)}`);

	return {
		assumptions,
		conversationId:
			conversationTurns.length > 0
				? conversationTurns[0]?.sessionId
				: undefined,
		decisions,
		document,
		openQuestions,
		sourceTurnIds,
		uncertainSections,
	};
}

function buildAnswerToTurnIds(
	turns: readonly ConversationTurn[],
): ReadonlyMap<string, readonly string[]> {
	const result = new Map<string, string[]>();

	for (const turn of turns) {
		if (!turn.sourceLinks) {
			continue;
		}

		for (const answerId of turn.sourceLinks.answerIds) {
			const existing = result.get(answerId) ?? [];
			result.set(answerId, [...existing, turn.id]);
		}

		for (const assumptionId of turn.sourceLinks.assumptionIds) {
			const existing = result.get(assumptionId) ?? [];
			result.set(assumptionId, [...existing, turn.id]);
		}

		for (const openQuestionId of turn.sourceLinks.openQuestionIds) {
			const existing = result.get(openQuestionId) ?? [];
			result.set(openQuestionId, [...existing, turn.id]);
		}

		for (const proposalId of turn.sourceLinks.proposalIds) {
			const existing = result.get(proposalId) ?? [];
			result.set(proposalId, [...existing, turn.id]);
		}
	}

	return result;
}

function readConversationSessionSafe(
	projectRoot: string,
): { id: string; turns: readonly ConversationTurn[] } | null {
	try {
		const session = readConversationSession(projectRoot);
		return session ? { id: session.id, turns: session.turns } : null;
	} catch {
		return null;
	}
}

export function collectMissingInputs(
	document: CanonicalDocument,
	workspace: WorkspaceState,
): readonly string[] {
	const missing: string[] = [];

	for (const decisionId of document.requiredInputs.decisions) {
		const decision = workspace.decisions.decisions.find(
			(d) => d.id === decisionId,
		);

		if (!decision || decision.status !== 'confirmed') {
			missing.push(`decision:${decisionId}`);
		}
	}

	for (const answerId of document.requiredInputs.answers) {
		const answer = workspace.answers.answers.find((a) => a.id === answerId);

		if (!answer || answer.status !== 'answered') {
			missing.push(`answer:${answerId}`);
		}
	}

	return missing;
}

export function collectMissingRequiredSections(
	document: CanonicalDocument,
	workspace: WorkspaceState,
): readonly string[] {
	const missing: string[] = [];
	const context = buildTemplateContext(document, workspace);

	for (const section of document.sections) {
		if (!section.required) {
			continue;
		}

		const hasContent =
			context.decisions[section.id] !== undefined ||
			context.decisions[`section.${section.id}`] !== undefined;

		if (!hasContent) {
			missing.push(section.id);
		}
	}

	return missing;
}

function writeDocumentFile(filePath: string, content: string): void {
	ensureDirectory(dirname(filePath));
	writeFileSync(filePath, content, { encoding: 'utf8' });
}

export type { DocumentFrontmatter };
export { formatRenderSummary };
