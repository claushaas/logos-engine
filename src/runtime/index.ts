/** Runtime services */

export type {
	CommandChangedPath,
	CommandError,
	CommandExecutionMode,
	CommandMessage,
	CommandResult,
	CommandResultMetadata,
	CommandStatus,
	CommandWarning,
	CreateCommandResultOptions,
	JsonSerializableCommandResult,
} from './command-result.js';
export {
	createCommandResult,
	formatCommandResultForHuman,
	statusToExitCode,
	toJsonSerializable,
} from './command-result.js';
export type { StructuredError, StructuredErrorOptions } from './errors.js';
export {
	createStructuredError,
	formatStructuredError,
	formatStructuredErrors,
	toCommandError,
} from './errors.js';

export type {
	LoggerOptions,
	LogLevel,
	LogSink,
	MemoryLogSink,
} from './logging.js';
export { ConsoleLogSink, defaultLogger, Logger } from './logging.js';
export type {
	DetectProjectContextOptions,
	DocumentationRootConfig,
	ProjectContext,
	ProjectContextDiagnostic,
	ProjectContextError,
	ProjectRootDetectionResult,
	ProjectRootKind,
	ProviderConfigStatus,
	WorkspaceConfigDetectionResult,
	WorkspaceDetectionResult,
	WorkspaceInitializationState,
} from './project-context.js';
export {
	detectProjectContext,
	detectProjectRoot,
	detectWorkspace,
	detectWorkspaceConfig,
	formatInitializationState,
	formatProjectContextLines,
	formatProviderStatus,
} from './project-context.js';

export type { RedactionOptions as RedactionOptionsType } from './redaction.js';
export {
	redactAndRelativize,
	redactString,
	redactValue,
	relativizePaths,
} from './redaction.js';
