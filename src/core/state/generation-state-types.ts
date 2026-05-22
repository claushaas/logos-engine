/**
 * LOGOS Core — Generation state types.
 *
 * Defines the shape of durable generation state and preflight
 * snapshot metadata.
 */

// ---------------------------------------------------------------------------
// Preflight snapshot
// ---------------------------------------------------------------------------

/**
 * Durable summary of a single preflight attempt.
 *
 * This is persisted inside {@link GenerationState.lastPreflight}
 * so that status retrieval and later generation attempts can
 * reference the most recent preflight result without re-running
 * every check.
 */
export type GenerationPreflightSnapshot = {
	checkedAt: string;
	mode: string;
	status: string;
	ready: boolean;
	completenessScore: number;
	blockerCodes: string[];
	warningCodes: string[];
};

// ---------------------------------------------------------------------------
// Generation state
// ---------------------------------------------------------------------------

export type GenerationState = {
	projectRoot: string;
	initializedAt: string;
	updatedAt: string;
	lastPreflightAt?: string;
	lastGeneratedAt?: string;
	generatedPaths: string[];
	lastPreflight?: GenerationPreflightSnapshot;
	metadata?: Record<string, unknown>;
};
