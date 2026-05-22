/**
 * LOGOS Core — State repository port contract.
 *
 * Defines a port for persisting and loading canonical LOGOS state.
 * Implementations may use the filesystem, memory, or other backends.
 */

import type { LogosConfig } from '../state/config-types.js';
import type { GenerationState } from '../state/generation-state-types.js';
import type { LogosIntakeState } from '../state/intake-state-types.js';

export type LogosStateRepository = {
	loadConfig(projectRoot: string): Promise<LogosConfig>;
	saveConfig(projectRoot: string, config: LogosConfig): Promise<void>;

	loadIntakeState(projectRoot: string): Promise<LogosIntakeState>;
	saveIntakeState(projectRoot: string, state: LogosIntakeState): Promise<void>;

	loadGenerationState(projectRoot: string): Promise<GenerationState>;
	saveGenerationState(
		projectRoot: string,
		state: GenerationState,
	): Promise<void>;
};
