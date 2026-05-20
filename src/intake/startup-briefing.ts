/** Startup Briefing — deterministic fallback and AI-backed startup briefing */

import { checkProviderDisclosure } from '../ai/provider-disclosure.js';
import type {
	AiProviderDiagnostic,
	AiProviderPort,
	StartupBriefingResponse,
} from '../ai/provider-port.js';
import { validateStartupBriefingResponse } from '../ai/provider-responses.js';
import { redactString } from '../runtime/redaction.js';
import type { IntakeContext } from './intake-context-types.js';
import { buildStartupBriefingRequest } from './provider-request-builders.js';
import type {
	StartupBriefing,
	StartupBriefingAction,
	StartupBriefingDiagnostic,
	StartupBriefingFallbackReason,
	StartupBriefingInput,
	StartupBriefingResult,
	StartupBriefingSection,
} from './startup-briefing-types.js';

// ---------------------------------------------------------------------------
// Deterministic fallback briefing builder
// ---------------------------------------------------------------------------

export function buildDeterministicStartupBriefing(
	input: StartupBriefingInput,
): StartupBriefing {
	const diagnostics: StartupBriefingDiagnostic[] = [];
	const sections: StartupBriefingSection[] = [];
	const actions: StartupBriefingAction[] = [];

	if (!input.workspaceInitialized) {
		return buildUninitializedBriefing(input);
	}

	// Section: Workspace summary
	const workspaceLines: string[] = [
		`Project root: ${redactString(input.projectRoot)}`,
		`Documentation root: ${redactString(input.documentationRoot)}`,
		`Active profile: ${input.activeProfileId ?? 'unknown'}`,
	];
	sections.push({
		isSuggestion: false,
		label: 'Workspace',
		lines: workspaceLines,
		sectionId: 'workspace',
	});

	// Section: State summary
	const stateLines: string[] = [];
	if (input.sessionCount > 0)
		stateLines.push(`Sessions: ${input.sessionCount}`);
	if (input.runCount > 0) stateLines.push(`Runs: ${input.runCount}`);
	if (input.artifactCount > 0)
		stateLines.push(`Artifacts: ${input.artifactCount}`);
	if (input.openQuestionCount > 0)
		stateLines.push(`Open questions: ${input.openQuestionCount}`);
	if (input.riskCount > 0)
		stateLines.push(
			`Risks: ${input.riskCount} (${input.activeRiskCount} active)`,
		);
	if (input.proposalCount > 0) {
		stateLines.push(
			`Proposals: ${input.proposalCount} (${input.pendingProposalCount} pending, ${input.acceptedProposalCount} accepted)`,
		);
	}
	if (input.validationGapCount > 0)
		stateLines.push(`Validation gaps: ${input.validationGapCount}`);

	if (stateLines.length > 0) {
		sections.push({
			isSuggestion: false,
			label: 'State',
			lines: stateLines,
			sectionId: 'state',
		});
	}

	// Section: Next question cluster hint
	let nextQuestionHint: string | undefined;
	if (input.questionCluster && input.questionCluster.questions.length > 0) {
		const clusterLines: string[] = [];
		clusterLines.push(
			input.questionClusterSummary ?? input.questionCluster.reasonSummary,
		);
		clusterLines.push(
			`${input.questionCluster.questions.length} question(s) in this cluster`,
		);

		for (const q of input.questionCluster.questions.slice(0, 3)) {
			clusterLines.push(`  • ${q.text}`);
		}
		if (input.questionCluster.questions.length > 3) {
			clusterLines.push(
				`  ... and ${input.questionCluster.questions.length - 3} more`,
			);
		}

		sections.push({
			isSuggestion: true,
			label: 'Next Question Cluster',
			lines: clusterLines,
			sectionId: 'question_cluster',
		});

		nextQuestionHint = `Next: ${input.questionCluster.questions[0]?.text ?? 'continue intake'}`;
	}

	// Section: Provider status
	if (!input.providerConfigured) {
		sections.push({
			isSuggestion: true,
			label: 'Provider',
			lines: ['AI provider is not configured.'],
			sectionId: 'provider',
		});

		actions.push({
			actionId: 'config_ai',
			command: '/config ai',
			description: 'Configure an AI provider for assisted intake',
			isImplemented: false,
			isSuggestion: true,
			priority: 'medium',
		});
	}

	// Build suggested actions
	actions.push({
		actionId: 'status',
		command: '/status',
		description: 'View full workspace status',
		isImplemented: true,
		isSuggestion: false,
		priority: 'low',
	});

	if (input.questionCluster && input.questionCluster.questions.length > 0) {
		actions.push({
			actionId: 'continue',
			command: '/continue',
			description: 'Continue intake session',
			isImplemented: true,
			isSuggestion: false,
			priority: 'high',
		});
	}

	if (input.pendingProposalCount > 0) {
		actions.push({
			actionId: 'review_proposals',
			command: '/status',
			description: `${input.pendingProposalCount} proposal(s) pending review`,
			isImplemented: true,
			isSuggestion: true,
			priority: 'high',
		});
	}

	if (input.openQuestionCount > 0) {
		actions.push({
			actionId: 'review_questions',
			command: '/continue',
			description: `${input.openQuestionCount} open question(s) to address`,
			isImplemented: true,
			isSuggestion: true,
			priority: 'medium',
		});
	}

	// Core commands
	actions.push({
		actionId: 'future_generate',
		command: '/generate',
		description: 'Generate canonical Markdown documentation',
		isImplemented: true,
		isSuggestion: true,
		priority: 'low',
	});

	actions.push({
		actionId: 'future_validate',
		command: '/validate',
		description: 'Run deterministic validation',
		isImplemented: true,
		isSuggestion: true,
		priority: 'low',
	});

	actions.push({
		actionId: 'future_diagnose',
		command: '/diagnose',
		description: 'Run diagnostic analysis',
		isImplemented: true,
		isSuggestion: true,
		priority: 'low',
	});

	// Append workspace diagnostics as info
	for (const d of input.workspaceDiagnostics) {
		diagnostics.push({ ...d });
	}

	const summary = buildSummary(input);

	return {
		actions,
		diagnostics,
		fallbackReason: undefined,
		mode: 'deterministic_fallback',
		nextQuestionHint,
		sections,
		source: 'deterministic_fallback',
		status: 'success',
		summary,
	};
}

