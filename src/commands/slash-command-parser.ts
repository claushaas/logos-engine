import {
	getSlashCommandDefinition,
	type SlashCommandDefinition,
	slashCommandDefinitions,
} from './slash-command-registry.js';

export type ParsedSlashCommand = {
	readonly args: readonly string[];
	readonly definition: SlashCommandDefinition;
	readonly input: string;
};

export type SlashCommandParseResult =
	| {
			readonly command: ParsedSlashCommand;
			readonly ok: true;
	  }
	| {
			readonly error: SlashCommandParseError;
			readonly ok: false;
	  };

export type SlashCommandParseError = {
	readonly code: 'empty_input' | 'missing_slash' | 'unknown_command';
	readonly message: string;
};

export function parseSlashCommand(input: string): SlashCommandParseResult {
	const normalizedInput = normalizeCommandInput(input);

	if (normalizedInput.length === 0) {
		return {
			error: {
				code: 'empty_input',
				message: 'Type a slash command, such as /help.',
			},
			ok: false,
		};
	}

	if (!normalizedInput.startsWith('/')) {
		return {
			error: {
				code: 'missing_slash',
				message: 'Slash commands must start with "/".',
			},
			ok: false,
		};
	}

	const match = findCommandMatch(normalizedInput);

	if (!match) {
		return {
			error: {
				code: 'unknown_command',
				message: `Unknown slash command: ${normalizedInput.split(' ')[0]}`,
			},
			ok: false,
		};
	}

	return {
		command: {
			args: splitArgs(normalizedInput.slice(match.id.length).trim()),
			definition: match,
			input: normalizedInput,
		},
		ok: true,
	};
}

function findCommandMatch(input: string): SlashCommandDefinition | undefined {
	const definitions = [...slashCommandDefinitions].sort(
		(left, right) => right.id.length - left.id.length,
	);

	return definitions.find((definition) => {
		const candidates = [definition.id, ...(definition.aliases ?? [])];

		return candidates.some(
			(candidate) => input === candidate || input.startsWith(`${candidate} `),
		);
	});
}

function normalizeCommandInput(input: string): string {
	return input.trim().replaceAll(/\s+/g, ' ');
}

function splitArgs(input: string): readonly string[] {
	if (input.length === 0) {
		return [];
	}

	return input.split(' ');
}

export function isKnownSlashCommand(commandId: string): boolean {
	return getSlashCommandDefinition(commandId) !== undefined;
}
