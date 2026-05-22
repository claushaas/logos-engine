/**
 * LOGOS Core — Error contracts.
 *
 * Defines structured error codes and error shapes.
 * These are plain serializable data. Raw thrown Error objects must not be
 * exposed in this contract.
 */

export type LogosErrorCode =
	| 'project_not_initialized'
	| 'invalid_project_root'
	| 'profile_not_found'
	| 'profile_invalid'
	| 'intake_not_started'
	| 'intake_already_complete'
	| 'active_question_missing'
	| 'question_registry_invalid'
	| 'state_read_failed'
	| 'state_write_failed'
	| 'evaluation_failed'
	| 'preflight_blocked'
	| 'generation_failed'
	| 'pi_extension_api_unavailable'
	| 'unknown_error';

export type LogosError = {
	code: LogosErrorCode;
	message: string;
	details?: string;
	cause?: string;
	metadata?: Record<string, unknown>;
};
