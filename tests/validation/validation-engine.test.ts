import { describe, expect, it } from 'vitest';
import type { Decision } from '../../src/domain/decision-registry.js';
import type {
	RiskPattern,
	ValidationRule,
} from '../../src/domain/profile-loader.js';
import {
	createEmptyValidationResult,
	evaluateCondition,
	evaluateRiskPattern,
	evaluateValidationRule,
	runValidation,
	type ValidationCondition,
	type ValidationContext,
} from '../../src/validation/validation-engine.js';

function createTestDecision(
	overrides: Partial<Decision> & { id: string; value: unknown },
): Decision {
	const now = new Date().toISOString();
	return {
		affectedDocuments: [],
		confidence: 'medium',
		createdAt: now,
		id: overrides.id,
		impacts: [],
		rationale: 'Test decision',
		revisionHistory: [],
		sourceAnswerIds: [],
		status: overrides.status ?? 'confirmed',
		title: `Test ${overrides.id}`,
		updatedAt: now,
		value: overrides.value,
		...overrides,
	};
}

function createTestRule(
	overrides: Partial<ValidationRule> & { id: string },
): ValidationRule {
	return {
		affectedDocuments: ['doc.test'],
		description: 'Test rule',
		phaseId: '00-test',
		requiredDecisionIds: ['test.decision'],
		severity: 'error',
		title: 'Test Rule',
		...overrides,
	} as ValidationRule;
}

function createTestRiskPattern(
	overrides: Partial<RiskPattern> & { id: string },
): RiskPattern {
	return {
		affectedDocuments: ['doc.risk'],
		description: 'Test risk',
		phaseId: '00-test',
		severity: 'warning',
		title: 'Test Risk',
		...overrides,
	} as RiskPattern;
}

describe('validation engine - empty result', () => {
	it('creates an empty validation result', () => {
		const result = createEmptyValidationResult();

		expect(result.findings).toEqual([]);
		expect(result.summary.totalCount).toBe(0);
		expect(result.summary.criticalCount).toBe(0);
		expect(result.summary.errorCount).toBe(0);
		expect(result.summary.warningCount).toBe(0);
		expect(result.summary.infoCount).toBe(0);
		expect(result.byPhase.size).toBe(0);
	});
});

describe('validation engine - required decision rules', () => {
	it('returns a finding when required decision is missing', () => {
		const rule = createTestRule({
			id: 'test.missing_decision',
			requiredDecisionIds: ['foundation.target_user'],
		});
		const context: ValidationContext = { decisions: [] };

		const finding = evaluateValidationRule(rule, context);

		expect(finding).not.toBeNull();
		expect(finding?.id).toBe('test.missing_decision');
		expect(finding?.severity).toBe('error');
		expect(finding?.affectedDecisionIds).toEqual(['foundation.target_user']);
		expect(finding?.ruleType).toBe('required_decision');
	});

	it('returns a finding when required decision is not confirmed', () => {
		const rule = createTestRule({
			id: 'test.unconfirmed_decision',
			requiredDecisionIds: ['foundation.target_user'],
		});
		const context: ValidationContext = {
			decisions: [
				createTestDecision({
					id: 'foundation.target_user',
					status: 'assumed',
					value: 'developers',
				}),
			],
		};

		const finding = evaluateValidationRule(rule, context);

		expect(finding).not.toBeNull();
		expect(finding?.affectedDecisionIds).toEqual(['foundation.target_user']);
	});

	it('returns null when all required decisions are confirmed', () => {
		const rule = createTestRule({
			id: 'test.confirmed_decision',
			requiredDecisionIds: ['foundation.target_user'],
		});
		const context: ValidationContext = {
			decisions: [
				createTestDecision({
					id: 'foundation.target_user',
					status: 'confirmed',
					value: 'developers',
				}),
			],
		};

		const finding = evaluateValidationRule(rule, context);

		expect(finding).toBeNull();
	});

	it('checks multiple required decisions', () => {
		const rule = createTestRule({
			id: 'test.multi_decisions',
			requiredDecisionIds: ['decision.a', 'decision.b', 'decision.c'],
		});
		const context: ValidationContext = {
			decisions: [
				createTestDecision({
					id: 'decision.a',
					status: 'confirmed',
					value: true,
				}),
				createTestDecision({
					id: 'decision.b',
					status: 'assumed',
					value: true,
				}),
			],
		};

		const finding = evaluateValidationRule(rule, context);

		expect(finding).not.toBeNull();
		expect(finding?.affectedDecisionIds).toEqual(['decision.b', 'decision.c']);
	});
});

