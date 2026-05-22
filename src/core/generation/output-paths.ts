/**
 * LOGOS Core — Output path resolution and validation (Step 6.3).
 *
 * Resolves and validates output paths for the generation write plan.
 * Reuses {@link checkPathInsideProject} from fs/path-safety but maps
 * results to richer {@link WritePlanRisk} codes.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import path from 'node:path';
import { checkPathInsideProject } from '../fs/path-safety.js';
import type { WritePlanRisk } from './write-plan.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ResolveOutputPathInput = {
	projectRoot: string;
	outputPath: string;
};

export type ResolvedOutputPath =
	| {
			ok: true;
			path: string;
			relativePath: string;
	  }
	| {
			ok: false;
			risk: WritePlanRisk;
	  };

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve and validate an output path against the project root.
 *
 * Rules:
 * - Relative output paths are resolved against projectRoot.
 * - Absolute output paths are allowed only if they resolve inside
 *   projectRoot.
 * - Empty paths are invalid (`unsafe_path`).
 * - `..` traversal escaping project root is invalid (`path_traversal`).
 * - Sibling prefix attacks (e.g., /repo/app-malicious/file.md) are
 *   invalid (`outside_project_root`).
 * - `~/` prefixed paths are treated as unsafe without expansion.
 *
 * Does NOT silently rewrite unsafe paths into safe ones.
 */
export function resolveSafeOutputPath(
	input: ResolveOutputPathInput,
): ResolvedOutputPath {
	const { projectRoot, outputPath } = input;

	// Empty path.
	if (outputPath.length === 0) {
		return {
			ok: false,
			risk: {
				code: 'unsafe_path',
				message: 'Output path is empty.',
				path: outputPath,
			},
		};
	}

	// `~/` prefix — treat as unsafe path traversal.
	if (outputPath.startsWith('~')) {
		return {
			ok: false,
			risk: {
				code: 'path_traversal',
				message: `Output path contains home-directory reference: "${outputPath}".`,
				path: outputPath,
			},
		};
	}

	// Delegate to path-safety check.
	const safety = checkPathInsideProject({
		projectRoot,
		targetPath: outputPath,
	});

	if (!safety.safe) {
		const code: WritePlanRisk['code'] =
			safety.reason === 'empty_path'
				? 'unsafe_path'
				: safety.reason === 'outside_project_root'
					? 'outside_project_root'
					: 'unsafe_path';

		return {
			ok: false,
			risk: {
				code,
				message: `Output path is not safe: "${outputPath}" (${safety.reason}).`,
				path: outputPath,
			},
		};
	}

	// Resolve to absolute path for filesystem operations.
	const absolutePath = path.resolve(projectRoot, outputPath);

	return {
		ok: true,
		path: absolutePath,
		relativePath: safety.relativePath,
	};
}
