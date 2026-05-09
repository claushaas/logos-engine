import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CanonicalDocument } from '../domain/profile-loader.js';

export type TemplateContext = {
	readonly assumptions: readonly string[];
	readonly conversationId?: string | undefined;
	readonly decisions: Readonly<Record<string, unknown>>;
	readonly document: CanonicalDocument;
	readonly openQuestions: readonly string[];
	readonly sourceTurnIds: Readonly<Record<string, readonly string[]>>;
	readonly uncertainSections: Readonly<
		Record<string, 'assumption' | 'unknown'>
	>;
};

export class TemplateRenderError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'TemplateRenderError';
	}
}

export function loadTemplate(templatePath: string): string {
	try {
		return readFileSync(templatePath, 'utf8');
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new TemplateRenderError(
			`Failed to load template ${templatePath}: ${message}`,
		);
	}
}

export function renderTemplate(
	template: string,
	context: TemplateContext,
	_profileDirectory: string,
): string {
	let result = template;

	result = replaceVariable(result, 'document.title', context.document.title);
	result = replaceVariable(
		result,
		'document.purpose',
		context.document.purpose,
	);
	result = replaceVariable(result, 'document.id', context.document.id);
	result = replaceVariable(
		result,
		'conversation.id',
		context.conversationId ?? 'no-conversation-session',
	);

	for (const section of context.document.sections) {
		const sectionContent = renderSection(section.id, section.title, context);
		result = replaceSectionBlock(result, section.id, sectionContent);
	}

	result = replaceVariable(
		result,
		'assumptions.list',
		formatList(context.assumptions),
	);
	result = replaceVariable(
		result,
		'openQuestions.list',
		formatList(context.openQuestions),
	);

	return result;
}

export function renderSection(
	sectionId: string,
	sectionTitle: string,
	context: TemplateContext,
): string {
	const decisionKey = `section.${sectionId}`;
	const decisionValue = context.decisions[decisionKey];
	const uncertainty =
		context.uncertainSections[sectionId] ??
		context.uncertainSections[decisionKey];
	const sourceTurns =
		context.sourceTurnIds[sectionId] ??
		context.sourceTurnIds[decisionKey] ??
		[];

	let content = '';

	if (decisionValue !== undefined) {
		content = `${uncertaintyPrefix(uncertainty)}${String(decisionValue)}${sourceTurnSuffix(sourceTurns)}`;
	} else {
		const genericDecision = context.decisions[sectionId];

		if (genericDecision !== undefined) {
			content = `${uncertaintyPrefix(uncertainty)}${String(genericDecision)}${sourceTurnSuffix(sourceTurns)}`;
		} else {
			content = '_Awaiting input._';
		}
	}

	return `## ${sectionTitle}\n\n${content}\n\n<!-- logos:section:manual:${sectionId} -->`;
}

function uncertaintyPrefix(uncertainty: string | undefined): string {
	if (uncertainty === 'assumption') {
		return '> **Note:** This content is based on an _assumption_ and has not been confirmed.\n\n';
	}

	if (uncertainty === 'unknown') {
		return '> **Note:** This content is based on an _unknown or unresolved_ input.\n\n';
	}

	return '';
}

function sourceTurnSuffix(sourceTurns: readonly string[]): string {
	if (sourceTurns.length === 0) {
		return '';
	}

	const turnList = [...new Set(sourceTurns)]
		.slice(0, 3)
		.map((id) => `\`${id}\``)
		.join(', ');

	const more =
		sourceTurns.length > 3 ? ` (and ${sourceTurns.length - 3} more)` : '';

	return `\n\n_Conversation sources: ${turnList}${more}_`;
}

export function generateDefaultTemplate(document: CanonicalDocument): string {
	const sections = document.sections
		.map((section) => `## ${section.title}\n\n_Awaiting input._`)
		.join('\n\n');

	return [`# ${document.title}\n`, document.purpose, sections].join('\n\n');
}

function replaceVariable(
	template: string,
	name: string,
	value: string,
): string {
	const regex = new RegExp(`\\{\\{\\s*${escapeRegex(name)}\\s*\\}\\}`, 'g');
	return template.replace(regex, value);
}

function replaceSectionBlock(
	template: string,
	sectionId: string,
	content: string,
): string {
	const startMarker = `<!-- logos:section:start:${sectionId} -->`;
	const endMarker = `<!-- logos:section:end:${sectionId} -->`;
	const startIndex = template.indexOf(startMarker);
	const endIndex = template.indexOf(endMarker);

	if (startIndex === -1 || endIndex === -1) {
		return template;
	}

	return (
		template.slice(0, startIndex + startMarker.length) +
		'\n' +
		content +
		'\n' +
		template.slice(endIndex)
	);
}

function formatList(items: readonly string[]): string {
	if (items.length === 0) {
		return '_None recorded._';
	}

	return items.map((item) => `- ${item}`).join('\n');
}

function escapeRegex(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function resolveTemplatePath(
	templateRef: string | undefined,
	profileDirectory: string,
): string | null {
	if (!templateRef) {
		return null;
	}

	return resolve(profileDirectory, templateRef);
}
