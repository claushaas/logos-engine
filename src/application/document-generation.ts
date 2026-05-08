import {
	DocumentRenderError,
	formatRenderSummary,
	renderDocuments as renderDocumentTree,
} from '../document-renderer/document-renderer.js';
import {
	getDefaultProfileDirectory,
	loadProfileContract,
} from '../domain/profile-loader.js';
import { readWorkspaceState } from '../domain/workspace-state.js';
import type { RenderMode } from '../foundation/status-contracts.js';
import { detectProjectRoot } from '../storage/project-root.js';

export type GenerateOptions = {
	readonly force?: boolean;
	readonly mode?: RenderMode;
};

export function generateDocuments(
	projectRoot: string,
	options: GenerateOptions = {},
): {
	readonly lines: readonly string[];
	readonly status: 'error' | 'ok';
	readonly title: string;
} {
	try {
		const workspace = readWorkspaceState(projectRoot);
		const profileDirectory = getDefaultProfileDirectory(
			workspace.project.profileId,
		);
		const profile = loadProfileContract(profileDirectory);

		const mode = options.mode ?? 'safe';

		if (mode === 'force' && !options.force) {
			return {
				lines: [
					'Force render requires explicit confirmation.',
					'Use /generate --force to overwrite existing documents.',
					'Warning: this will overwrite all generated documents.',
				],
				status: 'error',
				title: 'Force render requires confirmation',
			};
		}

		const renderOptions = {
			forceConfirmed: options.force ?? false,
			mode,
			profileDirectory,
			projectRoot,
		};

		const summary = renderDocumentTree(profile, workspace, renderOptions);
		const lines = formatRenderSummary(summary);

		return {
			lines: [
				`Generated ${summary.createdCount} new, updated ${summary.updatedCount}, skipped ${summary.skippedCount} documents.`,
				...lines,
			],
			status: 'ok',
			title: 'Documents generated',
		};
	} catch (error) {
		if (error instanceof DocumentRenderError) {
			return {
				lines: [error.message],
				status: 'error',
				title: 'Document generation failed',
			};
		}

		const message = error instanceof Error ? error.message : String(error);

		return {
			lines: [
				message,
				'Ensure the workspace is initialized with /init before generating documents.',
			],
			status: 'error',
			title: 'Document generation failed',
		};
	}
}

export function generateDocumentsForCwd(
	cwd: string,
	args: readonly string[],
): {
	readonly lines: readonly string[];
	readonly status: 'error' | 'ok';
	readonly title: string;
} {
	const projectRoot = detectProjectRoot(cwd);

	if (!projectRoot) {
		return {
			lines: [
				'No LOGOS workspace found.',
				'Run /init to create a workspace first.',
			],
			status: 'error',
			title: 'No workspace found',
		};
	}

	const mode = args.includes('--force')
		? 'force'
		: args.includes('--refresh')
			? 'refresh'
			: 'safe';

	return generateDocuments(projectRoot, {
		force: args.includes('--force'),
		mode,
	});
}
