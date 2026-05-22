/**
 * LOGOS Core — Path safety helpers.
 *
 * Validates that filesystem writes remain inside the project root.
 */

import path from 'node:path';

export type PathSafetyResult =
	| {
			safe: true;
			projectRoot: string;
			targetPath: string;
			relativePath: string;
	  }
	| {
			safe: false;
			projectRoot: string;
			targetPath: string;
			reason: 'outside_project_root' | 'empty_path' | 'invalid_project_root';
	  };

export function checkPathInsideProject(input: {
	projectRoot: string;
	targetPath: string;
}): PathSafetyResult {
	const { projectRoot, targetPath } = input;

	if (projectRoot.length === 0) {
		return {
			projectRoot,
			reason: 'invalid_project_root',
			safe: false,
			targetPath,
		};
	}

	if (targetPath.length === 0) {
		return {
			projectRoot,
			reason: 'empty_path',
			safe: false,
			targetPath,
		};
	}

	const resolvedRoot = path.resolve(projectRoot);
	const resolvedTarget = path.resolve(resolvedRoot, targetPath);
	const relativePath = path.relative(resolvedRoot, resolvedTarget);

	if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
		return {
			projectRoot,
			reason: 'outside_project_root',
			safe: false,
			targetPath,
		};
	}

	return {
		projectRoot,
		relativePath,
		safe: true,
		targetPath,
	};
}