describe('validation engine - conditional rules', () => {
	it('skips rule when condition is not met', () => {
		const rule = createTestRule({
			condition: {
				decision: 'feature.enabled',
				equals: true,
			},
			id: 'test.conditional',
			requiredDecisionIds: ['feature.config'],
		});
		const context: ValidationContext = {
			decisions: [
				createTestDecision({
					id: 'feature.enabled',
					status: 'confirmed',
					value: false,
				}),
			],
		};

		const finding = evaluateValidationRule(rule, context);

		expect(finding).toBeNull();
	});

	it('evaluates rule when condition is met', () => {
		const rule = createTestRule({
			condition: {
				decision: 'feature.enabled',
				equals: true,
			},
			id: 'test.conditional_met',
			requiredDecisionIds: ['feature.config'],
		});
		const context: ValidationContext = {
			decisions: [
				createTestDecision({
					id: 'feature.enabled',
					status: 'confirmed',
					value: true,
				}),
			],
		};

		const finding = evaluateValidationRule(rule, context);

		expect(finding).not.toBeNull();
		expect(finding?.id).toBe('test.conditional_met');
		expect(finding?.ruleType).toBe('dependency');
	});

	it('handles condition with "in" operator', () => {
		const rule = createTestRule({
			condition: {
				decision: 'pricing.model',
				in: ['freemium', 'free'],
			},
			id: 'test.in_condition',
			requiredDecisionIds: ['pricing.limits'],
		});
		const context: ValidationContext = {
			decisions: [
				createTestDecision({
					id: 'pricing.model',
					status: 'confirmed',
					value: 'freemium',
				}),
			],
		};

		const finding = evaluateValidationRule(rule, context);

		expect(finding).not.toBeNull();
	});

	it('handles "all" composite condition', () => {
		const rule = createTestRule({
			condition: {
				all: [
					{ decision: 'feature.ai', equals: true },
					{ decision: 'pricing.model', in: ['free', 'freemium'] },
				],
			},
			id: 'test.all_condition',
			requiredDecisionIds: ['feature.ai_limits'],
		});
		const context: ValidationContext = {
			decisions: [
				createTestDecision({
					id: 'feature.ai',
					status: 'confirmed',
					value: true,
				}),
				createTestDecision({
					id: 'pricing.model',
					status: 'confirmed',
					value: 'freemium',
				}),
			],
		};

		const finding = evaluateValidationRule(rule, context);

		expect(finding).not.toBeNull();
		expect(finding?.ruleType).toBe('dependency');
	});

	it('handles "any" composite condition', () => {
		const rule = createTestRule({
			condition: {
				any: [
					{ decision: 'feature.a', equals: true },
					{ decision: 'feature.b', equals: true },
				],
			},
			id: 'test.any_condition',
			requiredDecisionIds: ['feature.limits'],
		});
		const context: ValidationContext = {
			decisions: [
				createTestDecision({
					id: 'feature.a',
					status: 'confirmed',
					value: false,
				}),
				createTestDecision({
					id: 'feature.b',
					status: 'confirmed',
					value: true,
				}),
			],
		};

		const finding = evaluateValidationRule(rule, context);

		expect(finding).not.toBeNull();
	});

	it('skips rule when unconfirmed decision in condition', () => {
		const rule = createTestRule({
			condition: {
				decision: 'feature.enabled',
				equals: true,
			},
			id: 'test.unconfirmed_condition',
			requiredDecisionIds: ['feature.config'],
		});
		const context: ValidationContext = {
			decisions: [
				createTestDecision({
					id: 'feature.enabled',
					status: 'proposed',
					value: true,
				}),
			],
		};

		const finding = evaluateValidationRule(rule, context);

		expect(finding).toBeNull();
	});
});

