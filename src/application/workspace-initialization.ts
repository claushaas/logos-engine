import { existsSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import {
	loadProfileById,
	type ProfileContract,
} from '../domain/profile-loader.js';
import {
	readWorkspaceState,
	workspaceSchemaVersion,
} from '../domain/workspace-state.js';
import { detectProjectRoot } from '../storage/project-root.js';
import {
	atomicWriteJsonFile,
	ensureDirectory,
} from '../storage/safe-file-writes.js';

export type WorkspaceInitializationResult =
	| {
			readonly createdPaths: readonly string[];
			readonly projectRoot: string;
			readonly status: 'created';
	  }
	| {
			readonly projectRoot: string;
			readonly status: 'exists';
	  };

export function initializeWorkspace(
	cwd: string,
	profileContract: ProfileContract = loadProfileById('app-business'),
): WorkspaceInitializationResult {
	const projectRoot = detectProjectRoot(cwd);
	const workspaceRoot = join(projectRoot, '.logos');

	if (workspaceExists(projectRoot)) {
		readWorkspaceState(projectRoot);

		return {
			projectRoot,
			status: 'exists',
		};
	}

	const now = new Date().toISOString();
	const createdPaths: string[] = [];

	for (const directory of [
		workspaceRoot,
		join(workspaceRoot, 'sessions'),
		join(workspaceRoot, 'proposals'),
		join(projectRoot, 'docs'),
		...getCanonicalDocsDirectories(projectRoot, profileContract.documentPaths),
	]) {
		ensureDirectory(directory);
		createdPaths.push(relativeToProject(projectRoot, directory));
	}

	const stateFiles = [
		{
			path: join(workspaceRoot, 'project.json'),
			value: {
				createdAt: now,
				profileId: profileContract.id,
				projectName: basename(projectRoot),
				projectRoot: '.',
				schemaVersion: workspaceSchemaVersion,
				updatedAt: now,
			},
		},
		{
			path: join(workspaceRoot, 'profile.lock.json'),
			value: {
				documentCount: profileContract.documentPaths.length,
				lockedAt: now,
				profileId: profileContract.id,
				profileName: profileContract.name,
				profileVersion: profileContract.version,
				schemaVersion: workspaceSchemaVersion,
			},
		},
		{
			path: join(workspaceRoot, 'answers.json'),
			value: {
				answers: [],
				schemaVersion: workspaceSchemaVersion,
			},
		},
		{
			path: join(workspaceRoot, 'decisions.json'),
			value: {
				decisions: [],
				schemaVersion: workspaceSchemaVersion,
			},
		},
		{
			path: join(workspaceRoot, 'diagnostics.json'),
			value: {
				diagnostics: [],
				generatedAt: now,
				schemaVersion: workspaceSchemaVersion,
			},
		},
		{
			path: join(workspaceRoot, 'config.json'),
			value: {
				ai: {
					enabled: false,
					model: null,
					provider: null,
					remoteContextDisclosureAccepted: false,
					tokenSource: null,
				},
				schemaVersion: workspaceSchemaVersion,
			},
		},
	];

	for (const stateFile of stateFiles) {
		atomicWriteJsonFile(stateFile.path, stateFile.value);
		createdPaths.push(relativeToProject(projectRoot, stateFile.path));
	}

	readWorkspaceState(projectRoot);

	return {
		createdPaths: createdPaths.sort(),
		projectRoot,
		status: 'created',
	};
}

function workspaceExists(projectRoot: string): boolean {
	return existsSync(join(projectRoot, '.logos'));
}

function getCanonicalDocsDirectories(
	projectRoot: string,
	documentPaths: readonly string[],
): readonly string[] {
	return [
		...new Set(
			documentPaths.map((documentPath) =>
				join(projectRoot, dirname(documentPath)),
			),
		),
	].sort();
}

function relativeToProject(projectRoot: string, path: string): string {
	return relative(projectRoot, path);
}
