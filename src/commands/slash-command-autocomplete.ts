import {
	type SlashCommandDefinition,
	slashCommandDefinitions,
} from './slash-command-registry.js';

export type SlashCommandCompletion = {
	readonly description: string;
	readonly insertText: string;
	readonly label: string;
};

export function getSlashCommandCompletions(
	input: string,
): readonly SlashCommandCompletion[] {
	const normalizedInput = input.trimStart().replaceAll(/\s+/g, ' ');

	if (normalizedInput.length === 0) {
		return slashCommandDefinitions.map(toCommandCompletion);
	}

	const optionCompletions = getOptionCompletions(normalizedInput);

	if (optionCompletions.length > 0) {
		return optionCompletions;
	}

	return slashCommandDefinitions
		.filter((command) => command.id.startsWith(normalizedInput))
		.map(toCommandCompletion);
}

function getOptionCompletions(
	input: string,
): readonly SlashCommandCompletion[] {
	const command = slashCommandDefinitions.find(
		(definition) =>
			input === definition.id || input.startsWith(`${definition.id} `),
	);

	if (!command?.options) {
		return [];
	}

	const optionPrefix =
		input.slice(command.id.length).trim().split(' ').at(-1) ?? '';

	if (!optionPrefix.startsWith('-')) {
		return command.options.map((option) => toOptionCompletion(command, option));
	}

	return command.options
		.filter((option) => option.startsWith(optionPrefix))
		.map((option) => toOptionCompletion(command, option));
}

function toCommandCompletion(
	command: SlashCommandDefinition,
): SlashCommandCompletion {
	return {
		description: command.description,
		insertText: command.id,
		label: command.usage,
	};
}

function toOptionCompletion(
	command: SlashCommandDefinition,
	option: string,
): SlashCommandCompletion {
	return {
		description: command.description,
		insertText: `${command.id} ${option}`,
		label: `${command.id} ${option}`,
	};
}
