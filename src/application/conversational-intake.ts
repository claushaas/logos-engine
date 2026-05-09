import {
	type AiOperationOutput,
	getAiOperationMetadata,
} from '../ai/ai-operations.js';
import { type LlmProvider, runAiOperation } from '../ai/llm-provider.js';
import { createMockLlmProvider } from '../ai/mock-provider.js';
import { buildPromptForAiOperation } from '../ai/prompt-builder.js';
import {
	addConversationTurn,
	type ConversationSession,
	createConversationSession,
	saveConversationSession,
} from '../domain/conversation-model.js';
import { loadProfileById } from '../domain/profile-loader.js';
import { readWorkspaceState } from '../domain/workspace-state.js';
import {
	readConversationSession,
	writeConversationSession,
} from '../storage/intake-state.js';
import { detectProjectRoot } from '../storage/project-root.js';

export type ConversationMessageResult = {
	readonly aiMessages: readonly string[];
	readonly conversationId: string;
	readonly providerStatus:
		| 'mock'
		| 'no_provider'
		| 'remote_pending'
		| 'remote_ready';
	readonly providerNotice: string;
	readonly sessionExists: boolean;
	readonly status: 'ok' | 'error' | 'no_provider';
	readonly turnCount: number;
};

export type ConversationResumeResult = {
	readonly aiMessage: string;
	readonly conversationId: string;
	readonly providerStatus:
		| 'mock'
		| 'no_provider'
		| 'remote_pending'
		| 'remote_ready';
	readonly providerNotice: string;
	readonly status: 'ok' | 'error' | 'no_provider';
	readonly turnCount: number;
};

function resolveProviderAndStatus(projectRoot: string): {
	provider: LlmProvider;
	providerStatus: ConversationMessageResult['providerStatus'];
	providerNotice: string;
} {
	try {
		const workspace = readWorkspaceState(projectRoot);
		const config = workspace.config.ai;

		if (!config.enabled || !config.provider) {
			return {
				provider: createMockLlmProvider(),
				providerNotice:
					'No AI provider configured. The conversation runs with a local mock that cannot provide project-specific responses. Run /config ai to set up a provider (local or remote).',
				providerStatus: 'no_provider',
			};
		}

		if (config.provider === 'mock') {
			return {
				provider: createMockLlmProvider(),
				providerNotice:
					'Using mock provider for testing. No data leaves this machine.',
				providerStatus: 'mock',
			};
		}

		if (!config.remoteContextDisclosureAccepted) {
			return {
				provider: createMockLlmProvider(),
				providerNotice: `Provider ${config.provider} configured but remote disclosure not accepted. Run /config ai --allow-remote to acknowledge that project context may be sent to the remote provider. Mock responses used for now.`,
				providerStatus: 'remote_pending',
			};
		}

		return {
			provider: createMockLlmProvider(),
			providerNotice: `Using ${config.provider} provider. Project context may be sent to remote endpoint. Run /config ai --show to review.`,
			providerStatus: 'remote_ready',
		};
	} catch {
		return {
			provider: createMockLlmProvider(),
			providerNotice:
				'No LOGOS workspace found. Run /init to set up a workspace, then configure a provider with /config ai.',
			providerStatus: 'no_provider',
		};
	}
}

