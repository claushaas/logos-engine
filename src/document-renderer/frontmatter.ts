export type DocumentFrontmatter = {
	documentId: string;
	generatedAt: string;
	profile: string;
	status: 'draft' | 'generated' | 'incomplete';
};

export function generateFrontmatter(frontmatter: DocumentFrontmatter): string {
	const lines = [
		'---',
		`logos:`,
		`  document_id: ${frontmatter.documentId}`,
		`  profile: ${frontmatter.profile}`,
		`  generated_at: ${frontmatter.generatedAt}`,
		`  status: ${frontmatter.status}`,
		'---',
	];

	return lines.join('\n');
}

export function parseFrontmatter(content: string): DocumentFrontmatter | null {
	const match = content.match(/^---\n([\s\S]*?)\n---/);

	if (!match) {
		return null;
	}

	const frontmatterText = match[1] ?? '';
	const documentId = extractYamlValue(frontmatterText, 'document_id');
	const profile = extractYamlValue(frontmatterText, 'profile');

	if (!documentId || !profile) {
		return null;
	}

	const generatedAt = extractYamlValue(frontmatterText, 'generated_at');
	const status = extractYamlValue(frontmatterText, 'status');

	return {
		documentId,
		generatedAt: generatedAt || new Date().toISOString(),
		profile,
		status: (status as DocumentFrontmatter['status'] | null) || 'draft',
	};
}

function extractYamlValue(text: string, key: string): string | null {
	const regex = new RegExp(`^\\s*${key}\\s*:\\s*(.+)$`, 'm');
	const match = text.match(regex);

	if (!match?.[1]) {
		return null;
	}

	return match[1].trim();
}
