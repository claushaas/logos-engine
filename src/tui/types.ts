/** TUI slash command and routing types */

import type { StartupBriefing } from '../intake/startup-briefing-types.js';
import type { ProjectContext } from '../runtime/project-context.js';
import type { TuiConfirmationRequest } from './confirmation-model.js';
import type { TuiViewKind } from './workbench-model.js';

export type ParsedInput =
	| { kind: 'empty' }
	| { kind: 'free-form'; text: string }
	| { kind: 'slash'; name: string; args: string[]; raw: string };

export type CommandResultStatus = 'success' | 'info' | 'warning' | 'error';

export interface SlashCommandResult {
	kind: CommandResultStatus;
	command: string;
	messages: string[];
	shouldExit: boolean;
	/** Optional confirmation request when interactive confirmation is needed */
	confirmationRequest?: TuiConfirmationRequest | undefined;
	/** Workbench view kind for Phase 5 TUI workbench layout */
	viewKind?: TuiViewKind | undefined;
}

export interface RouterContext {
	projectContext: ProjectContext;
	startupBriefing?: StartupBriefing | undefined;
	/** Whether the TUI is running in interactive mode (keyboard confirmation available) */
	interactive?: boolean | undefined;
	/** Set to true to bypass confirmation (used by resolver after user accepts) */
	confirmationBypass?: boolean | undefined;
}