describe('validation engine - risk patterns', () => {
	it('returns a finding when risk condition is met', () => {
		const pattern = createTestRiskPattern({
			condition: {
				decision: 'feature.high_risk',
				equals: true,
			},
			id: 'risk.test',
		});
		const context: ValidationContext = {
			decisions: [
				createTestDecision({
					id: 'feature.high_risk',
					status: 'confirmed',
					value: true,
				}),
			],
		};

		const finding = evaluateRiskPattern(pattern, context);

		expect(finding).not.toBeNull();
		expect(finding?.id).toBe('risk.test');
		expect(finding?.ruleType).toBe('risk');
	});

	it('returns null when risk condition is not met', () => {
		const pattern = createTestRiskPattern({
			condition: {
				decision: 'feature.high_risk',
				equals: true,
			},
			id: 'risk.test',
		});
		const context: ValidationContext = {
			decisions: [
				createTestDecision({
					id: 'feature.high_risk',
					status: 'confirmed',
					value: false,
				}),
			],
		};

		const finding = evaluateRiskPattern(pattern, context);

		expect(finding).toBeNull();
	});

	it('returns a finding for unconditional risk patterns', () => {
		const pattern = createTestRiskPattern({
			id: 'risk.always',
		});
		const context: ValidationContext = { decisions: [] };

		const finding = evaluateRiskPattern(pattern, context);

		expect(finding).not.toBeNull();
		expect(finding?.id).toBe('risk.always');
	});
});

