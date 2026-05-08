import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CanonicalDocument } from '../domain/profile-loader.js';

export type TemplateContext = {
	readonly assumptions: readonly string[];
	readonly decisions: Readonly<Record<string, unknown>>;
	readonly document: CanonicalDocument;
	readonly openQuestions: readonly string[];
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

	if (decisionValue !== undefined) {
		return `## ${sectionTitle}\n\n${String(decisionValue)}\n\n<!-- logos:section:manual:${sectionId} -->`;
	}

	const genericDecision = context.decisions[sectionId];

	if (genericDecision !== undefined) {
		return `## ${sectionTitle}\n\n${String(genericDecision)}\n\n<!-- logos:section:manual:${sectionId} -->`;
	}

	return `## ${sectionTitle}\n\n_Awaiting input._\n\n<!-- logos:section:manual:${sectionId} -->`;
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
