import {
	existsSync,
	mkdirSync,
	renameSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';

export class SafeWriteError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'SafeWriteError';
	}
}

export function ensureDirectory(path: string): void {
	mkdirSync(path, { recursive: true });
}

export function safeWriteTextFile(path: string, contents: string): void {
	if (existsSync(path)) {
		throw new SafeWriteError(`Refusing to overwrite existing file: ${path}`);
	}

	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, contents, { encoding: 'utf8', flag: 'wx' });
}

export function atomicWriteJsonFile(path: string, value: unknown): void {
	if (existsSync(path)) {
		throw new SafeWriteError(`Refusing to overwrite existing file: ${path}`);
	}

	atomicWriteJsonContents(path, value, false);
}

export function atomicReplaceJsonFile(path: string, value: unknown): void {
	atomicWriteJsonContents(path, value, true);
}

function atomicWriteJsonContents(
	path: string,
	value: unknown,
	allowReplace: boolean,
): void {
	mkdirSync(dirname(path), { recursive: true });

	const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
	const contents = `${JSON.stringify(value, null, 2)}\n`;

	try {
		writeFileSync(temporaryPath, contents, { encoding: 'utf8', flag: 'wx' });

		if (!allowReplace && existsSync(path)) {
			throw new SafeWriteError(`Refusing to overwrite existing file: ${path}`);
		}

		renameSync(temporaryPath, path);
	} catch (error) {
		if (existsSync(temporaryPath)) {
			rmSync(temporaryPath, { force: true });
		}

		throw error;
	}
}
