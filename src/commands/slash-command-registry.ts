export type SlashCommandDefinition = {
	readonly aliases?: readonly string[];
	readonly description: string;
	readonly id: string;
	readonly options?: readonly string[];
	readonly usage: string;
};

export const slashCommandDefinitions = [
	{
		aliases: [],
		description: 'Initialize a LOGOS workspace and begin setup.',
		id: '/init',
		options: [],
		usage: '/init',
	},
	{
		aliases: [],
		description: 'Start or resume the AI-led intake conversation.',
		id: '/continue',
		options: [],
		usage: '/continue',
	},
	{
		aliases: [],
		description: 'Show current project progress.',
		id: '/status',
		options: [],
		usage: '/status',
	},
	{
		aliases: [],
		description: 'Validate the current phase or whole project.',
		id: '/validate',
		options: ['--phase', '--all'],
		usage: '/validate [--phase <phase>|--all]',
	},
	{
		aliases: [],
		description: 'Run diagnostics and show gaps, risks, and next actions.',
		id: '/diagnose',
		options: [],
		usage: '/diagnose',
	},
	{
		aliases: [],
		description: 'Render or refresh generated documents.',
		id: '/generate',
		options: ['--safe', '--refresh', '--force'],
		usage: '/generate [--safe|--refresh|--force]',
	},
	{
		aliases: [],
		description: 'Configure LLM provider access without storing raw tokens.',
		id: '/config ai',
		options: [
			'--show',
			'--test',
			'--disable',
			'--provider',
			'--endpoint',
			'--model',
			'--token-env',
			'--timeout-ms',
			'--allow-remote',
		],
		usage:
			'/config ai [--show|--test|--disable|--provider <preset> --model <id> --token-env <name> --timeout-ms <ms> --allow-remote]',
	},
	{
		aliases: [],
		description: 'Show available slash commands.',
		id: '/help',
		options: [],
		usage: '/help',
	},
	{
		aliases: ['/quit'],
		description: 'Save current state and exit the TUI.',
		id: '/exit',
		options: [],
		usage: '/exit',
	},
] as const satisfies readonly SlashCommandDefinition[];

export type SlashCommandId = (typeof slashCommandDefinitions)[number]['id'];

export function getSlashCommandDefinition(
	commandId: string,
): SlashCommandDefinition | undefined {
	const definitions: readonly SlashCommandDefinition[] =
		slashCommandDefinitions;

	return definitions.find(
		(command) =>
			command.id === commandId || command.aliases?.includes(commandId),
	);
}
