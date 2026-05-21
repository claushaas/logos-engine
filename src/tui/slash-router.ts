/** Pure slash command router — returns typed results, performs no side effects */

import {
	acceptAiProviderDisclosure,
	declineAiProviderDisclosure,
	disableAiProvider,
	formatProviderListForDisplay,
	formatTestSummary,
	getAiProviderStatus,
	getDisclosurePreview,
	getProviderEntry,
	resetAiProviderConfig,
	setAiProvider,
	setAiProviderEndpoint,
	setAiProviderMode,
	setAiProviderModel,
	setAiProviderTimeout,
	setAiProviderTokenEnvVar,
	testAiProvider,
} from '../ai/index.js';
import {
	getOutput,
	getOutputSources,
	listOutputs,
	listStaleOutputs,
} from '../artifacts/output-browser.js';
import { OUTPUT_DISPLAY_KIND_LABELS } from '../artifacts/output-browser-model.js';
import {
	buildDocumentDependencyGraph,
	createInspectableGraphOutput,
} from '../dependency-graph/index.js';
import { executiveCompileWorkflow } from '../executive/index.js';
import { generateCanonicalDocs } from '../generation/generate-canonical-docs.js';
import type { GenerateCanonicalDocsWritePolicy } from '../generation/generate-types.js';
import { unifiedGeneration } from '../generation/unified-generation.js';
import type {
	UnifiedGenerationDryRunResult,
	UnifiedGenerationOptions,
	UnifiedGenerationPreflight,
	UnifiedGenerationReport,
} from '../generation/unified-generation-types.js';
import { initWorkspace, preflightInit } from '../init/index.js';
import {
	getProposal,
	acceptProposal as intakeAcceptProposal,
	rejectProposal as intakeRejectProposal,
	reviseProposal as intakeReviseProposal,
	listProposals,
} from '../intake/index.js';
import { processFreeFormIntake } from '../intake/intake-service.js';
import { planNextQuestions } from '../intake/question-planner.js';
import { buildContractGraph } from '../profiles/contract-graph.js';
import { loadDocumentationContract } from '../profiles/documentation-contract.js';
import { loadProfileRegistry } from '../profiles/profile-registry.js';
import {
	formatInitializationState,
	formatProviderStatus,
} from '../runtime/project-context.js';
import { detectStaleness } from '../staleness/index.js';
import { readWorkspaceState } from '../state/workspace-state-repository.js';
import { getWorkspaceStatusSummary } from '../state/workspace-status.js';
import { runDiagnoseCommand } from '../validation/diagnose-command.js';
import { runValidateCommand } from '../validation/validate-command.js';
import {
	applyResetToDefault,
	applyRootChange,
	getDocumentationRootStatus,
	previewResetToDefault,
	previewRootChange,
} from '../workspace/index.js';
import {
	createTuiConfirmationRequest,
	yesNoOptions,
} from './confirmation-model.js';
import type {
	CommandResultStatus,
	ParsedInput,
	RouterContext,
	SlashCommandResult,
} from './types.js';
import type { TuiViewKind } from './workbench-model.js';

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
			viewKind: 'status' as TuiViewKind,
		};
	}

	if (parsed.kind === 'free-form') {
		return handleFreeFormIntake(parsed.text, context);
	}

	const { name, args } = parsed;

	// Nested command: /config ai
	if (name === 'config' && args[0] === 'ai') {
		return getConfigAiResult(args.slice(1), context);
	}

	switch (name) {
		case 'help':
			return {
				command: 'help',
				kind: 'success',
				messages: getHelpMessages(),
				shouldExit: false,
				viewKind: 'help' as TuiViewKind,
			};
		case 'status':
			return getStatusResult(context);
		case 'exit':
			return {
				command: 'exit',
				kind: 'success',
				messages: ['Goodbye.'],
				shouldExit: true,
				viewKind: 'status' as TuiViewKind,
			};
		case 'init':
			return getInitResult(args, context);
		case 'continue':
			return getContinueResult(context);
		case 'generate':
			return getGenerateResult(args, context);
		case 'diagnose':
			return getDiagnoseResult(args, context);
		case 'validate':
			return getValidateResult(args, context);
		case 'graph':
			return getGraphResult(args, context);
		case 'executive':
			return getExecutiveResult(args, context);
		case 'proposals':
			return getProposalsResult(args, context);
		case 'decisions':
			return getDecisionsResult(args, context);
		case 'outputs':
			return getOutputsResult(args, context);
		case 'root':
			return getRootResult(args, context);
		default:
			return {
				command: name,
				kind: 'error',
				messages: [
					`Unknown command: /${name}`,
					'Run /help for available commands.',
				],
				shouldExit: false,
				viewKind: 'recovery' as TuiViewKind,
			};
	}
}

/**
 * Check whether keyboard confirmation should be used for this context.
 * Returns true when the TUI is interactive and confirmation hasn't been bypassed.
 */
