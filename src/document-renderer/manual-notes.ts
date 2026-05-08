export const MANUAL_SECTION_START = '<!-- logos:manual-section:start:';
export const MANUAL_SECTION_END = '<!-- logos:manual-section:end:';

export type ManualSection = {
	readonly body: string;
	readonly sectionId: string;
};

export function extractManualSections(
	content: string,
): readonly ManualSection[] {
	const sections: ManualSection[] = [];
	const startRegex = new RegExp(
		`${escapeRegex(MANUAL_SECTION_START)}([^>]+) -->`,
		'g',
	);

	let startMatch = startRegex.exec(content);

	while (startMatch !== null) {
		const sectionId = startMatch[1]?.trim();

		if (!sectionId) {
			startMatch = startRegex.exec(content);
			continue;
		}

		const endMarker = `${MANUAL_SECTION_END}${sectionId} -->`;
		const endIndex = content.indexOf(
			endMarker,
			startMatch.index + startMatch[0].length,
		);

		if (endIndex === -1) {
			startMatch = startRegex.exec(content);
			continue;
		}

		const bodyStart = startMatch.index + startMatch[0].length;
		const body = content.slice(bodyStart, endIndex).trim();

		sections.push({ body, sectionId });
		startMatch = startRegex.exec(content);
	}

	return sections;
}

export function wrapManualSection(sectionId: string, body: string): string {
	return [
		`${MANUAL_SECTION_START}${sectionId} -->`,
		body,
		`${MANUAL_SECTION_END}${sectionId} -->`,
	].join('\n');
}

export function mergeManualSections(
	generatedContent: string,
	manualSections: readonly ManualSection[],
): string {
	let result = generatedContent;

	for (const section of manualSections) {
		const wrapped = wrapManualSection(section.sectionId, section.body);
		const sectionMarker = `<!-- logos:section:manual:${section.sectionId} -->`;

		if (result.includes(sectionMarker)) {
			result = result.replace(sectionMarker, wrapped);
		}
	}

	return result;
}

function escapeRegex(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
