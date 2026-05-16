/** TUI slash command and routing types */

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
	cwd: string;
	docRoot: string;
	profile: string;
	providerStatus: string;
	workspaceInitialized: boolean;
}
