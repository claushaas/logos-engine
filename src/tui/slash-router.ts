/** Pure slash command router — returns typed results, performs no side effects */

import { initWorkspace, preflightInit } from '../init/index.js';
import { planNextQuestions } from '../intake/question-planner.js';
import { buildContractGraph } from '../profiles/contract-graph.js';
import { loadDocumentationContract } from '../profiles/documentation-contract.js';
import {
	formatInitializationState,
	formatProviderStatus,
} from '../runtime/project-context.js';
import { readWorkspaceState } from '../state/workspace-state-repository.js';
import type {
	ParsedInput,
	RouterContext,
	SlashCommandResult,
} from './types.js';

export async function routeSlashCommand(
	parsed: ParsedInput,
	context: RouterContext,
): Promise<SlashCommandResult> {
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
			return getInitResult(args, context);
		case 'continue':
			return getContinueResult(context);
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
		'  /init        — Initialize LOGOS workspace',
		'  /init --confirm — Confirm and execute workspace creation',
		'  /init --root <path> — Set custom documentation root',
		'  /init --profile <id> — Select profile (default: standard)',
		'  /init --dry-run — Plan workspace without creating files',
		'  /continue    — Continue intake with the next question cluster',
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

async function getContinueResult(
	context: RouterContext,
): Promise<SlashCommandResult> {
	const projectRoot = context.projectContext.root.rootPath ?? undefined;
	if (!projectRoot) {
		return {
			command: 'continue',
			kind: 'error',
			messages: [
				'Cannot continue intake because no project root was detected.',
				'Run logos from a project repository or initialize a workspace first.',
			],
			shouldExit: false,
		};
	}

	const readResult = await readWorkspaceState({ projectRoot });
	if (!readResult.success || !readResult.state) {
		return {
			command: 'continue',
			kind: 'warning',
			messages: [
				'Cannot continue intake because the LOGOS workspace is not initialized.',
				'Run /init to create a workspace, then run /continue again.',
			],
			shouldExit: false,
		};
	}

	try {
		const contract = await loadDocumentationContract({
			profileId: readResult.state.profile.profileId,
			repoRoot: projectRoot,
		});
		const graphResult = buildContractGraph(contract);
		const plan = planNextQuestions({
			contract,
			graph: graphResult.graph,
			state: readResult.state,
		});

		if (!plan.success || !plan.cluster || plan.cluster.questions.length === 0) {
			return {
				command: 'continue',
				kind: 'info',
				messages: [
					'No next intake questions are available for the current workspace state.',
					'Run /status to review workspace state and recovery hints.',
				],
				shouldExit: false,
			};
		}

		const lines = [
			'Next intake question cluster:',
			'',
			plan.cluster.reasonSummary,
			`Source documents: ${plan.cluster.sourceDocuments.join(', ')}`,
			'',
		];

		for (const [index, question] of plan.cluster.questions.entries()) {
			lines.push(`${index + 1}. ${question.text}`);
			lines.push(
				`   Source: ${question.source.documentCanonicalId} (${question.source.phaseId})`,
			);
			lines.push(
				`   Classification: ${question.blockingLevel}, ${question.priority}, ${question.reason}`,
			);
			if (question.existingOpenQuestionId) {
				lines.push(
					`   Preserved open question: ${question.existingOpenQuestionId}`,
				);
			}
		}

		lines.push('');
		lines.push(
			'Type an answer in the TUI to capture input evidence; proposals still require explicit review before becoming confirmed state.',
		);

		return {
			command: 'continue',
			kind: 'success',
			messages: lines,
			shouldExit: false,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			command: 'continue',
			kind: 'error',
			messages: [
				'Cannot continue intake because the active profile could not be loaded.',
				message,
				'Run /status to inspect workspace configuration.',
			],
			shouldExit: false,
		};
	}
}

async function getInitResult(
	args: string[],
	context: RouterContext,
): Promise<SlashCommandResult> {
	const isConfirm = args.includes('--confirm');
	const isDryRun = args.includes('--dry-run');

	// Extract --root <path>
	let customRoot: string | undefined;
	const rootIdx = args.indexOf('--root');
	if (rootIdx !== -1 && rootIdx + 1 < args.length) {
		customRoot = args[rootIdx + 1];
	}

	// Extract --profile <id>
	let profileId: string | undefined;
	const profileIdx = args.indexOf('--profile');
	if (profileIdx !== -1 && profileIdx + 1 < args.length) {
		profileId = args[profileIdx + 1];
	}

	// Use the project root from the existing context if available
	const projectRoot = context.projectContext.root.rootPath ?? undefined;

	if (isDryRun) {
		const plan = await preflightInit({
			documentationRoot: customRoot,
			dryRun: true,
			profileId,
			projectRoot,
		});

		const lines: string[] = [
			'Dry-run: workspace initialization plan',
			'',
			'Target paths:',
			`  Project root:        ${plan.targetPaths.projectRoot}`,
			`  .logos/ directory:   ${plan.targetPaths.logosDir}`,
			`  Workspace state file: ${plan.targetPaths.workspaceStateFile}`,
			`  Documentation root:   ${plan.targetPaths.documentationRoot}`,
			'',
			'Profile:',
			`  ID:      ${plan.profile.profileId}`,
			`  Source:  ${plan.profile.source}`,
			`  Validated: ${plan.profile.validated}`,
			'',
			'Documentation root:',
			`  Path:    ${plan.documentationRoot.rootPath}`,
			`  Default: ${plan.documentationRoot.isDefault}`,
			`  Valid:   ${plan.documentationRoot.valid}`,
		];

		if (!plan.safe) {
			lines.push('');
			lines.push('Warnings / Errors:');
			for (const diag of plan.diagnostics) {
				lines.push(`  [${diag.severity.toUpperCase()}] ${diag.message}`);
				if (diag.recoveryHint) {
					lines.push(`    Recovery: ${diag.recoveryHint}`);
				}
			}
		}

		if (plan.collision.kind !== 'none') {
			lines.push('');
			lines.push(`Collision: ${plan.collision.message}`);
			if (plan.collision.recoveryHint) {
				lines.push(`  Recovery: ${plan.collision.recoveryHint}`);
			}
		}

		lines.push('');
		lines.push('(dry-run: no files were written)');
		lines.push('Run /init --confirm to execute.');

		return {
			command: 'init',
			kind: plan.safe ? 'info' : 'warning',
			messages: lines,
			shouldExit: false,
		};
	}

	if (isConfirm) {
		const result = await initWorkspace({
			confirm: true,
			documentationRoot: customRoot,
			profileId,
			projectRoot,
		});

		return {
			command: 'init',
			kind:
				result.status === 'success' || result.status === 'dry_run'
					? 'success'
					: result.status === 'already_initialized'
						? 'warning'
						: 'error',
			messages: result.messages,
			shouldExit: false,
		};
	}

	// Default: show preflight plan, require confirmation
	const preflight = await preflightInit({
		documentationRoot: customRoot,
		profileId,
		projectRoot,
	});

	const lines: string[] = [
		'Workspace initialization preflight',
		'',
		'The following paths will be created:',
		`  Project root:        ${preflight.targetPaths.projectRoot}`,
		`  .logos/ directory:   ${preflight.targetPaths.logosDir}`,
		`  Workspace state:     ${preflight.targetPaths.workspaceStateFile}`,
		'',
		'Configuration:',
		`  Documentation root:  ${preflight.documentationRoot.rootPath} (absolute: ${preflight.documentationRoot.absolutePath})`,
		`  Default root:        ${preflight.documentationRoot.isDefault}`,
		`  Profile:             ${preflight.profile.profileId} (${preflight.profile.source})`,
		'',
	];

	if (!preflight.safe) {
		lines.push('Preflight found issues:');
		for (const diag of preflight.diagnostics) {
			lines.push(`  [${diag.severity.toUpperCase()}] ${diag.message}`);
			if (diag.recoveryHint) {
				lines.push(`    Recovery: ${diag.recoveryHint}`);
			}
		}
		lines.push('');
	}

	if (preflight.collision.kind !== 'none') {
		lines.push(`Warning: ${preflight.collision.message}`);
		if (preflight.collision.recoveryHint) {
			lines.push(`  ${preflight.collision.recoveryHint}`);
		}
		lines.push('');
	}

	lines.push('No files have been written.');
	lines.push('Run /init --confirm to create the workspace.');
	lines.push('Run /init --dry-run for a detailed dry-run plan.');
	lines.push('Run /init --root <path> to set a custom documentation root.');

	const kind = preflight.safe ? 'info' : 'warning';

	return {
		command: 'init',
		kind,
		messages: lines,
		shouldExit: false,
	};
}

import { getWorkspaceStatusSummary } from '../state/workspace-status.js';

async function getStatusResult(
	context: RouterContext,
): Promise<SlashCommandResult> {
	const ctx = context.projectContext;
	const projectRoot = ctx.root.rootPath ?? ctx.cwd;

	// Attempt state-backed summary
	let summary:
		| Awaited<ReturnType<typeof getWorkspaceStatusSummary>>
		| undefined;
	try {
		summary = await getWorkspaceStatusSummary({ projectRoot });
	} catch {
		// Fall back to context-only status
	}

	const lines: string[] = [
		'Status:',
		`  Repository path:    ${projectRoot}`,
		`  Documentation root: ${ctx.config.documentationRoot.rootPath}`,
		`  Active profile:     ${ctx.config.activeProfileId ?? 'unknown'}`,
		`  Provider status:    ${formatProviderStatus(ctx.config.providerStatus)}`,
		`  Workspace:          ${formatInitializationState(ctx.workspace.initializationState)}`,
	];

	if (summary) {
		lines.push('');
		lines.push('Session summary:');
		lines.push(`  Total sessions:   ${summary.sessionSummary.totalSessions}`);
		lines.push(`  Active sessions:  ${summary.sessionSummary.activeSessions}`);
		if (summary.sessionSummary.latestSession) {
			lines.push(
				`  Latest session:   ${summary.sessionSummary.latestSession.sessionType} (${summary.sessionSummary.latestSession.status})`,
			);
		}

		lines.push('');
		lines.push('Run summary:');
		lines.push(`  Total runs:       ${summary.runSummary.totalRuns}`);
		lines.push(`  Validation runs:  ${summary.runSummary.totalValidationRuns}`);
		lines.push(`  Diagnostic runs:  ${summary.runSummary.totalDiagnosticRuns}`);
		lines.push(`  Generation runs:  ${summary.runSummary.totalGenerationRuns}`);
		lines.push(`  Executive runs:   ${summary.runSummary.totalExecutiveRuns}`);
		if (summary.runSummary.latestRun) {
			lines.push(
				`  Latest run:       ${summary.runSummary.latestRun.runType} (${summary.runSummary.latestRun.status})`,
			);
		}

		lines.push('');
		lines.push('Artifact summary:');
		lines.push(`  Total artifacts:  ${summary.artifactSummary.totalArtifacts}`);
		lines.push(`  Canonical:        ${summary.artifactSummary.canonicalCount}`);
		lines.push(
			`  Non-canonical:    ${summary.artifactSummary.nonCanonicalCount}`,
		);
		if (summary.artifactSummary.latestArtifact) {
			lines.push(
				`  Latest artifact:  ${summary.artifactSummary.latestArtifact.artifactType} (${summary.artifactSummary.latestArtifact.status})`,
			);
		}
	}

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
