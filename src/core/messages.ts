/**
 * LOGOS Core — Message contracts.
 *
 * Defines assistant-facing message and action shapes.
 * These are plain serializable data intended for rendering by external surfaces
 * such as the Pi Extension. Core must not import Pi or UI types here.
 */

export type AssistantMessageKind =
	| 'question'
	| 'follow_up'
	| 'clarification'
	| 'contradiction'
	| 'status'
	| 'warning'
	| 'error'
	| 'generation_result'
	| 'confirmation_request'
	| 'completion';

export type AssistantActionKind =
	| 'confirm'
	| 'cancel'
	| 'continue'
	| 'pause'
	| 'resume'
	| 'generate'
	| 'open_path'
	| 'show_status';

export type AssistantAction = {
	id: string;
	kind: AssistantActionKind;
	label: string;
	description?: string;
	destructive?: boolean;
	metadata?: Record<string, unknown>;
};

export type AssistantMessage = {
	kind: AssistantMessageKind;
	title?: string;
	body: string;
	questionId?: string;
	actions?: AssistantAction[];
	metadata?: Record<string, unknown>;
};
