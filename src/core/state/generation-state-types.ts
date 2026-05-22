/**
 * LOGOS Core — Generation state types.
 *
 * Defines the shape of durable generation state.
 */

export type GenerationState = {
	projectRoot: string;
	initializedAt: string;
	updatedAt: string;
	lastPreflightAt?: string;
	lastGeneratedAt?: string;
	generatedPaths: string[];
	metadata?: Record<string, unknown>;
};
