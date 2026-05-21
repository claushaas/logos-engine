/** Intake Service — state-backed free-form text intake pipeline */

import { getAiProviderStatus } from '../ai/provider-config-service.js';
import { evaluateAiProviderExecutionPolicy } from '../ai/provider-execution-policy.js';
import type {
	WorkspaceSession,
	WorkspaceState,
} from '../state/workspace-state.schema.js';
import {
	readWorkspaceState,
	updateWorkspaceState,
} from '../state/workspace-state-repository.js';
import type { DeterministicInterpretationResult } from './deterministic-interpreter.js';
import { interpretIntakeText } from './deterministic-interpreter.js';
import {
	createIntakeTurn,
	updateIntakeTurn,
} from './intake-turn-repository.js';
import type { IntakeTurn, IntakeTurnDiagnostic } from './intake-turn-types.js';
import { createProposals } from './proposal-repository.js';
import type { ReviewableProposal } from './proposal-types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FreeFormIntakeOptions {
	text: string;
	projectRoot: string;
	dryRun?: boolean;
	idFactory?: () => string;
	clock?: { now(): string };
	// Injected session or we auto-resolve/create one
	session?: WorkspaceSession | undefined;
}

export interface FreeFormIntakeResult {
	success: boolean;
	turn: IntakeTurn;
	proposals: ReviewableProposal[];
	messages: string[];
	diagnostics: IntakeTurnDiagnostic[];
	interpretationSource: 'deterministic' | 'ai-provider' | 'none';
	nextActions: string[];
	dryRun: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultClock(): { now(): string } {
	return { now: () => new Date().toISOString() };
}

function defaultIdFactory(prefix: string): () => string {
	return () =>
		`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Main intake entry point
// ---------------------------------------------------------------------------

export async function processFreeFormIntake(
	options: FreeFormIntakeOptions,
): Promise<FreeFormIntakeResult> {
	const clock = options.clock ?? defaultClock();
	const turnIdFactory = options.idFactory ?? defaultIdFactory('turn');
	const propIdFactory = () => (options.idFactory ?? defaultIdFactory('prop'))();
	const now = clock.now();
	const diagnostics: IntakeTurnDiagnostic[] = [];
	const messages: string[] = [];
	const nextActions: string[] = [];

	// 1. Read workspace state
	const readResult = await readWorkspaceState({
		projectRoot: options.projectRoot,
	});

	if (!readResult.success || !readResult.state) {
		return {
			diagnostics: [
				{
					code: 'LOGOS_INTAKE_WORKSPACE_NOT_FOUND',
					message: 'Workspace state not available. Cannot create intake turn.',
					recoveryHint: 'Run /init to initialize a LOGOS workspace.',
					severity: 'error',
				},
			],
			dryRun: options.dryRun ?? false,
			interpretationSource: 'none',
			messages: ['Cannot process intake: workspace not initialized.'],
			nextActions: ['Run /init', 'Run /help'],
			proposals: [],
			success: false,
			turn: createEmptyTurn(),
		};
	}

	const state = readResult.state;
	let session = options.session;

	// 2. Resolve or create session (persist when new)

	if (!session) {
		const sessions = state.sessions;
		const activeIntake = sessions.find(
			(s) => s.sessionType === 'intake' && s.status === 'open',
		);
		const activeTui = sessions.find(
			(s) => s.sessionType === 'tui' && s.status === 'open',
		);
		session = activeIntake ?? activeTui ?? undefined;
	}

	if (!session) {
		// Create and persist a new intake session
		const newSession: WorkspaceSession = {
			commandOrTrigger: 'free-form intake',
			relatedArtifactIds: [],
			relatedDecisionIds: [],
			relatedQuestionIds: [],
			relatedRunIds: [],
			sessionId: `session-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
			sessionType: 'intake',
			startedAt: now,
			status: 'open',
		};

