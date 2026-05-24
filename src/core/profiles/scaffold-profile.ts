/**
 * LOGOS Core — Profile scaffolding helper.
 *
 * Copies a profile directory from a real-filesystem source to the
 * project-local `profiles/` directory via a {@link LogosFilesystem} port.
 *
 * Used by {@link initProject} to make the bundled Standard profile
 * available when a user runs `/logos-init` in a fresh project.
 *
 * Boundary: this is a Core utility.  It may import Node.js `fs`/`path`
 * but must not import Pi, Ink, React, TUI, or CLI modules.
 */

import type { Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { LogosFilesystem } from '../ports/filesystem.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type ScaffoldProfileInput = {
	/** Absolute path to the source profile directory (on real filesystem). */
	sourceProfileDir: string;
	/** Absolute path where the profile should be created in the project. */
	targetProfileDir: string;
	/** Filesystem port for writing into the project. */
	filesystem: LogosFilesystem;
};

/**
 * Recursively copy a profile directory from a real-filesystem source
 * into the project-local `profiles/` directory.
 *
 * - Skips files and directories whose name starts with "." (hidden files).
 * - Reads source files via `node:fs`, writes target via `filesystem` port.
 * - Creates parent directories as needed.
 * - Throws if the source directory does not exist or is not readable.
 */
export async function scaffoldProfileFromSource(
	input: ScaffoldProfileInput,
): Promise<void> {
	const { sourceProfileDir, targetProfileDir, filesystem } = input;

	// Ensure target directory exists.
	await filesystem.ensureDirectory(targetProfileDir);

	let entries: Dirent[];
	try {
		entries = await fs.readdir(sourceProfileDir, { withFileTypes: true });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(
			`Failed to read profile source directory "${sourceProfileDir}": ${message}`,
		);
	}

	for (const entry of entries) {
		// Skip hidden files and directories (e.g. .DS_Store, .gitkeep).
		if (entry.name.startsWith('.')) {
			continue;
		}

		const sourcePath = path.join(sourceProfileDir, entry.name);
		const targetPath = `${targetProfileDir}/${entry.name}`;

		if (entry.isDirectory()) {
			await scaffoldProfileFromSource({
				filesystem,
				sourceProfileDir: sourcePath,
				targetProfileDir: targetPath,
			});
		} else if (entry.isFile()) {
			const content = await fs.readFile(sourcePath, 'utf-8');
			await filesystem.writeTextFile({
				content,
				overwrite: false,
				path: targetPath,
				reason: 'profile_scaffold',
			});
		}
		// Symlinks and other entry types are silently skipped.
	}
}
