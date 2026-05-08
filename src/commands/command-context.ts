import { detectProjectRoot } from '../storage/project-root.js';

export type CommandContext = {
	readonly cwd: string;
	readonly projectRoot: string;
	readonly workspace: {
		readonly state: 'not_checked';
	};
};

export function loadCommandContext(cwd: string): CommandContext {
	return {
		cwd,
		projectRoot: detectProjectRoot(cwd),
		workspace: {
			state: 'not_checked',
		},
	};
}
