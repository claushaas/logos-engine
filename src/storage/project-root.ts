import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function detectProjectRoot(cwd: string): string {
	let currentDirectory = resolve(cwd);

	while (true) {
		if (existsSync(resolve(currentDirectory, '.git'))) {
			return currentDirectory;
		}

		const parentDirectory = dirname(currentDirectory);

		if (parentDirectory === currentDirectory) {
			return resolve(cwd);
		}

		currentDirectory = parentDirectory;
	}
}
