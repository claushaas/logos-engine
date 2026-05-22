/**
 * LOGOS Core — Intake state types.
 *
 * Defines the shape of durable intake state.
 */

export type IntakeMode =
	| 'idle'
	| 'intake_active'
	| 'paused'
	| 'generating'
	| 'complete';

export type IntakeProgress = {
	total: number;
	sufficient: number;
	partial: number;
	missing: number;
	contradictory: number;
	byPhase: Record<
		string,
		{
			total: number;
			sufficient: number;
			partial: number;
			missing: number;
			contradictory: number;
		}
	>;
};

export type LogosIntakeState = {
	projectRoot: string;
	initializedAt: string;
	updatedAt: string;
	mode: IntakeMode;
	activeQuestionId?: string;
	progress: IntakeProgress;
	metadata?: Record<string, unknown>;
};
