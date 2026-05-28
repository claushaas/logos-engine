/**
 * Tests for `promptStateForLifecycle` and `selectPrompt` — lifecycle-to-prompt-state
 * mapping, registry fallback chain integration, and `promptRefs` override resolution.
 */
import { describe, expect, it } from 'vitest';
import type {
	NodeLifecycle,
	NodeRuntimeState,
	PromptState,
} from '../../src/contracts/node-state.js';
import type {
	LogosProfile,
	NodeDefinition,
} from '../../src/contracts/profile.js';
import { PROMPT_STATES } from '../../src/prompt-orchestration/default-prompts.js';
import {
	type PromptDefinition,
	PromptRegistry,
	type PromptScope,
} from '../../src/prompt-orchestration/prompt-registry.js';
import {
	promptStateForLifecycle,
	selectPrompt,
} from '../../src/prompt-orchestration/prompt-selector.js';
import type {
	DocumentId,
	NodeId,
	ProfileId,
	PromptId,
} from '../../src/shared/index.js';

// ─── Test helpers ───────────────────────────────────────────────────────────

function def(
	id: string,
	scope: PromptScope,
	promptState: PromptState,
	content = 'test content',
): PromptDefinition {
	return { content, id: id as PromptId, promptState, scope, version: '1.0.0' };
}

function emptyRegistry(): PromptRegistry {
	return new PromptRegistry({ loadDefaults: false });
}

function registryWithDefaults(): PromptRegistry {
	return new PromptRegistry();
}

/**
 * Build a minimal `NodeRuntimeState` at the given lifecycle.
 */
function makeNodeState(
	nodeId: string,
	lifecycle: NodeLifecycle,
): NodeRuntimeState {
	return {
		allowedActions: [],
		canonicalAnswer: null,
		completeness: {
			blockingIssues: [],
			complete: false,
			coverage: {},
			missing: [],
			weak: [],
		},
		conversation: [],
		dependencies: { blockedBy: [], requiredNodeIds: [], unlocks: [] },
		extracted: {
			assumptions: [],
			decisions: [],
			facts: [],
			openQuestions: [],
			risks: [],
		},
		lastAssistantMessageId: undefined,
		lastUserMessageId: undefined,
		lifecycle,
		nodeId: nodeId as NodeId,
		promptState: 'initial', // Derived by selector, not used directly.
		updatedAt: '2025-01-01T00:00:00.000Z',
	};
}

/**
 * Build a minimal `NodeDefinition` for testing.
 */
function makeNodeDef(
	nodeId: string,
	overrides?: Partial<NodeDefinition>,
): NodeDefinition {
	return {
		canonicalQuestion: 'What is the core thesis?',
		coverageTopics: ['Core thesis'],
		documentId: 'doc-1' as DocumentId,
		id: nodeId as NodeId,
		order: 1,
		phaseId: 'phase-1',
		promptRefs: {},
		sufficiencyCriteria: ['Specific', 'Actionable'],
		title: 'Core Thesis',
		...overrides,
	};
}

/**
 * Build a minimal `LogosProfile` for testing.
 */
function makeProfile(profileId: string): LogosProfile {
	return {
		description: 'Test profile',
		documents: [],
		id: profileId as ProfileId,
		materializationRules: [],
		nodes: [],
		phases: [],
		title: 'Test Profile',
		version: '1.0.0',
	};
}

// ─── Lifecycle → PromptState mapping ────────────────────────────────────────

