/**
 * LOGOS Core — Config state types.
 *
 * Defines the shape of project-local LOGOS configuration.
 */

export type LogosConfig = {
	version: 1;
	activeProfileId: string;
	createdAt: string;
	updatedAt: string;
	metadata?: Record<string, unknown>;
};

export function createDefaultLogosConfig(input: {
	now: string;
	activeProfileId?: string;
}): LogosConfig {
	return {
		activeProfileId: input.activeProfileId ?? 'standard',
		createdAt: input.now,
		metadata: {},
		updatedAt: input.now,
		version: 1,
	};
}
