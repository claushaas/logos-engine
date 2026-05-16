/** Pure slash command router — returns typed results, performs no side effects */

import {
	formatInitializationState,
	formatProviderStatus,
} from '../runtime/project-context.js';
import type {
	ParsedInput,
	RouterContext,
	SlashCommandResult,
} from './types.js';

export function routeSlashCommand(
	parsed: ParsedInput,
	context: RouterContext,
): SlashCommandResult {
	if (parsed.kind === 'empty') {
		return {
			command: '',
			kind: 'info',
			messages: [],
			shouldExit: false,
		};
	}

	if (parsed.kind === 'free-form') {
		return {
			command: 'intake',
			kind: 'info',
			messages: [
				`Received: "${parsed.text}"`,
				'Free-form intake routing will be implemented in a later phase.',
			],
			shouldExit: false,
		};
	}

	const { name, args } = parsed;

	// Nested command: /config ai
	if (name === 'config' && args[0] === 'ai') {
		return {
			command: 'config ai',
			kind: 'warning',
			messages: [
				'/config ai is recognized but not yet implemented.',
				'Planned for Phase 4 — Intake and Question Engine.',
			],
			shouldExit: false,
		};
	}

	switch (name) {
		case 'help':
			return {
				command: 'help',
				kind: 'success',
				messages: getHelpMessages(),
				shouldExit: false,
			};
		case 'status':
			return getStatusResult(context);
		case 'exit':
			return {
				command: 'exit',
				kind: 'success',
				messages: ['Goodbye.'],
				shouldExit: true,
			};
		case 'init':
			return {
				command: 'init',
				kind: 'warning',
				messages: [
					'/init is recognized but not yet implemented.',
					'Planned for Step 2.3 / Phase 3 — Local State and Sessions.',
				],
				shouldExit: false,
			};
		case 'continue':
			return {
				command: 'continue',
				kind: 'warning',
				messages: [
					'/continue is recognized but not yet implemented.',
					'Planned for Phase 4 — Intake and Question Engine.',
				],
				shouldExit: false,
			};
		case 'generate':
			return {
				command: 'generate',
				kind: 'warning',
				messages: [
					'/generate is recognized but not yet implemented.',
					'Planned for Phase 5 — Canonical Markdown Generation.',
				],
				shouldExit: false,
			};
		case 'diagnose':
			return {
				command: 'diagnose',
				kind: 'warning',
				messages: [
					'/diagnose is recognized but not yet implemented.',
					'Planned for Phase 6 — Validation, Linting, and Review Gates.',
				],
				shouldExit: false,
			};
		case 'validate':
			return {
				command: 'validate',
				kind: 'warning',
				messages: [
					'/validate is recognized but not yet implemented.',
					'Planned for Phase 6 — Validation, Linting, and Review Gates.',
				],
				shouldExit: false,
			};
		default:
			return {
				command: name,
				kind: 'error',
				messages: [
					`Unknown command: /${name}`,
					'Run /help for available commands.',
				],
				shouldExit: false,
			};
	}
}

function getHelpMessages(): string[] {
	return [
		'LOGOS Engine — TUI slash commands:',
		'',
		'  /init        — Initialize workspace (not yet implemented)',
		'  /continue    — Continue intake session (not yet implemented)',
		'  /generate    — Generate canonical Markdown (not yet implemented)',
		'  /diagnose    — Run diagnostics (not yet implemented)',
		'  /validate    — Run validation (not yet implemented)',
		'  /status      — Show runtime status',
		'  /config ai   — Configure AI provider (not yet implemented)',
		'  /help        — Show this help',
		'  /exit        — Exit the shell',
		'',
		'You can also type free-form text for the intake engine (not yet implemented).',
	];
}

function getStatusResult(context: RouterContext): SlashCommandResult {
	const ctx = context.projectContext;
	const lines: string[] = [
		'Status:',
		`  Repository path:    ${ctx.root.rootPath ?? ctx.cwd}`,
		`  Documentation root: ${ctx.config.documentationRoot.rootPath}`,
		`  Active profile:     ${ctx.config.activeProfileId ?? 'unknown'}`,
		`  Provider status:    ${formatProviderStatus(ctx.config.providerStatus)}`,
		`  Workspace:          ${formatInitializationState(ctx.workspace.initializationState)}`,
	];

	if (ctx.workspace.initializationState === 'missing') {
		lines.push('');
		lines.push('  Recovery: Run /init to initialize the workspace.');
	}

	for (const diag of ctx.diagnostics) {
		if (diag.recoveryHint) {
			lines.push(`  [${diag.severity.toUpperCase()}] ${diag.message}`);
			lines.push(`    Recovery: ${diag.recoveryHint}`);
		}
	}

	return {
		command: 'status',
		kind: 'info',
		messages: lines,
		shouldExit: false,
	};
}