function shouldUseKeyboardConfirmation(context: RouterContext): boolean {
	return context.interactive === true && context.confirmationBypass !== true;
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
		'  /generate    — Generate canonical Markdown documentation',
		'  /generate --canonical-only — Generate canonical Markdown only (default when no flags)',
		'  /generate --canonical-only --confirm — Include derived HTML + Agent Packs',
		'  /generate --skip-derived — Generate canonical only, skip derived',
		'  /generate --html-only — Generate HTML artifacts only',
		'  /generate --agent-pack-only — Generate Agent Packs only',
		'  /generate --confirm — Confirm and execute generation',
		'  /generate --dry-run — Plan generation without writes',
		'  /generate --policy <name> --confirm — Use specific write policy',
		'  /diagnose    — Run diagnostic analysis',
		'  /diagnose --dry-run — Run diagnosis without writes',
		'  /validate    — Run deterministic validation',
		'  /validate --dry-run — Run validation without writes',
		'  /validate --scope <scope> — Scope validation (contracts, state, artifacts, outputs)',
		'  /status      — Show runtime status',
		'  /graph       — Show dependency graph output',
		'  /graph --json — Show graph output as JSON',
		'  /graph --phase <phaseId> — Filter graph by phase',
		'  /graph --doc <documentId> — Filter graph by document',
		'  /graph --mode full — Show full graph output',
		'  /config ai   — Configure AI provider (status, mode, provider, model, endpoint, token, timeout, disclosure, test, disable, reset)',
		'  /executive compile — Compile Executive Axis (JSON + exports)',
		'  /executive compile --dry-run — Preflight executive compilation',
		'  /help        — Show this help',
		'  /exit        — Exit the shell',
		'',
		'Documentation root:',
		'  /outputs    — Browse generated outputs (list, show, sources, stale)',
		'  /outputs list --type <type> — Filter by type (canonical, html, agent-pack, report, executive)',
		'  /outputs list --derived|--canonical — Filter by canonicality',
		'  /outputs list --status stale|current — Filter by status',
		'  /outputs show <id>  — Show output detail',
		'  /outputs sources <id> — Show output source references',
		'  /outputs stale       — List stale/blocked/missing outputs',
		'  /root                     — Show documentation root configuration',
		'  /root status              — Show current root status',
		'  /root preview <path>      — Preview a root change (read-only)',
		'  /root set <path>          — Change documentation root (requires confirmation)',
		'  /root set <path> --dry-run — Dry-run root change',
		'  /root reset               — Reset to default logos/ (requires confirmation)',
		'  /root reset --dry-run     — Dry-run reset',
		'',
		'Proposal review:',
		'  /proposals [list]             — List reviewable proposals',
		'  /proposals show <id>          — Show proposal details',
		'  /proposals accept <id>        — Accept proposal (creates confirmed record)',
		'  /proposals revise <id> <text> — Revise proposal',
		'  /proposals reject <id>        — Reject proposal',
		'  /proposals defer <id>         — Defer proposal',
		'  /proposals affected <id>      — Show affected documents',
		'  /proposals --kind <kind>      — Filter by kind (decision, assumption, etc.)',
		'  /proposals --status <status>  — Filter by status',
		'',
		'Decision correction:',
		'  /decisions [list]             — List confirmed decisions',
		'  /decisions show <id>          — Show decision details',
		'  /decisions revise <id> <text> — Revise confirmed decision',
		'  /decisions supersede <id> <text> — Supersede confirmed decision',
		'  /decisions affected <id>      — Show affected documents and stale outputs',
		'',
		'You can also type free-form text for conversational intake.',
		'Non-slash input is captured as intake evidence and creates reviewable proposals.',
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

	// Extract --profile-root <path>
	let profileRoot: string | undefined;
	const profileRootIdx = args.indexOf('--profile-root');
	if (profileRootIdx !== -1 && profileRootIdx + 1 < args.length) {
		profileRoot = args[profileRootIdx + 1];
	}

	// Use the project root from the existing context if available
	const projectRoot = context.projectContext.root.rootPath ?? undefined;

	if (isDryRun) {
		const plan = await preflightInit({
			documentationRoot: customRoot,
			dryRun: true,
			profileId,
			profileRoot,
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
			profileRoot,
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

	// Default: show preflight plan, optionally with keyboard confirmation
	const preflight = await preflightInit({
		documentationRoot: customRoot,
		profileId,
		profileRoot,
		projectRoot,
	});

	const baseLines: string[] = [
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
		baseLines.push('Preflight found issues:');
		for (const diag of preflight.diagnostics) {
			baseLines.push(`  [${diag.severity.toUpperCase()}] ${diag.message}`);
			if (diag.recoveryHint) {
				baseLines.push(`    Recovery: ${diag.recoveryHint}`);
			}
		}
		baseLines.push('');
	}

	if (preflight.collision.kind !== 'none') {
		baseLines.push(`Warning: ${preflight.collision.message}`);
		if (preflight.collision.recoveryHint) {
			baseLines.push(`  ${preflight.collision.recoveryHint}`);
		}
		baseLines.push('');
	}

	// Interactive keyboard confirmation
	if (
		shouldUseKeyboardConfirmation(context) &&
		preflight.safe &&
		preflight.collision.kind === 'none'
	) {
		const sourceCmd = ['/init'];
		if (customRoot) sourceCmd.push('--root', customRoot);
		if (profileId) sourceCmd.push('--profile', profileId);
		if (profileRoot) sourceCmd.push('--profile-root', profileRoot);

		const confirmationRequest = createTuiConfirmationRequest({
			actionKind: 'workspace_init',
			alternatives: [
				'Run /init --dry-run first.',
				'Choose a different profile.',
			],
			consequences: [
				`Create .logos/ directory at: ${preflight.targetPaths.logosDir}`,
				`Create workspace state file at: ${preflight.targetPaths.workspaceStateFile}`,
				`Documentation root: ${preflight.documentationRoot.rootPath}`,
				`Profile: ${preflight.profile.profileId}`,
			],
			destructive: false,
			diagnostics: preflight.diagnostics.map((d) => ({
				code: d.code,
				message: d.message,
				recoveryHints: d.recoveryHint
					? [{ category: 'manual_review' as const, message: d.recoveryHint }]
					: [],
				severity:
					d.severity === 'error'
						? 'error'
						: d.severity === 'warning'
							? 'warning'
							: 'info',
			})),
			message: 'Workspace files will be created in this repository.',
			options: yesNoOptions(),
			sensitive: false,
			sourceCommand: sourceCmd.join(' '),
			target: {
				kind: 'workspace',
				path: preflight.targetPaths.projectRoot,
			},
			title: 'Initialize LOGOS Workspace',
		});

		baseLines.push('Use the keyboard to accept or cancel below.');

		return {
			command: 'init',
			confirmationRequest,
			kind: 'info',
			messages: baseLines,
			shouldExit: false,
		};
	}

	// Non-interactive: standard text prompt
	baseLines.push('No files have been written.');
	baseLines.push('Run /init --confirm to create the workspace.');
	baseLines.push('Run /init --dry-run for a detailed dry-run plan.');
	baseLines.push('Run /init --root <path> to set a custom documentation root.');
	baseLines.push(
		'Run /init --profile-root <path> to use a custom local profile.',
	);

	const kind = preflight.safe ? 'info' : 'warning';

	return {
		command: 'init',
		kind,
		messages: baseLines,
		shouldExit: false,
	};
}

// ---------------------------------------------------------------------------
// Phase 7: Unified generation handler (canonical + derived)
// ---------------------------------------------------------------------------

async function handleUnifiedGeneration(
	_args: string[],
	context: RouterContext,
	scope: {
		isCanonicalOnly: boolean;
		isSkipDerived: boolean;
		isHtmlOnly: boolean;
		isAgentPackOnly: boolean;
		isConfirm: boolean;
		isDryRun: boolean;
		writePolicy: GenerateCanonicalDocsWritePolicy | undefined;
	},
): Promise<SlashCommandResult> {
	const projectRoot = context.projectContext.root.rootPath ?? undefined;
	if (!projectRoot) {
		return {
			command: 'generate',
			kind: 'error',
			messages: [
				'Cannot generate documentation because no project root was detected.',
			],
			shouldExit: false,
		};
	}

	const unifiedScope = {
		agentPack:
			scope.isAgentPackOnly ||
			(!scope.isCanonicalOnly && !scope.isHtmlOnly && !scope.isSkipDerived),
		canonical:
			!scope.isHtmlOnly && !scope.isAgentPackOnly && !scope.isSkipDerived,
		canonicalOnly: scope.isCanonicalOnly,
		html:
			scope.isHtmlOnly ||
			(!scope.isCanonicalOnly &&
				!scope.isAgentPackOnly &&
				!scope.isSkipDerived),
		skipDerived: scope.isSkipDerived,
	};

	const mode = scope.isDryRun
		? 'dry_run'
		: scope.isConfirm
			? 'execute'
			: 'preflight';

	try {
		const result = await unifiedGeneration({
			mode: mode as UnifiedGenerationOptions['mode'],
			projectRoot,
			scope: unifiedScope,
			writePolicy: scope.writePolicy,
		});

		// Type narrowing: preflight
		if (result.mode === 'preflight') {
			const preflight = result as UnifiedGenerationPreflight;
			const lines: string[] = [
				'Unified Generation Preflight',
				'',
				`Profile:            ${preflight.profileId}`,
				`Documentation root: ${preflight.documentationRoot}`,
				'',
				'Canonical Markdown:',
				`  Generate:   ${preflight.canonicalDocumentCounts.generate}`,
				`  Update:     ${preflight.canonicalDocumentCounts.update}`,
				`  Skip:       ${preflight.canonicalDocumentCounts.skip}`,
				`  Incomplete: ${preflight.canonicalDocumentCounts.incomplete}`,
				`  Blocked:    ${preflight.canonicalDocumentCounts.blocked}`,
				`  Failed:     ${preflight.canonicalDocumentCounts.failed}`,
				`  Stale:      ${preflight.canonicalDocumentCounts.stale}`,
				'',
				'Derived artifacts:',
				`  HTML artifacts:   ${preflight.htmlArtifactCount} declared`,
				`  Agent Packs:      ${preflight.agentPackCount} declared`,
				`  Ready:            ${preflight.derivedReadyCount}`,
				`  Blocked:          ${preflight.derivedBlockedCount}`,
			];

			if (preflight.collisionPaths.length > 0) {
				lines.push('');
				lines.push('Manual edits detected:');
				for (const p of preflight.collisionPaths.slice(0, 5)) {
					lines.push(`  ${p}`);
				}
			}

			// Keyboard confirmation
			if (shouldUseKeyboardConfirmation(context) && preflight.canonicalReady) {
				const sourceCmd = ['/generate', '--canonical-only'];
				if (scope.writePolicy) sourceCmd.push('--policy', scope.writePolicy);

				const confirmationRequest = createTuiConfirmationRequest({
					actionKind: 'canonical_generation',
					alternatives: [
						'Run /generate --dry-run first.',
						'Use --canonical-only for canonical only.',
					],
					consequences: [
						`Profile: ${preflight.profileId}`,
						`Documentation root: ${preflight.documentationRoot}`,
						`Canonical documents: ${preflight.canonicalDocumentCounts.generate} generate, ${preflight.canonicalDocumentCounts.update} update`,
						`HTML artifacts: ${preflight.htmlArtifactCount}`,
						`Agent Packs: ${preflight.agentPackCount}`,
					],
					destructive: false,
					message:
						'Markdown documents and derived artifacts will be written under the documentation root.',
					options: yesNoOptions(),
					sensitive: false,
					sourceCommand: sourceCmd.join(' '),
					target: {
						kind: 'documentation_root',
						path: preflight.documentationRoot,
					},
					title: 'Generate Canonical And Derived Outputs',
				});

				lines.push('Use the keyboard to accept or cancel below.');

				return {
					command: 'generate',
					confirmationRequest,
					kind: 'info',
					messages: lines,
					shouldExit: false,
				};
			}

			lines.push('');
			lines.push('No files have been written.');
			lines.push('Run /generate --confirm to execute generation.');

			return {
				command: 'generate',
				kind: preflight.canonicalReady ? 'info' : 'warning',
				messages: lines,
				shouldExit: false,
			};
		}

		// Type narrowing: dry_run
		if (result.mode === 'dry_run') {
			const dryRunResult = result as UnifiedGenerationDryRunResult;
			const lines: string[] = [
				'Unified Generation Dry-Run',
				'',
				`Profile:            ${dryRunResult.profileId}`,
				`Documentation root: ${dryRunResult.documentationRoot}`,
				`Write policy:       ${dryRunResult.writePolicy}`,
				'',
				'Canonical Markdown:',
				`  Generate:   ${dryRunResult.canonicalDocumentCounts.generate}`,
				`  Update:     ${dryRunResult.canonicalDocumentCounts.update}`,
				`  Skip:       ${dryRunResult.canonicalDocumentCounts.skip}`,
				`  Blocked:    ${dryRunResult.canonicalDocumentCounts.blocked}`,
				`  Failed:     ${dryRunResult.canonicalDocumentCounts.failed}`,
				'',
				'Derived artifacts:',
				`  HTML:   ${dryRunResult.htmlArtifactCount} (${dryRunResult.derivedReadyCount} ready, ${dryRunResult.derivedBlockedCount} blocked)`,
				`  Packs:  ${dryRunResult.agentPackCount}`,
				'',
				'(dry-run: no files were written)',
				'Run /generate --confirm to execute.',
			];

			return {
				command: 'generate',
				kind: 'info',
				messages: lines,
				shouldExit: false,
			};
		}

		// Type narrowing: execute
		if (result.mode === 'execute') {
			const execResult = result as UnifiedGenerationReport;
			const lines: string[] = [
				'Generation Complete',
				'',
				'Canonical Markdown:',
				`  Created:    ${execResult.canonical.counts.created}`,
				`  Updated:    ${execResult.canonical.counts.updated}`,
				`  Skipped:    ${execResult.canonical.counts.skipped}`,
				`  Blocked:    ${execResult.canonical.counts.blocked}`,
				`  Failed:     ${execResult.canonical.counts.failed}`,
				`  Stale:      ${execResult.canonical.counts.stale}`,
				'',
				'HTML Artifacts:',
				`  Created:    ${execResult.htmlArtifacts.counts.created}`,
				`  Updated:    ${execResult.htmlArtifacts.counts.updated}`,
				`  Skipped:    ${execResult.htmlArtifacts.counts.skipped}`,
				`  Blocked:    ${execResult.htmlArtifacts.counts.blocked}`,
				`  Failed:     ${execResult.htmlArtifacts.counts.failed}`,
				'',
				'Agent Packs:',
				`  Created:    ${execResult.agentPacks.counts.created}`,
				`  Updated:    ${execResult.agentPacks.counts.updated}`,
				`  Skipped:    ${execResult.agentPacks.counts.skipped}`,
				`  Blocked:    ${execResult.agentPacks.counts.blocked}`,
				`  Failed:     ${execResult.agentPacks.counts.failed}`,
				'',
				`Documentation root: ${execResult.documentationRoot}`,
			];

			if (execResult.runId) {
				lines.push(`Run ID:             ${execResult.runId}`);
			}

			if (execResult.registryUpdates.created.length > 0) {
				lines.push('');
				lines.push(
					`Registry: ${execResult.registryUpdates.created.length} artifacts registered`,
				);
			}

			if (execResult.registryUpdates.failed.length > 0) {
				lines.push(
					`  Failed registrations: ${execResult.registryUpdates.failed.length}`,
				);
			}

			if (execResult.staleOrphaned.count > 0) {
				lines.push(`Stale/orphaned outputs: ${execResult.staleOrphaned.count}`);
			}

			if (execResult.changedPaths.length > 0) {
				lines.push('');
				lines.push('Changed paths:');
				for (const p of execResult.changedPaths.slice(0, 10)) {
					lines.push(`  ${p}`);
				}
			}

			lines.push('');
			for (const action of execResult.nextActions.slice(0, 5)) {
				lines.push(action);
			}

			const hasErrors =
				execResult.overallStatus === 'failed' ||
				execResult.overallStatus === 'blocked';
			const hasWarnings =
				execResult.overallStatus === 'ok_with_warnings' ||
				execResult.overallStatus === 'partial';

			return {
				command: 'generate',
				kind: hasErrors ? 'error' : hasWarnings ? 'warning' : 'success',
				messages: lines,
				shouldExit: false,
			};
		}

		return {
			command: 'generate',
			kind: 'error',
			messages: ['Unexpected result mode from unified generation.'],
			shouldExit: false,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			command: 'generate',
			kind: 'error',
			messages: ['Unified generation failed:', message],
			shouldExit: false,
		};
	}
}

async function getGenerateResult(
	args: string[],
	context: RouterContext,
): Promise<SlashCommandResult> {
	const projectRoot = context.projectContext.root.rootPath ?? undefined;
	if (!projectRoot) {
		return {
			command: 'generate',
			kind: 'error',
			messages: [
				'Cannot generate canonical documentation because no project root was detected.',
				'Run logos from a project repository or initialize a workspace first.',
			],
			shouldExit: false,
		};
	}

	const readResult = await readWorkspaceState({ projectRoot });
	if (!readResult.success || !readResult.state) {
		return {
			command: 'generate',
			kind: 'warning',
			messages: [
				'Cannot generate documentation because the LOGOS workspace is not initialized.',
				'Run /init to create a workspace, then run /generate again.',
			],
			shouldExit: false,
		};
	}

	const isConfirm = args.includes('--confirm');
	const isDryRun = args.includes('--dry-run');

	// Phase 7: Derived artifact scope flags
	const isCanonicalOnly = args.includes('--canonical-only');
	const isSkipDerived = args.includes('--skip-derived');
	const isHtmlOnly = args.includes('--html-only');
	const isAgentPackOnly = args.includes('--agent-pack-only');
	const useUnified =
		isCanonicalOnly || isSkipDerived || isHtmlOnly || isAgentPackOnly;

	let writePolicy: GenerateCanonicalDocsWritePolicy | undefined;
	const policyIdx = args.indexOf('--policy');
	if (policyIdx !== -1 && policyIdx + 1 < args.length) {
		const raw = args[policyIdx + 1] as string | undefined;
		if (raw) {
			if (
				raw === 'skip' ||
				raw === 'fail' ||
				raw === 'backup_and_write' ||
				raw === 'backup-and-write' ||
				raw === 'overwrite'
			) {
				writePolicy =
					raw === 'backup-and-write'
						? 'backup_and_write'
						: (raw as GenerateCanonicalDocsWritePolicy);
			} else {
				return {
					command: 'generate',
					kind: 'error',
					messages: [
						`Invalid write policy: "${raw}"`,
						'Valid policies: skip, fail, backup_and_write, overwrite',
					],
					shouldExit: false,
				};
			}
		}
	}

	// Phase 7: Route to unified generation when derived scope flags are specified
	if (useUnified) {
		return handleUnifiedGeneration(args, context, {
			isAgentPackOnly,
			isCanonicalOnly,
			isConfirm,
			isDryRun,
			isHtmlOnly,
			isSkipDerived,
			writePolicy,
		});
	}

	if (isDryRun) {
		try {
			const result = await generateCanonicalDocs({
				mode: 'dry_run',
				projectRoot,
				writePolicy,
			});

			if (result.mode !== 'dry_run') {
				return {
					command: 'generate',
					kind: 'error',
					messages: ['Unexpected result mode from dry-run generation.'],
					shouldExit: false,
				};
			}

			const lines: string[] = [
				'Generation dry-run report',
				'',
				`Profile:            ${result.profileId}`,
				`Documentation root: ${result.documentationRoot}`,
				`Write policy:       ${result.writePolicy}`,
				'',
				'Planned actions:',
				`  Generate:   ${result.documentCounts.generate}`,
				`  Update:     ${result.documentCounts.update}`,
				`  Skip:       ${result.documentCounts.skip}`,
				`  Incomplete: ${result.documentCounts.incomplete}`,
				`  Blocked:    ${result.documentCounts.blocked}`,
				`  Failed:     ${result.documentCounts.failed}`,
				`  Stale:      ${result.documentCounts.stale}`,
				'',
				'Write plan:',
				`  Created:   ${result.writePlanSummary.created}`,
				`  Updated:   ${result.writePlanSummary.updated}`,
				`  Skipped:   ${result.writePlanSummary.skipped}`,
				`  Collisions: ${result.writePlanSummary.collisions}`,
				`  Failed:    ${result.writePlanSummary.failed}`,
				'',
			];

			if (result.collisionPaths.length > 0) {
				lines.push('Collisions (manual edits detected):');
				for (const p of result.collisionPaths.slice(0, 10)) {
					lines.push(`  ${p}`);
				}
				if (result.collisionPaths.length > 10) {
					lines.push(`  ... and ${result.collisionPaths.length - 10} more`);
				}
				lines.push('');
			}

			if (result.targetPaths.length > 0) {
				lines.push('Target paths:');
				for (const p of result.targetPaths.slice(0, 10)) {
					lines.push(`  ${p}`);
				}
				if (result.targetPaths.length > 10) {
					lines.push(`  ... and ${result.targetPaths.length - 10} more`);
				}
				lines.push('');
			}

			lines.push('(dry-run: no files were written)');
			lines.push('Run /generate --confirm to execute.');

			return {
				command: 'generate',
				kind: 'info',
				messages: lines,
				shouldExit: false,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				command: 'generate',
				kind: 'error',
				messages: ['Generation failed:', message],
				shouldExit: false,
			};
		}
	}

	if (isConfirm) {
		try {
			const result = await generateCanonicalDocs({
				mode: 'execute',
				projectRoot,
				writePolicy,
			});

			if (result.mode !== 'execute') {
				return {
					command: 'generate',
					kind: 'error',
					messages: ['Unexpected result mode from generation execution.'],
					shouldExit: false,
				};
			}

			const lines: string[] = [
				'Generation complete',
				'',
				'Outcomes:',
				`  Created:    ${result.createdPaths.length}`,
				`  Updated:    ${result.updatedPaths.length}`,
				`  Skipped:    ${result.skippedPaths.length}`,
				`  Incomplete: ${result.incompleteDocumentIds.length}`,
				`  Blocked:    ${result.blockedDocumentIds.length}`,
				`  Failed:     ${result.failedDocumentIds.length}`,
				`  Stale:      ${result.staleDocumentIds.length}`,
				`  Collisions: ${result.collisionPaths.length}`,
				'',
				`Documentation root: ${result.documentationRoot}`,
				`Run ID:             ${result.runId}`,
				'',
			];

			if (result.changedPaths.length > 0) {
				lines.push('Changed paths:');
				for (const p of result.changedPaths.slice(0, 10)) {
					lines.push(`  ${p}`);
				}
				if (result.changedPaths.length > 10) {
					lines.push(`  ... and ${result.changedPaths.length - 10} more`);
				}
				lines.push('');
			}

			if (result.collisionPaths.length > 0) {
				lines.push('Collisions (manual edits were protected):');
				for (const p of result.collisionPaths.slice(0, 10)) {
					lines.push(`  ${p}`);
				}
				lines.push('');
			}

			lines.push('Next: Run /status to review updated state.');
			lines.push('Future: Run /validate (Phase 6) to check generated output.');

			const hasErrors =
				result.collisionPaths.length > 0 ||
				result.diagnostics.some((d) => d.severity === 'error');
			const hasWarnings = result.diagnostics.some(
				(d) => d.severity === 'warning',
			);

			return {
				command: 'generate',
				kind: hasErrors ? 'error' : hasWarnings ? 'warning' : 'success',
				messages: lines,
				shouldExit: false,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				command: 'generate',
				kind: 'error',
				messages: ['Generation failed:', message],
				shouldExit: false,
			};
		}
	}

	// Default: show preflight, optionally with keyboard confirmation
	try {
		const preflight = await generateCanonicalDocs({
			mode: 'preflight',
			projectRoot,
			writePolicy,
		});

		if (preflight.mode !== 'preflight') {
			return {
				command: 'generate',
				kind: 'error',
				messages: ['Unexpected result mode from generation preflight.'],
				shouldExit: false,
			};
		}

		const baseLines: string[] = [
			'Generation preflight',
			'',
			`Profile:            ${preflight.profileId}`,
			`Documentation root: ${preflight.documentationRoot}`,
			'',
			'Planned actions:',
			`  Generate:   ${preflight.documentCounts.generate}`,
			`  Update:     ${preflight.documentCounts.update}`,
			`  Skip:       ${preflight.documentCounts.skip}`,
			`  Incomplete: ${preflight.documentCounts.incomplete}`,
			`  Blocked:    ${preflight.documentCounts.blocked}`,
			`  Failed:     ${preflight.documentCounts.failed}`,
			`  Stale:      ${preflight.documentCounts.stale}`,
			'',
		];

		if (preflight.collisionPaths.length > 0) {
			baseLines.push('Manual edits detected (will be protected):');
			for (const p of preflight.collisionPaths.slice(0, 5)) {
				baseLines.push(`  ${p}`);
			}
			if (preflight.collisionPaths.length > 5) {
				baseLines.push(`  ... and ${preflight.collisionPaths.length - 5} more`);
			}
			baseLines.push('');
		}

		if (preflight.targetPaths.length > 0) {
			baseLines.push('Target paths:');
			for (const p of preflight.targetPaths.slice(0, 10)) {
				baseLines.push(`  ${p}`);
			}
			if (preflight.targetPaths.length > 10) {
				baseLines.push(`  ... and ${preflight.targetPaths.length - 10} more`);
			}
			baseLines.push('');
		}

		// Interactive keyboard confirmation
		if (shouldUseKeyboardConfirmation(context)) {
			const sourceCmd = ['/generate'];
			if (writePolicy) sourceCmd.push('--policy', writePolicy);

			const confirmationRequest = createTuiConfirmationRequest({
				actionKind: 'canonical_generation',
				alternatives: [
					'Run /generate --dry-run first.',
					'Use a different write policy.',
				],
				consequences: [
					`Profile: ${preflight.profileId}`,
					`Documentation root: ${preflight.documentationRoot}`,
					`Files to generate: ${preflight.documentCounts.generate}`,
					`Files to update: ${preflight.documentCounts.update}`,
					...(preflight.collisionPaths.length > 0
						? [
								`Manual edits detected in ${preflight.collisionPaths.length} file(s) — they will be protected.`,
							]
						: []),
				],
				destructive: false,
				message:
					'Markdown documents will be written under the documentation root.',
				options: yesNoOptions(),
				sensitive: false,
				sourceCommand: sourceCmd.join(' '),
				target: {
					kind: 'documentation_root',
					path: preflight.documentationRoot,
				},
				title: 'Generate Canonical Documentation',
			});

			baseLines.push('Use the keyboard to accept or cancel below.');

			return {
				command: 'generate',
				confirmationRequest,
				kind: 'info',
				messages: baseLines,
				shouldExit: false,
			};
		}

		// Non-interactive: standard text prompt
		baseLines.push('No files have been written.');
		baseLines.push('Run /generate --confirm to execute generation.');
		baseLines.push('Run /generate --dry-run for a detailed dry-run report.');
		baseLines.push(
			'Supported policies: skip, fail, backup_and_write, overwrite',
		);
		baseLines.push(
			'  Use /generate --policy backup_and_write --confirm to backup before overwrite.',
		);

		const hasWarnings =
			preflight.documentCounts.blocked > 0 ||
			preflight.documentCounts.failed > 0 ||
			preflight.collisionPaths.length > 0;

		return {
			command: 'generate',
			kind: hasWarnings ? 'warning' : 'info',
			messages: baseLines,
			shouldExit: false,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			command: 'generate',
			kind: 'error',
			messages: ['Generation preflight failed:', message],
			shouldExit: false,
		};
	}
}
async function getValidateResult(
	args: string[],
	context: RouterContext,
): Promise<SlashCommandResult> {
	const projectRoot = context.projectContext.root.rootPath ?? undefined;
	if (!projectRoot) {
		return {
			command: 'validate',
			kind: 'error',
			messages: [
				'Cannot run validation because no project root was detected.',
				'Run logos from a project repository or initialize a workspace first.',
			],
			shouldExit: false,
		};
	}

	const isDryRun = args.includes('--dry-run');
	let scopeArg: string | undefined;
	const scopeIdx = args.indexOf('--scope');
	if (scopeIdx !== -1 && scopeIdx + 1 < args.length) {
		scopeArg = args[scopeIdx + 1];
	}

	const scopes: string[] | undefined = scopeArg ? [scopeArg] : undefined;

	try {
		const result = await runValidateCommand({
			mode: isDryRun ? 'dry_run' : 'execute',
			projectRoot,
			scopes: scopes as
				| ('contracts' | 'state' | 'artifacts' | 'outputs' | 'all')[]
				| undefined,
		});

		if (result.status === 'error') {
			const lines: string[] = [];
			for (const e of result.errors) {
				lines.push(`[${e.severity.toUpperCase()}] ${e.message}`);
				if (e.recoveryHint) lines.push(`  Recovery: ${e.recoveryHint}`);
			}
			return {
				command: 'validate',
				kind: 'error',
				messages: lines,
				shouldExit: false,
			};
		}

		const data = result.data;
		const lines: string[] = [];

		lines.push(`Gate Status: ${data.gateStatus.toUpperCase()}`);
		lines.push('');
		lines.push(`Findings: ${data.findingCounts.total} total`);
		lines.push(`  Fatal:    ${data.findingCounts.fatal}`);
		lines.push(`  Errors:   ${data.findingCounts.error}`);
		lines.push(`  Warnings: ${data.findingCounts.warning}`);
		lines.push(`  Info:     ${data.findingCounts.info}`);
		lines.push('');

		if (data.topFindings.length > 0) {
			lines.push('Top findings:');
			for (const f of data.topFindings.slice(0, 10)) {
				lines.push(`  [${f.severity.toUpperCase()}] ${f.message}`);
				if (f.path) lines.push(`    Path: ${f.path}`);
			}
			if (data.topFindings.length > 10) {
				lines.push(`  ... and ${data.topFindings.length - 10} more`);
			}
			lines.push('');
		}

		if (data.reportPath) {
			lines.push(`Report: ${data.reportPath}`);
			if (data.reportId) lines.push(`Report ID: ${data.reportId}`);
			if (data.runId) lines.push(`Run ID: ${data.runId}`);
			lines.push('');
		}

		if (data.changedPaths.length > 0) {
			lines.push('Changed paths:');
			for (const p of data.changedPaths.slice(0, 5)) {
				lines.push(`  ${p}`);
			}
			if (data.changedPaths.length > 5) {
				lines.push(`  ... and ${data.changedPaths.length - 5} more`);
			}
			lines.push('');
		}

		if (data.recoveryHints.length > 0) {
			lines.push('Recovery hints:');
			for (const hint of data.recoveryHints.slice(0, 5)) {
				lines.push(`  - ${hint}`);
			}
			lines.push('');
		}

		if (isDryRun) {
			lines.push('(dry-run: no files were written)');
		} else if (!data.reportPath) {
			lines.push('(report generation was skipped)');
		}

		lines.push('');
		lines.push('Next: Run /diagnose for analysis or /status to review state.');

		return {
			command: 'validate',
			kind:
				data.gateStatus === 'fail'
					? 'warning'
					: data.gateStatus === 'pass_with_warnings'
						? 'warning'
						: 'success',
			messages: lines,
			shouldExit: false,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			command: 'validate',
			kind: 'error',
			messages: ['Validation failed:', message],
			shouldExit: false,
		};
	}
}

async function getDiagnoseResult(
	args: string[],
	context: RouterContext,
): Promise<SlashCommandResult> {
	const projectRoot = context.projectContext.root.rootPath ?? undefined;
	if (!projectRoot) {
		return {
			command: 'diagnose',
			kind: 'error',
			messages: [
				'Cannot run diagnosis because no project root was detected.',
				'Run logos from a project repository or initialize a workspace first.',
			],
			shouldExit: false,
		};
	}

	const isDryRun = args.includes('--dry-run');

	try {
		const result = await runDiagnoseCommand({
			mode: isDryRun ? 'dry_run' : 'execute',
			projectRoot,
		});

		if (result.status === 'error') {
			const lines: string[] = [];
			for (const e of result.errors) {
				lines.push(`[${e.severity.toUpperCase()}] ${e.message}`);
				if (e.recoveryHint) lines.push(`  Recovery: ${e.recoveryHint}`);
			}
			return {
				command: 'diagnose',
				kind: 'error',
				messages: lines,
				shouldExit: false,
			};
		}

		const data = result.data;
		const lines: string[] = [];

		lines.push(`Gate Status: ${data.gateStatus.toUpperCase()}`);
		lines.push(`Interpretation: ${data.interpretationSource}`);
		if (data.fallbackReason) {
			lines.push(`  Fallback reason: ${data.fallbackReason}`);
		}
		lines.push('');
		lines.push(`Findings: ${data.findingCounts.total} total`);
		lines.push(`  Fatal:    ${data.findingCounts.fatal}`);
		lines.push(`  Errors:   ${data.findingCounts.error}`);
		lines.push(`  Warnings: ${data.findingCounts.warning}`);
		lines.push(`  Info:     ${data.findingCounts.info}`);
		lines.push('');

		if (data.explanations.length > 0) {
			lines.push('Explanation:');
			for (const exp of data.explanations.slice(0, 5)) {
				lines.push(`  ${exp.text}`);
			}
			if (data.explanations.length > 5) {
				lines.push(`  ... and ${data.explanations.length - 5} more`);
			}
			lines.push('');
		}

		if (data.groupedFindings.length > 0) {
			lines.push('Finding groups:');
			for (const group of data.groupedFindings.slice(0, 5)) {
				lines.push(`  ${group.label}: ${group.reason}`);
			}
			if (data.groupedFindings.length > 5) {
				lines.push(`  ... and ${data.groupedFindings.length - 5} more`);
			}
			lines.push('');
		}

		if (data.suggestedActions.length > 0) {
			lines.push('Suggested actions:');
			for (const action of data.suggestedActions.slice(0, 7)) {
				lines.push(
					`  [${action.priority.toUpperCase()}] [${action.category}] ${action.text}`,
				);
			}
			if (data.suggestedActions.length > 7) {
				lines.push(`  ... and ${data.suggestedActions.length - 7} more`);
			}
			lines.push('');
		}

		if (data.reportPath) {
			lines.push(`Report: ${data.reportPath}`);
			if (data.reportId) lines.push(`Report ID: ${data.reportId}`);
			if (data.runId) lines.push(`Run ID: ${data.runId}`);
			lines.push('');
		}

		if (data.changedPaths.length > 0) {
			lines.push('Changed paths:');
			for (const p of data.changedPaths.slice(0, 5)) {
				lines.push(`  ${p}`);
			}
			if (data.changedPaths.length > 5) {
				lines.push(`  ... and ${data.changedPaths.length - 5} more`);
			}
			lines.push('');
		}

		if (data.interpretationSource !== 'deterministic') {
			lines.push(
				'Note: AI interpretation is explanatory only and does not alter deterministic findings, severity, or gate status.',
			);
			lines.push('');
		}

		if (isDryRun) {
			lines.push('(dry-run: no files were written)');
		} else if (!data.reportPath) {
			lines.push('(report generation was skipped)');
		}

		lines.push('');
		lines.push(
			'Next: Run /validate for raw findings or /status to review state.',
		);

		return {
			command: 'diagnose',
			kind:
				data.gateStatus === 'fail'
					? 'warning'
					: data.gateStatus === 'pass_with_warnings'
						? 'warning'
						: 'success',
			messages: lines,
			shouldExit: false,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			command: 'diagnose',
			kind: 'error',
			messages: ['Diagnosis failed:', message],
			shouldExit: false,
		};
	}
}

async function getStatusResult(
	context: RouterContext,
): Promise<SlashCommandResult> {
	const ctx = context.projectContext;
	const projectRoot = ctx.root.rootPath ?? ctx.cwd;

	// Attempt staleness detection (read-only, best-effort)
	let stalenessResult:
		| {
				currentCount: number;
				staleCount: number;
				missingCount: number;
				blockedCount: number;
				orphanedCount: number;
				unknownCount: number;
				total: number;
				optionalDependencyWarningCount: number;
				topStaleReasons: string[];
				topBlockingReasons: string[];
		  }
		| undefined;

	let graphSummary:
		| {
				phaseCount: number;
				documentCount: number;
				outputCount: number;
				edgeCount: number;
		  }
		| undefined;

	try {
		const readResult = await readWorkspaceState({ projectRoot });
		if (readResult.success && readResult.state) {
			const state = readResult.state;
			const contract = await loadDocumentationContract({
				profileId: state.profile.profileId,
				repoRoot: projectRoot,
			});

			const registry = await loadProfileRegistry({
				profileId: state.profile.profileId,
				repoRoot: projectRoot,
			});

			const graphResult = buildDocumentDependencyGraph({
				contract,
				registry,
			});

			graphSummary = {
				documentCount: graphResult.graph.nodes.filter(
					(n) => n.kind === 'document',
				).length,
				edgeCount: graphResult.graph.edges.length,
				outputCount: graphResult.graph.nodes.filter(
					(n) =>
						n.kind === 'canonical_output' ||
						n.kind === 'html_artifact' ||
						n.kind === 'agent_pack' ||
						n.kind === 'data_artifact' ||
						n.kind === 'report_artifact' ||
						n.kind === 'executive_output' ||
						n.kind === 'executive_json' ||
						n.kind === 'executive_markdown' ||
						n.kind === 'executive_html',
				).length,
				phaseCount: graphResult.graph.nodes.filter((n) => n.kind === 'phase')
					.length,
			};

			const detection = await detectStaleness({
				artifactRegistryEntries: state.artifacts.map((a) => ({
					artifactId: a.artifactId,
					artifactType: a.artifactType,
					checksum: a.checksum,
					generatedAt: a.generatedAt,
					isCanonical: a.isCanonical,
					metadata: a.metadata,
					path: a.path,
					runId: a.runId,
					sourceDocumentIds: a.sourceDocumentIds,
					status: a.status,
				})),
				assumptions: state.assumptions.map((a) => ({
					affectedDocumentIds: a.affectedDocumentIds,
					body: a.body,
					createdAt: a.createdAt,
					id: a.id,
					status: a.status,
					title: a.title,
					updatedAt: a.updatedAt,
				})),
				decisions: state.decisions.map((d) => ({
					affectedDocumentIds: d.affectedDocumentIds,
					body: d.body,
					createdAt: d.createdAt,
					id: d.id,
					status: d.status,
					title: d.title,
					updatedAt: d.updatedAt,
				})),
				dependencyGraph: {
					edges: graphResult.graph.edges,
					nodeMap: graphResult.graph.nodeMap,
					nodes: graphResult.graph.nodes,
					upstreamEdges: graphResult.graph.upstreamEdges,
				},
				documentationRoot: state.documentation.rootPath,
				generatedMetadataOverrides: new Map(),
				generationRuns: state.runs
					.filter(
						(r) => r.runType === 'generation' || r.runType === 'executive',
					)
					.map((r) => ({
						completedAt: r.completedAt,
						relatedArtifactIds: r.relatedArtifactIds,
						runId: r.runId,
						startedAt: r.startedAt,
						status: r.status,
					})),
				loadedDescriptorData: new Map(
					contract.documents.map((doc) => [
						doc.canonicalId,
						{
							canonicalOutput: doc.descriptor.outputs.canonical.path,
							inputs: (doc.descriptor.inputs ?? []).map((i) => ({
								id: i.id,
								required: i.required,
								type: i.type,
							})),
							outputs: flattenDescriptorOutputs(doc.descriptor.outputs),
							phaseId: doc.phaseId,
							status: doc.descriptor.status,
							title: doc.descriptor.title,
						},
					]),
				),
				openQuestions: state.openQuestions.map((q) => ({
					affectedDocumentIds: q.affectedDocumentIds,
					body: q.body,
					createdAt: q.createdAt,
					id: q.id,
					question: q.question,
					status: q.status,
					updatedAt: q.updatedAt,
				})),
				phaseDescriptors: contract.phases.map((p) => ({
					id: p.id,
					sourcePath: p.sourcePath,
					title: p.title,
				})),
				profileId: state.profile.profileId,
				profileRegistryFingerprint: '',
				profileRoot: contract.profileRoot,
				profileVersion: state.profile.profileVersion,
				risks: state.risks.map((r) => ({
					affectedDocumentIds: r.affectedDocumentIds,
					body: r.body,
					createdAt: r.createdAt,
					id: r.id,
					severity: r.severity,
					status: r.status,
					title: r.title,
					updatedAt: r.updatedAt,
				})),
			});

			stalenessResult = {
				blockedCount: detection.summary.blockedCount,
				currentCount: detection.summary.currentCount,
				missingCount: detection.summary.missingCount,
				optionalDependencyWarningCount:
					detection.summary.optionalDependencyWarningCount,
				orphanedCount: detection.summary.orphanedCount,
				staleCount: detection.summary.staleCount,
				topBlockingReasons: [...detection.summary.topBlockingReasons],
				topStaleReasons: [...detection.summary.topStaleReasons],
				total: detection.summary.total,
				unknownCount: detection.summary.unknownCount,
			};
		}
	} catch {
		stalenessResult = undefined;
	}

	// Attempt state-backed summary
	let summary:
		| Awaited<ReturnType<typeof getWorkspaceStatusSummary>>
		| undefined;
	try {
		summary = await getWorkspaceStatusSummary({ projectRoot }, stalenessResult);
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

		// Staleness summary
		if (summary.stalenessSummary && summary.stalenessSummary.total > 0) {
			const s = summary.stalenessSummary;
			lines.push('');
			lines.push('Staleness:');
			lines.push(`  Total outputs:    ${s.total}`);
			lines.push(`  Current:          ${s.currentCount}`);
			lines.push(`  Stale:            ${s.staleCount}`);
			lines.push(`  Missing:          ${s.missingCount}`);
			lines.push(`  Blocked:          ${s.blockedCount}`);
			lines.push(`  Orphaned:         ${s.orphanedCount}`);
			lines.push(`  Unknown:          ${s.unknownCount}`);
			if (s.optionalDependencyWarningCount > 0) {
				lines.push(
					`  Optional dep warnings: ${s.optionalDependencyWarningCount}`,
				);
			}
			if (s.topStaleReasons.length > 0) {
				lines.push('  Top stale reasons:');
				for (const r of s.topStaleReasons.slice(0, 3)) {
					lines.push(`    - ${r}`);
				}
			}
			if (s.topBlockingReasons.length > 0) {
				lines.push('  Top blocking reasons:');
				for (const r of s.topBlockingReasons.slice(0, 3)) {
					lines.push(`    - ${r}`);
				}
			}
		} else if (summary.stalenessSummary?.total === 0) {
			lines.push('');
			lines.push('Staleness:  (no generated outputs exist yet)');
		}

		// Register summary (Step 8.2)
		if (summary.registerSummary) {
			const rs = summary.registerSummary;
			lines.push('');
			lines.push('Register summary:');
			lines.push(
				`  Decisions:      ${rs.decisions.total} (${formatCounts(rs.decisions.byStatus)})`,
			);
			lines.push(
				`  Assumptions:    ${rs.assumptions.total} (${formatCounts(rs.assumptions.byStatus)})`,
			);
			lines.push(
				`  Hypotheses:     ${rs.hypotheses.total} (${formatCounts(rs.hypotheses.byStatus)})`,
			);
			lines.push(
				`  Risks:          ${rs.risks.total} (${formatCounts(rs.risks.byStatus)})`,
			);
			lines.push(
				`  Open Questions: ${rs.openQuestions.total} (${formatCounts(rs.openQuestions.byStatus)})`,
			);
			lines.push(`  Blocking open:  ${rs.blockingOpenQuestions}`);
			lines.push(`  Unresolved:     ${rs.unresolvedOpenQuestions}`);
			lines.push(`  Review req'd:   ${rs.reviewRequired}`);
		}

		// Compact graph summary (always when graph was built)
		if (graphSummary) {
			lines.push('');
			lines.push('Graph summary:');
			lines.push(`  Phases:     ${graphSummary.phaseCount}`);
			lines.push(`  Documents:  ${graphSummary.documentCount}`);
			lines.push(`  Outputs:    ${graphSummary.outputCount}`);
			lines.push(`  Edges:      ${graphSummary.edgeCount}`);
		}

		// Executive readiness summary (Step 11.1 — concise, read-only)
		if (summary.registerSummary) {
			const rs = summary.registerSummary;
			lines.push('');
			lines.push('Executive readiness:');
			lines.push(
				'  /executive compile runs the readiness gate before compiling.',
			);
			lines.push(
				'  Default execution is a preflight; use --confirm to write outputs.',
			);
			lines.push(`  Blocking open questions: ${rs.blockingOpenQuestions}`);
			if (stalenessResult) {
				lines.push(`  Stale normative outputs:  ${stalenessResult.staleCount}`);
				lines.push(
					`  Missing normative outputs: ${stalenessResult.missingCount}`,
				);
				lines.push(
					`  Blocked outputs:          ${stalenessResult.blockedCount}`,
				);
			}
		}
	}

	function formatCounts(byStatus: Record<string, number>): string {
		return Object.entries(byStatus)
			.map(([k, v]) => `${k}:${v}`)
			.join(', ');
	}

	// AI Provider status (read-only, no state mutation)
	{
		const providerResult = await getAiProviderStatus({ projectRoot });
		if (providerResult.success) {
			const pc = providerResult.config;
			lines.push('');
			lines.push('AI Provider:');
			lines.push(`  Mode:              ${pc.mode}`);
			lines.push(`  Provider ID:       ${pc.providerId ?? '(none)'}`);
			lines.push(`  Model ID:          ${pc.modelId ?? '(none)'}`);
			lines.push(
				`  Endpoint origin:   ${pc.endpoint ? pc.endpoint.replace(/[?#].*$/, '').slice(0, 60) : '(none)'}`,
			);
			lines.push(
				`  Token env var:     ${pc.tokenEnvVar ? `$${pc.tokenEnvVar} (configured)` : '(not set)'}`,
			);
			lines.push(
				`  Timeout:           ${pc.timeoutMs}ms (${pc.timeoutMs / 1000}s)`,
			);
			if (pc.mode === 'remote') {
				lines.push(
					`  Disclosure:        ${pc.disclosure.accepted ? 'accepted' : pc.disclosure.declinedAt ? 'declined' : 'required'}`,
				);
			}
			if (pc.lastTest && pc.lastTest.status !== 'never_run') {
				lines.push(
					`  Last test:         ${pc.lastTest.status} (${pc.lastTest.testedAt ?? 'unknown'})`,
				);
			}
			if (pc.mode === 'no_provider' || pc.mode === 'disabled') {
				lines.push(
					'  Recovery:          Run /config ai to set up an AI provider.',
				);
			} else if (pc.mode === 'remote' && !pc.disclosure.accepted) {
				lines.push(
					'  Recovery:          Run /config ai disclosure accept to enable remote execution.',
				);
			}
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

async function getGraphResult(
	args: string[],
	context: RouterContext,
): Promise<SlashCommandResult> {
	const ctx = context.projectContext;
	const projectRoot = ctx.root.rootPath ?? ctx.cwd;

	const useJson = args.includes('--json');
	const phaseFilter = extractFlagValue(args, '--phase');
	const docFilter = extractFlagValue(args, '--doc');
	const modeFlag = extractFlagValue(args, '--mode');

	const renderMode = (() => {
		switch (modeFlag) {
			case 'summary':
			case 'phase_tree':
			case 'document_dependencies':
			case 'outputs':
			case 'staleness':
			case 'regeneration':
			case 'full':
				return modeFlag;
			default:
				return 'summary';
		}
	})();

	try {
		const readResult = await readWorkspaceState({ projectRoot });

		let _graphTried = false;
		let graphError: string | undefined;

		// Try to build graph from workspace
		if (readResult.success && readResult.state) {
			try {
				const state = readResult.state;
				const contract = await loadDocumentationContract({
					profileId: state.profile.profileId,
					repoRoot: projectRoot,
				});

				const registry = await loadProfileRegistry({
					profileId: state.profile.profileId,
					repoRoot: projectRoot,
				});

				const graphResult = buildDocumentDependencyGraph({
					contract,
					registry,
				});

				let stalenessResult:
					| Awaited<ReturnType<typeof detectStaleness>>
					| undefined;

				try {
					stalenessResult = await detectStaleness({
						artifactRegistryEntries: state.artifacts.map((a) => ({
							artifactId: a.artifactId,
							artifactType: a.artifactType,
							checksum: a.checksum,
							generatedAt: a.generatedAt,
							isCanonical: a.isCanonical,
							metadata: a.metadata,
							path: a.path,
							runId: a.runId,
							sourceDocumentIds: a.sourceDocumentIds,
							status: a.status,
						})),
						assumptions: state.assumptions.map((a) => ({
							affectedDocumentIds: a.affectedDocumentIds,
							body: a.body,
							createdAt: a.createdAt,
							id: a.id,
							status: a.status,
							title: a.title,
							updatedAt: a.updatedAt,
						})),
						decisions: state.decisions.map((d) => ({
							affectedDocumentIds: d.affectedDocumentIds,
							body: d.body,
							createdAt: d.createdAt,
							id: d.id,
							status: d.status,
							title: d.title,
							updatedAt: d.updatedAt,
						})),
						dependencyGraph: {
							edges: graphResult.graph.edges,
							nodeMap: graphResult.graph.nodeMap,
							nodes: graphResult.graph.nodes,
							upstreamEdges: graphResult.graph.upstreamEdges,
						},
						documentationRoot: state.documentation.rootPath,
						generatedMetadataOverrides: new Map(),
						generationRuns: state.runs
							.filter(
								(r) => r.runType === 'generation' || r.runType === 'executive',
							)
							.map((r) => ({
								completedAt: r.completedAt,
								relatedArtifactIds: r.relatedArtifactIds,
								runId: r.runId,
								startedAt: r.startedAt,
								status: r.status,
							})),
						loadedDescriptorData: new Map(
							contract.documents.map((doc) => [
								doc.canonicalId,
								{
									canonicalOutput: doc.descriptor.outputs.canonical.path,
									inputs: (doc.descriptor.inputs ?? []).map((i) => ({
										id: i.id,
										required: i.required,
										type: i.type,
									})),
									outputs: flattenDescriptorOutputs(doc.descriptor.outputs),
									phaseId: doc.phaseId,
									status: doc.descriptor.status,
									title: doc.descriptor.title,
								},
							]),
						),
						openQuestions: state.openQuestions.map((q) => ({
							affectedDocumentIds: q.affectedDocumentIds,
							body: q.body,
							createdAt: q.createdAt,
							id: q.id,
							question: q.question,
							status: q.status,
							updatedAt: q.updatedAt,
						})),
						phaseDescriptors: contract.phases.map((p) => ({
							id: p.id,
							sourcePath: p.sourcePath,
							title: p.title,
						})),
						profileId: state.profile.profileId,
						profileRegistryFingerprint: '',
						profileRoot: contract.profileRoot,
						profileVersion: state.profile.profileVersion,
						risks: state.risks.map((r) => ({
							affectedDocumentIds: r.affectedDocumentIds,
							body: r.body,
							createdAt: r.createdAt,
							id: r.id,
							severity: r.severity,
							status: r.status,
							title: r.title,
							updatedAt: r.updatedAt,
						})),
					});
				} catch {
					stalenessResult = undefined;
				}

				_graphTried = true;

				const output = createInspectableGraphOutput(
					{ graph: graphResult.graph, stalenessResult },
					{
						filter: {
							documentId: docFilter ?? undefined,
							phaseId: phaseFilter ?? undefined,
						},
						format: useJson ? 'json' : 'text',
						mode: renderMode,
					},
				);

				const resultText =
					useJson && output.jsonOutput
						? output.jsonOutput
						: (output.textOutput ?? '');

				return {
					command: 'graph',
					kind: 'success',
					messages: resultText.split('\n').filter((line) => line !== ''),
					shouldExit: false,
				};
			} catch (err) {
				graphError =
					err instanceof Error ? err.message : 'Unknown graph build error';
			}
		}

		// Fallback: try to build graph from profile contract (no workspace)
		try {
			const profileId = ctx.config.activeProfileId ?? 'standard';
			const contract = await loadDocumentationContract({
				profileId,
				repoRoot: projectRoot,
			});
			const registry = await loadProfileRegistry({
				profileId,
				repoRoot: projectRoot,
			});
			const graphResult = buildDocumentDependencyGraph({ contract, registry });

			const output = createInspectableGraphOutput(
				{ graph: graphResult.graph },
				{
					filter: {
						documentId: docFilter ?? undefined,
						phaseId: phaseFilter ?? undefined,
					},
					format: useJson ? 'json' : 'text',
					mode: renderMode,
				},
			);

			const resultText =
				useJson && output.jsonOutput
					? output.jsonOutput
					: (output.textOutput ?? '');

			return {
				command: 'graph',
				kind: 'success',
				messages: resultText.split('\n').filter((line) => line !== ''),
				shouldExit: false,
			};
		} catch (err) {
			const fallbackError =
				err instanceof Error ? err.message : 'Unknown error';
			return {
				command: 'graph',
				kind: 'error',
				messages: [
					'Failed to build dependency graph:',
					graphError ? `  Workspace: ${graphError}` : undefined,
					`  Profile contract: ${fallbackError}`,
					'Ensure you are in a repository with a valid profile, or run /init first.',
				].filter(Boolean) as string[],
				shouldExit: false,
			};
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return {
			command: 'graph',
			kind: 'error',
			messages: ['Graph output failed:', message],
			shouldExit: false,
		};
	}
}

// ---------------------------------------------------------------------------
// Root configuration handler
// ---------------------------------------------------------------------------

async function getRootResult(
	args: string[],
	context: RouterContext,
): Promise<SlashCommandResult> {
	const projectRoot = context.projectContext.root.rootPath ?? undefined;

	if (!projectRoot) {
		return {
			command: 'root',
			kind: 'error',
			messages: [
				'Cannot configure documentation root because no project root was detected.',
				'Run logos from a project repository or initialize a workspace first.',
			],
			shouldExit: false,
			viewKind: 'recovery' as TuiViewKind,
		};
	}

	const subcommand = args[0];
	const isDryRun = args.includes('--dry-run');
	const isConfirm = args.includes('--confirm');

	// /root or /root status — show current root status
	if (!subcommand || subcommand === 'status') {
		try {
			const status = await getDocumentationRootStatus({ projectRoot });

			const lines: string[] = [
				'Documentation Root Configuration',
				'',
				'Current root:',
				`  Path:              ${status.root.safeDisplayPath}`,
				`  Kind:              ${status.root.kind}`,
				`  Explicitly set:    ${status.root.wasExplicitlyConfigured ? 'yes' : 'no'}`,
				`  Inside project:    ${status.root.insideProjectRoot ? 'yes' : 'no'}`,
				`  Exists:            ${status.root.exists ? 'yes' : 'no'}`,
				`  Empty:             ${status.root.isEmpty ? 'yes' : 'no'}`,
				`  Health:            ${status.health}`,
			];

			if (status.staleOutputCount > 0 || status.orphanedOutputCount > 0) {
				lines.push('');
				lines.push(`  Stale outputs:     ${status.staleOutputCount}`);
				lines.push(`  Orphaned outputs:  ${status.orphanedOutputCount}`);
			}

			if (status.recoveryHint) {
				lines.push('');
				lines.push(`  Recovery hint: ${status.recoveryHint}`);
			}

			lines.push('');
			lines.push('Available commands:');
			lines.push(
				'  /root status                — Show current root configuration',
			);
			lines.push(
				'  /root preview <path>        — Preview a root change (read-only)',
			);
			lines.push(
				'  /root set <path>            — Change documentation root (requires confirmation)',
			);
			lines.push(
				'  /root set <path> --dry-run  — Preview root change without applying',
			);
			lines.push(
				'  /root reset                 — Reset to default logos/ (requires confirmation)',
			);
			lines.push('  /root reset --dry-run       — Preview reset to default');
			lines.push('');
			lines.push(
				'The documentation root is where LOGOS writes canonical Markdown, HTML artifacts,',
			);
			lines.push('agent packs, reports, and Executive outputs.');

			return {
				command: 'root',
				kind: 'info',
				messages: lines,
				shouldExit: false,
				viewKind: 'root_config' as TuiViewKind,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				command: 'root',
				kind: 'error',
				messages: ['Failed to get root status:', message],
				shouldExit: false,
				viewKind: 'recovery' as TuiViewKind,
			};
		}
	}

	// /root preview <path>
	if (subcommand === 'preview') {
		const targetPath = args[1];
		if (!targetPath) {
			return {
				command: 'root',
				kind: 'error',
				messages: [
					'Usage: /root preview <path>',
					'Please provide a target path to preview.',
				],
				shouldExit: false,
				viewKind: 'root_config' as TuiViewKind,
			};
		}

		try {
			const preview = await previewRootChange({
				projectRoot,
				proposedPath: targetPath,
			});

			const lines: string[] = [
				'Root Change Preview',
				'',
				'Current root:',
				`  Path:      ${preview.current.safeDisplayPath}`,
				`  Kind:      ${preview.current.kind}`,
				`  Exists:    ${preview.current.exists ? 'yes' : 'no'}`,
				'',
				'Proposed root:',
				`  Path:      ${preview.proposed.safeDisplayPath}`,
				`  Kind:      ${preview.proposed.kind}`,
				`  Exists:    ${preview.proposed.exists ? 'yes' : 'no'}`,
				`  Empty:     ${preview.proposed.isEmpty ? 'yes' : 'no'}`,
				`  Inside:    ${preview.proposed.insideProjectRoot ? 'yes' : 'no'}`,
				'',
				`Health:      ${preview.health}`,
				`Safe:        ${preview.safety.safe ? 'yes' : 'no'}`,
			];

			// Safety checks
			if (preview.safety.checks.length > 0) {
				const failed = preview.safety.checks.filter((c) => !c.passed);
				if (failed.length > 0) {
					lines.push('');
					lines.push('Safety checks:');
					for (const check of failed) {
						lines.push(`  [${check.severity.toUpperCase()}] ${check.message}`);
						if (check.recoveryHint) {
							lines.push(`    Recovery: ${check.recoveryHint}`);
						}
					}
				}
			}

			// Collisions
			if (preview.collisions.length > 0) {
				lines.push('');
				lines.push('Collisions detected:');
				for (const collision of preview.collisions) {
					lines.push(`  - ${collision.message}`);
				}
			}

			// Affected outputs
			if (
				preview.affectedOutputs.canonicalOutputs.length > 0 ||
				preview.affectedOutputs.derivedOutputs.length > 0
			) {
				lines.push('');
				lines.push('Affected outputs:');
				lines.push(
					`  Canonical: ${preview.affectedOutputs.canonicalOutputs.length}`,
				);
				lines.push(
					`  Derived:   ${preview.affectedOutputs.derivedOutputs.length}`,
				);
				lines.push(`  Stale:     ${preview.affectedOutputs.staleCount}`);
				lines.push(`  Orphaned:  ${preview.affectedOutputs.orphanedCount}`);
				lines.push(
					`  Regenerate: ${preview.affectedOutputs.regenerationNeeded}`,
				);
				lines.push(
					`  Manual cleanup: ${preview.affectedOutputs.manualCleanupNeeded}`,
				);
			} else {
				lines.push('');
				lines.push('Affected outputs: none');
			}

			// Diagnostics
			if (preview.diagnostics.length > 0) {
				const errors = preview.diagnostics.filter(
					(d) => d.severity === 'error',
				);
				const warnings = preview.diagnostics.filter(
					(d) => d.severity === 'warning',
				);
				if (errors.length > 0) {
					lines.push('');
					lines.push('Issues:');
					for (const d of errors) {
						lines.push(`  [ERROR] ${d.message}`);
						for (const hint of d.recoveryHints) {
							lines.push(`    ${hint.message}`);
						}
					}
				}
				if (warnings.length > 0) {
					for (const d of warnings) {
						lines.push(`  [WARN] ${d.message}`);
					}
				}
			}

			lines.push('');
			lines.push('No files have been written.');
			lines.push(
				'Run /root set <path> to apply, or /root set <path> --dry-run for a fuller preview.',
			);

			return {
				command: 'root',
				kind: preview.safety.safe ? 'info' : 'warning',
				messages: lines,
				shouldExit: false,
				viewKind: 'root_config' as TuiViewKind,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				command: 'root',
				kind: 'error',
				messages: ['Failed to preview root change:', message],
				shouldExit: false,
				viewKind: 'recovery' as TuiViewKind,
			};
		}
	}

	// /root set <path>
	if (subcommand === 'set') {
		const targetPath = args[1];
		if (!targetPath) {
			return {
				command: 'root',
				kind: 'error',
				messages: ['Usage: /root set <path>', 'Please provide a target path.'],
				shouldExit: false,
				viewKind: 'root_config' as TuiViewKind,
			};
		}

		// Dry-run: show preview without writing
		if (isDryRun) {
			try {
				const result = await applyRootChange({
					confirmed: false,
					dryRun: true,
					projectRoot,
					proposedPath: targetPath,
				});

				return {
					command: 'root',
					kind: 'info',
					messages: result.messages,
					shouldExit: false,
					viewKind: 'root_config' as TuiViewKind,
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					command: 'root',
					kind: 'error',
					messages: ['Failed to dry-run root change:', message],
					shouldExit: false,
					viewKind: 'recovery' as TuiViewKind,
				};
			}
		}

		// --confirm: apply directly
		if (isConfirm) {
			try {
				const result = await applyRootChange({
					confirmed: true,
					dryRun: false,
					projectRoot,
					proposedPath: targetPath,
				});

				return {
					command: 'root',
					kind: result.applied ? 'success' : 'error',
					messages: result.messages,
					shouldExit: false,
					viewKind: 'root_config' as TuiViewKind,
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					command: 'root',
					kind: 'error',
					messages: ['Failed to apply root change:', message],
					shouldExit: false,
					viewKind: 'recovery' as TuiViewKind,
				};
			}
		}

		// Interactive: show preview and create confirmation
		try {
			const preview = await previewRootChange({
				projectRoot,
				proposedPath: targetPath,
			});

			const baseLines: string[] = [
				'Root Change Confirmation Required',
				'',
				`Current root:  ${preview.current.safeDisplayPath}`,
				`Proposed root: ${preview.proposed.safeDisplayPath}`,
				`Health:        ${preview.health}`,
				`Safe:          ${preview.safety.safe ? 'yes' : 'no'}`,
				'',
			];

			if (!preview.safety.safe) {
				return {
					command: 'root',
					kind: 'error',
					messages: [
						'Root change blocked: proposed root is not safe.',
						'Run /root preview <path> for details.',
					],
					shouldExit: false,
					viewKind: 'root_config' as TuiViewKind,
				};
			}

			if (preview.collisions.length > 0) {
				baseLines.push('Collisions:');
				for (const c of preview.collisions.slice(0, 5)) {
					baseLines.push(`  - ${c.message}`);
				}
				baseLines.push('');
			}

			baseLines.push(
				`Affected outputs: ${preview.affectedOutputs.staleCount} stale, ${preview.affectedOutputs.orphanedCount} orphaned`,
			);
			baseLines.push('');

			if (shouldUseKeyboardConfirmation(context)) {
				const confirmationRequest = createTuiConfirmationRequest({
					actionKind: 'config_change',
					alternatives: [
						'Run /root preview <path> for a detailed preview first.',
						'Run /root reset to revert to the default logos/.',
					],
					consequences: [
						`Documentation root will change from ${preview.current.safeDisplayPath} to ${preview.proposed.safeDisplayPath}`,
						`${preview.affectedOutputs.staleCount} outputs will be marked stale`,
						`${preview.affectedOutputs.orphanedCount} outputs will be orphaned`,
						'No files will be moved or deleted.',
						'Run /generate to regenerate outputs under the new root.',
					],
					destructive: preview.affectedOutputs.staleCount > 0,
					message:
						'Changing the documentation root will affect existing outputs. No files will be moved or deleted automatically.',
					options: yesNoOptions({
						acceptLabel: 'Change Root',
						cancelLabel: 'Cancel',
					}),
					sensitive: false,
					sourceCommand: `/root set ${targetPath}`,
					target: {
						kind: 'documentation_root',
						path: preview.proposed.safeDisplayPath,
					},
					title: 'Change Documentation Root',
				});

				baseLines.push('Use the keyboard to accept or cancel below.');

				return {
					command: 'root',
					confirmationRequest,
					kind: 'info',
					messages: baseLines,
					shouldExit: false,
					viewKind: 'root_config' as TuiViewKind,
				};
			}

			// Non-interactive
			baseLines.push('Run /root set <path> --confirm to apply.');
			baseLines.push('Run /root set <path> --dry-run for a dry-run.');

			return {
				command: 'root',
				kind: 'info',
				messages: baseLines,
				shouldExit: false,
				viewKind: 'root_config' as TuiViewKind,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				command: 'root',
				kind: 'error',
				messages: ['Failed to preview root change:', message],
				shouldExit: false,
				viewKind: 'recovery' as TuiViewKind,
			};
		}
	}

	// /root reset
	if (subcommand === 'reset') {
		if (isDryRun) {
			try {
				const result = await applyResetToDefault({
					confirmed: false,
					dryRun: true,
					projectRoot,
				});

				return {
					command: 'root',
					kind: 'info',
					messages: result.messages,
					shouldExit: false,
					viewKind: 'root_config' as TuiViewKind,
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					command: 'root',
					kind: 'error',
					messages: ['Failed to dry-run reset:', message],
					shouldExit: false,
					viewKind: 'recovery' as TuiViewKind,
				};
			}
		}

		if (isConfirm) {
			try {
				const result = await applyResetToDefault({
					confirmed: true,
					dryRun: false,
					projectRoot,
				});

				return {
					command: 'root',
					kind: result.applied ? 'success' : 'error',
					messages: result.messages,
					shouldExit: false,
					viewKind: 'root_config' as TuiViewKind,
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					command: 'root',
					kind: 'error',
					messages: ['Failed to apply reset:', message],
					shouldExit: false,
					viewKind: 'recovery' as TuiViewKind,
				};
			}
		}

		// Interactive
		try {
			const preview = await previewResetToDefault({ projectRoot });

			const baseLines: string[] = [
				'Reset Documentation Root to Default',
				'',
				`Current root:  ${preview.current.safeDisplayPath}`,
				`Default root:  ${preview.proposed.safeDisplayPath}`,
				'',
				'This will reset the documentation root to the default logos/.',
				'Existing generated files will not be moved or deleted.',
				'',
			];

			if (shouldUseKeyboardConfirmation(context)) {
				const confirmationRequest = createTuiConfirmationRequest({
					actionKind: 'config_change',
					alternatives: [
						'Run /root reset --dry-run to preview first.',
						'Run /root set <path> to choose a custom root.',
					],
					consequences: [
						'Documentation root will be reset to logos/',
						'Existing outputs under the old root will not be moved or deleted.',
						'Run /generate to regenerate under the default root.',
					],
					destructive: false,
					message:
						'Reset the documentation root to the default logos/ directory.',
					options: yesNoOptions({
						acceptLabel: 'Reset to Default',
						cancelLabel: 'Cancel',
					}),
					sensitive: false,
					sourceCommand: '/root reset',
					target: {
						kind: 'documentation_root',
						path: 'logos/',
					},
					title: 'Reset Documentation Root',
				});

				baseLines.push('Use the keyboard to accept or cancel below.');

				return {
					command: 'root',
					confirmationRequest,
					kind: 'info',
					messages: baseLines,
					shouldExit: false,
					viewKind: 'root_config' as TuiViewKind,
				};
			}

			baseLines.push('Run /root reset --confirm to apply.');
			baseLines.push('Run /root reset --dry-run for a dry-run.');

			return {
				command: 'root',
				kind: 'info',
				messages: baseLines,
				shouldExit: false,
				viewKind: 'root_config' as TuiViewKind,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				command: 'root',
				kind: 'error',
				messages: ['Failed to preview reset:', message],
				shouldExit: false,
				viewKind: 'recovery' as TuiViewKind,
			};
		}
	}

	// Unknown subcommand
	return {
		command: 'root',
		kind: 'error',
		messages: [
			`Unknown root subcommand: ${subcommand ?? '(empty)'}`,
			'Available: status, preview <path>, set <path>, reset',
		],
		shouldExit: false,
		viewKind: 'recovery' as TuiViewKind,
	};
}

// ---------------------------------------------------------------------------
// Free-form intake handler
// ---------------------------------------------------------------------------

async function handleFreeFormIntake(
	text: string,
	context: RouterContext,
): Promise<SlashCommandResult> {
	const projectRoot = context.projectContext.root.rootPath ?? undefined;
	if (!projectRoot) {
		return {
			command: 'intake',
			kind: 'error',
			messages: [
				'Cannot process intake because no project root was detected.',
				'Run logos from a project repository or initialize a workspace first.',
			],
			shouldExit: false,
		};
	}

	const readResult = await readWorkspaceState({ projectRoot });
	if (!readResult.success || !readResult.state) {
		return {
			command: 'intake',
			kind: 'warning',
			messages: [
				'Cannot process intake because the LOGOS workspace is not initialized.',
				'Run /init to create a workspace, then type free-form text again.',
			],
			shouldExit: false,
		};
	}

	try {
		const result = await processFreeFormIntake({
			projectRoot,
			text,
		});

		const lines: string[] = [...result.messages];

		if (result.proposals.length > 0) {
			lines.push('');
			lines.push('Proposals created:');
			for (const p of result.proposals) {
				const confLabel = p.confidence ? ` [${p.confidence} confidence]` : '';
				const srcLabel = p.sourceLabel ? ` (${p.sourceLabel})` : '';
				lines.push(
					`  ${p.proposalId}: ${p.kind}${confLabel}${srcLabel} — ${p.title.substring(0, 80)}`,
				);
			}
		}

		if (result.nextActions.length > 0) {
			lines.push('');
			lines.push('Next actions:');
			for (const action of result.nextActions.slice(0, 5)) {
				lines.push(`  - ${action}`);
			}
		}

		lines.push('');
		lines.push(
			'Proposals are not confirmed until explicitly accepted. Run /proposals list to review.',
		);

		return {
			command: 'intake',
			kind: result.success ? 'success' : 'warning',
			messages: lines,
			shouldExit: false,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			command: 'intake',
			kind: 'error',
			messages: [
				'Intake processing failed:',
				message,
				'Your input has been preserved. Run /config ai status to check provider configuration.',
			],
			shouldExit: false,
		};
	}
}

// ---------------------------------------------------------------------------
// /proposals command
// ---------------------------------------------------------------------------

async function getProposalsResult(
	args: string[],
	context: RouterContext,
): Promise<SlashCommandResult> {
	const projectRoot = context.projectContext.root.rootPath ?? undefined;
	if (!projectRoot) {
		return {
			command: 'proposals',
			kind: 'error',
			messages: ['Cannot list proposals because no project root was detected.'],
			shouldExit: false,
		};
	}

	const subCmd = args[0];

	// /proposals list
	if (!subCmd || subCmd === 'list') {
		const kind = args.includes('--kind')
			? args[args.indexOf('--kind') + 1]
			: undefined;
		const status = args.includes('--status')
			? args[args.indexOf('--status') + 1]
			: undefined;

		const listResult = await listProposals({
			kind,
			projectRoot,
			status,
		});

		if (!listResult.success) {
			return {
				command: 'proposals',
				kind: 'error',
				messages: listResult.diagnostics.map((d) => d.message),
				shouldExit: false,
			};
		}

		const lines: string[] = ['Proposals:'];

		if (listResult.proposals.length === 0) {
			lines.push('  (none)');
			lines.push('');
			lines.push(
				'No proposals exist yet. Type free-form text to create proposals from your input.',
			);
		} else {
			lines.push(`  ${listResult.proposals.length} proposal(s):`);
			lines.push('');
			for (const p of listResult.proposals) {
				const confLabel = p.confidence ? ` [${p.confidence}]` : '';
				const srcLabel = p.sourceLabel ? ` (${p.sourceLabel})` : '';
				lines.push(
					`  ${p.proposalId} | ${p.kind} | ${p.status}${confLabel}${srcLabel}`,
				);
				lines.push(`    ${p.title.substring(0, 100)}`);
			}
			lines.push('');
			lines.push(
				'Commands: /proposals show <id>, /proposals accept <id>, /proposals revise <id> <text>, /proposals reject <id>, /proposals affected <id>',
			);
		}

		return {
			command: 'proposals',
			kind: 'success',
			messages: lines,
			shouldExit: false,
		};
	}

	// /proposals show <id>
	if (subCmd === 'show') {
		const proposalId = args[1];
		if (!proposalId) {
			return {
				command: 'proposals',
				kind: 'error',
				messages: ['Usage: /proposals show <proposal-id>'],
				shouldExit: false,
			};
		}

		const getResult = await getProposal({ projectRoot, proposalId });

		if (!getResult.success || !getResult.proposal) {
			return {
				command: 'proposals',
				kind: 'error',
				messages: getResult.diagnostics.map((d) => d.message),
				shouldExit: false,
			};
		}

		const p = getResult.proposal;
		const lines: string[] = [
			'Proposal detail:',
			'',
			`  ID:          ${p.proposalId}`,
			`  Kind:        ${p.kind}`,
			`  Status:      ${p.status}`,
			`  Confidence:  ${p.confidence ?? 'not set'}`,
			`  Source:      ${p.sourceLabel ?? 'not set'}`,
			`  Turn:        ${p.sourceTurnId ?? 'not set'}`,
			`  Title:       ${p.title}`,
			`  Body:        ${p.body.substring(0, 200)}`,
		];

		if (p.caveat) {
			lines.push(`  Caveat:      ${p.caveat}`);
		}
		if (p.rejectionReason) {
			lines.push(`  Rejection:   ${p.rejectionReason}`);
		}
		if (p.affectedDocumentIds.length > 0) {
			lines.push(`  Affected:    ${p.affectedDocumentIds.join(', ')}`);
		}
		if (p.diagnostics.length > 0) {
			lines.push('  Diagnostics:');
			for (const d of p.diagnostics.slice(0, 3)) {
				lines.push(`    [${d.severity}] ${d.message}`);
			}
		}

		lines.push('');
		lines.push(
			'Actions: /proposals accept <id>, /proposals revise <id> <text>, /proposals reject <id>, /proposals defer <id>, /proposals affected <id>',
		);

		return {
			command: 'proposals',
			kind: 'success',
			messages: lines,
			shouldExit: false,
		};
	}

	// /proposals accept <id>
	if (subCmd === 'accept') {
		const proposalId = args[1];
		if (!proposalId) {
			return {
				command: 'proposals',
				kind: 'error',
				messages: ['Usage: /proposals accept <proposal-id>'],
				shouldExit: false,
			};
		}

		// Interactive keyboard confirmation
		if (shouldUseKeyboardConfirmation(context)) {
			const getResult = await getProposal({ projectRoot, proposalId });
			if (getResult.success && getResult.proposal) {
				const p = getResult.proposal;
				const confirmationRequest = createTuiConfirmationRequest({
					actionKind: 'proposal_accept',
					consequences: [
						`Proposal "${p.title}" will become a confirmed ${p.kind} record.`,
						...(p.affectedDocumentIds.length > 0
							? [`Affected documents: ${p.affectedDocumentIds.join(', ')}`]
							: []),
						'This may affect generated outputs.',
					],
					destructive: false,
					message: `Accepting this proposal will create a confirmed ${p.kind} record from the proposed content.`,
					options: yesNoOptions(),
					sensitive: false,
					sourceCommand: `/proposals accept ${proposalId}`,
					target: {
						id: proposalId,
						kind: 'proposal',
						safeDisplay: p.title.substring(0, 100),
					},
					title: `Accept Proposal: ${p.title.substring(0, 60)}`,
				});

				const displayLines: string[] = [
					'Proposal acceptance confirmation',
					'',
					`  ID:    ${p.proposalId}`,
					`  Kind:  ${p.kind}`,
					`  Title: ${p.title}`,
					'',
					'Use the keyboard to accept or cancel below.',
				];

				return {
					command: 'proposals',
					confirmationRequest,
					kind: 'info',
					messages: displayLines,
					shouldExit: false,
				};
			}
		}

		const result = await intakeAcceptProposal({ projectRoot, proposalId });

		return formatProposalLifecycleResult('accept', result);
	}

	// /proposals revise <id> <text>
	if (subCmd === 'revise') {
		const proposalId = args[1];
		const revisedText = args.slice(2).join(' ');
		if (!proposalId || !revisedText.trim()) {
			return {
				command: 'proposals',
				kind: 'error',
				messages: ['Usage: /proposals revise <proposal-id> <revised text>'],
				shouldExit: false,
			};
		}

		// Interactive keyboard confirmation
		if (shouldUseKeyboardConfirmation(context)) {
			const getResult = await getProposal({ projectRoot, proposalId });
			if (getResult.success && getResult.proposal) {
				const p = getResult.proposal;
				const confirmationRequest = createTuiConfirmationRequest({
					actionKind: 'proposal_revise',
					consequences: [
						`Proposal "${p.title}" will be revised with new text.`,
						`New text: ${revisedText.trim().substring(0, 120)}`,
					],
					destructive: false,
					message: 'Revising a proposal updates its content before acceptance.',
					options: yesNoOptions({
						acceptLabel: 'Revise',
						cancelLabel: 'Cancel',
					}),
					sensitive: false,
					sourceCommand: `/proposals revise ${proposalId} ${revisedText.trim()}`,
					target: {
						id: proposalId,
						kind: 'proposal',
						safeDisplay: p.title.substring(0, 100),
					},
					title: `Revise Proposal: ${p.title.substring(0, 60)}`,
				});

				const displayLines: string[] = [
					'Proposal revision confirmation',
					'',
					`  ID:      ${p.proposalId}`,
					`  Kind:    ${p.kind}`,
					`  Title:   ${p.title}`,
					`  New:     ${revisedText.trim().substring(0, 100)}`,
					'',
					'Use the keyboard to revise or cancel below.',
				];

				return {
					command: 'proposals',
					confirmationRequest,
					kind: 'info',
					messages: displayLines,
					shouldExit: false,
				};
			}
		}

		const result = await intakeReviseProposal({
			body: revisedText.trim(),
			projectRoot,
			proposalId,
			title: revisedText.trim().substring(0, 80),
		});

		return formatProposalLifecycleResult('revise', result);
	}

	// /proposals reject <id>
	if (subCmd === 'reject') {
		const proposalId = args[1];
		if (!proposalId) {
			return {
				command: 'proposals',
				kind: 'error',
				messages: ['Usage: /proposals reject <proposal-id>'],
				shouldExit: false,
			};
		}

		// Interactive keyboard confirmation
		if (shouldUseKeyboardConfirmation(context)) {
			const getResult = await getProposal({ projectRoot, proposalId });
			if (getResult.success && getResult.proposal) {
				const p = getResult.proposal;
				const confirmationRequest = createTuiConfirmationRequest({
					actionKind: 'proposal_reject',
					consequences: [
						`Proposal "${p.title}" will be marked as rejected.`,
						'It will remain in state but cannot be accepted later.',
					],
					destructive: false,
					message:
						'Rejecting a proposal prevents it from being accepted in the future.',
					options: yesNoOptions({
						acceptLabel: 'Reject',
						cancelLabel: 'Cancel',
					}),
					sensitive: false,
					sourceCommand: `/proposals reject ${proposalId}`,
					target: {
						id: proposalId,
						kind: 'proposal',
						safeDisplay: p.title.substring(0, 100),
					},
					title: `Reject Proposal: ${p.title.substring(0, 60)}`,
				});

				const displayLines: string[] = [
					'Proposal rejection confirmation',
					'',
					`  ID:    ${p.proposalId}`,
					`  Kind:  ${p.kind}`,
					`  Title: ${p.title}`,
					'',
					'Use the keyboard to reject or cancel below.',
				];

				return {
					command: 'proposals',
					confirmationRequest,
					kind: 'info',
					messages: displayLines,
					shouldExit: false,
				};
			}
		}

		const result = await intakeRejectProposal({ projectRoot, proposalId });

		return formatProposalLifecycleResult('reject', result);
	}

	// /proposals defer <id>
	if (subCmd === 'defer') {
		const proposalId = args[1];
		if (!proposalId) {
			return {
				command: 'proposals',
				kind: 'error',
				messages: ['Usage: /proposals defer <proposal-id>'],
				shouldExit: false,
			};
		}

		// Interactive keyboard confirmation
		if (shouldUseKeyboardConfirmation(context)) {
			const getResult = await getProposal({ projectRoot, proposalId });
			if (getResult.success && getResult.proposal) {
				const p = getResult.proposal;
				const confirmationRequest = createTuiConfirmationRequest({
					actionKind: 'proposal_defer',
					consequences: [
						`Proposal "${p.title}" will be deferred.`,
						'It remains reviewable later.',
					],
					destructive: false,
					message: 'Deferring keeps the proposal for later review.',
					options: yesNoOptions({
						acceptLabel: 'Defer',
						cancelLabel: 'Cancel',
					}),
					sensitive: false,
					sourceCommand: `/proposals defer ${proposalId}`,
					target: {
						id: proposalId,
						kind: 'proposal',
						safeDisplay: p.title.substring(0, 100),
					},
					title: `Defer Proposal: ${p.title.substring(0, 60)}`,
				});

				const displayLines: string[] = [
					'Proposal deferral confirmation',
					'',
					`  ID:    ${p.proposalId}`,
					`  Kind:  ${p.kind}`,
					`  Title: ${p.title}`,
					'',
					'Use the keyboard to defer or cancel below.',
				];

				return {
					command: 'proposals',
					confirmationRequest,
					kind: 'info',
					messages: displayLines,
					shouldExit: false,
				};
			}
		}

		const { deferProposal: deferProposalFn } = await import(
			'../intake/proposal-lifecycle.js'
		);
		const result = await deferProposalFn({
			projectRoot,
			proposalId,
		});

		return formatProposalLifecycleResult('defer', result);
	}

	// /proposals affected <id>
	if (subCmd === 'affected') {
		const proposalId = args[1];
		if (!proposalId) {
			return {
				command: 'proposals',
				kind: 'error',
				messages: ['Usage: /proposals affected <proposal-id>'],
				shouldExit: false,
			};
		}

		const getResult = await getProposal({ projectRoot, proposalId });

		if (!getResult.success || !getResult.proposal) {
			return {
				command: 'proposals',
				kind: 'error',
				messages: getResult.diagnostics.map((d) => d.message),
				shouldExit: false,
			};
		}

		const p = getResult.proposal;
		const lines: string[] = ['Affected documents:'];

		if (p.affectedDocumentIds.length === 0) {
			lines.push('  (none reported)');
			lines.push('');
			lines.push(
				'Run /validate or /diagnose to detect affected documents from state.',
			);
		} else {
			for (const docId of p.affectedDocumentIds) {
				lines.push(`  - ${docId}`);
			}
			lines.push('');
			lines.push(
				'If this proposal is accepted, these documents may need regeneration.',
			);
		}

		return {
			command: 'proposals',
			kind: 'success',
			messages: lines,
			shouldExit: false,
		};
	}

	return {
		command: 'proposals',
		kind: 'error',
		messages: [
			`Unknown /proposals subcommand: ${subCmd}`,
			'Valid: list, show <id>, accept <id>, revise <id> <text>, reject <id>, defer <id>, affected <id>',
		],
		shouldExit: false,
	};
}

function formatProposalLifecycleResult(
	action: string,
	result: Awaited<ReturnType<typeof intakeAcceptProposal>>,
): SlashCommandResult {
	if (!result.success) {
		return {
			command: 'proposals',
			kind: 'error',
			messages: result.diagnostics.map((d) => d.message),
			shouldExit: false,
		};
	}

	const lines: string[] = [
		`Proposal ${action}ed.`,
		`  ID:     ${result.proposalId}`,
	];

	if (result.proposal) {
		lines.push(`  Kind:   ${result.proposal.kind}`);
		lines.push(`  Status: ${result.proposal.status}`);
		lines.push(`  Title:  ${result.proposal.title.substring(0, 80)}`);
	}

	lines.push('');
	lines.push('Run /proposals list to see all proposals.');

	return {
		command: 'proposals',
		kind: 'success',
		messages: lines,
		shouldExit: false,
	};
}

// ---------------------------------------------------------------------------
// /decisions command
// ---------------------------------------------------------------------------

async function getDecisionsResult(
	args: string[],
	context: RouterContext,
): Promise<SlashCommandResult> {
	const projectRoot = context.projectContext.root.rootPath ?? undefined;
	if (!projectRoot) {
		return {
			command: 'decisions',
			kind: 'error',
			messages: ['Cannot list decisions because no project root was detected.'],
			shouldExit: false,
		};
	}

	const readResult = await readWorkspaceState({ projectRoot });
	if (!readResult.success || !readResult.state) {
		return {
			command: 'decisions',
			kind: 'error',
			messages: [
				'Cannot access decisions because workspace is not initialized.',
			],
			shouldExit: false,
		};
	}

	const decisions = readResult.state.decisions;
	const subCmd = args[0];

	// /decisions list
	if (!subCmd || subCmd === 'list') {
		if (decisions.length === 0) {
			return {
				command: 'decisions',
				kind: 'info',
				messages: [
					'No confirmed decisions exist.',
					'Accept a decision proposal via /proposals accept <id> to create a confirmed decision.',
				],
				shouldExit: false,
			};
		}

		const lines: string[] = ['Confirmed decisions:'];
		for (const d of decisions) {
			const confLabel = d.confidence ? ` [${d.confidence}]` : '';
			lines.push(`  ${d.id} | ${d.status}${confLabel}`);
			lines.push(`    ${d.title.substring(0, 100)}`);
		}

		lines.push('');
		lines.push(
			'Commands: /decisions show <id>, /decisions revise <id> <text>, /decisions supersede <id> <text>, /decisions affected <id>',
		);

		return {
			command: 'decisions',
			kind: 'success',
			messages: lines,
			shouldExit: false,
		};
	}

	// /decisions show <id>
	if (subCmd === 'show') {
		const decisionId = args[1];
		if (!decisionId) {
			return {
				command: 'decisions',
				kind: 'error',
				messages: ['Usage: /decisions show <decision-id>'],
				shouldExit: false,
			};
		}

		const decision = decisions.find((d) => d.id === decisionId);
		if (!decision) {
			return {
				command: 'decisions',
				kind: 'error',
				messages: [
					`Decision "${decisionId}" not found.`,
					'Run /decisions list to see all decisions.',
				],
				shouldExit: false,
			};
		}

		const lines: string[] = [
			'Decision detail:',
			'',
			`  ID:          ${decision.id}`,
			`  Status:      ${decision.status}`,
			`  Confidence:  ${decision.confidence ?? 'not set'}`,
			`  Title:       ${decision.title}`,
			`  Body:        ${(decision.body ?? '').substring(0, 200)}`,
		];

		if (decision.affectedDocumentIds.length > 0) {
			lines.push(`  Affected:    ${decision.affectedDocumentIds.join(', ')}`);
		}
		if (decision.sourceRefs.length > 0) {
			lines.push(`  Sources:     ${decision.sourceRefs.join(', ')}`);
		}

		lines.push('');
		lines.push(
			'Actions: /decisions revise <id> <text>, /decisions supersede <id> <text>, /decisions affected <id>',
		);

		return {
			command: 'decisions',
			kind: 'success',
			messages: lines,
			shouldExit: false,
		};
	}

	// /decisions revise <id> <text>
	if (subCmd === 'revise') {
		const decisionId = args[1];
		const revisedText = args.slice(2).join(' ');

		if (!decisionId || !revisedText.trim()) {
			return {
				command: 'decisions',
				kind: 'error',
				messages: ['Usage: /decisions revise <decision-id> <revised text>'],
				shouldExit: false,
			};
		}

		// Interactive keyboard confirmation
		if (shouldUseKeyboardConfirmation(context)) {
			const decision = decisions.find((d) => d.id === decisionId);
			if (decision) {
				const confirmationRequest = createTuiConfirmationRequest({
					actionKind: 'decision_revise',
					consequences: [
						`Decision "${decision.title}" will be revised.`,
						...(decision.affectedDocumentIds.length > 0
							? [
									`Affected documents: ${decision.affectedDocumentIds.join(', ')}`,
								]
							: []),
						'Affected outputs may become stale.',
					],
					destructive: false,
					message:
						'Revising a confirmed decision updates its content and may affect downstream documents.',
					options: yesNoOptions({
						acceptLabel: 'Revise',
						cancelLabel: 'Cancel',
					}),
					sensitive: false,
					sourceCommand: `/decisions revise ${decisionId} ${revisedText.trim()}`,
					target: {
						id: decisionId,
						kind: 'decision',
						safeDisplay: decision.title.substring(0, 100),
					},
					title: `Revise Decision: ${decision.title.substring(0, 60)}`,
				});

				const displayLines: string[] = [
					'Decision revision confirmation',
					'',
					`  ID:      ${decision.id}`,
					`  Title:   ${decision.title}`,
					`  New:     ${revisedText.trim().substring(0, 100)}`,
					...(decision.affectedDocumentIds.length > 0
						? [`  Affected: ${decision.affectedDocumentIds.join(', ')}`]
						: []),
					'',
					'Use the keyboard to revise or cancel below.',
				];

				return {
					command: 'decisions',
					confirmationRequest,
					kind: 'info',
					messages: displayLines,
					shouldExit: false,
				};
			}
		}

		try {
			const { reviseDecision } = await import(
				'../intake/decision-correction.js'
			);
			const result = await reviseDecision({
				decisionId,
				newBody: revisedText.trim(),
				newTitle: revisedText.trim().substring(0, 80),
				projectRoot,
			});

			if (!result.success) {
				return {
					command: 'decisions',
					kind: 'error',
					messages: result.diagnostics.map((d) => d.message),
					shouldExit: false,
				};
			}

			const lines: string[] = [
				'Decision revised.',
				`  ID:        ${result.decisionId}`,
			];
			if (result.affectedDocuments.length > 0) {
				lines.push(`  Affected:  ${result.affectedDocuments.join(', ')}`);
			}
			lines.push('');
			lines.push('Run /decisions list to see all decisions.');
			lines.push('Run /generate to regenerate affected documents.');

			return {
				command: 'decisions',
				kind: 'success',
				messages: lines,
				shouldExit: false,
			};
		} catch {
			return {
				command: 'decisions',
				kind: 'error',
				messages: ['Decision revision service not available.'],
				shouldExit: false,
			};
		}
	}

	// /decisions supersede <id> <text>
	if (subCmd === 'supersede') {
		const decisionId = args[1];
		const newText = args.slice(2).join(' ');

		if (!decisionId || !newText.trim()) {
			return {
				command: 'decisions',
				kind: 'error',
				messages: ['Usage: /decisions supersede <decision-id> <new text>'],
				shouldExit: false,
			};
		}

		// Interactive keyboard confirmation
		if (shouldUseKeyboardConfirmation(context)) {
			const decision = decisions.find((d) => d.id === decisionId);
			if (decision) {
				const confirmationRequest = createTuiConfirmationRequest({
					actionKind: 'decision_supersede',
					consequences: [
						`Decision "${decision.title}" will be superseded by a new decision.`,
						'The original decision will be marked as superseded in state.',
						...(decision.affectedDocumentIds.length > 0
							? [
									`Affected documents: ${decision.affectedDocumentIds.join(', ')}`,
								]
							: []),
						'Affected outputs may become stale.',
					],
					destructive: true,
					message:
						'Superseding replaces a confirmed decision. This is a consequential action — a new decision record will be created.',
					options: yesNoOptions({
						acceptLabel: 'Supersede',
						cancelLabel: 'Cancel',
					}),
					sensitive: false,
					sourceCommand: `/decisions supersede ${decisionId} ${newText.trim()}`,
					target: {
						id: decisionId,
						kind: 'decision',
						safeDisplay: decision.title.substring(0, 100),
					},
					title: `Supersede Decision: ${decision.title.substring(0, 60)}`,
				});

				const displayLines: string[] = [
					'Decision supersession confirmation',
					'',
					`  ID:      ${decision.id}`,
					`  Title:   ${decision.title}`,
					`  New:     ${newText.trim().substring(0, 100)}`,
					...(decision.affectedDocumentIds.length > 0
						? [`  Affected: ${decision.affectedDocumentIds.join(', ')}`]
						: []),
					'',
					'Use the keyboard to supersede or cancel below.',
				];

				return {
					command: 'decisions',
					confirmationRequest,
					kind: 'info',
					messages: displayLines,
					shouldExit: false,
				};
			}
		}

		try {
			const { supersedeDecision } = await import(
				'../intake/decision-correction.js'
			);
			const result = await supersedeDecision({
				decisionId,
				newBody: newText.trim(),
				newTitle: newText.trim().substring(0, 80),
				projectRoot,
			});

			if (!result.success) {
				return {
					command: 'decisions',
					kind: 'error',
					messages: result.diagnostics.map((d) => d.message),
					shouldExit: false,
				};
			}

			const lines: string[] = [
				'Decision superseded.',
				`  Old ID:      ${result.decisionId}`,
				`  New ID:      ${result.newDecisionId}`,
			];
			if (result.affectedDocuments.length > 0) {
				lines.push(`  Affected:    ${result.affectedDocuments.join(', ')}`);
			}
			lines.push('');
			lines.push('Run /generate to regenerate affected documents.');

			return {
				command: 'decisions',
				kind: 'success',
				messages: lines,
				shouldExit: false,
			};
		} catch {
			return {
				command: 'decisions',
				kind: 'error',
				messages: ['Decision supersession service not available.'],
				shouldExit: false,
			};
		}
	}

	// /decisions affected <id>
	if (subCmd === 'affected') {
		const decisionId = args[1];
		if (!decisionId) {
			return {
				command: 'decisions',
				kind: 'error',
				messages: ['Usage: /decisions affected <decision-id>'],
				shouldExit: false,
			};
		}

		const decision = decisions.find((d) => d.id === decisionId);
		if (!decision) {
			return {
				command: 'decisions',
				kind: 'error',
				messages: [`Decision "${decisionId}" not found.`],
				shouldExit: false,
			};
		}

		const lines: string[] = ['Affected documents:'];

		if (decision.affectedDocumentIds.length === 0) {
			lines.push('  (none reported)');
		} else {
			for (const docId of decision.affectedDocumentIds) {
				lines.push(`  - ${docId}`);
			}
		}

		// Also check artifacts
		const affectedArtifacts = readResult.state.artifacts.filter(
			(a) =>
				a.status === 'stale' ||
				a.sourceDocumentIds.some((id) =>
					decision.affectedDocumentIds.includes(id),
				),
		);

		if (affectedArtifacts.length > 0) {
			lines.push('');
			lines.push('Stale artifacts:');
			for (const a of affectedArtifacts.slice(0, 5)) {
				lines.push(`  - ${a.path} (${a.artifactType}, ${a.status})`);
			}
			lines.push('');
			lines.push('Run /generate to regenerate stale outputs.');
		}

		return {
			command: 'decisions',
			kind: 'success',
			messages: lines,
			shouldExit: false,
		};
	}

	return {
		command: 'decisions',
		kind: 'error',
		messages: [
			`Unknown /decisions subcommand: ${subCmd}`,
			'Valid: list, show <id>, revise <id> <text>, supersede <id> <text>, affected <id>',
		],
		shouldExit: false,
	};
}

function extractFlagValue(args: string[], flag: string): string | undefined {
	const idx = args.indexOf(flag);
	if (idx >= 0 && idx + 1 < args.length) {
		return args[idx + 1] ?? undefined;
	}
	return undefined;
}

async function getExecutiveResult(
	args: string[],
	context: RouterContext,
): Promise<SlashCommandResult> {
	const subCommand = args[0];

	if (!subCommand || subCommand === 'help') {
		return {
			command: 'executive',
			kind: 'info',
			messages: [
				'Executive Axis commands:',
				'',
				'  /executive compile           — Compile Executive Axis (JSON + exports)',
				'  /executive compile --dry-run — Preflight executive compilation',
				'  /executive compile --confirm — Execute compilation',
				'  /executive compile --mode strict — Strict mode (block on readiness issues)',
				'  /executive compile --mode diagnostic-preview — Diagnostic preview mode',
				'  /executive compile --target json — Only Executive Plan JSON',
				'  /executive compile --target markdown — Only Markdown export',
				'  /executive compile --target html — Only HTML export',
				'  /executive compile --target github-issues — Only GitHub issue files',
				'  /executive compile --target agent-pack — Only Agent Pack files',
				'  /executive compile --all-file-exports — All supported file exports',
				'',
				'Outputs are derived, non-canonical snapshots.',
				'No external APIs are called. No external records are created.',
			],
			shouldExit: false,
		};
	}

	if (subCommand !== 'compile') {
		return {
			command: 'executive',
			kind: 'error',
			messages: [
				`Unknown executive subcommand: ${subCommand}`,
				'Valid subcommands: compile',
				'Run /executive for help.',
			],
			shouldExit: false,
		};
	}

	const projectRoot = context.projectContext.root.rootPath ?? undefined;
	if (!projectRoot) {
		return {
			command: 'executive compile',
			kind: 'error',
			messages: [
				'Cannot compile Executive Axis because no project root was detected.',
				'Run logos from a project repository or initialize a workspace first.',
			],
			shouldExit: false,
		};
	}

	const isDryRun = args.includes('--dry-run');
	const isConfirm = args.includes('--confirm');

	// Mode
	let mode: 'strict' | 'diagnostic_preview' = 'strict';
	const modeIdx = args.indexOf('--mode');
	if (modeIdx !== -1 && modeIdx + 1 < args.length) {
		const raw = args[modeIdx + 1];
		if (raw === 'diagnostic-preview' || raw === 'diagnostic_preview') {
			mode = 'diagnostic_preview';
		} else if (raw === 'strict') {
			mode = 'strict';
		} else {
			return {
				command: 'executive compile',
				kind: 'error',
				messages: [
					`Invalid mode: "${raw}"`,
					'Valid modes: strict, diagnostic-preview',
				],
				shouldExit: false,
			};
		}
	}

	// Target selection
	const isAllFileExports = args.includes('--all-file-exports');
	let selectedTargets: string[] | undefined;
	const targetIdx = args.indexOf('--target');
	if (targetIdx !== -1 && targetIdx + 1 < args.length) {
		const raw = args[targetIdx + 1] ?? '';
		switch (raw) {
			case 'json':
				selectedTargets = ['executive_plan_json'];
				break;
			case 'markdown':
				selectedTargets = ['markdown_export'];
				break;
			case 'html':
				selectedTargets = ['html_export'];
				break;
			case 'github-issues':
			case 'github_issues':
				selectedTargets = ['github_issue_file_export'];
				break;
			case 'agent-pack':
			case 'agent_pack':
				selectedTargets = ['agent_pack_file_export'];
				break;
			default:
				return {
					command: 'executive compile',
					kind: 'error',
					messages: [
						`Invalid target: "${raw}"`,
						'Valid targets: json, markdown, html, github-issues, agent-pack',
					],
					shouldExit: false,
				};
		}
	}

	if (isAllFileExports) {
		selectedTargets = [
			'executive_plan_json',
			'markdown_export',
			'html_export',
			'github_issue_file_export',
			'agent_pack_file_export',
		];
	}

	// Write policy
	let writePolicy: string | undefined;
	const policyIdx = args.indexOf('--write-policy');
	if (policyIdx !== -1 && policyIdx + 1 < args.length) {
		const raw = args[policyIdx + 1] ?? '';
		switch (raw) {
			case 'skip-existing':
				writePolicy = 'skip_existing';
				break;
			case 'fail-on-collision':
				writePolicy = 'fail_on_collision';
				break;
			case 'backup-and-write':
				writePolicy = 'backup_and_write';
				break;
			case 'explicit-overwrite':
				writePolicy = 'explicit_overwrite';
				break;
			default:
				return {
					command: 'executive compile',
					kind: 'error',
					messages: [
						`Invalid write policy: "${raw}"`,
						'Valid policies: skip-existing, fail-on-collision, backup-and-write, explicit-overwrite',
					],
					shouldExit: false,
				};
		}
	}

	try {
		const workflowDryRun = isDryRun || !isConfirm;
		const compileInputBase = {
			dryRun: workflowDryRun,
			mode,
			projectRoot,
		};
		const compileInput =
			selectedTargets || writePolicy
				? {
						...compileInputBase,
						...(selectedTargets ? { selectedTargets } : {}),
						...(writePolicy ? { writePolicy } : {}),
					}
				: compileInputBase;

		const result = await executiveCompileWorkflow(
			compileInput as import('../executive/index.js').ExecutiveCompileInput,
		);

		const kindMap: Record<string, CommandResultStatus> = {
			blocked: 'warning',
			compiled: 'success',
			compiled_with_warnings: 'warning',
			dry_run: 'info',
			failed: 'error',
			unknown: 'warning',
		};

		if (isDryRun) {
			// Add dry-run note
			const displayLines = [
				...(result.readyForDisplay ?? []),
				'',
				'(dry-run: no files were written)',
				'Run /executive compile --confirm to execute.',
			];
			return {
				command: 'executive compile',
				kind: 'info',
				messages: displayLines,
				shouldExit: false,
			};
		}

		if (isConfirm && result.status !== 'blocked') {
			const displayLines = [
				...(result.readyForDisplay ?? []),
				'',
				result.runId ? `Run ID: ${result.runId}` : '',
				'',
				'Next: Run /status to review updated state.',
			].filter(Boolean);

			return {
				command: 'executive compile',
				kind: kindMap[result.status] ?? 'info',
				messages: displayLines,
				shouldExit: false,
			};
		}

		// Default: preflight display, optionally with keyboard confirmation
		// When interactive and not blocked, return confirmation
		if (shouldUseKeyboardConfirmation(context) && result.status !== 'blocked') {
			// Preserve original user args for sourceCommand (not internal normalized values)
			const sourceCmd = [
				'/executive',
				...args.filter((a) => a !== '--confirm' && a !== '--dry-run'),
			];

			const confirmationRequest = createTuiConfirmationRequest({
				actionKind: 'executive_compile',
				alternatives: [
					'Run /executive compile --dry-run first.',
					'Select specific targets with --target.',
				],
				consequences: [
					`Mode: ${mode}`,
					...(selectedTargets
						? [`Targets: ${selectedTargets.join(', ')}`]
						: []),
					...(result.readyForDisplay ?? []).slice(0, 5),
				],
				destructive: false,
				message: 'Executive outputs will be compiled and written.',
				options: yesNoOptions(),
				sensitive: false,
				sourceCommand: sourceCmd.join(' '),
				title: 'Compile Executive Axis',
			});

			const displayLines = [
				...(result.readyForDisplay ?? []),
				'',
				'Use the keyboard to accept or cancel below.',
			];

			return {
				command: 'executive compile',
				confirmationRequest,
				kind: kindMap[result.status] ?? 'info',
				messages: displayLines,
				shouldExit: false,
			};
		}

		const displayLines = [
			...(result.readyForDisplay ?? []),
			'',
			'No files have been written.',
			'Run /executive compile --confirm to execute.',
			'Run /executive compile --dry-run for a detailed dry-run report.',
		];

		return {
			command: 'executive compile',
			kind: kindMap[result.status] ?? 'info',
			messages: displayLines,
			shouldExit: false,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			command: 'executive compile',
			kind: 'error',
			messages: ['Executive compilation failed:', message],
			shouldExit: false,
		};
	}
}

function _findCanonicalOutputPath(descriptor: {
	outputs?: { canonical?: { path: string } };
}): string {
	return descriptor.outputs?.canonical?.path ?? '';
}

function flattenDescriptorOutputs(outputs: {
	canonical: { path: string; format: string };
	artifacts?: { id: string; path: string; format: string }[];
	agentPacks?: { id: string; path: string; format: string }[];
	data?: { id: string; path: string; format: string }[];
	executive?: { id: string; path: string; format: string }[];
}): { kind: string; path: string | undefined; format: string | undefined }[] {
	const result: {
		kind: string;
		path: string | undefined;
		format: string | undefined;
	}[] = [];
	result.push({
		format: outputs.canonical.format,
		kind: 'canonical',
		path: outputs.canonical.path,
	});
	for (const a of outputs.artifacts ?? []) {
		result.push({ format: a.format, kind: 'artifact', path: a.path });
	}
	for (const p of outputs.agentPacks ?? []) {
		result.push({ format: p.format, kind: 'agentPack', path: p.path });
	}
	for (const d of outputs.data ?? []) {
		result.push({ format: d.format, kind: 'data', path: d.path });
	}
	for (const e of outputs.executive ?? []) {
		result.push({ format: e.format, kind: 'executive', path: e.path });
	}
	return result;
}

// ---------------------------------------------------------------------------
// /config ai command handler
// ---------------------------------------------------------------------------

async function getConfigAiResult(
	args: string[],
	context: RouterContext,
): Promise<SlashCommandResult> {
	const projectRoot = context.projectContext.root.rootPath ?? undefined;

	if (!projectRoot) {
		return {
			command: 'config ai',
			kind: 'error',
			messages: [
				'Cannot configure AI provider because no project root was detected.',
				'Run logos from a project repository or initialize a workspace first.',
			],
			shouldExit: false,
		};
	}

	const subcommand = args[0];

	// /config ai (no args) — show status and available commands
	if (!subcommand) {
		const result = await getAiProviderStatus({ projectRoot });
		const config = result.config;
		const lines: string[] = [
			'AI Provider Configuration',
			'',
			'Current status:',
			`  Mode:              ${config.mode}`,
		];

		if (config.providerId) {
			lines.push(`  Provider:          ${config.providerId}`);
		}
		if (config.modelId) {
			lines.push(`  Model:             ${config.modelId}`);
		}
		if (config.endpoint) {
			const origin =
				config.endpoint.length > 60
					? `${config.endpoint.slice(0, 57)}...`
					: config.endpoint;
			lines.push(`  Endpoint:          ${origin}`);
		}
		if (config.tokenEnvVar) {
			lines.push(`  Token env var:     $${config.tokenEnvVar}`);
		} else {
			lines.push(`  Token env var:     (not set)`);
		}
		lines.push(
			`  Timeout:           ${config.timeoutMs}ms (${config.timeoutMs / 1000}s)`,
		);

		if (config.mode === 'remote') {
			lines.push(
				`  Disclosure:        ${config.disclosure.accepted ? 'accepted' : config.disclosure.declinedAt ? 'declined' : 'required (not yet accepted)'}`,
			);
		}

		if (config.lastTest && config.lastTest.status !== 'never_run') {
			lines.push('');
			lines.push(...formatTestSummary(config.lastTest));
		}

		lines.push('');
		lines.push('Available subcommands:');
		lines.push('  /config ai status              — Show current configuration');
		lines.push(
			'  /config ai mode <mode>         — Set mode (disabled, no_provider, local, remote)',
		);
		lines.push('  /config ai provider <id>       — Set provider');
		lines.push('  /config ai model <id>          — Set model ID');
		lines.push('  /config ai endpoint <url>      — Set endpoint URL');
		lines.push('  /config ai token-env <VAR>     — Set token env var name');
		lines.push(
			'  /config ai timeout <seconds>   — Set timeout (default 60s, max 180s)',
		);
		lines.push('  /config ai disclosure          — Show disclosure preview');
		lines.push('  /config ai disclosure accept   — Accept remote disclosure');
		lines.push('  /config ai disclosure decline  — Decline remote disclosure');
		lines.push('  /config ai test                — Test provider connectivity');
		lines.push('  /config ai disable             — Disable provider execution');
		lines.push(
			'  /config ai reset               — Reset to default configuration',
		);
		lines.push('  /config ai providers           — List known providers');
		lines.push('');
		lines.push(
			'NOTE: Token values are NEVER stored. Only environment variable names are saved.',
		);

		return {
			command: 'config ai',
			kind: 'info',
			messages: lines,
			shouldExit: false,
		};
	}

	// /config ai status
	if (subcommand === 'status') {
		const result = await getAiProviderStatus({ projectRoot });
		if (!result.success) {
			return {
				command: 'config ai status',
				kind: 'warning',
				messages:
					result.messages.length > 0
						? result.messages
						: ['Could not read provider status.'],
				shouldExit: false,
			};
		}

		const config = result.config;
		const lines: string[] = [
			'AI Provider Status',
			'',
			`  Mode:              ${config.mode}`,
			`  Provider ID:       ${config.providerId ?? '(none)'}`,
			`  Model ID:          ${config.modelId ?? '(none)'}`,
			`  Endpoint origin:   ${config.endpoint ? config.endpoint.replace(/[?#].*$/, '') : '(none)'}`,
			`  Token env var:     ${config.tokenEnvVar ? `$${config.tokenEnvVar}` : '(not set)'}`,
			`  Timeout:           ${config.timeoutMs}ms (${config.timeoutMs / 1000}s)`,
		];

		if (config.mode === 'remote') {
			lines.push(
				`  Disclosure:        ${config.disclosure.accepted ? 'accepted' : 'required'}`,
			);
		}

		if (config.lastTest && config.lastTest.status !== 'never_run') {
			lines.push(
				`  Last test:         ${config.lastTest.status} (${config.lastTest.testedAt ?? 'unknown'})`,
			);
		}

		if (config.mode === 'no_provider' || config.mode === 'disabled') {
			lines.push('');
			lines.push(
				'Recovery: Run /config ai mode remote or /config ai mode local to enable AI assistance.',
			);
		}

		return {
			command: 'config ai status',
			kind: 'info',
			messages: lines,
			shouldExit: false,
		};
	}

	// /config ai mode <mode>
	if (subcommand === 'mode') {
		const mode = args[1];
		if (!mode) {
			return {
				command: 'config ai mode',
				kind: 'error',
				messages: [
					'Usage: /config ai mode <disabled|no_provider|local|remote>',
				],
				shouldExit: false,
			};
		}

		const result = await setAiProviderMode({ projectRoot }, mode);
		const lines: string[] = [];
		if (result.success) {
			lines.push(`Provider mode set to: ${result.config.mode}`);
		} else {
			lines.push(`Failed to set mode: ${mode}`);
		}
		for (const d of result.diagnostics) {
			lines.push(`  [${d.severity.toUpperCase()}] ${d.message}`);
			if (d.recoveryHint) lines.push(`    Recovery: ${d.recoveryHint}`);
		}
		for (const m of result.messages) {
			if (m) lines.push(m);
		}

		return {
			command: 'config ai mode',
			kind: result.success ? 'success' : 'error',
			messages: lines,
			shouldExit: false,
		};
	}

	// /config ai provider <provider-id>
	if (subcommand === 'provider') {
		const providerId = args[1];
		if (!providerId) {
			return {
				command: 'config ai provider',
				kind: 'error',
				messages: [
					'Usage: /config ai provider <provider-id>',
					'Run /config ai providers to see available options.',
				],
				shouldExit: false,
			};
		}

		const result = await setAiProvider({ projectRoot }, providerId);
		const lines: string[] = [];
		if (result.success) {
			const entry = getProviderEntry(result.config.providerId ?? '');
			lines.push(`Provider set to: ${providerId}`);
			if (entry) {
				lines.push(`  Display:   ${entry.displayLabel}`);
				lines.push(`  Mode:      ${entry.modeCategory}`);
				if (entry.requiresToken) lines.push('  Token:     required');
				if (entry.requiresDisclosure)
					lines.push('  Disclosure: required for remote execution');
			}
		} else {
			lines.push(`Failed to set provider: ${providerId}`);
		}
		for (const d of result.diagnostics) {
			lines.push(`  [${d.severity.toUpperCase()}] ${d.message}`);
			if (d.recoveryHint) lines.push(`    Recovery: ${d.recoveryHint}`);
		}
		for (const m of result.messages) {
			if (m) lines.push(m);
		}

		return {
			command: 'config ai provider',
			kind: result.success ? 'success' : 'error',
			messages: lines,
			shouldExit: false,
		};
	}

	// /config ai providers
	if (subcommand === 'providers') {
		return {
			command: 'config ai providers',
			kind: 'info',
			messages: formatProviderListForDisplay(),
			shouldExit: false,
		};
	}

	// /config ai model <model-id>
	if (subcommand === 'model') {
		const modelId = args[1];
		if (!modelId) {
			return {
				command: 'config ai model',
				kind: 'error',
				messages: ['Usage: /config ai model <model-id>'],
				shouldExit: false,
			};
		}

		const result = await setAiProviderModel({ projectRoot }, modelId);
		const lines: string[] = [];
		if (result.success) {
			lines.push(`Model set to: ${result.config.modelId}`);
		} else {
			lines.push(`Failed to set model: ${modelId}`);
		}
		for (const d of result.diagnostics) {
			lines.push(`  [${d.severity.toUpperCase()}] ${d.message}`);
			if (d.recoveryHint) lines.push(`    Recovery: ${d.recoveryHint}`);
		}
		for (const m of result.messages) {
			if (m) lines.push(m);
		}

		return {
			command: 'config ai model',
			kind: result.success ? 'success' : 'error',
			messages: lines,
			shouldExit: false,
		};
	}

	// /config ai endpoint <url>
	if (subcommand === 'endpoint') {
		const endpoint = args[1];
		if (!endpoint) {
			return {
				command: 'config ai endpoint',
				kind: 'error',
				messages: ['Usage: /config ai endpoint <url>'],
				shouldExit: false,
			};
		}

		const result = await setAiProviderEndpoint({ projectRoot }, endpoint);
		const lines: string[] = [];
		if (result.success) {
			lines.push('Endpoint set.');
			lines.push(`  URL: ${result.config.endpoint}`);
		} else {
			lines.push(`Failed to set endpoint.`);
		}
		for (const d of result.diagnostics) {
			lines.push(`  [${d.severity.toUpperCase()}] ${d.message}`);
			if (d.recoveryHint) lines.push(`    Recovery: ${d.recoveryHint}`);
		}
		for (const m of result.messages) {
			if (m) lines.push(m);
		}

		return {
			command: 'config ai endpoint',
			kind: result.success ? 'success' : 'error',
			messages: lines,
			shouldExit: false,
		};
	}

	// /config ai token-env <ENV_VAR_NAME>
	if (subcommand === 'token-env') {
		const envVar = args[1];
		if (!envVar) {
			return {
				command: 'config ai token-env',
				kind: 'error',
				messages: [
					'Usage: /config ai token-env <ENV_VAR_NAME>',
					'Provide the environment variable name only (e.g., OPENAI_API_KEY), never the token value.',
				],
				shouldExit: false,
			};
		}

		const result = await setAiProviderTokenEnvVar({ projectRoot }, envVar);
		const lines: string[] = [];
		if (result.success) {
			lines.push(
				`Token environment variable set to: $${result.config.tokenEnvVar}`,
			);
			lines.push(
				'The variable name is stored; the value is never saved or displayed.',
			);
		} else {
			lines.push('Failed to set token environment variable.');
		}
		for (const d of result.diagnostics) {
			lines.push(`  [${d.severity.toUpperCase()}] ${d.message}`);
			if (d.recoveryHint) lines.push(`    Recovery: ${d.recoveryHint}`);
		}
		for (const m of result.messages) {
			if (m) lines.push(m);
		}

		return {
			command: 'config ai token-env',
			kind: result.success ? 'success' : 'error',
			messages: lines,
			shouldExit: false,
		};
	}

	// /config ai timeout <seconds>
	if (subcommand === 'timeout') {
		const rawValue = args[1];
		if (!rawValue) {
			return {
				command: 'config ai timeout',
				kind: 'error',
				messages: [
					'Usage: /config ai timeout <seconds>',
					'Default: 60 seconds. Maximum: 180 seconds.',
					'Provide the timeout in seconds (e.g., /config ai timeout 120).',
				],
				shouldExit: false,
			};
		}

		const value = Number(rawValue);
		// Interpret: values <= 180 treated as seconds, values > 180 as milliseconds
		const timeoutMs = value <= 180 ? value * 1000 : value;

		if (Number.isNaN(timeoutMs)) {
			return {
				command: 'config ai timeout',
				kind: 'error',
				messages: [`Invalid timeout value: ${rawValue}`],
				shouldExit: false,
			};
		}

		const result = await setAiProviderTimeout({ projectRoot }, timeoutMs);
		const lines: string[] = [];
		if (result.success) {
			lines.push(
				`Timeout set to: ${result.config.timeoutMs}ms (${result.config.timeoutMs / 1000}s)`,
			);
		} else {
			lines.push(`Failed to set timeout.`);
		}
		for (const d of result.diagnostics) {
			lines.push(`  [${d.severity.toUpperCase()}] ${d.message}`);
			if (d.recoveryHint) lines.push(`    Recovery: ${d.recoveryHint}`);
		}
		for (const m of result.messages) {
			if (m) lines.push(m);
		}

		return {
			command: 'config ai timeout',
			kind: result.success ? 'success' : 'error',
			messages: lines,
			shouldExit: false,
		};
	}

	// /config ai disclosure
	if (subcommand === 'disclosure') {
		const action = args[1];

		if (!action) {
			// Show disclosure preview
			const { preview, config } = await getDisclosurePreview({
				projectRoot,
			});

			if (!preview) {
				const lines: string[] = [
					'Disclosure preview is only available when a remote provider is configured.',
				];
				if (config.mode !== 'remote') {
					lines.push(
						`Current mode: ${config.mode}. Switch to remote mode first: /config ai mode remote`,
					);
				}
				return {
					command: 'config ai disclosure',
					kind: 'info',
					messages: lines,
					shouldExit: false,
				};
			}

			const lines: string[] = [
				'Remote Provider Disclosure',
				'',
				`Provider:         ${preview.providerId}`,
			];
			if (preview.modelId) lines.push(`Model:            ${preview.modelId}`);
			if (preview.endpointOrigin)
				lines.push(`Endpoint origin:  ${preview.endpointOrigin}`);
			if (preview.tokenSource)
				lines.push(`Token source:     ${preview.tokenSource}`);
			lines.push(
				`Timeout:          ${preview.timeoutMs}ms (${preview.timeoutMs / 1000}s)`,
			);
			lines.push('');
			lines.push('Context categories that may be sent to the remote provider:');
			for (const cat of preview.contextCategories) {
				lines.push(`  - ${cat.replace(/_/g, ' ')}`);
			}
			lines.push('');
			lines.push(preview.statement);
			lines.push('');
			lines.push('To accept this disclosure:  /config ai disclosure accept');
			lines.push('To decline:                 /config ai disclosure decline');

			return {
				command: 'config ai disclosure',
				kind: 'info',
				messages: lines,
				shouldExit: false,
			};
		}

		if (action === 'accept') {
			// Interactive keyboard confirmation before accepting disclosure
			if (shouldUseKeyboardConfirmation(context)) {
				const { preview, config: previewConfig } = await getDisclosurePreview({
					projectRoot,
				});

				const confirmationRequest = createTuiConfirmationRequest({
					actionKind: 'provider_disclosure',
					alternatives: [
						'Use local/no_provider mode instead.',
						'Decline and stay local-only.',
					],
					consequences: [
						'Project context categories may be sent to the remote provider.',
						'You can revoke this consent at any time via /config ai disclosure decline.',
						...(preview
							? [
									`Provider: ${preview.providerId}`,
									...(preview.modelId ? [`Model: ${preview.modelId}`] : []),
									`Timeout: ${previewConfig.timeoutMs}ms`,
								]
							: []),
					],
					destructive: false,
					message:
						'Remote provider disclosure describes what context may be sent when you use AI features. Accept only if you understand and consent to remote transmission.',
					options: yesNoOptions({
						acceptLabel: 'Accept Disclosure',
						cancelLabel: 'Decline',
					}),
					sensitive: true,
					sourceCommand: '/config ai disclosure accept',
					title: 'Accept Remote Provider Disclosure',
				});

				const previewLines: string[] = ['Remote Provider Disclosure', ''];
				if (preview) {
					previewLines.push(`Provider: ${preview.providerId}`);
					if (preview.modelId) previewLines.push(`Model: ${preview.modelId}`);
					previewLines.push('');
					previewLines.push(preview.statement);
				}
				previewLines.push('');
				previewLines.push('Use the keyboard to accept or decline below.');

				return {
					command: 'config ai disclosure accept',
					confirmationRequest,
					kind: 'info',
					messages: previewLines,
					shouldExit: false,
				};
			}

			const result = await acceptAiProviderDisclosure({ projectRoot });
			const lines: string[] = [];
			if (result.success) {
				lines.push('Remote provider disclosure accepted.');
				lines.push(
					`Accepted at: ${result.config.disclosure.acceptedAt ?? 'now'}`,
				);
				lines.push('Remote provider execution is now allowed.');
			} else {
				lines.push('Failed to accept disclosure.');
			}
			for (const d of result.diagnostics) {
				lines.push(`  [${d.severity.toUpperCase()}] ${d.message}`);
				if (d.recoveryHint) lines.push(`    Recovery: ${d.recoveryHint}`);
			}
			for (const m of result.messages) {
				if (m) lines.push(m);
			}

			return {
				command: 'config ai disclosure accept',
				kind: result.success ? 'success' : 'error',
				messages: lines,
				shouldExit: false,
			};
		}

		if (action === 'decline') {
			const result = await declineAiProviderDisclosure({ projectRoot });
			const lines: string[] = [];
			if (result.success) {
				lines.push('Remote provider disclosure declined.');
				lines.push('Remote provider execution is now blocked.');
				lines.push(
					'Run /config ai disclosure accept to re-enable remote execution.',
				);
			} else {
				lines.push('Failed to decline disclosure.');
			}
			for (const d of result.diagnostics) {
				lines.push(`  [${d.severity.toUpperCase()}] ${d.message}`);
				if (d.recoveryHint) lines.push(`    Recovery: ${d.recoveryHint}`);
			}
			for (const m of result.messages) {
				if (m) lines.push(m);
			}

			return {
				command: 'config ai disclosure decline',
				kind: result.success ? 'success' : 'error',
				messages: lines,
				shouldExit: false,
			};
		}

		return {
			command: 'config ai disclosure',
			kind: 'error',
			messages: [
				`Unknown disclosure action: ${action}`,
				'Valid actions: accept, decline',
			],
			shouldExit: false,
		};
	}

	// /config ai test
	if (subcommand === 'test') {
		// Use deterministic test runner in non-interactive context
		const result = await testAiProvider({
			_testRunner: async (config) => {
				// Synthetic test: always passes in fake/test context
				// Real provider testing requires a real provider port injection
				return {
					diagnosticCodes: [],
					durationMs: 0,
					endpointOrigin: config.endpoint ?? 'none',
					modelId: config.modelId,
					providerId: config.providerId,
					status: 'passed' as const,
					testedAt: new Date().toISOString(),
				};
			},
			projectRoot,
		});

		if (!result.success) {
			const lines: string[] = ['Provider test blocked or failed.'];
			for (const d of result.diagnostics) {
				lines.push(`  [${d.severity.toUpperCase()}] ${d.message}`);
				if (d.recoveryHint) lines.push(`    Recovery: ${d.recoveryHint}`);
			}
			return {
				command: 'config ai test',
				kind: 'warning',
				messages: lines,
				shouldExit: false,
			};
		}

		const lines: string[] = [];
		if (result.config.lastTest) {
			lines.push(...formatTestSummary(result.config.lastTest));
		}
		for (const d of result.diagnostics) {
			lines.push(`  [${d.severity.toUpperCase()}] ${d.message}`);
		}
		for (const m of result.messages) {
			if (m) lines.push(m);
		}

		return {
			command: 'config ai test',
			kind: 'success',
			messages: lines,
			shouldExit: false,
		};
	}

	// /config ai disable
	if (subcommand === 'disable') {
		const result = await disableAiProvider({ projectRoot });
		const lines: string[] = [];
		if (result.success) {
			lines.push('Provider disabled. AI execution is now blocked.');
			lines.push(
				'Run /config ai mode remote or /config ai mode local to re-enable.',
			);
		} else {
			lines.push('Failed to disable provider.');
		}
		for (const d of result.diagnostics) {
			lines.push(`  [${d.severity.toUpperCase()}] ${d.message}`);
			if (d.recoveryHint) lines.push(`    Recovery: ${d.recoveryHint}`);
		}
		for (const m of result.messages) {
			if (m) lines.push(m);
		}

		return {
			command: 'config ai disable',
			kind: result.success ? 'success' : 'error',
			messages: lines,
			shouldExit: false,
		};
	}

	// /config ai reset
	if (subcommand === 'reset') {
		const result = await resetAiProviderConfig({ projectRoot });
		const lines: string[] = [];
		if (result.success) {
			lines.push('Provider configuration reset to defaults.');
			lines.push(`  Mode: ${result.config.mode}`);
			lines.push(`  Timeout: ${result.config.timeoutMs}ms`);
			lines.push(
				'  All provider, model, endpoint, token, and disclosure settings cleared.',
			);
		} else {
			lines.push('Failed to reset provider configuration.');
		}
		for (const d of result.diagnostics) {
			lines.push(`  [${d.severity.toUpperCase()}] ${d.message}`);
			if (d.recoveryHint) lines.push(`    Recovery: ${d.recoveryHint}`);
		}
		for (const m of result.messages) {
			if (m) lines.push(m);
		}

		return {
			command: 'config ai reset',
			kind: result.success ? 'success' : 'error',
			messages: lines,
			shouldExit: false,
		};
	}

	// Unknown subcommand
	return {
		command: 'config ai',
		kind: 'error',
		messages: [
			`Unknown /config ai subcommand: ${subcommand}`,
			'Valid subcommands: status, mode, provider, providers, model, endpoint, token-env, timeout, disclosure, test, disable, reset',
		],
		shouldExit: false,
	};
}

// ---------------------------------------------------------------------------
// /outputs command — Phase 7: Derived Artifact Generation And Browsing
// ---------------------------------------------------------------------------

async function getOutputsResult(
	args: string[],
	context: RouterContext,
): Promise<SlashCommandResult> {
	const projectRoot = context.projectContext.root.rootPath ?? undefined;
	if (!projectRoot) {
		return {
			command: 'outputs',
			kind: 'error',
			messages: [
				'Cannot browse outputs because no project root was detected.',
				'Run logos from a project repository or initialize a workspace first.',
			],
			shouldExit: false,
			viewKind: 'output_browser' as TuiViewKind,
		};
	}

	const subcommand = args[0];

	// /outputs show <artifactId>
	if (subcommand === 'show') {
		const artifactId = args[1];
		if (!artifactId) {
			return {
				command: 'outputs show',
				kind: 'error',
				messages: ['Usage: /outputs show <artifact-id>'],
				shouldExit: false,
				viewKind: 'output_browser' as TuiViewKind,
			};
		}

		const result = await getOutput(projectRoot, artifactId);
		if ('error' in result) {
			return {
				command: 'outputs show',
				kind: 'error',
				messages: [result.error],
				shouldExit: false,
				viewKind: 'output_browser' as TuiViewKind,
			};
		}

		const lines: string[] = [
			'Output Detail',
			'',
			`Artifact ID:     ${result.artifactId}`,
			`Type:            ${result.artifactType}`,
			`Display Kind:    ${result.displayKind} (${OUTPUT_DISPLAY_KIND_LABELS[result.displayKind]})`,
			`Canonicality:    ${result.canonicality}`,
			`Status:          ${result.status}`,
			`Path:            ${result.path}`,
			`Generated:       ${result.generatedAt ?? '(unknown)'}`,
			`Run ID:          ${result.runId ?? '(none)'}`,
		];

		if (result.profileId) {
			lines.push(
				`Profile:         ${result.profileId}${result.profileVersion ? ` v${result.profileVersion}` : ''}`,
			);
		}
		if (result.documentationRoot) {
			lines.push(`Doc Root:        ${result.documentationRoot}`);
		}

		lines.push('');
		lines.push(
			`Source Document IDs: ${result.sourceDocumentIds.length > 0 ? result.sourceDocumentIds.join(', ') : '(none)'}`,
		);
		lines.push(
			`Source Artifact IDs: ${result.sourceArtifactIds.length > 0 ? result.sourceArtifactIds.join(', ') : '(none)'}`,
		);

		if (result.checksum) {
			lines.push(`Checksum:        ${result.checksum.slice(0, 16)}...`);
		}

		if (result.diagnostics.length > 0) {
			lines.push('');
			lines.push('Diagnostics:');
			for (const d of result.diagnostics.slice(0, 10)) {
				lines.push(`  [${d.severity.toUpperCase()}] ${d.message}`);
				if (d.recoveryHint) lines.push(`    Recovery: ${d.recoveryHint}`);
			}
		}

		lines.push('');
		lines.push('Next actions:');
		for (const action of result.nextActions) {
			lines.push(`  ${action}`);
		}

		return {
			command: 'outputs show',
			kind: 'info',
			messages: lines,
			shouldExit: false,
			viewKind: 'output_browser' as TuiViewKind,
		};
	}

	// /outputs sources <artifactId>
	if (subcommand === 'sources') {
		const artifactId = args[1];
		if (!artifactId) {
			return {
				command: 'outputs sources',
				kind: 'error',
				messages: ['Usage: /outputs sources <artifact-id>'],
				shouldExit: false,
				viewKind: 'output_browser' as TuiViewKind,
			};
		}

		const result = await getOutputSources(projectRoot, artifactId);
		if ('error' in result) {
			return {
				command: 'outputs sources',
				kind: 'error',
				messages: [result.error],
				shouldExit: false,
				viewKind: 'output_browser' as TuiViewKind,
			};
		}

		const lines: string[] = [
			'Output Sources',
			'',
			`Artifact ID:         ${result.artifactId}`,
			'',
			`Source Documents:    ${result.sourceDocumentIds.length > 0 ? result.sourceDocumentIds.join(', ') : '(none)'}`,
			`Source Artifacts:    ${result.sourceArtifactIds.length > 0 ? result.sourceArtifactIds.join(', ') : '(none)'}`,
		];

		if (result.sourcePaths.length > 0) {
			lines.push('');
			lines.push('Source paths:');
			for (const p of result.sourcePaths) {
				lines.push(`  ${p}`);
			}
		}

		if (result.sourceChecksums.length > 0) {
			lines.push('');
			lines.push('Source checksums:');
			for (const sc of result.sourceChecksums.slice(0, 10)) {
				lines.push(
					`  ${sc.artifactId}: ${sc.checksum?.slice(0, 16) ?? '(none)'}`,
				);
			}
		}

		return {
			command: 'outputs sources',
			kind: 'info',
			messages: lines,
			shouldExit: false,
			viewKind: 'output_browser' as TuiViewKind,
		};
	}

	// /outputs stale
	if (subcommand === 'stale') {
		const result = await listStaleOutputs(projectRoot);
		if ('error' in result) {
			return {
				command: 'outputs stale',
				kind: 'error',
				messages: [result.error],
				shouldExit: false,
				viewKind: 'output_browser' as TuiViewKind,
			};
		}

		const lines: string[] = [
			'Stale Outputs',
			'',
			`Stale:    ${result.staleCount}`,
			`Orphaned: ${result.orphanedCount}`,
			`Missing:  ${result.missingCount}`,
			`Blocked:  ${result.blockedCount}`,
		];

		if (result.items.length > 0) {
			lines.push('');
			lines.push('Stale / blocked / missing outputs:');
			for (const item of result.items.slice(0, 20)) {
				lines.push(
					`  [${item.status}] [${item.displayKind}] ${item.artifactId}`,
				);
				lines.push(`    Path: ${item.path}`);
			}
			if (result.items.length > 20) {
				lines.push(`  ... and ${result.items.length - 20} more`);
			}
		}

		lines.push('');
		lines.push('Next actions:');
		for (const action of result.nextActions) {
			lines.push(`  ${action}`);
		}

		return {
			command: 'outputs stale',
			kind: result.staleCount > 0 ? 'warning' : 'info',
			messages: lines,
			shouldExit: false,
			viewKind: 'output_browser' as TuiViewKind,
		};
	}

	// Parse filter flags for /outputs and /outputs list
	const isListSubcommand = subcommand === 'list' || subcommand === undefined;
	if (isListSubcommand) {
		const argsForFilter = subcommand === 'list' ? args.slice(1) : args;

		let filterType: string | undefined;
		let filterCanonicality: 'canonical' | 'derived' | undefined;
		let filterStatus: string | undefined;

		let i = 0;
		while (i < argsForFilter.length) {
			const arg = argsForFilter[i];
			if (arg === '--type' && i + 1 < argsForFilter.length) {
				filterType = argsForFilter[i + 1];
				i += 2;
			} else if (arg === '--derived') {
				filterCanonicality = 'derived';
				i++;
			} else if (arg === '--canonical') {
				filterCanonicality = 'canonical';
				i++;
			} else if (arg === '--status' && i + 1 < argsForFilter.length) {
				filterStatus = argsForFilter[i + 1];
				i += 2;
			} else {
				i++;
			}
		}

		const filter: Record<string, unknown> = {};
		if (filterType) {
			switch (filterType) {
				case 'canonical':
					filter.artifactType = 'canonical_markdown';
					break;
				case 'html':
					filter.artifactType = 'html';
					break;
				case 'agent-pack':
					filter.artifactType = 'agent_pack';
					break;
				case 'report':
					filter.artifactType = 'report';
					break;
				case 'executive':
					filter.displayKind = 'executive_output';
					break;
				default:
					return {
						command: 'outputs',
						kind: 'error',
						messages: [
							`Unknown --type value: ${filterType}`,
							'Valid types: canonical, html, agent-pack, report, executive',
						],
						shouldExit: false,
						viewKind: 'output_browser' as TuiViewKind,
					};
			}
		}
		if (filterCanonicality) {
			filter.canonicality = filterCanonicality;
		}
		if (filterStatus) {
			if (
				filterStatus !== 'stale' &&
				filterStatus !== 'current' &&
				filterStatus !== 'generated' &&
				filterStatus !== 'failed' &&
				filterStatus !== 'blocked' &&
				filterStatus !== 'missing'
			) {
				return {
					command: 'outputs',
					kind: 'error',
					messages: [
						`Unknown --status value: ${filterStatus}`,
						'Valid statuses: stale, current, generated, failed, blocked, missing',
					],
					shouldExit: false,
					viewKind: 'output_browser' as TuiViewKind,
				};
			}
			// Map 'current' to 'generated' for the registry
			filter.status = filterStatus === 'current' ? 'generated' : filterStatus;
		}

		// Use output browser service with filter
		const result = await listOutputs({
			filter:
				Object.keys(filter).length > 0
					? (filter as Parameters<typeof listOutputs>[0]['filter'])
					: undefined,
			projectRoot,
		});

		if ('error' in result) {
			return {
				command: 'outputs',
				kind: 'error',
				messages: [result.error],
				shouldExit: false,
				viewKind: 'output_browser' as TuiViewKind,
			};
		}

		const lines: string[] = [
			'Output Browser',
			'',
			`Total artifacts:  ${result.summary.totalArtifacts}`,
			`Canonical:        ${result.summary.canonicalCount}`,
			`Derived:          ${result.summary.derivedCount}`,
			`Current:          ${result.summary.currentCount}`,
			`Stale:            ${result.summary.staleCount}`,
			`Failed:           ${result.summary.failedCount}`,
			`Blocked:          ${result.summary.blockedCount}`,
		];

		if (result.filteredCount !== result.totalCount) {
			lines.push('');
			lines.push(`Filtered: ${result.filteredCount} of ${result.totalCount}`);
			if (filterType) lines.push(`  Type: ${filterType}`);
			if (filterCanonicality)
				lines.push(`  Canonicality: ${filterCanonicality}`);
			if (filterStatus) lines.push(`  Status: ${filterStatus}`);
		}

		if (result.items.length > 0) {
			lines.push('');
			lines.push('Outputs:');
			for (const item of result.items.slice(0, 25)) {
				lines.push(
					`  [${item.status}] [${item.canonicality}] [${item.displayKind}] ${item.artifactId}`,
				);
				lines.push(`    Path: ${item.path}`);
				if (item.generatedAt) {
					lines.push(`    Generated: ${item.generatedAt}`);
				}
			}
			if (result.items.length > 25) {
				lines.push(`  ... and ${result.items.length - 25} more`);
			}
		}

		lines.push('');
		lines.push(
			'Commands: /outputs show <id>, /outputs sources <id>, /outputs stale',
		);

		return {
			command: 'outputs',
			kind:
				result.summary.staleCount > 0 || result.summary.failedCount > 0
					? 'warning'
					: 'info',
			messages: lines,
			shouldExit: false,
			viewKind: 'output_browser' as TuiViewKind,
		};
	}

	// Unknown subcommand
	return {
		command: 'outputs',
		kind: 'error',
		messages: [
			`Unknown /outputs subcommand: ${subcommand}`,
			'Valid subcommands: list, show <id>, sources <id>, stale',
		],
		shouldExit: false,
		viewKind: 'output_browser' as TuiViewKind,
	};
}
