/**
 * Application layer — use cases, orchestration, and snapshot building.
 *
 * The application layer sits between the TUI (interface) and the
 * state engine (domain). It implements use cases that:
 * - Orchestrate multi-step operations across domain modules.
 * - Validate input before passing to the state engine.
 * - Build render snapshots for the TUI.
 *
 * The TUI calls application use cases — never low-level modules directly.
 */

export {
	type ApplyAgentTurnOptions,
	applyAgentTurn,
} from './apply-agent-turn.js';
export { generateAgentTurn } from './generate-agent-turn.js';
export {
	buildRenderSnapshot,
	getStatusSymbolForLifecycle,
} from './render-model-builder.js';
export {
	type ApplicationRuntime,
	type CreateRuntimeOptions,
	createApplicationRuntime,
	type RuntimeEvent,
	type RuntimeListener,
} from './runtime.js';
export {
	type AcceptCanonicalAnswerOptions,
	type AcceptCanonicalAnswerResult,
	acceptCanonicalAnswerUseCase,
} from './use-cases/accept-canonical-answer.js';
export {
	type EditCanonicalAnswerOptions,
	type EditCanonicalAnswerResult,
	editCanonicalAnswerUseCase,
} from './use-cases/edit-canonical-answer.js';
export {
	closeDocumentPreviewUseCase,
	type OpenDocumentPreviewOptions,
	type OpenDocumentPreviewResult,
	openDocumentPreviewUseCase,
} from './use-cases/open-document-preview.js';
export {
	type RegenerateCanonicalAnswerOptions,
	type RegenerateCanonicalAnswerResult,
	regenerateCanonicalAnswerUseCase,
} from './use-cases/regenerate-canonical-answer.js';
export {
	type ReopenNodeOptions,
	type ReopenNodeResult,
	reopenNodeUseCase,
} from './use-cases/reopen-node.js';
export {
	type SelectNodeOptions,
	type SelectNodeResult,
	selectNodeUseCase,
} from './use-cases/select-node.js';
export {
	type SkipNodeOptions,
	type SkipNodeResult,
	skipNodeUseCase,
} from './use-cases/skip-node.js';
export {
	type SubmitUserMessageOptions,
	type SubmitUserMessageResult,
	submitUserMessageUseCase,
} from './use-cases/submit-user-message.js';
