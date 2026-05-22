import { describe, expect, it } from 'vitest';
import { createDefaultLogosConfig } from '../../src/core/state/config-types.js';
import type { GenerationState } from '../../src/core/state/generation-state-types.js';
import { createInMemoryStateRepository } from '../../src/core/state/in-memory-state-repository.js';
import type { LogosIntakeState } from '../../src/core/state/intake-state-types.js';

describe('in-memory state repository', () => {
	it('can be created as a LogosStateRepository fake', () => {
		const repo = createInMemoryStateRepository();
		expect(typeof repo.loadConfig).toBe('function');
		expect(typeof repo.saveConfig).toBe('function');
		expect(typeof repo.loadIntakeState).toBe('function');
		expect(typeof repo.saveIntakeState).toBe('function');
		expect(typeof repo.loadGenerationState).toBe('function');
		expect(typeof repo.saveGenerationState).toBe('function');
	});

	it('throws when loading config that has not been saved', async () => {
		const repo = createInMemoryStateRepository();
		await expect(repo.loadConfig('/unknown')).rejects.toThrow(
			'Config not found',
		);
	});

	it('can save and load config', async () => {
		const repo = createInMemoryStateRepository();
		const config = createDefaultLogosConfig({
			activeProfileId: 'custom',
			now: '2026-05-21T00:00:00Z',
		});

		await repo.saveConfig('/project', config);
		const loaded = await repo.loadConfig('/project');

		expect(loaded).toEqual(config);
		expect(loaded.activeProfileId).toBe('custom');
	});

	it('can save and load intake state', async () => {
		const repo = createInMemoryStateRepository();
		const state: LogosIntakeState = {
			activeQuestionId: 'q-1',
			initializedAt: '2026-05-21T00:00:00Z',
			mode: 'intake_active',
			progress: {
				byPhase: {},
				contradictory: 0,
				missing: 1,
				partial: 0,
				sufficient: 2,
				total: 3,
			},
			projectRoot: '/project',
			updatedAt: '2026-05-21T00:00:00Z',
		};

		await repo.saveIntakeState('/project', state);
		const loaded = await repo.loadIntakeState('/project');

		expect(loaded).toEqual(state);
		expect(loaded.mode).toBe('intake_active');
		expect(loaded.activeQuestionId).toBe('q-1');
	});

	it('can save and load generation state', async () => {
		const repo = createInMemoryStateRepository();
		const state: GenerationState = {
			generatedPaths: ['docs/output.md'],
			initializedAt: '2026-05-21T00:00:00Z',
			lastGeneratedAt: '2026-05-21T01:00:00Z',
			projectRoot: '/project',
			updatedAt: '2026-05-21T00:00:00Z',
		};

		await repo.saveGenerationState('/project', state);
		const loaded = await repo.loadGenerationState('/project');

		expect(loaded).toEqual(state);
		expect(loaded.generatedPaths).toEqual(['docs/output.md']);
	});

	it('does not share saved objects by reference', async () => {
		const repo = createInMemoryStateRepository();
		const config = createDefaultLogosConfig({
			now: '2026-05-21T00:00:00Z',
		});

		await repo.saveConfig('/project', config);
		const loaded1 = await repo.loadConfig('/project');
		const loaded2 = await repo.loadConfig('/project');

		expect(loaded1).not.toBe(config);
		expect(loaded2).not.toBe(config);
		expect(loaded1).not.toBe(loaded2);

		loaded1.activeProfileId = 'mutated';
		expect(loaded2.activeProfileId).toBe('standard');
	});

	it('does not share intake state by reference', async () => {
		const repo = createInMemoryStateRepository();
		const state: LogosIntakeState = {
			initializedAt: '2026-05-21T00:00:00Z',
			mode: 'paused',
			progress: {
				byPhase: {},
				contradictory: 0,
				missing: 0,
				partial: 0,
				sufficient: 0,
				total: 0,
			},
			projectRoot: '/project',
			updatedAt: '2026-05-21T00:00:00Z',
		};

		await repo.saveIntakeState('/project', state);
		const loaded1 = await repo.loadIntakeState('/project');
		const loaded2 = await repo.loadIntakeState('/project');

		expect(loaded1).not.toBe(state);
		expect(loaded2).not.toBe(state);
		expect(loaded1).not.toBe(loaded2);

		loaded1.mode = 'complete';
		expect(loaded2.mode).toBe('paused');
	});

	it('does not share generation state by reference', async () => {
		const repo = createInMemoryStateRepository();
		const state: GenerationState = {
			generatedPaths: ['a.md'],
			initializedAt: '2026-05-21T00:00:00Z',
			projectRoot: '/project',
			updatedAt: '2026-05-21T00:00:00Z',
		};

		await repo.saveGenerationState('/project', state);
		const loaded1 = await repo.loadGenerationState('/project');
		const loaded2 = await repo.loadGenerationState('/project');

		expect(loaded1).not.toBe(state);
		expect(loaded2).not.toBe(state);
		expect(loaded1).not.toBe(loaded2);

		loaded1.generatedPaths.push('b.md');
		expect(loaded2.generatedPaths).toEqual(['a.md']);
	});

	it('can be initialized with seed data for intake and generation state', async () => {
		const intakeState: LogosIntakeState = {
			initializedAt: '2026-05-21T00:00:00Z',
			mode: 'idle',
			progress: {
				byPhase: {},
				contradictory: 0,
				missing: 0,
				partial: 0,
				sufficient: 0,
				total: 0,
			},
			projectRoot: '/project',
			updatedAt: '2026-05-21T00:00:00Z',
		};
		const generationState: GenerationState = {
			generatedPaths: [],
			initializedAt: '2026-05-21T00:00:00Z',
			projectRoot: '/project',
			updatedAt: '2026-05-21T00:00:00Z',
		};

		const repo = createInMemoryStateRepository({
			generationState,
			intakeState,
		});

		const loadedIntake = await repo.loadIntakeState('/project');
		const loadedGeneration = await repo.loadGenerationState('/project');

		expect(loadedIntake).toEqual(intakeState);
		expect(loadedGeneration).toEqual(generationState);
	});

	it('can be initialized with seed config when projectRoot is provided', async () => {
		const config = createDefaultLogosConfig({
			activeProfileId: 'seeded',
			now: '2026-05-21T00:00:00Z',
		});

		const repo = createInMemoryStateRepository({
			config,
			projectRoot: '/seeded',
		});

		const loaded = await repo.loadConfig('/seeded');
		expect(loaded).toEqual(config);
		expect(loaded.activeProfileId).toBe('seeded');
	});

	it('throws when seeding config without projectRoot', () => {
		const config = createDefaultLogosConfig({
			now: '2026-05-21T00:00:00Z',
		});

		expect(() => createInMemoryStateRepository({ config })).toThrow(
			'projectRoot is required when seeding config',
		);
	});
});
