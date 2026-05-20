/** TUI shell logic — extracted for testability */

import {
	buildDeterministicStartupBriefing,
	planNextQuestions,
	type StartupBriefing,
	type StartupBriefingInput,
} from '../intake/index.js';
import { renderStartupBriefing } from '../intake/startup-briefing-renderer.js';
import { buildContractGraph } from '../profiles/contract-graph.js';
import { loadDocumentationContract } from '../profiles/documentation-contract.js';
import { detectProjectContext } from '../runtime/project-context.js';
import { readWorkspaceState } from '../state/workspace-state-repository.js';
import { parseSlashCommand } from './slash-parser.js';
import { routeSlashCommand } from './slash-router.js';
import type { RouterContext } from './types.js';

export interface Message {
	id: number;
	sender: 'user' | 'system';
	text: string;
}

export interface CreateRouterContextOptions {
	interactive?: boolean | undefined;
	confirmationBypass?: boolean | undefined;
}

export function createRouterContext(
	options?: CreateRouterContextOptions,
): RouterContext {
	return {
		confirmationBypass: options?.confirmationBypass,
		interactive: options?.interactive,
		projectContext: detectProjectContext(),
	};
}

export async function buildStartupBriefingInputFromContext(
	projectRoot: string,
): Promise<StartupBriefingInput | undefined> {
	const readResult = await readWorkspaceState({ projectRoot });
	if (!readResult.success || !readResult.state) {
		return undefined;
	}

	const state = readResult.state;
	const workspaceInitialized = readResult.initializationState === 'initialized';

	const openQuestions = state.openQuestions ?? [];
	const proposals = state.proposals ?? [];
	const risks = state.risks ?? [];
	const sessions = state.sessions ?? [];
	const runs = state.runs ?? [];
	const artifacts = state.artifacts ?? [];

	const pendingProposals = proposals.filter(
		(p) => p.status === 'proposed',
	).length;
	const acceptedProposals = proposals.filter(
		(p) => p.status === 'accepted',
	).length;
	const activeRisks = risks.filter(
		(r) => r.status === 'identified' || r.status === 'monitored',
	).length;

	const providerConfigured = state.provider?.enabled === true;
	const providerKind = state.provider?.providerId;

	// Provider consent: check if disclosure was accepted
	let providerConsent: 'accepted' | 'declined' | 'absent' = 'absent';
	if (state.provider?.disclosureAcceptedAt) {
		providerConsent = 'accepted';
	}

	const workspaceDiagnostics = readResult.diagnostics.map((d) => ({
		code: d.code,
		message: d.message,
		recoveryHint: d.recoveryHint,
		severity: d.severity,
	}));

	let questionCluster: StartupBriefingInput['questionCluster'];
	let questionClusterSummary: string | undefined;
	try {
		const contract = await loadDocumentationContract({
			profileId: state.profile.profileId,
			repoRoot: projectRoot,
		});
		const graphResult = buildContractGraph(contract);
		const plan = planNextQuestions({
			contract,
			graph: graphResult.graph,
			state,
		});
		questionCluster = plan.cluster;
		questionClusterSummary = plan.cluster?.reasonSummary;
	} catch {
		workspaceDiagnostics.push({
			code: 'startup_question_cluster_unavailable',
			message: 'Startup briefing could not plan the next question cluster.',
			recoveryHint:
				'Run /status to inspect workspace state and profile loading.',
			severity: 'warning',
		});
	}

	return {
		acceptedProposalCount: acceptedProposals,
		activeProfileId: state.profile.profileId,
		activeRiskCount: activeRisks,
		artifactCount: artifacts.length,
		documentationRoot: state.documentation.rootPath,
		openQuestionCount: openQuestions.filter((q) => q.status === 'open').length,
		pendingProposalCount: pendingProposals,
		projectRoot,
		proposalCount: proposals.length,
		providerConfigured,
		providerConsent,
		providerKind,
		questionCluster,
		questionClusterSummary,
		riskCount: risks.length,
		runCount: runs.length,
		sessionCount: sessions.length,
		validationGapCount: 0,
		workspaceDiagnostics,
		workspaceInitialized,
	};
}

export async function generateStartupBriefing(
	projectRoot: string,
): Promise<StartupBriefing | undefined> {
	const input = await buildStartupBriefingInputFromContext(projectRoot);
	if (!input) return undefined;
	return buildDeterministicStartupBriefing(input);
}

export function renderBriefingAsMessages(briefing: StartupBriefing): string[] {
	return renderStartupBriefing(briefing);
}

export interface ProcessCommandResult {
	messages: Message[];
	shouldExit: boolean;
	/** Optional confirmation request requiring interactive resolution */
	confirmationRequest?:
		| import('./types.js').SlashCommandResult['confirmationRequest']
		| undefined;
}

export async function processCommand(
	input: string,
	context: RouterContext,
): Promise<ProcessCommandResult> {
	const trimmed = input.trim();
	if (trimmed.length === 0) {
		return { messages: [], shouldExit: false };
	}

	const messages: Message[] = [{ id: 0, sender: 'user', text: trimmed }];

	try {
		const parsed = parseSlashCommand(trimmed);
		const result = await routeSlashCommand(parsed, context);

		for (const msg of result.messages) {
			messages.push({ id: messages.length, sender: 'system', text: msg });
		}

		return {
			confirmationRequest: result.confirmationRequest,
			messages,
			shouldExit: result.shouldExit,
		};
	} catch (err) {
		// Safe error boundary: catch unknown errors and display safe diagnostics
		// without crashing the TUI shell
		const { wrapUnknownError, formatDiagnosticForTerminal } = await import(
			'../runtime/diagnostics.js'
		);
		const { redactString } = await import('../runtime/redaction.js');

		const diagnostic = wrapUnknownError(err, { area: 'TUI' });
		messages.push({
			id: messages.length,
			sender: 'system',
			text: '[ERROR] An unexpected error occurred while processing this command.',
		});
		for (const line of formatDiagnosticForTerminal(diagnostic)) {
			messages.push({
				id: messages.length,
				sender: 'system',
				text: `  ${redactString(line)}`,
			});
		}
		messages.push({
			id: messages.length,
			sender: 'system',
			text: 'The shell is still running. Run /help for available commands.',
		});

		return { messages, shouldExit: false };
	}
}
