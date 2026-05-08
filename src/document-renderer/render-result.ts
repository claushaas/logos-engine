import type { CanonicalDocument } from '../domain/profile-loader.js';
import type { RenderMode } from '../foundation/status-contracts.js';

export type DocumentRenderStatus =
	| 'created'
	| 'updated'
	| 'skipped'
	| 'blocked';

export type DocumentRenderResult = {
	readonly document: CanonicalDocument;
	readonly filePath: string;
	readonly missingInputs: readonly string[];
	readonly missingRequiredSections: readonly string[];
	readonly status: DocumentRenderStatus;
};

export type RenderSummary = {
	readonly createdCount: number;
	readonly mode: RenderMode;
	readonly results: readonly DocumentRenderResult[];
	readonly skippedCount: number;
	readonly updatedCount: number;
};

export function createRenderSummary(
	results: readonly DocumentRenderResult[],
	mode: RenderMode,
): RenderSummary {
	const createdCount = results.filter((r) => r.status === 'created').length;
	const updatedCount = results.filter((r) => r.status === 'updated').length;
	const skippedCount = results.filter((r) => r.status === 'skipped').length;

	return {
		createdCount,
		mode,
		results,
		skippedCount,
		updatedCount,
	};
}

export function formatRenderSummary(summary: RenderSummary): readonly string[] {
	const lines = [
		`Render mode: ${summary.mode}`,
		`Documents: ${summary.results.length}`,
		`  Created: ${summary.createdCount}`,
		`  Updated: ${summary.updatedCount}`,
		`  Skipped: ${summary.skippedCount}`,
	];

	const withIssues = summary.results.filter(
		(r) => r.missingInputs.length > 0 || r.missingRequiredSections.length > 0,
	);

	if (withIssues.length > 0) {
		lines.push('', 'Documents with missing inputs:');

		for (const result of withIssues) {
			lines.push(`  ${result.document.id} (${result.status})`);

			if (result.missingInputs.length > 0) {
				lines.push(`    Missing inputs: ${result.missingInputs.join(', ')}`);
			}

			if (result.missingRequiredSections.length > 0) {
				lines.push(
					`    Missing sections: ${result.missingRequiredSections.join(', ')}`,
				);
			}
		}
	}

	return lines;
}