// ---------------------------------------------------------------------------
// Uninitialized workspace briefing
// ---------------------------------------------------------------------------

function buildUninitializedBriefing(
	_input: StartupBriefingInput,
): StartupBriefing {
	return {
		actions: [
			{
				actionId: 'init',
				command: '/init',
				description: 'Initialize a LOGOS workspace',
				isImplemented: true,
				isSuggestion: false,
				priority: 'high',
			},
			{
				actionId: 'help',
				command: '/help',
				description: 'List available commands',
				isImplemented: true,
				isSuggestion: false,
				priority: 'medium',
			},
			{
				actionId: 'status',
				command: '/status',
				description: 'View runtime status',
				isImplemented: true,
				isSuggestion: false,
				priority: 'low',
			},
		],
		diagnostics: [],
		fallbackReason: undefined,
		mode: 'deterministic_fallback',
		nextQuestionHint: undefined,
		sections: [
			{
				isSuggestion: true,
				label: 'Initialization',
				lines: [
					'LOGOS workspace is not initialized.',
					'Run /init to create a workspace and start using LOGOS.',
				],
				sectionId: 'init',
			},
		],
		source: 'deterministic_fallback',
		status: 'success',
		summary: 'LOGOS workspace not initialized. Run /init to begin.',
	};
}

// ---------------------------------------------------------------------------
// AI-backed startup briefing
// ---------------------------------------------------------------------------

export interface BuildAiStartupBriefingOptions {
	input: StartupBriefingInput;
	provider: AiProviderPort;
	intakeContext: IntakeContext;
	disclosureConsent: 'accepted' | 'declined' | 'absent';
}

