/**
 * LOGOS Pi Extension — Node.js filesystem adapter.
 *
 * Implements the `LogosFilesystem` port using Node.js `fs/promises`.
 * This is the production adapter; tests use fakes / in-memory filesystems.
 *
 * Boundary: this is a Pi-extension adapter.  It may import Node.js `fs`
 * but must not import Pi runtime types, CLI/TUI, Ink, or React.
 */

import fs from 'node:fs/promises';

import type { LogosFilesystem } from '../../core/index.js';

/**
 * Create a `LogosFilesystem` implementation backed by the real Node.js
 * filesystem.
 */
export function createNodeFilesystemAdapter(): LogosFilesystem {
	return {
		async ensureDirectory(filePath: string): Promise<void> {
			await fs.mkdir(filePath, { recursive: true });
		},

		async fileExists(input): Promise<boolean> {
			try {
				const stat = await fs.stat(input.path);
				return stat.isFile();
			} catch {
				return false;
			}
		},

		async listDirectory(input) {
			const entries = await fs.readdir(input.path, {
				withFileTypes: true,
			});
			return entries.map((e) => ({
				kind: e.isDirectory() ? ('directory' as const) : ('file' as const),
				path: `${input.path}/${e.name}`,
			}));
		},

		async readTextFile(filePath: string) {
			const content = await fs.readFile(filePath, 'utf-8');
			return { content, path: filePath };
		},

		async writeTextFile(input) {
			await fs.writeFile(input.path, input.content, 'utf-8');
		},
	};
}