describe('validation engine - runValidation', () => {
	it('runs all rules and returns findings', () => {
		const rules = [
			createTestRule({ id: 'test.a', requiredDecisionIds: ['decision.a'] }),
			createTestRule({ id: 'test.b', requiredDecisionIds: ['decision.b'] }),
		];
		const context: ValidationContext = {
			decisions: [
				createTestDecision({
					id: 'decision.a',
					status: 'confirmed',
					value: true,
				}),
			],
		};

		const result = runValidation(rules, [], context);

		expect(result.findings).toHaveLength(1);
		expect(result.findings[0].id).toBe('test.b');
		expect(result.summary.errorCount).toBe(1);
		expect(result.summary.totalCount).toBe(1);
	});

	it('includes risk patterns in results', () => {
		const rules = [
			createTestRule({ id: 'test.a', requiredDecisionIds: ['decision.a'] }),
		];
		const patterns = [
			createTestRiskPattern({
				condition: { decision: 'risk.trigger', equals: true },
				id: 'risk.a',
			}),
		];
		const context: ValidationContext = {
			decisions: [
				createTestDecision({
					id: 'decision.a',
					status: 'confirmed',
					value: true,
				}),
				createTestDecision({
					id: 'risk.trigger',
					status: 'confirmed',
					value: true,
				}),
			],
		};

		const result = runValidation(rules, patterns, context);

		expect(result.findings).toHaveLength(1);
		expect(result.findings[0].id).toBe('risk.a');
		expect(result.summary.warningCount).toBe(1);
	});

	it('filters findings by phase', () => {
		const rules = [
			createTestRule({
				id: 'test.phase1',
				phaseId: '01-phase',
				requiredDecisionIds: ['dec.a'],
			}),
			createTestRule({
				id: 'test.phase2',
				phaseId: '02-phase',
				requiredDecisionIds: ['dec.b'],
			}),
		];
		const context: ValidationContext = { decisions: [] };

		const result = runValidation(rules, [], context, { phaseId: '01-phase' });

		expect(result.findings).toHaveLength(1);
		expect(result.findings[0].id).toBe('test.phase1');
	});

	it('groups findings by phase', () => {
		const rules = [
			createTestRule({
				id: 'test.a',
				phaseId: '01-phase',
				requiredDecisionIds: ['dec.a'],
			}),
			createTestRule({
				id: 'test.b',
				phaseId: '01-phase',
				requiredDecisionIds: ['dec.b'],
			}),
			createTestRule({
				id: 'test.c',
				phaseId: '02-phase',
				requiredDecisionIds: ['dec.c'],
			}),
		];
		const context: ValidationContext = { decisions: [] };

		const result = runValidation(rules, [], context);

		expect(result.byPhase.get('01-phase')).toHaveLength(2);
		expect(result.byPhase.get('02-phase')).toHaveLength(1);
	});

	it('counts all severity levels in summary', () => {
		const rules = [
			createTestRule({
				id: 'test.critical',
				requiredDecisionIds: ['dec.a'],
				severity: 'critical',
			}),
			createTestRule({
				id: 'test.error',
				requiredDecisionIds: ['dec.b'],
				severity: 'error',
			}),
			createTestRule({
				id: 'test.warning',
				requiredDecisionIds: ['dec.c'],
				severity: 'warning',
			}),
			createTestRule({
				id: 'test.info',
				requiredDecisionIds: ['dec.d'],
				severity: 'info',
			}),
		];
		const context: ValidationContext = { decisions: [] };

		const result = runValidation(rules, [], context);

		expect(result.summary.criticalCount).toBe(1);
		expect(result.summary.errorCount).toBe(1);
		expect(result.summary.warningCount).toBe(1);
		expect(result.summary.infoCount).toBe(1);
		expect(result.summary.totalCount).toBe(4);
	});
});

