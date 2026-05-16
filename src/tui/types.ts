/** TUI slash command and routing types */

import type { StartupBriefing } from '../intake/startup-briefing-types.js';
import type { ProjectContext } from '../runtime/project-context.js';

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
}

export interface RouterContext {
	projectContext: ProjectContext;
	startupBriefing?: StartupBriefing | undefined;
}
