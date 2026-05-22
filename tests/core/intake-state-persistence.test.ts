import { describe, expect, it } from 'vitest';
import type {
	DirectoryEntry,
	DirectoryListInput,
	FileExistsInput,
	FileReadResult,
	FileWriteInput,
	LogosFilesystem,
} from '../../src/core/ports/filesystem.js';
import {
	getLogosIntakeStatePath,
	LOGOS_INTAKE_STATE_FILE_NAME,
	loadIntakeState,
	parseIntakeStateJson,
	saveIntakeState,
	stringifyIntakeState,
} from '../../src/core/state/intake-state-persistence.js';

// ---------------------------------------------------------------------------
// In-memory fake filesystem
// ---------------------------------------------------------------------------

function createFakeFilesystem(): LogosFilesystem {
	const files = new Map<string, string>();
	const dirs = new Set<string>();

	return {
		async ensureDirectory(p: string): Promise<void> {
			dirs.add(p);
		},

		async fileExists(input: FileExistsInput): Promise<boolean> {
			return files.has(input.path);
		},

		async listDirectory(_input: DirectoryListInput): Promise<DirectoryEntry[]> {
			const prefix = _input.path;
			const entries: DirectoryEntry[] = [];
			for (const filePath of files.keys()) {
				if (filePath.startsWith(prefix)) {
					entries.push({ kind: 'file', path: filePath });
				}
			}
			for (const dirPath of dirs) {
				if (dirPath.startsWith(prefix) && dirPath !== prefix) {
					entries.push({ kind: 'directory', path: dirPath });
				}
			}
			return entries;
		},

		async readTextFile(p: string): Promise<FileReadResult> {
			const content = files.get(p);
			if (content === undefined) {
				throw new Error(`ENOENT: ${p}`);
			}
			return { content, path: p };
		},

		async writeTextFile(input: FileWriteInput): Promise<void> {
			if (!input.overwrite && files.has(input.path)) {
				throw new Error(`EEXIST: ${input.path}`);
			}
			files.set(input.path, input.content);
		},
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const now = '2026-05-22T00:00:00Z';

describe('intake state path helpers', () => {
	it('LOGOS_INTAKE_STATE_FILE_NAME is intake-state.json', () => {
		expect(LOGOS_INTAKE_STATE_FILE_NAME).toBe('intake-state.json');
	});

	it('getLogosIntakeStatePath points to .logos/intake-state.json', () => {
		expect(getLogosIntakeStatePath('/my/project')).toBe(
			'/my/project/.logos/intake-state.json',
		);
	});
});

describe('loadIntakeState', () => {
	it('returns default state when file is absent (createdDefault: true)', async () => {
		const fs = createFakeFilesystem();
		const result = await loadIntakeState({
			filesystem: fs,
			now,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.createdDefault).toBe(true);
			expect(result.state.mode).toBe('idle');
			expect(result.state.version).toBe(1);
			expect(result.state.projectRoot).toBe('/project');
			expect(result.warnings.length).toBeGreaterThan(0);
		}
	});

	it('does not write the default file during load', async () => {
		const fs = createFakeFilesystem();
		await loadIntakeState({
			filesystem: fs,
			now,
			projectRoot: '/project',
		});

		const exists = await fs.fileExists({
			path: getLogosIntakeStatePath('/project'),
		});
		expect(exists).toBe(false);
	});

	it('saving and loading round-trips the state', async () => {
		const fs = createFakeFilesystem();
		const state = {
			activeQuestionId: 'q-1',
			answeredQuestions: {
				'q-1': {
					answer: 'Yes',
					answeredAt: now,
					questionId: 'q-1',
					status: 'sufficient' as const,
				},
			},
			contradictions: {},
			initializedAt: now,
			mode: 'intake_active' as const,
			partialQuestions: {},
			progress: {
				byPhase: {},
				contradictory: 0,
				missing: 0,
				partial: 0,
				skipped: 0,
				sufficient: 1,
				total: 1,
			},
			projectRoot: '/project',
			skippedQuestions: {},
			updatedAt: now,
			version: 1 as const,
		};

		await saveIntakeState({
			filesystem: fs,
			projectRoot: '/project',
			state,
		});

		const result = await loadIntakeState({
			filesystem: fs,
			now,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.createdDefault).toBe(false);
			expect(result.state).toEqual(state);
		}
	});

	it('saved JSON parses back to equivalent normalized state', async () => {
		const fs = createFakeFilesystem();
		const state = {
			answeredQuestions: {},
			contradictions: {},
			initializedAt: now,
			mode: 'paused' as const,
			partialQuestions: {},
			progress: {
				byPhase: {},
				contradictory: 0,
				missing: 0,
				partial: 0,
				skipped: 0,
				sufficient: 0,
				total: 0,
			},
			projectRoot: '/project',
			skippedQuestions: {},
			updatedAt: now,
			version: 1 as const,
		};

		await saveIntakeState({
			filesystem: fs,
			projectRoot: '/project',
			state,
		});

		const result = await loadIntakeState({
			filesystem: fs,
			now,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.state).toEqual(state);
		}
	});

	it('returns structured errors for invalid JSON', async () => {
		const fs = createFakeFilesystem();
		const statePath = getLogosIntakeStatePath('/project');
		await fs.ensureDirectory('/project/.logos');
		await fs.writeTextFile({
			content: '{ invalid json',
			overwrite: true,
			path: statePath,
		});

		const result = await loadIntakeState({
			filesystem: fs,
			now,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors[0]).toContain('Failed to parse intake state JSON');
		}
	});

	it('returns structured errors for invalid state values', async () => {
		const fs = createFakeFilesystem();
		const statePath = getLogosIntakeStatePath('/project');
		await fs.ensureDirectory('/project/.logos');
		await fs.writeTextFile({
			content: JSON.stringify({ mode: 'invalid-mode' }),
			overwrite: true,
			path: statePath,
		});

		const result = await loadIntakeState({
			filesystem: fs,
			now,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors[0]).toContain('Invalid intake mode');
		}
	});
});

describe('saveIntakeState', () => {
	it('writes stable JSON through filesystem port', async () => {
		const fs = createFakeFilesystem();
		const state = {
			answeredQuestions: {},
			contradictions: {},
			initializedAt: now,
			mode: 'idle' as const,
			partialQuestions: {},
			progress: {
				byPhase: {},
				contradictory: 0,
				missing: 0,
				partial: 0,
				skipped: 0,
				sufficient: 0,
				total: 0,
			},
			projectRoot: '/project',
			skippedQuestions: {},
			updatedAt: now,
			version: 1 as const,
		};

		await saveIntakeState({
			filesystem: fs,
			projectRoot: '/project',
			state,
		});

		const statePath = getLogosIntakeStatePath('/project');
		expect(await fs.fileExists({ path: statePath })).toBe(true);

		const readResult = await fs.readTextFile(statePath);
		const parsed = JSON.parse(readResult.content);
		expect(parsed.mode).toBe('idle');
		expect(parsed.version).toBe(1);
	});

	it('ensures .logos/ directory exists', async () => {
		const fs = createFakeFilesystem();
		const state = {
			answeredQuestions: {},
			contradictions: {},
			initializedAt: now,
			mode: 'idle' as const,
			partialQuestions: {},
			progress: {
				byPhase: {},
				contradictory: 0,
				missing: 0,
				partial: 0,
				skipped: 0,
				sufficient: 0,
				total: 0,
			},
			projectRoot: '/project',
			skippedQuestions: {},
			updatedAt: now,
			version: 1 as const,
		};

		await saveIntakeState({
			filesystem: fs,
			projectRoot: '/project',
			state,
		});

		const statePath = getLogosIntakeStatePath('/project');
		expect(await fs.fileExists({ path: statePath })).toBe(true);
	});

	it('refuses to write outside project root', async () => {
		const fs = createFakeFilesystem();
		const state = {
			answeredQuestions: {},
			contradictions: {},
			initializedAt: now,
			mode: 'idle' as const,
			partialQuestions: {},
			progress: {
				byPhase: {},
				contradictory: 0,
				missing: 0,
				partial: 0,
				skipped: 0,
				sufficient: 0,
				total: 0,
			},
			projectRoot: '',
			skippedQuestions: {},
			updatedAt: now,
			version: 1 as const,
		};

		await expect(
			saveIntakeState({
				filesystem: fs,
				projectRoot: '',
				state,
			}),
		).rejects.toThrow('outside project root');
	});
});

describe('parseIntakeStateJson', () => {
	it('parses valid JSON into normalized state', () => {
		const state = {
			answeredQuestions: {},
			contradictions: {},
			initializedAt: now,
			mode: 'idle',
			partialQuestions: {},
			progress: {
				byPhase: {},
				contradictory: 0,
				missing: 0,
				partial: 0,
				skipped: 0,
				sufficient: 0,
				total: 0,
			},
			projectRoot: '/project',
			skippedQuestions: {},
			updatedAt: now,
			version: 1,
		};

		const result = parseIntakeStateJson({
			content: JSON.stringify(state),
			now,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.state.mode).toBe('idle');
		}
	});

	it('returns structured errors for invalid JSON', () => {
		const result = parseIntakeStateJson({
			content: '{ invalid',
			now,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors[0]).toContain('Failed to parse intake state JSON');
		}
	});
});

describe('stringifyIntakeState', () => {
	it('produces stable two-space indented JSON', () => {
		const state = {
			answeredQuestions: {},
			contradictions: {},
			initializedAt: now,
			mode: 'idle' as const,
			partialQuestions: {},
			progress: {
				byPhase: {},
				contradictory: 0,
				missing: 0,
				partial: 0,
				skipped: 0,
				sufficient: 0,
				total: 0,
			},
			projectRoot: '/project',
			skippedQuestions: {},
			updatedAt: now,
			version: 1 as const,
		};

		const json = stringifyIntakeState(state);
		expect(json).toContain('\n  "version": 1');
		expect(JSON.parse(json)).toEqual(state);
	});
});