describe('validation engine - condition evaluator', () => {
	it('evaluates equals condition', () => {
		const condition: ValidationCondition = {
			decision: 'test.decision',
			equals: 'expected_value',
		};
		const context: ValidationContext = {
			decisions: [
				createTestDecision({
					id: 'test.decision',
					status: 'confirmed',
					value: 'expected_value',
				}),
			],
		};

		expect(evaluateCondition(condition, context)).toBe(true);
	});

	it('evaluates not equals condition', () => {
		const condition: ValidationCondition = {
			decision: 'test.decision',
			equals: 'wrong_value',
		};
		const context: ValidationContext = {
			decisions: [
				createTestDecision({
					id: 'test.decision',
					status: 'confirmed',
					value: 'expected_value',
				}),
			],
		};

		expect(evaluateCondition(condition, context)).toBe(false);
	});

	it('evaluates in condition', () => {
		const condition: ValidationCondition = {
			decision: 'test.decision',
			in: ['a', 'b', 'c'],
		};
		const context: ValidationContext = {
			decisions: [
				createTestDecision({
					id: 'test.decision',
					status: 'confirmed',
					value: 'b',
				}),
			],
		};

		expect(evaluateCondition(condition, context)).toBe(true);
	});

	it('evaluates not in condition', () => {
		const condition: ValidationCondition = {
			decision: 'test.decision',
			in: ['a', 'b', 'c'],
		};
		const context: ValidationContext = {
			decisions: [
				createTestDecision({
					id: 'test.decision',
					status: 'confirmed',
					value: 'z',
				}),
			],
		};

		expect(evaluateCondition(condition, context)).toBe(false);
	});

	it('evaluates all condition with all true', () => {
		const condition: ValidationCondition = {
			all: [
				{ decision: 'test.a', equals: true },
				{ decision: 'test.b', equals: true },
			],
		};
		const context: ValidationContext = {
			decisions: [
				createTestDecision({ id: 'test.a', status: 'confirmed', value: true }),
				createTestDecision({ id: 'test.b', status: 'confirmed', value: true }),
			],
		};

		expect(evaluateCondition(condition, context)).toBe(true);
	});

	it('evaluates all condition with one false', () => {
		const condition: ValidationCondition = {
			all: [
				{ decision: 'test.a', equals: true },
				{ decision: 'test.b', equals: true },
			],
		};
		const context: ValidationContext = {
			decisions: [
				createTestDecision({ id: 'test.a', status: 'confirmed', value: true }),
				createTestDecision({ id: 'test.b', status: 'confirmed', value: false }),
			],
		};

		expect(evaluateCondition(condition, context)).toBe(false);
	});

	it('evaluates any condition with one true', () => {
		const condition: ValidationCondition = {
			any: [
				{ decision: 'test.a', equals: true },
				{ decision: 'test.b', equals: true },
			],
		};
		const context: ValidationContext = {
			decisions: [
				createTestDecision({ id: 'test.a', status: 'confirmed', value: false }),
				createTestDecision({ id: 'test.b', status: 'confirmed', value: true }),
			],
		};

		expect(evaluateCondition(condition, context)).toBe(true);
	});

	it('evaluates any condition with all false', () => {
		const condition: ValidationCondition = {
			any: [
				{ decision: 'test.a', equals: true },
				{ decision: 'test.b', equals: true },
			],
		};
		const context: ValidationContext = {
			decisions: [
				createTestDecision({ id: 'test.a', status: 'confirmed', value: false }),
				createTestDecision({ id: 'test.b', status: 'confirmed', value: false }),
			],
		};

		expect(evaluateCondition(condition, context)).toBe(false);
	});

	it('returns false when decision is not confirmed', () => {
		const condition: ValidationCondition = {
			decision: 'test.decision',
			equals: 'expected_value',
		};
		const context: ValidationContext = {
			decisions: [
				createTestDecision({
					id: 'test.decision',
					status: 'assumed',
					value: 'expected_value',
				}),
			],
		};

		expect(evaluateCondition(condition, context)).toBe(false);
	});

	it('returns false when decision does not exist', () => {
		const condition: ValidationCondition = {
			decision: 'test.missing',
			equals: 'expected_value',
		};
		const context: ValidationContext = { decisions: [] };

		expect(evaluateCondition(condition, context)).toBe(false);
	});

	it('handles nested all/any conditions', () => {
		const condition: ValidationCondition = {
			all: [
				{
					any: [
						{ decision: 'test.a', equals: true },
						{ decision: 'test.b', equals: true },
					],
				},
				{ decision: 'test.c', equals: true },
			],
		};
		const context: ValidationContext = {
			decisions: [
				createTestDecision({ id: 'test.a', status: 'confirmed', value: false }),
				createTestDecision({ id: 'test.b', status: 'confirmed', value: true }),
				createTestDecision({ id: 'test.c', status: 'confirmed', value: true }),
			],
		};

		expect(evaluateCondition(condition, context)).toBe(true);
	});

	it('handles numeric values in equals', () => {
		const condition: ValidationCondition = {
			decision: 'test.decision',
			equals: 42,
		};
		const context: ValidationContext = {
			decisions: [
				createTestDecision({
					id: 'test.decision',
					status: 'confirmed',
					value: 42,
				}),
			],
		};

		expect(evaluateCondition(condition, context)).toBe(true);
	});

	it('handles boolean values in equals', () => {
		const condition: ValidationCondition = {
			decision: 'test.decision',
			equals: true,
		};
		const context: ValidationContext = {
			decisions: [
				createTestDecision({
					id: 'test.decision',
					status: 'confirmed',
					value: true,
				}),
			],
		};

		expect(evaluateCondition(condition, context)).toBe(true);
	});
});

