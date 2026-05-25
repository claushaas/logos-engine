/**
 * LOGOS Pi Extension — Intake model bridge.
 *
 * Triggers the Pi agent (LLM) to ask intake questions conversationally.
 * Uses the `agent_end` event to send the next question AFTER the
 * current agent turn completes, avoiding timing conflicts with
 * before_agent_start and input handlers.
 */

import type { ActivePrompt } from '../core/index.js';
import type { LogosPiExtensionApi } from './pi-types.js';

// ---------------------------------------------------------------------------
// Module-level pending prompt state
// ---------------------------------------------------------------------------

let pendingPrompt: ActivePrompt | undefined;

export function setPendingIntakePrompt(prompt: ActivePrompt): void {
	pendingPrompt = prompt;
}

// ---------------------------------------------------------------------------
// Register agent_end handler
// ---------------------------------------------------------------------------

export function registerIntakeModelBridge(pi: LogosPiExtensionApi): void {
	const piAny = pi as unknown as Record<string, unknown>;
	if (typeof piAny['on'] !== 'function') return;

	// After every agent turn, check if there's a pending intake question.
	(piAny['on'] as (event: string, handler: () => void) => void)(
		'agent_end',
		() => {
			if (pendingPrompt === undefined) return;

			const prompt = pendingPrompt;
			pendingPrompt = undefined;

			const instruction = buildInstruction(prompt);

			// Send as user message to trigger the next turn.
			const send = piAny['sendUserMessage'] as
				| ((m: string) => void)
				| undefined;
			if (typeof send === 'function') {
				try {
					send(instruction);
				} catch {
					/* */
				}
			}
		},
	);
}

// ---------------------------------------------------------------------------
// Instruction builder
// ---------------------------------------------------------------------------

function buildInstruction(prompt: ActivePrompt): string {
	const loc: string[] = [];
	if (prompt.phaseId) loc.push(prompt.phaseId);
	if (prompt.documentId) loc.push(prompt.documentId);
	if (prompt.sectionId) loc.push(prompt.sectionId);
	const locStr =
		loc.length > 0
			? ' (' +
				loc.join(' / ') +
				(prompt.priority ? ' ' + prompt.priority : '') +
				')'
			: '';

	const context =
		prompt.context && prompt.context.length > 0
			? '\nContext: ' + prompt.context
			: '';

	return (
		'LOGOS intake' +
		locStr +
		context +
		'\nAsk the user conversationally, in their language:\n' +
		prompt.text
	);
}
