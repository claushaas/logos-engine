/**
 * LOGOS Core — Filesystem port contract.
 *
 * Defines a Pi-independent, Node-fs-independent filesystem port.
 * All types are plain serializable data.
 */

export type FileReadResult = {
	path: string;
	content: string;
};

export type FileWriteInput = {
	path: string;
	content: string;
	overwrite?: boolean;
	reason?: string;
};

export type FileExistsInput = {
	path: string;
};

export type DirectoryListInput = {
	path: string;
};

export type DirectoryEntry = {
	path: string;
	kind: 'file' | 'directory';
};

export type LogosFilesystem = {
	readTextFile(path: string): Promise<FileReadResult>;
	writeTextFile(input: FileWriteInput): Promise<void>;
	fileExists(input: FileExistsInput): Promise<boolean>;
	ensureDirectory(path: string): Promise<void>;
	listDirectory(input: DirectoryListInput): Promise<DirectoryEntry[]>;
};
