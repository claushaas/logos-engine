/**
 * Keyboard-selectable confirmation prompt component.
 *
 * Phase 4: Keyboard Confirmation Framework — Outcome 2 (keyboard-selectable confirmation component).
 *
 * Renders a confirmation request with visible options, keyboard navigation,
 * and text-based selection indicators. Does NOT mutate state or call services.
 */

import { Box, Text, useInput } from 'ink';
import type React from 'react';
import type { TuiConfirmationRequest } from './confirmation-model.js';
import {
	applyConfirmationKeyboardAction,
	mapKeyToConfirmationAction,
} from './confirmation-state.js';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ConfirmationPromptProps {
	/** The confirmation request to display */
	request: TuiConfirmationRequest;

	/** Called when the user presses Enter / selects an option */
	onConfirm: (optionId: string) => void;

	/** Called when the user presses Escape */
	onCancel: () => void;

	/** Called when selection changes (for external state sync) */
	onSelectionChange?: ((optionId: string) => void) | undefined;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConfirmationPrompt(
	props: ConfirmationPromptProps,
): React.JSX.Element {
	const { request, onConfirm, onCancel, onSelectionChange } = props;

	// Keyboard handling — delegates to pure helpers
	useInput((_input, key) => {
		const action = mapKeyToConfirmationAction(key);
		if (!action) return;

		const result = applyConfirmationKeyboardAction(request, action);

		if (result.shouldConfirm) {
			onConfirm(result.selectedOptionId);
		} else if (result.shouldCancel) {
			onCancel();
		} else {
			onSelectionChange?.(result.selectedOptionId);
		}
	});

	const destructiveTag = request.destructive ? ' (destructive)' : '';
	const sensitiveTag = request.sensitive ? ' (sensitive)' : '';

	return (
		<Box flexDirection="column">
			<Box>
				<Text bold>
					{request.title}
					{destructiveTag}
					{sensitiveTag}
				</Text>
			</Box>

			<Box>
				<Text>{request.message}</Text>
			</Box>

			{request.target && (
				<Box>
					<Text>
						Target: {request.target.kind}
						{request.target.id ? ` (${request.target.id})` : ''}
						{request.target.safeDisplay
							? ` — ${request.target.safeDisplay}`
							: ''}
					</Text>
				</Box>
			)}

			{request.consequences.length > 0 && (
				<Box flexDirection="column">
					<Box>
						<Text bold>Consequences:</Text>
					</Box>
					{request.consequences.map((c) => (
						<Box key={c.substring(0, 30)}>
							<Text> • {c}</Text>
						</Box>
					))}
				</Box>
			)}

			{request.alternatives.length > 0 && (
				<Box flexDirection="column">
					<Box>
						<Text bold>Alternatives:</Text>
					</Box>
					{request.alternatives.map((a) => (
						<Box key={a.substring(0, 30)}>
							<Text> • {a}</Text>
						</Box>
					))}
				</Box>
			)}

			<Box flexDirection="column">
				<Box>
					<Text bold>Options:</Text>
				</Box>
				{request.options.map((option) => {
					const isSelected = option.id === request.selectedOptionId;
					const prefix = isSelected ? '>' : ' ';
					const bracket = isSelected ? '[selected]' : '[ ]';
					const destructiveLabel = option.isDestructive ? ' (destructive)' : '';
					return (
						<Box key={option.id}>
							{isSelected ? (
								<Text color="green">
									{prefix} {bracket} {option.label}
									{destructiveLabel}
								</Text>
							) : (
								<Text>
									{prefix} {bracket} {option.label}
									{destructiveLabel}
								</Text>
							)}
						</Box>
					);
				})}
			</Box>

			<Box>
				<Text dimColor>
					Arrow keys / Tab: move | Enter: select | Esc: cancel
				</Text>
			</Box>
		</Box>
	);
}
