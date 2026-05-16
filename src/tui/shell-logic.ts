/** TUI shell logic — extracted for testability */

import {
	buildDeterministicStartupBriefing,
	type StartupBriefing,
	type StartupBriefingInput,
} from '../intake/index.js';
import { renderStartupBriefing } from '../intake/startup-briefing-renderer.js';
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

export function createRouterContext(): RouterContext {
	return {
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
		questionCluster: undefined,
		questionClusterSummary: undefined,
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

export async function processCommand(
	input: string,
	context: RouterContext,
): Promise<{ messages: Message[]; shouldExit: boolean }> {
	const trimmed = input.trim();
	if (trimmed.length === 0) {
		return { messages: [], shouldExit: false };
	}

	const messages: Message[] = [{ id: 0, sender: 'user', text: trimmed }];
	const parsed = parseSlashCommand(trimmed);
	const result = await routeSlashCommand(parsed, context);

	for (const msg of result.messages) {
		messages.push({ id: messages.length, sender: 'system', text: msg });
	}

	return { messages, shouldExit: result.shouldExit };
}
