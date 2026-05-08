import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type {
	CanonicalDocument,
	ProfileContract,
} from '../domain/profile-loader.js';
import type { WorkspaceState } from '../domain/workspace-state.js';
import type { RenderMode } from '../foundation/status-contracts.js';
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
	const frontmatter = generateFrontmatter({
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

	const context = buildTemplateContext(document, workspace);
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
): TemplateContext {
	const decisions: Record<string, unknown> = {};

	for (const decisionId of document.requiredInputs.decisions) {
		const decision = workspace.decisions.decisions.find(
			(d) => d.id === decisionId,
		);

		if (decision?.status === 'confirmed') {
			decisions[decisionId] = decision.value;
		}
	}

	for (const answerId of document.requiredInputs.answers) {
		const answer = workspace.answers.answers.find((a) => a.id === answerId);

		if (answer?.status === 'answered') {
			decisions[answerId] = answer.answer;
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
		decisions,
		document,
		openQuestions,
	};
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