describe('promptStateForLifecycle', () => {
	const lifecycleMappings: Array<[NodeLifecycle, PromptState | null]> = [
		['not_started', 'initial'],
		['active', 'follow_up'],
		['answered', 'follow_up'],
		['needs_clarification', 'clarification'],
		['needs_refinement', 'refinement'],
		['ready_for_synthesis', 'synthesis'],
		['synthesized', 'review'],
		['accepted', 'accepted'],
		['blocked', 'blocked'],
		['deferred', null],
	];

	it.each(
		lifecycleMappings,
	)('%s → %s', (lifecycle: NodeLifecycle, expected: PromptState | null) => {
		expect(promptStateForLifecycle(lifecycle)).toBe(expected);
	});

	it('covers all NodeLifecycle values', () => {
		const lifecycles: NodeLifecycle[] = [
			'not_started',
			'active',
			'answered',
			'needs_clarification',
			'needs_refinement',
			'ready_for_synthesis',
			'synthesized',
			'accepted',
			'deferred',
			'blocked',
		];
		for (const lc of lifecycles) {
			const result = promptStateForLifecycle(lc);
			// Every lifecycle must return either a valid PromptState or null.
			if (result !== null) {
				expect(PROMPT_STATES).toContain(result);
			}
		}
	});

	it('deferred returns null (no prompt)', () => {
		expect(promptStateForLifecycle('deferred')).toBeNull();
	});

	it('not_started returns initial', () => {
		expect(promptStateForLifecycle('not_started')).toBe('initial');
	});

	it('synthesized returns review', () => {
		expect(promptStateForLifecycle('synthesized')).toBe('review');
	});

	it('blocked returns blocked', () => {
		expect(promptStateForLifecycle('blocked')).toBe('blocked');
	});
});

// ─── selectPrompt — basic lifecycle-based selection ─────────────────────────

describe('selectPrompt', () => {
	it('not_started node → initial prompt selected', () => {
		const registry = registryWithDefaults();
		const state = makeNodeState('core', 'not_started');
		const nodeDef = makeNodeDef('core');
		const profile = makeProfile('startup');

		const result = selectPrompt(state, nodeDef, profile, registry);
		expect(result).not.toBeNull();
		expect(result!.promptState).toBe('initial');
	});

	it('synthesized node → review prompt selected', () => {
		const registry = registryWithDefaults();
		const state = makeNodeState('core', 'synthesized');
		const nodeDef = makeNodeDef('core');
		const profile = makeProfile('startup');

		const result = selectPrompt(state, nodeDef, profile, registry);
		expect(result).not.toBeNull();
		expect(result!.promptState).toBe('review');
	});

	it('blocked node → blocked prompt selected', () => {
		const registry = registryWithDefaults();
		const state = makeNodeState('core', 'blocked');
		const nodeDef = makeNodeDef('core');
		const profile = makeProfile('startup');

		const result = selectPrompt(state, nodeDef, profile, registry);
		expect(result).not.toBeNull();
		expect(result!.promptState).toBe('blocked');
	});

	it('deferred node → returns null (no prompt)', () => {
		const registry = registryWithDefaults();
		const state = makeNodeState('core', 'deferred');
		const nodeDef = makeNodeDef('core');
		const profile = makeProfile('startup');

		const result = selectPrompt(state, nodeDef, profile, registry);
		expect(result).toBeNull();
	});

	it('active node → follow_up prompt selected', () => {
		const registry = registryWithDefaults();
		const state = makeNodeState('core', 'active');
		const nodeDef = makeNodeDef('core');
		const profile = makeProfile('startup');

		const result = selectPrompt(state, nodeDef, profile, registry);
		expect(result).not.toBeNull();
		expect(result!.promptState).toBe('follow_up');
	});

	it('accepted node → accepted prompt selected', () => {
		const registry = registryWithDefaults();
		const state = makeNodeState('core', 'accepted');
		const nodeDef = makeNodeDef('core');
		const profile = makeProfile('startup');

		const result = selectPrompt(state, nodeDef, profile, registry);
		expect(result).not.toBeNull();
		expect(result!.promptState).toBe('accepted');
	});
});

// ─── selectPrompt — profile-specific overrides ──────────────────────────────

describe('selectPrompt — profile-specific overrides', () => {
	it('profile-scoped prompt overrides global prompt', () => {
		const registry = emptyRegistry();

		// Register a global fallback.
		const globalFallback = def(
			'global.initial',
			{ level: 'global' },
			'initial',
			'global initial content',
		);
		registry.register(globalFallback);

		// Register a profile-specific initial prompt.
		const profileOverride = def(
			'startup.initial',
			{ level: 'profile', profileId: 'startup' },
			'initial',
			'profile-specific initial content',
		);
		registry.register(profileOverride);

		const state = makeNodeState('core', 'not_started');
		const nodeDef = makeNodeDef('core');
		const profile = makeProfile('startup');

		const result = selectPrompt(state, nodeDef, profile, registry);
		expect(result).not.toBeNull();
		expect(result!.id).toBe('startup.initial');
		expect(result!.content).toBe('profile-specific initial content');
	});

	it('global prompt used when no profile override exists', () => {
		const registry = emptyRegistry();
		registry.register(
			def('global.initial', { level: 'global' }, 'initial', 'global content'),
		);

		const state = makeNodeState('core', 'not_started');
		const nodeDef = makeNodeDef('core');
		const profile = makeProfile('startup');

		const result = selectPrompt(state, nodeDef, profile, registry);
		expect(result).not.toBeNull();
		expect(result!.id).toBe('global.initial');
	});
});

