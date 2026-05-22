/**
 * LOGOS Core — Config state types.
 *
 * Defines the shape of project-local LOGOS configuration.
 * Re-exports the canonical config types and constants from
 * {@link ../config/config-schema.js}.
 */

import type { LogosConfig } from '../config/config-schema.js';
import { DEFAULT_PROFILE_ID } from '../config/config-schema.js';

export type {
	LogosConfig,
	LogosConfigVersion,
} from '../config/config-schema.js';
export { DEFAULT_PROFILE_ID };

export function createDefaultLogosConfig(input: {
	now: string;
	activeProfileId?: string;
}): LogosConfig {
	return {
		activeProfileId: input.activeProfileId ?? DEFAULT_PROFILE_ID,
		createdAt: input.now,
		updatedAt: input.now,
		version: 1,
	};
}
