/**
 * LOGOS Core — In-memory state repository adapter.
 *
 * A test-friendly implementation of LogosStateRepository that does not touch
 * the filesystem. Useful for deterministic Core tests without Pi dependencies.
 */

import type { LogosStateRepository } from '../ports/state-repository.js';
import type { LogosConfig } from './config-types.js';
import type { GenerationState } from './generation-state-types.js';
import type { LogosIntakeState } from './intake-state-types.js';

export function createInMemoryStateRepository(
	initial?: Partial<{
		projectRoot: string;
		config: LogosConfig;
		intakeState: LogosIntakeState;
		generationState: GenerationState;
	}>,
): LogosStateRepository {
	const configStore: Map<string, LogosConfig> = new Map();
	const intakeStore: Map<string, LogosIntakeState> = new Map();
	const generationStore: Map<string, GenerationState> = new Map();

	if (initial?.config !== undefined) {
		if (initial.projectRoot === undefined || initial.projectRoot.length === 0) {
			throw new Error(
				'createInMemoryStateRepository: projectRoot is required when seeding config.',
			);
		}
		configStore.set(initial.projectRoot, structuredClone(initial.config));
	}

	if (initial?.intakeState !== undefined) {
		intakeStore.set(
			initial.intakeState.projectRoot,
			structuredClone(initial.intakeState),
		);
	}

	if (initial?.generationState !== undefined) {
		generationStore.set(
			initial.generationState.projectRoot,
			structuredClone(initial.generationState),
		);
	}

	return {
		async loadConfig(projectRoot: string): Promise<LogosConfig> {
			const value = configStore.get(projectRoot);
			if (value === undefined) {
				throw new Error(`Config not found for projectRoot: ${projectRoot}`);
			}
			return structuredClone(value);
		},

		async loadGenerationState(projectRoot: string): Promise<GenerationState> {
			const value = generationStore.get(projectRoot);
			if (value === undefined) {
				throw new Error(
					`Generation state not found for projectRoot: ${projectRoot}`,
				);
			}
			return structuredClone(value);
		},

		async loadIntakeState(projectRoot: string): Promise<LogosIntakeState> {
			const value = intakeStore.get(projectRoot);
			if (value === undefined) {
				throw new Error(
					`Intake state not found for projectRoot: ${projectRoot}`,
				);
			}
			return structuredClone(value);
		},

		async saveConfig(projectRoot: string, config: LogosConfig): Promise<void> {
			configStore.set(projectRoot, structuredClone(config));
		},

		async saveGenerationState(
			projectRoot: string,
			state: GenerationState,
		): Promise<void> {
			generationStore.set(projectRoot, structuredClone(state));
		},

		async saveIntakeState(
			projectRoot: string,
			state: LogosIntakeState,
		): Promise<void> {
			intakeStore.set(projectRoot, structuredClone(state));
		},
	};
}