export async function buildAiStartupBriefing(
	options: BuildAiStartupBriefingOptions,
): Promise<StartupBriefingResult> {
	const { input, provider, intakeContext, disclosureConsent } = options;

	// Check disclosure for remote providers
	if (provider.providerKind === 'remote') {
		const disclosureResult = checkProviderDisclosure({
			consent: disclosureConsent,
			contextCategories: [],
			contextCategorySummary: {},
			providerId: provider.providerId,
			providerKind: provider.providerKind,
		});

		if (!disclosureResult.allowed) {
			const fallback = buildDeterministicStartupBriefing(input);
			const fallbackReason: StartupBriefingFallbackReason =
				disclosureConsent === 'absent'
					? 'disclosure_absent'
					: 'disclosure_declined';
			return {
				briefing: {
					...fallback,
					fallbackReason,
					mode: 'deterministic_fallback',
					source: 'deterministic_fallback',
				},
				fallbackReason,
				providerDiagnostics: disclosureResult.diagnostics.map((d) => ({
					...d,
					severity: d.severity as 'error' | 'warning' | 'info',
				})),
			};
		}
	}

	// Build request from intake context
	const request = buildStartupBriefingRequest(intakeContext);
	request.providerId = provider.providerId;
	request.providerKind = provider.providerKind;

	let response: StartupBriefingResponse | undefined;
	let providerDiagnostics: AiProviderDiagnostic[] = [];

	try {
		response = await provider.startupBriefing(request);
		providerDiagnostics = Array.isArray(response?.diagnostics)
			? [...response.diagnostics]
			: [];
	} catch (err) {
		const fallback = buildDeterministicStartupBriefing(input);
		return {
			briefing: {
				...fallback,
				fallbackReason: 'provider_execution_failed',
				mode: 'deterministic_fallback',
				source: 'deterministic_fallback',
			},
			fallbackReason: 'provider_execution_failed',
			providerDiagnostics: [
				{
					code: 'E_PROVIDER_EXECUTION_FAILED',
					message: `Provider execution failed: ${err instanceof Error ? err.message : String(err)}`,
					path: undefined,
					pointer: '/provider/execution',
					recoveryHint: 'Check provider configuration and try again',
					severity: 'error',
				},
			],
		};
	}

	// Validate response
	const validation = validateStartupBriefingResponse(response);
	if (!validation.valid) {
		const fallback = buildDeterministicStartupBriefing(input);
		return {
			briefing: {
				...fallback,
				fallbackReason: 'provider_response_invalid',
				mode: 'deterministic_fallback',
				source: 'deterministic_fallback',
			},
			fallbackReason: 'provider_response_invalid',
			providerDiagnostics: [...providerDiagnostics, ...validation.diagnostics],
		};
	}

	// Check if provider response is a failure
	if (response.status === 'failure') {
		const fallback = buildDeterministicStartupBriefing(input);
		return {
			briefing: {
				...fallback,
				fallbackReason: 'provider_execution_failed',
				mode: 'deterministic_fallback',
				source: 'deterministic_fallback',
			},
			fallbackReason: 'provider_execution_failed',
			providerDiagnostics,
		};
	}

	// Build AI-assisted briefing from provider response
	const aiBriefing = mergeAiBriefing(input, response, providerDiagnostics);

	return {
		briefing: aiBriefing,
		fallbackReason: undefined,
		providerDiagnostics,
	};
}

// ---------------------------------------------------------------------------
// Merge AI provider response with deterministic input
// ---------------------------------------------------------------------------

