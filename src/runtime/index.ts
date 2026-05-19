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
	changedPathsFromLogos,
	createCommandResult,
	formatCommandResultForHuman,
	operationStatusToCommandStatus,
	statusToExitCode,
	toJsonSerializable,
} from './command-result.js';

// Step 13.1 — Diagnostics
export type {
	DiagnosticArea,
	LogosChangedPath,
	LogosChangedPathAction,
	LogosDiagnostic,
	LogosDiagnosticCode,
	LogosDiagnosticInput,
	LogosDiagnosticRelatedIds,
	LogosDiagnosticSeverity,
	LogosNextAction,
	LogosNextActionCategory,
	LogosOperationStatus,
	LogosPartialFailure,
	LogosRecoveryHint,
	LogosRecoveryHintCategory,
} from './diagnostics.js';
export {
	CHANGED_PATH_ACTION_ORDER,
	compareSeverity,
	createDiagnostic,
	DIAGNOSTIC_AREAS,
	DIAGNOSTIC_SEVERITY_ORDER,
	diagnosticCode,
	diagnosticToJson,
	formatDiagnosticForTerminal,
	formatDiagnosticsForTerminal,
	OPERATION_STATUS_ORDER,
	RECOVERY_HINT_CATEGORIES,
	RecoveryHints,
	recoveryHint,
	sortChangedPaths,
	sortDiagnostics,
	sortNextActions,
	UNKNOWN_ERROR_CODE,
	wrapUnknownError,
} from './diagnostics.js';

export type { StructuredError, StructuredErrorOptions } from './errors.js';
export {
	createStructuredError,
	diagnosticToStructuredError,
	ErrorCodes,
	formatStructuredError,
	formatStructuredErrors,
	structuredErrorToDiagnostic,
	toCommandError,
	wrapUnknownCaughtValue,
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