describe('validation engine - App Business critical rules', () => {
	it('flags missing target user as error', () => {
		const rule = createTestRule({
			affectedDocuments: ['intake.idea_brief'],
			description:
				'The project cannot complete foundation without a primary user.',
			id: 'foundation.target_user_required',
			phaseId: '00-intake',
			requiredDecisionIds: ['foundation.target_user'],
			severity: 'error',
			title: 'Target User Required',
		});
		const context: ValidationContext = { decisions: [] };

		const finding = evaluateValidationRule(rule, context);

		expect(finding).not.toBeNull();
		expect(finding?.severity).toBe('error');
		expect(finding?.affectedDocuments).toEqual(['intake.idea_brief']);
	});

	it('flags offline-first dependency when condition is met', () => {
		const rule = createTestRule({
			affectedDocuments: [
				'architecture.architecture',
				'architecture.data_model',
				'testing.testing_strategy',
			],
			condition: {
				decision: 'architecture.offline_strategy',
				equals: 'offline_first',
			},
			description:
				'Offline-first requires local storage, sync strategy, conflict resolution, and offline testing.',
			id: 'architecture.offline_first_dependency',
			phaseId: '06-architecture',
			requiredDecisionIds: [
				'architecture.local_storage',
				'architecture.sync_strategy',
				'architecture.conflict_resolution',
				'testing.offline_testing',
			],
			severity: 'error',
			title: 'Offline-First Dependency',
		});
		const context: ValidationContext = {
			decisions: [
				createTestDecision({
					id: 'architecture.offline_strategy',
					status: 'confirmed',
					value: 'offline_first',
				}),
			],
		};

		const finding = evaluateValidationRule(rule, context);

		expect(finding).not.toBeNull();
		expect(finding?.affectedDecisionIds).toEqual([
			'architecture.local_storage',
			'architecture.sync_strategy',
			'architecture.conflict_resolution',
			'testing.offline_testing',
		]);
	});

	it('skips offline-first dependency when condition is not met', () => {
		const rule = createTestRule({
			affectedDocuments: ['architecture.architecture'],
			condition: {
				decision: 'architecture.offline_strategy',
				equals: 'offline_first',
			},
			description: 'Offline-first requires local storage.',
			id: 'architecture.offline_first_dependency',
			phaseId: '06-architecture',
			requiredDecisionIds: ['architecture.local_storage'],
			severity: 'error',
			title: 'Offline-First Dependency',
		});
		const context: ValidationContext = {
			decisions: [
				createTestDecision({
					id: 'architecture.offline_strategy',
					status: 'confirmed',
					value: 'online_only',
				}),
			],
		};

		const finding = evaluateValidationRule(rule, context);

		expect(finding).toBeNull();
	});

	it('flags AI cost risk when condition is met', () => {
		const rule = createTestRule({
			affectedDocuments: [
				'economics.financial_model',
				'governance.risk_register',
			],
			condition: {
				all: [
					{ decision: 'product.uses_ai_heavy_workflows', equals: true },
					{
						decision: 'economics.pricing_model',
						in: ['free', 'freemium', 'low_price_subscription'],
					},
				],
			},
			description:
				'If the app uses AI-heavy workflows and has low pricing or a freemium model, flag gross margin risk.',
			id: 'economics.ai_cost_risk',
			phaseId: '03-economics',
			requiredDecisionIds: [],
			severity: 'warning',
			title: 'AI Cost Risk',
		});
		const context: ValidationContext = {
			decisions: [
				createTestDecision({
					id: 'product.uses_ai_heavy_workflows',
					status: 'confirmed',
					value: true,
				}),
				createTestDecision({
					id: 'economics.pricing_model',
					status: 'confirmed',
					value: 'freemium',
				}),
			],
		};

		const finding = evaluateValidationRule(rule, context);

		expect(finding).not.toBeNull();
		expect(finding?.ruleType).toBe('consistency');
	});
});
