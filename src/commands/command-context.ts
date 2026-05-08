export type CommandContext = {
	readonly cwd: string;
	readonly workspace: {
		readonly state: 'not_loaded';
	};
};

export function loadCommandContext(cwd: string): CommandContext {
	return {
		cwd,
		workspace: {
			state: 'not_loaded',
		},
	};
}
