/** Step 8.2 — Register Lifecycle: typed review-oriented domain operations */

import type { SafeFsAdapter } from '../fs/safe-filesystem.js';
import type { WorkspaceState } from '../state/workspace-state.schema.js';
import type { Clock } from '../state/workspace-state-repository.js';
import { updateWorkspaceState } from '../state/workspace-state-repository.js';
import type {
	AnyRegisterItem,
	AssumptionRegisterItem,
	DecisionRegisterItem,
	HypothesisRegisterItem,
	OpenQuestionRegisterItem,
	RegisterAffectedDocumentLink,
	RegisterCollections,
	RegisterLifecycleEvent,
	RegisterLifecycleEventType,
	RegisterOperationDiagnostic,
	RegisterOperationInput,
	RegisterOperationResult,
	RegisterReviewState,
	RegisterSourceLink,
	RegisterStatus,
	RiskRegisterItem,
} from './register-types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function newId(prefix: string): string {
	return `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function nowISO(): string {
	return new Date().toISOString();
}

function createDiagnostic(
	code: string,
	severity: RegisterOperationDiagnostic['severity'],
	message: string,
	overrides?: Partial<RegisterOperationDiagnostic>,
): RegisterOperationDiagnostic {
	return { code, message, severity, ...overrides };
}

function createLifecycleEvent(
	registerItemId: string,
	eventType: RegisterLifecycleEventType,
	overrides?: Partial<RegisterLifecycleEvent>,
): RegisterLifecycleEvent {
	return {
		eventId: newId('evt'),
		eventType,
		occurredAt: nowISO(),
		registerItemId,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Lifecycle transition rules
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<string, Set<string>> = {
	'assumption:confirmed': new Set(['superseded']),
	// Assumptions
	'assumption:proposed': new Set(['confirmed', 'rejected', 'superseded']),
	'assumption:rejected': new Set([]),
	'assumption:superseded': new Set([]),
	'decision:confirmed': new Set(['superseded']),
	// Decisions
	'decision:proposed': new Set(['confirmed', 'rejected', 'superseded']),
	'decision:rejected': new Set([]),
	'decision:superseded': new Set([]),
	'hypothesis:active': new Set([
		'validated',
		'invalidated',
		'inconclusive',
		'superseded',
	]),
	'hypothesis:inconclusive': new Set(['superseded']),
	'hypothesis:invalidated': new Set(['superseded']),
	// Hypotheses
	'hypothesis:proposed': new Set(['active', 'rejected', 'superseded']),
	'hypothesis:superseded': new Set([]),
	'hypothesis:validated': new Set(['superseded']),
	// Open Questions
	'open_question:open': new Set(['resolved', 'rejected', 'superseded']),
	'open_question:rejected': new Set([]),
	'open_question:resolved': new Set(['superseded']),
	'open_question:superseded': new Set([]),
	'risk:accepted': new Set(['mitigated', 'resolved', 'superseded']),
	'risk:mitigated': new Set(['resolved', 'superseded']),
	// Risks
	'risk:proposed': new Set(['accepted', 'rejected', 'superseded']),
	'risk:rejected': new Set([]),
	'risk:resolved': new Set(['superseded']),
	'risk:superseded': new Set([]),
};

function canTransition(
	kind: string,
	fromStatus: string,
	toStatus: string,
): boolean {
	const key = `${kind}:${fromStatus}`;
	const allowed = VALID_TRANSITIONS[key];
	if (!allowed) return false;
	return allowed.has(toStatus);
}

// ---------------------------------------------------------------------------
// Register collections access
// ---------------------------------------------------------------------------

function getRegisters(state: WorkspaceState): RegisterCollections {
	const r = (state as Record<string, unknown>).registers as
		| RegisterCollections
		| undefined;
	if (r) return r;
	const empty: RegisterCollections = {
		assumptions: [],
		decisions: [],
		hypotheses: [],
		lifecycleEvents: [],
		openQuestions: [],
		risks: [],
	};
	return empty;
}

function setRegisters(
	state: WorkspaceState,
	collections: RegisterCollections,
): WorkspaceState {
	return {
		...state,
		registers: collections as unknown as Record<string, unknown>,
	} as WorkspaceState;
}

function getItemsByKind(
	collections: RegisterCollections,
	kind: string,
): AnyRegisterItem[] {
	switch (kind) {
		case 'decision':
			return collections.decisions;
		case 'assumption':
			return collections.assumptions;
		case 'hypothesis':
			return collections.hypotheses;
		case 'risk':
			return collections.risks;
		case 'open_question':
			return collections.openQuestions;
		default:
			return [];
	}
}

function setItemsByKind(
	collections: RegisterCollections,
	kind: string,
	items: AnyRegisterItem[],
): RegisterCollections {
	const c = { ...collections };
	switch (kind) {
		case 'decision':
			c.decisions = items as DecisionRegisterItem[];
			break;
		case 'assumption':
			c.assumptions = items as AssumptionRegisterItem[];
			break;
		case 'hypothesis':
			c.hypotheses = items as HypothesisRegisterItem[];
			break;
		case 'risk':
			c.risks = items as RiskRegisterItem[];
			break;
		case 'open_question':
			c.openQuestions = items as OpenQuestionRegisterItem[];
			break;
	}
	return c;
}

function findItem(
	collections: RegisterCollections,
	id: string,
): AnyRegisterItem | undefined {
	for (const item of [
		...collections.decisions,
		...collections.assumptions,
		...collections.hypotheses,
		...collections.risks,
		...collections.openQuestions,
	]) {
		if (item.id === id) return item;
	}
	return undefined;
}

function replaceItem(
	collections: RegisterCollections,
	item: AnyRegisterItem,
): RegisterCollections {
	const kind = item.kind;
	const items = getItemsByKind(collections, kind);
	const idx = items.findIndex((i) => i.id === item.id);
	if (idx === -1) {
		items.push(item);
	} else {
		items[idx] = item;
	}
	return setItemsByKind(collections, kind, items);
}

// ---------------------------------------------------------------------------
// Base register item builder
// ---------------------------------------------------------------------------

function buildRegisterItem(
	input: RegisterOperationInput,
	id: string,
	now: string,
	status: RegisterStatus,
	reviewState: RegisterReviewState,
	confidence: string,
	lifecycleHistory: RegisterLifecycleEvent[],
): AnyRegisterItem {
	const base = {
		acceptedAt: undefined,
		affectedDocumentLinks: input.affectedDocumentLinks ?? [],
		body: input.body,
		confidence: confidence as AnyRegisterItem['confidence'],
		createdAt: now,
		decidedAt: undefined,
		details: undefined,
		diagnostics: [],
		id,
		kind: input.kind,
		lifecycleHistory,
		resolvedAt: undefined,
		reviewState,
		sourceLinks: input.sourceLinks ?? [],
		status,
		supersededAt: undefined,
		title: input.title,
		updatedAt: now,
	};

	switch (input.kind) {
		case 'decision':
			return {
				...base,
				alternativesConsidered: input.alternativesConsidered,
				consequences: input.consequences,
				decisionStatement: input.decisionStatement ?? input.title,
				kind: 'decision',
				rationale: input.rationale,
				status: status as DecisionRegisterItem['status'],
				supersededBy: undefined,
				supersedes: undefined,
			} satisfies DecisionRegisterItem;

		case 'assumption':
			return {
				...base,
				assumptionStatement: input.assumptionStatement ?? input.title,
				kind: 'assumption',
				relatedHypothesisIds: undefined,
				relatedOpenQuestionIds: undefined,
				relatedRiskIds: undefined,
				reviewDate: input.reviewDate,
				reviewTrigger: input.reviewTrigger,
				scope: input.scope,
				status: status as AssumptionRegisterItem['status'],
			} satisfies AssumptionRegisterItem;

		case 'hypothesis':
			return {
				...base,
				evidenceSourceIds: undefined,
				expectedSignal: input.expectedSignal,
				hypothesisStatement: input.hypothesisStatement ?? input.title,
				kind: 'hypothesis',
				outcomeStatus: undefined,
				relatedAssumptionIds: undefined,
				relatedRiskIds: undefined,
				status: status as HypothesisRegisterItem['status'],
				validationMethod: input.validationMethod,
			} satisfies HypothesisRegisterItem;

		case 'risk':
			return {
				...base,
				acceptedRiskMarker: undefined,
				impact: input.impact,
				kind: 'risk',
				likelihood: input.likelihood,
				mitigation: input.mitigation,
				owner: undefined,
				relatedAssumptionIds: undefined,
				relatedDecisionIds: undefined,
				relatedHypothesisIds: undefined,
				relatedOpenQuestionIds: undefined,
				riskStatement: input.riskStatement ?? input.title,
				status: status as RiskRegisterItem['status'],
			} satisfies RiskRegisterItem;

		case 'open_question':
			return {
				...base,
				isBlocking: input.isBlocking ?? false,
				kind: 'open_question',
				questionText: input.questionText ?? input.title,
				resolutionSummary: undefined,
				resolvedByClaimId: undefined,
				resolvedByDecisionId: undefined,
				resolvedBySourceId: undefined,
				status: status as OpenQuestionRegisterItem['status'],
				whyItMatters: input.whyItMatters,
			} satisfies OpenQuestionRegisterItem;
	}
}

// ---------------------------------------------------------------------------
// applyStatusTransition
// ---------------------------------------------------------------------------

function applyStatusTransition(
	item: AnyRegisterItem,
	toStatus: RegisterStatus,
	eventType: RegisterLifecycleEventType,
	input: RegisterOperationInput,
	now: string,
): {
	item: AnyRegisterItem;
	event: RegisterLifecycleEvent;
	diagnostics: RegisterOperationDiagnostic[];
} {
	const diagnostics: RegisterOperationDiagnostic[] = [];

	if (item.status === toStatus) {
		return {
			diagnostics: [
				createDiagnostic(
					'register_already_in_status',
					'info',
					`Register item "${item.id}" is already in status "${toStatus}"`,
					{ relatedRegisterItemId: item.id, relatedRegisterKind: item.kind },
				),
			],
			event: createLifecycleEvent(item.id, eventType, {
				fromStatus: item.status,
				notes: input.notes,
				occurredAt: now,
				toStatus,
			}),
			item,
		};
	}

	if (!canTransition(item.kind, item.status, toStatus)) {
		diagnostics.push(
			createDiagnostic(
				'register_invalid_transition',
				'error',
				`Cannot transition ${item.kind} "${item.id}" from "${item.status}" to "${toStatus}"`,
				{
					expected: `valid next status from ${item.status}`,
					received: toStatus,
					recoveryHint: `Valid transitions from "${item.status}" are: ${[...(VALID_TRANSITIONS[`${item.kind}:${item.status}`] ?? [])].join(', ') || 'none'}`,
					relatedRegisterItemId: item.id,
					relatedRegisterKind: item.kind,
				},
			),
		);
		return {
			diagnostics,
			event: createLifecycleEvent(item.id, eventType),
			item,
		};
	}

	const updatedItem = structuredClone(item) as typeof item;
	updatedItem.status = toStatus;
	updatedItem.updatedAt = now;

	if (toStatus === 'resolved') {
		(updatedItem as { resolvedAt?: string }).resolvedAt = now;
	}
	if (toStatus === 'confirmed') {
		(updatedItem as { decidedAt?: string }).decidedAt = now;
	}
	if (toStatus === 'accepted') {
		(updatedItem as { acceptedAt?: string }).acceptedAt = now;
	}
	if (toStatus === 'superseded') {
		(updatedItem as { supersededAt?: string }).supersededAt = now;
	}

	const event = createLifecycleEvent(item.id, eventType, {
		fromStatus: item.status,
		notes: input.notes,
		occurredAt: now,
		toStatus,
	});

	updatedItem.lifecycleHistory = [...updatedItem.lifecycleHistory, event];

	return { diagnostics, event, item: updatedItem };
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

export interface RegisterLifecycleOptions {
	projectRoot: string;
	dryRun?: boolean | undefined;
	clock?: Clock | undefined;
	idFactory?: (() => string) | undefined;
	_fs?: SafeFsAdapter | undefined;
	_testTimestamp?: string | undefined;
	_testRandomId?: string | undefined;
}

function _defaultOptions(
	options: RegisterLifecycleOptions,
): Required<Pick<RegisterLifecycleOptions, 'dryRun' | 'clock' | 'idFactory'>> {
	return {
		clock: options.clock ?? { now: nowISO },
		dryRun: options.dryRun ?? false,
		idFactory: options.idFactory ?? (() => newId('reg')),
	};
}

async function mutateRegisters(
	options: RegisterLifecycleOptions,
	mutator: (
		collections: RegisterCollections,
		now: string,
		idFactory: () => string,
	) => {
		collections: RegisterCollections;
		item: AnyRegisterItem | undefined;
		diagnostics: RegisterOperationDiagnostic[];
	},
): Promise<RegisterOperationResult> {
	const resolvedClock = options.clock ?? { now: nowISO };
	const resolvedIdFactory = options.idFactory ?? (() => newId('reg'));
	const now = resolvedClock.now();
	const dryRun = options.dryRun ?? false;

	let itemFromMutator: AnyRegisterItem | undefined;
	let diagnosticsFromMutator: RegisterOperationDiagnostic[] = [];

	const updateOpts: Parameters<typeof updateWorkspaceState>[0] = {
		dryRun,
		policy: 'overwrite',
		projectRoot: options.projectRoot,
		updater: (state: WorkspaceState) => {
			const collections = getRegisters(state);
			const mutation = mutator(collections, now, resolvedIdFactory);
			itemFromMutator = mutation.item;
			diagnosticsFromMutator = mutation.diagnostics;
			const nextState = setRegisters(state, mutation.collections);
			nextState.workspace.updatedAt = now;
			return nextState;
		},
	};
	if (options._fs !== undefined) updateOpts._fs = options._fs;
	if (options._testRandomId !== undefined)
		updateOpts._testRandomId = options._testRandomId;
	if (options._testTimestamp !== undefined)
		updateOpts._testTimestamp = options._testTimestamp;
	if (options.clock !== undefined) updateOpts.clock = options.clock;

	const result = await updateWorkspaceState(updateOpts);

	const allDiagnostics = [
		...result.diagnostics.map((d) =>
			createDiagnostic(
				d.code,
				d.severity as RegisterOperationDiagnostic['severity'],
				d.message,
			),
		),
		...diagnosticsFromMutator,
	];

	const hasErrors = allDiagnostics.some((d) => d.severity === 'error');

	return {
		changedPaths: result.changedPaths,
		diagnostics: allDiagnostics,
		dryRun: result.dryRun,
		item: itemFromMutator,
		success: result.success && !hasErrors,
	};
}

// ---------------------------------------------------------------------------
// Public lifecycle operations
// ---------------------------------------------------------------------------

export async function createRegisterItem(
	input: RegisterOperationInput,
	options: RegisterLifecycleOptions,
): Promise<RegisterOperationResult> {
	const diagnostics: RegisterOperationDiagnostic[] = [];

	if (!input.kind) {
		return {
			changedPaths: [],
			diagnostics: [
				createDiagnostic(
					'register_missing_kind',
					'error',
					'Register kind is required',
				),
			],
			dryRun: options.dryRun ?? false,
			item: undefined,
			success: false,
		};
	}

	let createdItem: AnyRegisterItem | undefined;

	const result = await mutateRegisters(
		options,
		(collections, now, idFactory) => {
			const id = idFactory();
			const defaultStatus =
				input.kind === 'open_question' ? 'open' : 'proposed';
			const status = input.status ?? defaultStatus;
			const reviewState = input.reviewState ?? 'requires_review';
			const confidence = input.confidence ?? 'unknown';

			const sourceLinks = (input.sourceLinks ?? []).map((sl) => ({
				...sl,
				linkedAt: sl.linkedAt ?? now,
			}));
			const affectedDocLinks = (input.affectedDocumentLinks ?? []).map(
				(dl) => ({
					...dl,
					linkedAt: dl.linkedAt ?? now,
				}),
			);

			const initialEventType: RegisterLifecycleEventType =
				status === 'proposed'
					? 'proposed'
					: status === 'open'
						? 'created'
						: 'created';

			const lifecycleEvent = createLifecycleEvent(id, initialEventType, {
				actor: input.actor,
				notes: input.notes,
				occurredAt: now,
				toStatus: status as RegisterStatus,
			});

			const fullInput: RegisterOperationInput = {
				...input,
				affectedDocumentLinks: affectedDocLinks,
				sourceLinks,
			};

			const item = buildRegisterItem(
				fullInput,
				id,
				now,
				status as RegisterStatus,
				reviewState,
				confidence,
				[lifecycleEvent],
			);

			createdItem = item;
			const newCollections = replaceItem(collections, item);

			return { collections: newCollections, diagnostics, item };
		},
	);

	return { ...result, item: createdItem };
}

export async function proposeRegisterItem(
	input: RegisterOperationInput,
	options: RegisterLifecycleOptions,
): Promise<RegisterOperationResult> {
	return createRegisterItem(
		{ ...input, reviewState: 'requires_review', status: 'proposed' },
		options,
	);
}

async function transitionOperation(
	itemId: string,
	toStatus: RegisterStatus,
	eventType: RegisterLifecycleEventType,
	input: RegisterOperationInput,
	options: RegisterLifecycleOptions,
): Promise<RegisterOperationResult> {
	let resultItem: AnyRegisterItem | undefined;
	const opDiagnostics: RegisterOperationDiagnostic[] = [];

	const result = await mutateRegisters(options, (collections, now) => {
		const item = findItem(collections, itemId);
		if (!item) {
			opDiagnostics.push(
				createDiagnostic(
					'register_item_not_found',
					'error',
					`Register item "${itemId}" not found`,
					{ relatedRegisterItemId: itemId },
				),
			);
			return { collections, diagnostics: opDiagnostics, item: undefined };
		}

		const transition = applyStatusTransition(
			item,
			toStatus,
			eventType,
			input,
			now,
		);
		opDiagnostics.push(...transition.diagnostics);

		if (transition.diagnostics.some((d) => d.severity === 'error')) {
			return {
				collections,
				diagnostics: opDiagnostics,
				item: undefined,
			};
		}

		const newCollections = replaceItem(collections, transition.item);
		resultItem = transition.item;

		return {
			collections: newCollections,
			diagnostics: opDiagnostics,
			item: transition.item,
		};
	});

	return { ...result, item: resultItem };
}

export async function confirmRegisterItem(
	itemId: string,
	input: RegisterOperationInput,
	options: RegisterLifecycleOptions,
): Promise<RegisterOperationResult> {
	return transitionOperation(itemId, 'confirmed', 'confirmed', input, options);
}

export async function rejectRegisterItem(
	itemId: string,
	input: RegisterOperationInput,
	options: RegisterLifecycleOptions,
): Promise<RegisterOperationResult> {
	return transitionOperation(itemId, 'rejected', 'rejected', input, options);
}

export async function supersedeRegisterItem(
	itemId: string,
	input: RegisterOperationInput,
	options: RegisterLifecycleOptions,
): Promise<RegisterOperationResult> {
	return transitionOperation(
		itemId,
		'superseded',
		'superseded',
		input,
		options,
	);
}

export async function reviseRegisterItem(
	itemId: string,
	input: RegisterOperationInput,
	options: RegisterLifecycleOptions,
): Promise<RegisterOperationResult> {
	const opDiagnostics: RegisterOperationDiagnostic[] = [];
	let resultItem: AnyRegisterItem | undefined;

	const result = await mutateRegisters(options, (collections, now) => {
		const item = findItem(collections, itemId);
		if (!item) {
			opDiagnostics.push(
				createDiagnostic(
					'register_item_not_found',
					'error',
					`Register item "${itemId}" not found`,
					{ relatedRegisterItemId: itemId },
				),
			);
			return { collections, diagnostics: opDiagnostics, item: undefined };
		}

		const revised = structuredClone(item) as typeof item;
		if (input.title) revised.title = input.title;
		if (input.body !== undefined) revised.body = input.body;
		revised.updatedAt = now;

		const event = createLifecycleEvent(itemId, 'revised', {
			fromStatus: item.status,
			notes: input.notes ?? input.reason,
			occurredAt: now,
			toStatus: item.status,
		});

		revised.lifecycleHistory = [...revised.lifecycleHistory, event];
		const newCollections = replaceItem(collections, revised);
		resultItem = revised;

		return {
			collections: newCollections,
			diagnostics: opDiagnostics,
			item: revised,
		};
	});

	return { ...result, item: resultItem };
}

export async function resolveOpenQuestion(
	itemId: string,
	input: RegisterOperationInput,
	options: RegisterLifecycleOptions,
): Promise<RegisterOperationResult> {
	const opDiagnostics: RegisterOperationDiagnostic[] = [];
	let resultItem: AnyRegisterItem | undefined;

	const result = await mutateRegisters(options, (collections, now) => {
		const item = findItem(collections, itemId);
		if (!item) {
			opDiagnostics.push(
				createDiagnostic(
					'register_item_not_found',
					'error',
					`Register item "${itemId}" not found`,
					{ relatedRegisterItemId: itemId },
				),
			);
			return { collections, diagnostics: opDiagnostics, item: undefined };
		}

		if (item.kind !== 'open_question') {
			opDiagnostics.push(
				createDiagnostic(
					'register_wrong_kind',
					'error',
					`Item "${itemId}" is not an open question`,
					{ relatedRegisterItemId: itemId, relatedRegisterKind: item.kind },
				),
			);
			return { collections, diagnostics: opDiagnostics, item: undefined };
		}

		const transition = applyStatusTransition(
			item,
			'resolved',
			'resolved',
			input,
			now,
		);
		opDiagnostics.push(...transition.diagnostics);

		if (transition.diagnostics.some((d) => d.severity === 'error')) {
			return { collections, diagnostics: opDiagnostics, item: undefined };
		}

		const resolved = transition.item as OpenQuestionRegisterItem;
		if (input.resolutionSummary !== undefined) {
			resolved.resolutionSummary = input.resolutionSummary;
		}
		resolved.resolvedByDecisionId = input.resolvedByDecisionId;
		resolved.resolvedByClaimId = input.resolvedByClaimId;
		resolved.resolvedBySourceId = input.resolvedBySourceId;

		const newCollections = replaceItem(collections, resolved);
		resultItem = resolved;

		return {
			collections: newCollections,
			diagnostics: opDiagnostics,
			item: resolved,
		};
	});

	return { ...result, item: resultItem };
}

export async function reopenOpenQuestion(
	itemId: string,
	input: RegisterOperationInput,
	options: RegisterLifecycleOptions,
): Promise<RegisterOperationResult> {
	const opDiagnostics: RegisterOperationDiagnostic[] = [];
	let resultItem: AnyRegisterItem | undefined;

	const result = await mutateRegisters(options, (collections, now) => {
		const item = findItem(collections, itemId);
		if (!item) {
			opDiagnostics.push(
				createDiagnostic(
					'register_item_not_found',
					'error',
					`Register item "${itemId}" not found`,
					{ relatedRegisterItemId: itemId },
				),
			);
			return { collections, diagnostics: opDiagnostics, item: undefined };
		}

		if (item.kind !== 'open_question') {
			opDiagnostics.push(
				createDiagnostic(
					'register_wrong_kind',
					'error',
					`Item "${itemId}" is not an open question`,
					{ relatedRegisterItemId: itemId, relatedRegisterKind: item.kind },
				),
			);
			return { collections, diagnostics: opDiagnostics, item: undefined };
		}

		if (item.status !== 'resolved') {
			opDiagnostics.push(
				createDiagnostic(
					'register_cannot_reopen',
					'error',
					`Open question "${itemId}" can only be reopened from "resolved" status, current: "${item.status}"`,
					{
						expected: 'resolved',
						received: item.status,
						relatedRegisterItemId: itemId,
						relatedRegisterKind: item.kind,
					},
				),
			);
			return { collections, diagnostics: opDiagnostics, item: undefined };
		}

		const reopened = structuredClone(item) as OpenQuestionRegisterItem;
		reopened.status = 'open';
		reopened.updatedAt = now;
		reopened.resolvedAt = undefined;

		const event = createLifecycleEvent(itemId, 'reopened', {
			fromStatus: 'resolved',
			notes: input.notes ?? input.reason,
			occurredAt: now,
			toStatus: 'open',
		});
		reopened.lifecycleHistory = [...reopened.lifecycleHistory, event];
		const newCollections = replaceItem(collections, reopened);
		resultItem = reopened;

		return {
			collections: newCollections,
			diagnostics: opDiagnostics,
			item: reopened,
		};
	});

	return { ...result, item: resultItem };
}

export async function acceptRisk(
	itemId: string,
	input: RegisterOperationInput,
	options: RegisterLifecycleOptions,
): Promise<RegisterOperationResult> {
	return transitionOperation(itemId, 'accepted', 'accepted', input, options);
}

export async function mitigateRisk(
	itemId: string,
	input: RegisterOperationInput,
	options: RegisterLifecycleOptions,
): Promise<RegisterOperationResult> {
	const opDiagnostics: RegisterOperationDiagnostic[] = [];
	let resultItem: AnyRegisterItem | undefined;

	const result = await mutateRegisters(options, (collections, now) => {
		const item = findItem(collections, itemId);
		if (!item) {
			opDiagnostics.push(
				createDiagnostic(
					'register_item_not_found',
					'error',
					`Register item "${itemId}" not found`,
					{ relatedRegisterItemId: itemId },
				),
			);
			return { collections, diagnostics: opDiagnostics, item: undefined };
		}

		if (item.kind !== 'risk') {
			opDiagnostics.push(
				createDiagnostic(
					'register_wrong_kind',
					'error',
					`Item "${itemId}" is not a risk`,
					{ relatedRegisterItemId: itemId, relatedRegisterKind: item.kind },
				),
			);
			return { collections, diagnostics: opDiagnostics, item: undefined };
		}

		const transition = applyStatusTransition(
			item,
			'mitigated',
			'mitigated',
			input,
			now,
		);
		opDiagnostics.push(...transition.diagnostics);

		if (transition.diagnostics.some((d) => d.severity === 'error')) {
			return { collections, diagnostics: opDiagnostics, item: undefined };
		}

		const mitigated = transition.item as RiskRegisterItem;
		if (input.mitigation !== undefined) {
			mitigated.mitigation = input.mitigation;
		}

		const newCollections = replaceItem(collections, mitigated);
		resultItem = mitigated;

		return {
			collections: newCollections,
			diagnostics: opDiagnostics,
			item: mitigated,
		};
	});

	return { ...result, item: resultItem };
}

export async function resolveRisk(
	itemId: string,
	input: RegisterOperationInput,
	options: RegisterLifecycleOptions,
): Promise<RegisterOperationResult> {
	return transitionOperation(itemId, 'resolved', 'resolved', input, options);
}

export async function activateHypothesis(
	itemId: string,
	input: RegisterOperationInput,
	options: RegisterLifecycleOptions,
): Promise<RegisterOperationResult> {
	return transitionOperation(itemId, 'active', 'activated', input, options);
}

export async function validateHypothesis(
	itemId: string,
	input: RegisterOperationInput,
	options: RegisterLifecycleOptions,
): Promise<RegisterOperationResult> {
	const opDiagnostics: RegisterOperationDiagnostic[] = [];
	let resultItem: AnyRegisterItem | undefined;

	const result = await mutateRegisters(options, (collections, now) => {
		const item = findItem(collections, itemId);
		if (!item) {
			opDiagnostics.push(
				createDiagnostic(
					'register_item_not_found',
					'error',
					`Register item "${itemId}" not found`,
					{ relatedRegisterItemId: itemId },
				),
			);
			return { collections, diagnostics: opDiagnostics, item: undefined };
		}

		if (item.kind !== 'hypothesis') {
			opDiagnostics.push(
				createDiagnostic(
					'register_wrong_kind',
					'error',
					`Item "${itemId}" is not a hypothesis`,
					{ relatedRegisterItemId: itemId, relatedRegisterKind: item.kind },
				),
			);
			return { collections, diagnostics: opDiagnostics, item: undefined };
		}

		const transition = applyStatusTransition(
			item,
			'validated',
			'validated',
			input,
			now,
		);
		opDiagnostics.push(...transition.diagnostics);

		if (transition.diagnostics.some((d) => d.severity === 'error')) {
			return { collections, diagnostics: opDiagnostics, item: undefined };
		}

		const validated = transition.item as HypothesisRegisterItem;
		validated.outcomeStatus = 'validated';

		const newCollections = replaceItem(collections, validated);
		resultItem = validated;

		return {
			collections: newCollections,
			diagnostics: opDiagnostics,
			item: validated,
		};
	});

	return { ...result, item: resultItem };
}

export async function invalidateHypothesis(
	itemId: string,
	input: RegisterOperationInput,
	options: RegisterLifecycleOptions,
): Promise<RegisterOperationResult> {
	const opDiagnostics: RegisterOperationDiagnostic[] = [];
	let resultItem: AnyRegisterItem | undefined;

	const result = await mutateRegisters(options, (collections, now) => {
		const item = findItem(collections, itemId);
		if (!item) {
			opDiagnostics.push(
				createDiagnostic(
					'register_item_not_found',
					'error',
					`Register item "${itemId}" not found`,
					{ relatedRegisterItemId: itemId },
				),
			);
			return { collections, diagnostics: opDiagnostics, item: undefined };
		}

		if (item.kind !== 'hypothesis') {
			opDiagnostics.push(
				createDiagnostic(
					'register_wrong_kind',
					'error',
					`Item "${itemId}" is not a hypothesis`,
					{ relatedRegisterItemId: itemId, relatedRegisterKind: item.kind },
				),
			);
			return { collections, diagnostics: opDiagnostics, item: undefined };
		}

		const transition = applyStatusTransition(
			item,
			'invalidated',
			'invalidated',
			input,
			now,
		);
		opDiagnostics.push(...transition.diagnostics);

		if (transition.diagnostics.some((d) => d.severity === 'error')) {
			return { collections, diagnostics: opDiagnostics, item: undefined };
		}

		const invalidated = transition.item as HypothesisRegisterItem;
		invalidated.outcomeStatus = 'invalidated';

		const newCollections = replaceItem(collections, invalidated);
		resultItem = invalidated;

		return {
			collections: newCollections,
			diagnostics: opDiagnostics,
			item: invalidated,
		};
	});

	return { ...result, item: resultItem };
}

export async function markHypothesisInconclusive(
	itemId: string,
	input: RegisterOperationInput,
	options: RegisterLifecycleOptions,
): Promise<RegisterOperationResult> {
	const opDiagnostics: RegisterOperationDiagnostic[] = [];
	let resultItem: AnyRegisterItem | undefined;

	const result = await mutateRegisters(options, (collections, now) => {
		const item = findItem(collections, itemId);
		if (!item) {
			opDiagnostics.push(
				createDiagnostic(
					'register_item_not_found',
					'error',
					`Register item "${itemId}" not found`,
					{ relatedRegisterItemId: itemId },
				),
			);
			return { collections, diagnostics: opDiagnostics, item: undefined };
		}

		if (item.kind !== 'hypothesis') {
			opDiagnostics.push(
				createDiagnostic(
					'register_wrong_kind',
					'error',
					`Item "${itemId}" is not a hypothesis`,
					{ relatedRegisterItemId: itemId, relatedRegisterKind: item.kind },
				),
			);
			return { collections, diagnostics: opDiagnostics, item: undefined };
		}

		const transition = applyStatusTransition(
			item,
			'inconclusive',
			'inconclusive',
			input,
			now,
		);
		opDiagnostics.push(...transition.diagnostics);

		if (transition.diagnostics.some((d) => d.severity === 'error')) {
			return { collections, diagnostics: opDiagnostics, item: undefined };
		}

		const inconclusive = transition.item as HypothesisRegisterItem;
		inconclusive.outcomeStatus = 'inconclusive';

		const newCollections = replaceItem(collections, inconclusive);
		resultItem = inconclusive;

		return {
			collections: newCollections,
			diagnostics: opDiagnostics,
			item: inconclusive,
		};
	});

	return { ...result, item: resultItem };
}

// ---------------------------------------------------------------------------
// Source and document linking
// ---------------------------------------------------------------------------

export async function linkRegisterItemToSource(
	itemId: string,
	sourceLink: RegisterSourceLink,
	options: RegisterLifecycleOptions,
): Promise<RegisterOperationResult> {
	const opDiagnostics: RegisterOperationDiagnostic[] = [];
	let resultItem: AnyRegisterItem | undefined;

	const result = await mutateRegisters(options, (collections, now) => {
		const item = findItem(collections, itemId);
		if (!item) {
			opDiagnostics.push(
				createDiagnostic(
					'register_item_not_found',
					'error',
					`Register item "${itemId}" not found`,
					{ relatedRegisterItemId: itemId },
				),
			);
			return { collections, diagnostics: opDiagnostics, item: undefined };
		}

		const updated = structuredClone(item) as typeof item;
		const sl: RegisterSourceLink = {
			...sourceLink,
			linkedAt: sourceLink.linkedAt ?? now,
		};
		updated.sourceLinks = [...updated.sourceLinks, sl];

		const event = createLifecycleEvent(itemId, 'source_linked', {
			notes: `Linked to source "${sl.sourceId}"`,
			occurredAt: now,
		});
		updated.lifecycleHistory = [...updated.lifecycleHistory, event];
		updated.updatedAt = now;

		const newCollections = replaceItem(collections, updated);
		resultItem = updated;
		return {
			collections: newCollections,
			diagnostics: opDiagnostics,
			item: updated,
		};
	});

	return { ...result, item: resultItem };
}

export async function linkRegisterItemToAffectedDocument(
	itemId: string,
	docLink: RegisterAffectedDocumentLink,
	options: RegisterLifecycleOptions,
): Promise<RegisterOperationResult> {
	const opDiagnostics: RegisterOperationDiagnostic[] = [];
	let resultItem: AnyRegisterItem | undefined;

	const result = await mutateRegisters(options, (collections, now) => {
		const item = findItem(collections, itemId);
		if (!item) {
			opDiagnostics.push(
				createDiagnostic(
					'register_item_not_found',
					'error',
					`Register item "${itemId}" not found`,
					{ relatedRegisterItemId: itemId },
				),
			);
			return { collections, diagnostics: opDiagnostics, item: undefined };
		}

		const updated = structuredClone(item) as typeof item;
		const dl: RegisterAffectedDocumentLink = {
			...docLink,
			linkedAt: docLink.linkedAt ?? now,
		};
		updated.affectedDocumentLinks = [...updated.affectedDocumentLinks, dl];

		const event = createLifecycleEvent(itemId, 'document_linked', {
			notes: `Linked to document "${dl.documentCanonicalId}"`,
			occurredAt: now,
		});
		updated.lifecycleHistory = [...updated.lifecycleHistory, event];
		updated.updatedAt = now;

		const newCollections = replaceItem(collections, updated);
		resultItem = updated;
		return {
			collections: newCollections,
			diagnostics: opDiagnostics,
			item: updated,
		};
	});

	return { ...result, item: resultItem };
}

export async function unlinkRegisterItemFromAffectedDocument(
	itemId: string,
	documentCanonicalId: string,
	options: RegisterLifecycleOptions,
): Promise<RegisterOperationResult> {
	const opDiagnostics: RegisterOperationDiagnostic[] = [];
	let resultItem: AnyRegisterItem | undefined;

	const result = await mutateRegisters(options, (collections, now) => {
		const item = findItem(collections, itemId);
		if (!item) {
			opDiagnostics.push(
				createDiagnostic(
					'register_item_not_found',
					'error',
					`Register item "${itemId}" not found`,
					{ relatedRegisterItemId: itemId },
				),
			);
			return { collections, diagnostics: opDiagnostics, item: undefined };
		}

		const updated = structuredClone(item) as typeof item;
		const before = updated.affectedDocumentLinks.length;
		updated.affectedDocumentLinks = updated.affectedDocumentLinks.filter(
			(dl) => dl.documentCanonicalId !== documentCanonicalId,
		);

		if (updated.affectedDocumentLinks.length === before) {
			opDiagnostics.push(
				createDiagnostic(
					'register_document_not_linked',
					'warning',
					`Document "${documentCanonicalId}" was not linked to item "${itemId}"`,
					{ relatedRegisterItemId: itemId },
				),
			);
		}

		const event = createLifecycleEvent(itemId, 'document_unlinked', {
			notes: `Unlinked document "${documentCanonicalId}"`,
			occurredAt: now,
		});
		updated.lifecycleHistory = [...updated.lifecycleHistory, event];
		updated.updatedAt = now;

		const newCollections = replaceItem(collections, updated);
		resultItem = updated;
		return {
			collections: newCollections,
			diagnostics: opDiagnostics,
			item: updated,
		};
	});

	return { ...result, item: resultItem };
}

// ---------------------------------------------------------------------------
// List / Get operations
// ---------------------------------------------------------------------------

export async function listRegisterItems(
	options: RegisterLifecycleOptions,
): Promise<{
	success: boolean;
	items: AnyRegisterItem[];
	diagnostics: RegisterOperationDiagnostic[];
}> {
	const { readWorkspaceState } = await import(
		'../state/workspace-state-repository.js'
	);
	const readResult = await readWorkspaceState({
		_fs: options._fs,
		projectRoot: options.projectRoot,
	});

	if (!readResult.success || !readResult.state) {
		return {
			diagnostics: readResult.diagnostics.map((d) =>
				createDiagnostic(
					d.code,
					d.severity as RegisterOperationDiagnostic['severity'],
					d.message,
				),
			),
			items: [],
			success: false,
		};
	}

	const collections = getRegisters(readResult.state);
	const items: AnyRegisterItem[] = [
		...collections.decisions,
		...collections.assumptions,
		...collections.hypotheses,
		...collections.risks,
		...collections.openQuestions,
	];

	return { diagnostics: [], items, success: true };
}

export async function getRegisterItem(
	itemId: string,
	options: RegisterLifecycleOptions,
): Promise<{
	success: boolean;
	item: AnyRegisterItem | undefined;
	diagnostics: RegisterOperationDiagnostic[];
}> {
	const { readWorkspaceState } = await import(
		'../state/workspace-state-repository.js'
	);
	const readResult = await readWorkspaceState({
		_fs: options._fs,
		projectRoot: options.projectRoot,
	});

	if (!readResult.success || !readResult.state) {
		return {
			diagnostics: readResult.diagnostics.map((d) =>
				createDiagnostic(
					d.code,
					d.severity as RegisterOperationDiagnostic['severity'],
					d.message,
				),
			),
			item: undefined,
			success: false,
		};
	}

	const collections = getRegisters(readResult.state);
	const item = findItem(collections, itemId);

	if (!item) {
		return {
			diagnostics: [
				createDiagnostic(
					'register_item_not_found',
					'error',
					`Register item "${itemId}" not found`,
					{ relatedRegisterItemId: itemId },
				),
			],
			item: undefined,
			success: false,
		};
	}

	return { diagnostics: [], item, success: true };
}