function mergeAiBriefing(
	input: StartupBriefingInput,
	response: StartupBriefingResponse,
	providerDiagnostics: AiProviderDiagnostic[],
): StartupBriefing {
	const sections: StartupBriefingSection[] = [];

	// Workspace section (from deterministic input)
	const workspaceLines: string[] = [
		`Project root: ${redactString(input.projectRoot)}`,
		`Documentation root: ${redactString(input.documentationRoot)}`,
		`Active profile: ${input.activeProfileId ?? 'unknown'}`,
	];
	sections.push({
		isSuggestion: false,
		label: 'Workspace',
		lines: workspaceLines,
		sectionId: 'workspace',
	});

	// State summary (from deterministic input)
	const stateLines: string[] = [];
	if (input.sessionCount > 0)
		stateLines.push(`Sessions: ${input.sessionCount}`);
	if (input.runCount > 0) stateLines.push(`Runs: ${input.runCount}`);
	if (input.artifactCount > 0)
		stateLines.push(`Artifacts: ${input.artifactCount}`);
	if (input.openQuestionCount > 0)
		stateLines.push(`Open questions: ${input.openQuestionCount}`);
	if (input.riskCount > 0)
		stateLines.push(
			`Risks: ${input.riskCount} (${input.activeRiskCount} active)`,
		);
	if (input.proposalCount > 0) {
		stateLines.push(
			`Proposals: ${input.proposalCount} (${input.pendingProposalCount} pending, ${input.acceptedProposalCount} accepted)`,
		);
	}
	if (input.validationGapCount > 0)
		stateLines.push(`Validation gaps: ${input.validationGapCount}`);

	if (stateLines.length > 0) {
		sections.push({
			isSuggestion: false,
			label: 'State',
			lines: stateLines,
			sectionId: 'state',
		});
	}

	// AI briefing items as suggestions
	if (response.briefingItems.length > 0) {
		const aiLines = response.briefingItems.map((item) => {
			const prefix =
				item.priority === 'critical'
					? '[CRITICAL] '
					: item.priority === 'high'
						? '[HIGH] '
						: '';
			return `  • ${prefix}${redactString(item.text)}`;
		});
		sections.push({
			isSuggestion: true,
			label: 'AI Briefing',
			lines: [response.summary ?? 'AI briefing items:'].concat(aiLines),
			sectionId: 'ai_briefing',
		});
	}

	// Next question cluster hint
	let nextQuestionHint: string | undefined;
	if (input.questionCluster && input.questionCluster.questions.length > 0) {
		nextQuestionHint = `Next: ${input.questionCluster.questions[0]?.text ?? 'continue intake'}`;
	}

	// Actions
	const actions = buildActions(input, response);

	// Diagnostics
	const diagnostics: StartupBriefingDiagnostic[] = [];
	for (const d of input.workspaceDiagnostics) {
		diagnostics.push({ ...d });
	}
	for (const d of providerDiagnostics) {
		if (d.severity !== 'info') {
			diagnostics.push({
				code: d.code,
				message: d.message,
				recoveryHint: d.recoveryHint,
				severity: d.severity,
			});
		}
	}

	const summary = buildSummary(input);

	return {
		actions,
		diagnostics,
		fallbackReason: undefined,
		mode: 'ai_assisted',
		nextQuestionHint,
		sections,
		source: 'ai_provider',
		status: response.status === 'success' ? 'success' : 'degraded',
		summary,
	};
}

// ---------------------------------------------------------------------------
// Build actions from deterministic state and AI response
// ---------------------------------------------------------------------------

function buildActions(
	input: StartupBriefingInput,
	response: StartupBriefingResponse,
): StartupBriefingAction[] {
	const actions: StartupBriefingAction[] = [];

	// Add AI-sourced suggestions
	for (const item of response.briefingItems) {
		actions.push({
			actionId: item.id,
			command: '/continue',
			description: redactString(item.text),
			isImplemented: true,
			isSuggestion: true,
			priority: item.priority === 'critical' ? 'high' : item.priority,
		});
	}

	// Always include core commands
	actions.push({
		actionId: 'status',
		command: '/status',
		description: 'View full workspace status',
		isImplemented: true,
		isSuggestion: false,
		priority: 'low',
	});

	if (input.questionCluster && input.questionCluster.questions.length > 0) {
		actions.push({
			actionId: 'continue',
			command: '/continue',
			description: 'Continue intake session',
			isImplemented: true,
			isSuggestion: false,
			priority: 'high',
		});
	}

	if (!input.providerConfigured) {
		actions.push({
			actionId: 'config_ai',
			command: '/config ai',
			description: 'Configure an AI provider for assisted intake',
			isImplemented: false,
			isSuggestion: true,
			priority: 'medium',
		});
	}

	return actions;
}

// ---------------------------------------------------------------------------
// Build summary line
// ---------------------------------------------------------------------------

function buildSummary(input: StartupBriefingInput): string {
	const parts: string[] = [];

	if (input.openQuestionCount > 0) {
		parts.push(`${input.openQuestionCount} open question(s)`);
	}
	if (input.pendingProposalCount > 0) {
		parts.push(`${input.pendingProposalCount} pending proposal(s)`);
	}
	if (input.activeRiskCount > 0) {
		parts.push(`${input.activeRiskCount} active risk(s)`);
	}
	if (input.questionCluster && input.questionCluster.questions.length > 0) {
		parts.push(`${input.questionCluster.questions.length} planned question(s)`);
	}

	if (parts.length === 0) {
		return 'Workspace initialized. No outstanding items.';
	}

	return `Workspace has ${parts.join(', ')}.`;
}