// ─── selectPrompt — promptRefs overrides ────────────────────────────────────

describe('selectPrompt — promptRefs overrides', () => {
	it('node promptRefs override takes precedence over global', () => {
		const registry = emptyRegistry();

		// Global fallback.
		registry.register(
			def('global.initial', { level: 'global' }, 'initial', 'global content'),
		);

		// Node-specific override prompt with a unique, non-clashing scope.
		// The ID-based resolution is what selects it, not the scope.
		const overridePrompt = def(
			'custom.initial.override',
			{
				level: 'node',
				nodeType: 'override-node',
				profileId: 'override-profile',
			},
			'initial',
			'custom initial from promptRefs',
		);
		registry.register(overridePrompt);

		const state = makeNodeState('core', 'not_started');
		const nodeDef = makeNodeDef('core', {
			promptRefs: { initial: 'custom.initial.override' as PromptId },
		});
		const profile = makeProfile('startup');

		const result = selectPrompt(state, nodeDef, profile, registry);
		expect(result).not.toBeNull();
		expect(result!.id).toBe('custom.initial.override');
		expect(result!.content).toBe('custom initial from promptRefs');
	});

	it('promptRefs override with mismatched promptState falls back', () => {
		const registry = emptyRegistry();

		// Global fallback.
		registry.register(
			def(
				'global.initial',
				{ level: 'global' },
				'initial',
				'global initial content',
			),
		);

		// A prompt referenced as "initial" but actually targeting "review".
		registry.register(
			def(
				'misconfigured.prompt',
				{ level: 'global' },
				'review', // Mismatch!
				'wrong state content',
			),
		);

		const state = makeNodeState('core', 'not_started');
		const nodeDef = makeNodeDef('core', {
			promptRefs: { initial: 'misconfigured.prompt' as PromptId },
		});
		const profile = makeProfile('startup');

		const result = selectPrompt(state, nodeDef, profile, registry);
		expect(result).not.toBeNull();
		// Falls back to global because the override's promptState is 'review',
		// not 'initial'.
		expect(result!.id).toBe('global.initial');
	});

	it('promptRefs references missing PromptId falls back', () => {
		const registry = emptyRegistry();
		registry.register(
			def('global.initial', { level: 'global' }, 'initial', 'global content'),
		);

		const state = makeNodeState('core', 'not_started');
		const nodeDef = makeNodeDef('core', {
			promptRefs: { initial: 'nonexistent.prompt' as PromptId },
		});
		const profile = makeProfile('startup');

		const result = selectPrompt(state, nodeDef, profile, registry);
		expect(result).not.toBeNull();
		expect(result!.id).toBe('global.initial');
	});

	it('lifecycle-derived promptState beats stored promptState on node', () => {
		const registry = registryWithDefaults();

		// Node says synthesized lifecycle but 'initial' promptState.
		const state = makeNodeState('core', 'synthesized');
		const nodeDef = makeNodeDef('core');
		const profile = makeProfile('startup');

		// The selector should ignore the stored 'initial' value
		// and derive 'review' from the 'synthesized' lifecycle.
		const result = selectPrompt(state, nodeDef, profile, registry);
		expect(result).not.toBeNull();
		expect(result!.promptState).toBe('review');
	});

	it('node without promptRefs falls back to scope-based lookup', () => {
		const registry = emptyRegistry();
		registry.register(
			def('global.review', { level: 'global' }, 'review', 'global review'),
		);

		const state = makeNodeState('core', 'synthesized');
		const nodeDef = makeNodeDef('core'); // No promptRefs.
		const profile = makeProfile('startup');

		const result = selectPrompt(state, nodeDef, profile, registry);
		expect(result).not.toBeNull();
		expect(result!.promptState).toBe('review');
	});
});