		const sessionResult = await updateWorkspaceState({
			dryRun: options.dryRun,
			projectRoot: options.projectRoot,
			updater: (s: WorkspaceState) => {
				const updated = structuredClone(s);
				updated.sessions = [...updated.sessions, newSession];
				return updated;
			},
		});

		if (sessionResult.success) {
			session = newSession;
		} else {
			// Session persistence failed; continue with in-memory session only
			session = newSession;
			diagnostics.push({
				code: 'LOGOS_INTAKE_SESSION_PERSIST_FAILED',
				message:
					'Failed to persist intake session; turn will still be captured.',
				recoveryHint: 'Check workspace state permissions.',
				severity: 'warning',
			});
		}
	}

	// 3. Create and persist intake turn
	const turnId = turnIdFactory();
	const evidenceRef = `intake-turn:${turnId}`;

	const turn: IntakeTurn = {
		createdAt: now,
		derivedProposalIds: [],
		diagnostics: [],
		evidenceRef,
		id: turnId,
		role: 'user',
		sessionId: session.sessionId,
		status: 'captured',
		text: options.text,
		workspaceRef: state.workspace.workspaceId,
	};

	const createResult = await createIntakeTurn({
		dryRun: options.dryRun,
		projectRoot: options.projectRoot,
		turn,
	});

	if (!createResult.success) {
		diagnostics.push(...createResult.diagnostics, {
			code: 'LOGOS_INTAKE_TURN_PERSIST_FAILED',
			message: 'Failed to persist intake turn.',
			recoveryHint: 'Check workspace state permissions and retry.',
			severity: 'error',
		});
		return {
			diagnostics,
			dryRun: options.dryRun ?? false,
			interpretationSource: 'none',
			messages: createResult.diagnostics.map((d) => d.message),
			nextActions: ['Run /status to check workspace state', 'Retry input'],
			proposals: [],
			success: false,
			turn: createResult.turn,
		};
	}

	const persistedTurn = createResult.turn;
	messages.push(`[Turn] Captured: ${persistedTurn.id}`);
	messages.push(
		`  Text: "${options.text.substring(0, 100)}${options.text.length > 100 ? '...' : ''}"`,
	);

	// 4. Check provider configuration
	let providerBlocked = true;
	let providerDiag:
		| { message: string; recoveryHint?: string | undefined }
		| undefined;

	try {
		const configResult = await getAiProviderStatus({
			projectRoot: options.projectRoot,
		});
		if (configResult.success && configResult.config) {
			const policy = evaluateAiProviderExecutionPolicy(configResult.config);
			providerBlocked = !policy.allowed;
			if (policy.allowed) {
				messages.push('[AI] Provider configured and available.');
			} else {
				const primary = policy.diagnostics[0];
				providerDiag = primary
					? { message: primary.message, recoveryHint: primary.recoveryHint }
					: undefined;
				messages.push(`[AI] ${providerDiag?.message ?? 'Provider blocked.'}`);
			}
		} else {
			providerBlocked = true;
			providerDiag = {
				message: 'No AI provider configured.',
				recoveryHint: 'Run /config ai to set up an AI provider.',
			};
			messages.push('[AI] No provider configured.');
		}
	} catch {
		providerBlocked = true;
		messages.push('[AI] Could not read provider configuration.');
	}

	// 5. Run interpretation
	let interpretationResult: DeterministicInterpretationResult;
	let interpretationSource: FreeFormIntakeResult['interpretationSource'] =
		'deterministic';

	if (providerBlocked) {
		// Use deterministic interpreter
		interpretationResult = interpretIntakeText({
			clock,
			idFactory: propIdFactory,
			sessionId: session.sessionId,
			text: options.text,
			turnId,
		});
		interpretationSource = 'deterministic';

		if (providerDiag) {
			messages.push(`[No-provider fallback] ${providerDiag.message}`);
			if (providerDiag.recoveryHint) {
				nextActions.push(providerDiag.recoveryHint);
			}
		}
	} else {
		// For now, use deterministic interpreter always (AI wiring is a future phase)
		interpretationResult = interpretIntakeText({
			clock,
			idFactory: propIdFactory,
			sessionId: session.sessionId,
			text: options.text,
			turnId,
		});
		interpretationSource = 'deterministic';
		messages.push(
			'[Interpretation] Deterministic interpretation applied (AI interpretation wiring is a future phase).',
		);
	}

	// 6. Create proposals
	let proposals: ReviewableProposal[] = [];
	const proposalIds: string[] = [];

	if (interpretationResult.proposals.length > 0) {
		const createProposalsResult = await createProposals(
			options.projectRoot,
			interpretationResult.proposals,
			{ dryRun: options.dryRun },
		);

		if (createProposalsResult.success) {
			proposals = interpretationResult.proposals;
			for (const p of proposals) {
				proposalIds.push(p.proposalId);
			}
			messages.push(
				`[Proposals] Created ${proposals.length} proposal(s) for review.`,
			);
			nextActions.push(
				`Review ${proposals.length} proposal(s): /proposals list`,
			);
		} else {
			messages.push(
				'[Proposals] Failed to create some proposals. Turn remains captured.',
			);
			diagnostics.push({
				code: 'LOGOS_PROPOSAL_CREATION_PARTIAL',
				message:
					'Some proposals could not be created after turn capture. Turn is preserved.',
				recoveryHint: 'Check workspace state and retry.',
				severity: 'warning',
			});
		}
	}

	// 7. Update turn with derived proposals and interpretation summary
	const updateResult = await updateIntakeTurn({
		dryRun: options.dryRun,
		projectRoot: options.projectRoot,
		turnId,
		update: {
			derivedProposalIds: proposalIds,
			interpretation: {
				diagnostics: interpretationResult.diagnostics.map((d) => ({
					code: d.code,
					message: d.message,
					recoveryHint: d.recoveryHint,
					severity: d.severity,
				})),
				interpreterRole: 'deterministic_interpreter',
				proposalCount: proposals.length,
			},
			status:
				proposals.length > 0
					? 'proposed'
					: interpretationResult.diagnostics.some(
								(d) => d.severity === 'warning',
							)
						? 'failed'
						: 'interpreted',
		},
	});

	if (!updateResult.success) {
		diagnostics.push({
			code: 'LOGOS_INTAKE_TURN_UPDATE_FAILED',
			message:
				'Turn was captured but could not be updated with interpretation results.',
			recoveryHint: 'Proposals may still be reviewable if created.',
			severity: 'warning',
		});
	}

	// 8. Source label advice
	if (interpretationSource === 'deterministic' && proposals.length > 0) {
		messages.push(
			'[Source] Proposals are deterministically interpreted. Review carefully.',
		);
	}

	// Low confidence flag
	const hasLowConfidence = proposals.some((p) => p.confidence === 'low');
	if (hasLowConfidence) {
		messages.push(
			'[Confidence] Some proposals have low confidence and require careful review.',
		);
		nextActions.push(
			'Low-confidence proposals require careful review before acceptance.',
		);
	}

	// If no proposals created
	if (proposals.length === 0) {
		messages.push(
			'[Info] No proposals were created from this input. The turn is preserved as intake evidence.',
		);
		nextActions.push('Try rephrasing your input.');
	}

	// Always suggest next actions
	nextActions.push('Run /proposals list to review proposals');
	nextActions.push('Run /status to review workspace state');

	return {
		diagnostics: [...createResult.diagnostics, ...diagnostics],
		dryRun: options.dryRun ?? false,
		interpretationSource,
		messages,
		nextActions,
		proposals,
		success: true,
		turn: updateResult.turn ?? persistedTurn,
	};
}

function createEmptyTurn(): IntakeTurn {
	return {
		createdAt: new Date().toISOString(),
		derivedProposalIds: [],
		diagnostics: [],
		evidenceRef: 'intake-turn:empty',
		id: 'empty',
		role: 'user',
		sessionId: 'empty',
		status: 'failed',
		text: '',
	};
}