export async function handleConversationMessage(
	cwd: string,
	userMessage: string,
): Promise<ConversationMessageResult> {
	const projectRoot = resolveProjectRoot(cwd);
	const { provider, providerStatus, providerNotice } =
		resolveProviderAndStatus(projectRoot);

	let session = loadOrCreateSession(projectRoot);
	const sessionExists = session.turns.length > 0;

	session = addConversationTurn({
		content: userMessage,
		role: 'user',
		session,
	});

	const aiMessages: string[] = [];
	let status: ConversationMessageResult['status'] = 'ok';

	try {
		const workspace = readWorkspaceState(projectRoot);
		const profile = loadProfileById(workspace.project.profileId);
		const conversationHistory = session.turns.map((turn) => ({
			content: turn.content,
			role: turn.role,
		}));

		const prompt = buildPromptForAiOperation({
			conversationHistory,
			input: { userMessage },
			operationId: 'lead_intake_turn',
			profile,
			workspace,
		});

		const output = await runAiOperation(provider, prompt.request);
		const intakeOutput = output as AiOperationOutput<'lead_intake_turn'>;
		const metadata = getAiOperationMetadata('lead_intake_turn');

		session = addConversationTurn({
			content: intakeOutput.response,
			metadata: {
				operationId: 'lead_intake_turn',
				status: metadata.outputStatus,
			},
			role: 'ai',
			session,
		});

		aiMessages.push(intakeOutput.response);

		if (intakeOutput.suggestedQuestion) {
			aiMessages.push(`Suggested: ${intakeOutput.suggestedQuestion}`);
		}

		aiMessages.push(
			`Next move: ${intakeOutput.nextMove} — ${intakeOutput.rationale}`,
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		aiMessages.push(`AI response failed: ${message}. Session preserved.`);
		status = 'error';
	}

	if (providerStatus === 'no_provider') {
		aiMessages.push('');
		aiMessages.push(
			'Note: No AI provider configured. For real AI conversation, run /config ai.',
		);
		status = 'no_provider';
	}

	persistSession(projectRoot, session);

	return {
		aiMessages,
		conversationId: session.id,
		providerNotice,
		providerStatus,
		sessionExists,
		status,
		turnCount: session.turns.length,
	};
}

export function resumeConversation(cwd: string): ConversationResumeResult {
	const projectRoot = resolveProjectRoot(cwd);
	const { providerStatus, providerNotice } =
		resolveProviderAndStatus(projectRoot);

	const session = loadOrCreateSession(projectRoot);
	let startMessage = '';

	if (session.turns.length === 0) {
		startMessage =
			'No conversation history yet. Start by describing your app idea, the problem it solves, and who it helps. I will help you work through the important details.';
	} else {
		const lastAiMessage = [...session.turns]
			.reverse()
			.find((turn) => turn.role === 'ai');

		startMessage =
			lastAiMessage?.content ??
			'Conversation resumed. You can continue describing your project or ask a question.';
	}

	if (providerStatus === 'no_provider') {
		startMessage = [
			startMessage,
			'',
			'Note: No AI provider is configured. The conversation runs with a local mock.',
			'For real AI responses, run /config ai to set up a provider (local or remote).',
		].join('\n');
	}

	const isNoProvider = providerStatus === 'no_provider';

	return {
		aiMessage: startMessage,
		conversationId: session.id,
		providerNotice,
		providerStatus,
		status: isNoProvider ? 'no_provider' : 'ok',
		turnCount: session.turns.length,
	};
}

export function endConversation(cwd: string): ConversationResumeResult {
	const projectRoot = resolveProjectRoot(cwd);
	const session = loadOrCreateSession(projectRoot);
	const finalized = saveConversationSession({ session });

	persistSession(projectRoot, finalized);

	return {
		aiMessage:
			'Conversation saved. Run /continue to pick up where you left off.',
		conversationId: finalized.id,
		providerNotice: '',
		providerStatus: 'mock',
		status: 'ok',
		turnCount: finalized.turns.length,
	};
}

function resolveProjectRoot(cwd: string): string {
	const root = detectProjectRoot(cwd);

	if (!root) {
		return cwd;
	}

	return root;
}

function loadOrCreateSession(projectRoot: string): ConversationSession {
	const existing = readConversationSession(projectRoot);

	if (existing) {
		return existing;
	}

	try {
		const workspace = readWorkspaceState(projectRoot);

		return createConversationSession({
			profileId: workspace.project.profileId,
			schemaVersion: workspace.project.schemaVersion,
		});
	} catch {
		return createConversationSession({
			profileId: 'app-business',
			schemaVersion: '0.1.0',
		});
	}
}

function persistSession(
	projectRoot: string,
	session: ConversationSession,
): void {
	try {
		writeConversationSession(projectRoot, session);
	} catch {
		// Session persistence failure is non-fatal for conversation experience
	}
}
