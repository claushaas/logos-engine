import { describe, expect, it } from 'vitest';
import type { Decision } from '../../src/domain/decision-registry.js';
import type {
	RiskPattern,
	ValidationRule,
} from '../../src/domain/profile-loader.js';
import {
	buildDiagnosticsContext,
	convertValidationFindingToDiagnostic,
	createEmptyDiagnosticsResult,
	runDeterministicDiagnostics,
	runDiagnostics,
	type ValidationContext,
} from '../../src/index.js';
import {
	createEmptyValidationResult,
	evaluateRiskPattern,
	evaluateValidationRule,
	runValidation,
	type ValidationFinding,
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

describe('diagnostics engine - empty result', () => {
	it('creates an empty diagnostics result', () => {
		const result = createEmptyDiagnosticsResult();

		expect(result.findings).toEqual([]);
		expect(result.summary.totalCount).toBe(0);
		expect(result.summary.criticalCount).toBe(0);
		expect(result.summary.errorCount).toBe(0);
		expect(result.summary.warningCount).toBe(0);
		expect(result.summary.infoCount).toBe(0);
		expect(result.generatedWithoutLiveAi).toBe(true);
		expect(result.nextRecommendedAction).toBeUndefined();
		expect(result.aiContributions).toEqual([]);
		expect(result.affectedDocuments).toEqual([]);
		expect(result.affectedDecisions).toEqual([]);
	});
});

describe('diagnostics engine - buildDiagnosticsContext', () => {
	it('builds context from validation context', () => {
		const validationContext: ValidationContext = {
			decisions: [
				createTestDecision({
					id: 'test.decision',
					status: 'confirmed',
					value: true,
				}),
			],
		};

		const context = buildDiagnosticsContext(
			validationContext,
			['doc.a'],
			['question.1'],
			['assumption.1'],
		);

		expect(context.decisions).toHaveLength(1);
		expect(context.affectedDocuments).toEqual(['doc.a']);
		expect(context.openQuestionIds).toEqual(['question.1']);
		expect(context.assumptionIds).toEqual(['assumption.1']);
	});

	it('deduplicates affected documents', () => {
		const validationContext: ValidationContext = { decisions: [] };

		const context = buildDiagnosticsContext(validationContext, [
			'doc.a',
			'doc.a',
			'doc.b',
		]);

		expect(context.affectedDocuments).toEqual(['doc.a', 'doc.b']);
	});
});

describe('diagnostics engine - convertValidationFindingToDiagnostic', () => {
	it('converts a required_decision finding to gap category', () => {
		const finding: ValidationFinding = {
			affectedDecisionIds: ['decision.a'],
			affectedDocuments: ['doc.test'],
			description: 'Missing decision',
			id: 'test.finding',
			phaseId: '00-test',
			ruleType: 'required_decision',
			severity: 'error',
			suggestedNextAction: 'Define the decision',
			title: 'Missing Decision',
		};

		const diagnostic = convertValidationFindingToDiagnostic(finding);

		expect(diagnostic.id).toBe('test.finding');
		expect(diagnostic.category).toBe('gap');
		expect(diagnostic.source).toBe('deterministic');
		expect(diagnostic.severity).toBe('error');
		expect(diagnostic.title).toBe('Missing Decision');
		expect(diagnostic.description).toBe('Missing decision');
		expect(diagnostic.affectedDecisionIds).toEqual(['decision.a']);
		expect(diagnostic.affectedDocuments).toEqual(['doc.test']);
		expect(diagnostic.suggestedNextAction).toBe('Define the decision');
	});

	it('converts a consistency finding to inconsistency category', () => {
		const finding: ValidationFinding = {
			affectedDecisionIds: [],
			affectedDocuments: ['doc.test'],
			description: 'Contradiction found',
			id: 'test.inconsistency',
			phaseId: '00-test',
			ruleType: 'consistency',
			severity: 'critical',
			title: 'Contradiction',
		};

		const diagnostic = convertValidationFindingToDiagnostic(finding);

		expect(diagnostic.category).toBe('inconsistency');
		expect(diagnostic.severity).toBe('critical');
	});

	it('converts a risk finding to risk category', () => {
		const finding: ValidationFinding = {
			affectedDecisionIds: [],
			affectedDocuments: ['doc.risk'],
			description: 'High risk pattern',
			id: 'risk.test',
			phaseId: '00-test',
			ruleType: 'risk',
			severity: 'warning',
			title: 'Risk Pattern',
		};

		const diagnostic = convertValidationFindingToDiagnostic(finding);

		expect(diagnostic.category).toBe('risk');
		expect(diagnostic.source).toBe('deterministic');
	});
});

describe('diagnostics engine - runDeterministicDiagnostics', () => {
	it('produces empty diagnostics when validation is clean', () => {
		const validationResult = createEmptyValidationResult();
		const diagnosticsContext = buildDiagnosticsContext({ decisions: [] });

		const result = runDeterministicDiagnostics(
			validationResult,
			diagnosticsContext,
		);

		expect(result.findings).toHaveLength(0);
		expect(result.summary.totalCount).toBe(0);
		expect(result.generatedWithoutLiveAi).toBe(true);
		expect(result.nextRecommendedAction).toBe(
			'Project looks complete. Run /generate to create documentation.',
		);
	});

	it('converts validation findings to diagnostic findings', () => {
		const rule = createTestRule({
			id: 'test.missing',
			requiredDecisionIds: ['foundation.target_user'],
			severity: 'error',
			title: 'Target User Missing',
		});
		const context: ValidationContext = { decisions: [] };
		const finding = evaluateValidationRule(rule, context);
		expect(finding).not.toBeNull();
		if (!finding) throw new Error('Expected finding');

		const validationResult = {
			byPhase: new Map([['00-test', [finding]]]),
			findings: [finding],
			summary: {
				criticalCount: 0,
				errorCount: 1,
				infoCount: 0,
				totalCount: 1,
				warningCount: 0,
			},
		};

		const diagnosticsContext = buildDiagnosticsContext(context);
		const result = runDeterministicDiagnostics(
			validationResult,
			diagnosticsContext,
		);

		expect(result.findings).toHaveLength(1);
		expect(result.findings[0].id).toBe('test.missing');
		expect(result.findings[0].category).toBe('gap');
		expect(result.findings[0].source).toBe('deterministic');
		expect(result.summary.errorCount).toBe(1);
		expect(result.nextRecommendedAction).toBe(
			'Resolve 1 error(s) to unblock progress.',
		);
	});

	it('includes risk pattern findings', () => {
		const pattern = createTestRiskPattern({
			condition: { decision: 'risk.trigger', equals: true },
			id: 'risk.test',
			severity: 'warning',
		});
		const context: ValidationContext = {
			decisions: [
				createTestDecision({
					id: 'risk.trigger',
					status: 'confirmed',
					value: true,
				}),
			],
		};
		const finding = evaluateRiskPattern(pattern, context);
		expect(finding).not.toBeNull();
		if (!finding) throw new Error('Expected finding');

		const validationResult = {
			byPhase: new Map([['00-test', [finding]]]),
			findings: [finding],
			summary: {
				criticalCount: 0,
				errorCount: 0,
				infoCount: 0,
				totalCount: 1,
				warningCount: 1,
			},
		};

		const diagnosticsContext = buildDiagnosticsContext(context);
		const result = runDeterministicDiagnostics(
			validationResult,
			diagnosticsContext,
		);

		expect(result.findings).toHaveLength(1);
		expect(result.findings[0].category).toBe('risk');
		expect(result.findings[0].source).toBe('deterministic');
		expect(result.summary.warningCount).toBe(1);
	});

	it('groups findings by severity', () => {
		const rules = [
			createTestRule({
				id: 'test.critical',
				requiredDecisionIds: ['dec.a'],
				severity: 'critical',
			}),
			createTestRule({
				id: 'test.warning',
				requiredDecisionIds: ['dec.b'],
				severity: 'warning',
			}),
			createTestRule({
				id: 'test.info',
				requiredDecisionIds: ['dec.c'],
				severity: 'info',
			}),
		];
		const context: ValidationContext = { decisions: [] };
		const validationResult = runValidation(rules, [], context);

		const diagnosticsContext = buildDiagnosticsContext(context);
		const result = runDeterministicDiagnostics(
			validationResult,
			diagnosticsContext,
		);

		expect(result.bySeverity.get('critical')).toHaveLength(1);
		expect(result.bySeverity.get('error')).toHaveLength(0);
		expect(result.bySeverity.get('warning')).toHaveLength(1);
		expect(result.bySeverity.get('info')).toHaveLength(1);
	});

	it('groups findings by category', () => {
		const rules = [
			createTestRule({
				id: 'test.gap',
				requiredDecisionIds: ['dec.a'],
				severity: 'error',
			}),
		];
		const patterns = [
			createTestRiskPattern({
				condition: { decision: 'risk.trigger', equals: true },
				id: 'risk.test',
			}),
		];
		const context: ValidationContext = {
			decisions: [
				createTestDecision({
					id: 'risk.trigger',
					status: 'confirmed',
					value: true,
				}),
			],
		};
		const validationResult = runValidation(rules, patterns, context);

		const diagnosticsContext = buildDiagnosticsContext(context);
		const result = runDeterministicDiagnostics(
			validationResult,
			diagnosticsContext,
		);

		expect(result.byCategory.get('gap')).toHaveLength(1);
		expect(result.byCategory.get('risk')).toHaveLength(1);
	});

	it('recommends addressing critical issues first', () => {
		const rules = [
			createTestRule({
				id: 'test.critical',
				requiredDecisionIds: ['dec.a'],
				severity: 'critical',
				suggestedNextAction: 'Define target user immediately.',
			}),
		];
		const context: ValidationContext = { decisions: [] };
		const validationResult = runValidation(rules, [], context);

		const diagnosticsContext = buildDiagnosticsContext(context);
		const result = runDeterministicDiagnostics(
			validationResult,
			diagnosticsContext,
		);

		expect(result.nextRecommendedAction).toBe(
			'Define target user immediately.',
		);
	});

	it('recommends resolving errors when no critical issues', () => {
		const rules = [
			createTestRule({
				id: 'test.error',
				requiredDecisionIds: ['dec.a'],
				severity: 'error',
			}),
		];
		const context: ValidationContext = { decisions: [] };
		const validationResult = runValidation(rules, [], context);

		const diagnosticsContext = buildDiagnosticsContext(context);
		const result = runDeterministicDiagnostics(
			validationResult,
			diagnosticsContext,
		);

		expect(result.nextRecommendedAction).toBe(
			'Resolve 1 error(s) to unblock progress.',
		);
	});

	it('recommends reviewing warnings when no critical or error issues', () => {
		const rules = [
			createTestRule({
				id: 'test.warning',
				requiredDecisionIds: ['dec.a'],
				severity: 'warning',
			}),
		];
		const context: ValidationContext = { decisions: [] };
		const validationResult = runValidation(rules, [], context);

		const diagnosticsContext = buildDiagnosticsContext(context);
		const result = runDeterministicDiagnostics(
			validationResult,
			diagnosticsContext,
		);

		expect(result.nextRecommendedAction).toBe(
			'Review 1 warning(s) to improve completeness.',
		);
	});
});

describe('diagnostics engine - runDiagnostics with mocked AI', () => {
	it('returns deterministic results when no provider is given', async () => {
		const rules = [
			createTestRule({
				id: 'test.missing',
				requiredDecisionIds: ['dec.a'],
			}),
		];
		const context: ValidationContext = { decisions: [] };
		const diagnosticsContext = buildDiagnosticsContext(context);

		const result = await runDiagnostics(rules, [], context, diagnosticsContext);

		expect(result.findings).toHaveLength(1);
		expect(result.generatedWithoutLiveAi).toBe(true);
		expect(result.aiContributions).toHaveLength(0);
	});

	it('returns deterministic results when AI analysis is disabled', async () => {
		const rules = [
			createTestRule({
				id: 'test.missing',
				requiredDecisionIds: ['dec.a'],
			}),
		];
		const context: ValidationContext = { decisions: [] };
		const diagnosticsContext = buildDiagnosticsContext(context);

		const result = await runDiagnostics(
			rules,
			[],
			context,
			diagnosticsContext,
			{ includeAiAnalysis: false },
		);

		expect(result.findings).toHaveLength(1);
		expect(result.generatedWithoutLiveAi).toBe(true);
	});

	it('uses mock provider safely without live AI calls', async () => {
		const { createMockLlmProvider } = await import(
			'../../src/ai/mock-provider.js'
		);
		const mockProvider = createMockLlmProvider();

		const rules = [
			createTestRule({
				id: 'test.missing',
				requiredDecisionIds: ['dec.a'],
			}),
		];
		const context: ValidationContext = { decisions: [] };
		const diagnosticsContext = buildDiagnosticsContext(context);

		const result = await runDiagnostics(
			rules,
			[],
			context,
			diagnosticsContext,
			{ includeAiAnalysis: true, provider: mockProvider },
		);

		// Mock provider returns empty gaps/risks but a recommendation by default
		expect(result.findings.length).toBeGreaterThanOrEqual(1);
		expect(result.findings.some((f) => f.source === 'deterministic')).toBe(
			true,
		);
		expect(result.generatedWithoutLiveAi).toBe(false);
	});

	it('handles malformed AI responses gracefully', async () => {
		const { createMockLlmProvider } = await import(
			'../../src/ai/mock-provider.js'
		);
		const mockProvider = createMockLlmProvider({
			identify_gaps: { gaps: 'not_an_array', status: 'needs_review' },
			identify_risks: { risks: 'not_an_array', status: 'needs_review' },
			recommend_next_question_group: {
				recommendation: 'not_an_object',
				status: 'proposed',
			},
		});

		const rules = [
			createTestRule({
				id: 'test.missing',
				requiredDecisionIds: ['dec.a'],
			}),
		];
		const context: ValidationContext = { decisions: [] };
		const diagnosticsContext = buildDiagnosticsContext(context);

		const result = await runDiagnostics(
			rules,
			[],
			context,
			diagnosticsContext,
			{ includeAiAnalysis: true, provider: mockProvider },
		);

		// Should still return deterministic findings even if AI response is malformed
		expect(result.findings.some((f) => f.source === 'deterministic')).toBe(
			true,
		);
	});
});

describe('diagnostics engine - does not mutate confirmed decisions', () => {
	it('preserves all decision statuses', () => {
		const decisions = [
			createTestDecision({
				id: 'decision.a',
				status: 'confirmed',
				value: true,
			}),
			createTestDecision({
				id: 'decision.b',
				status: 'proposed',
				value: false,
			}),
		];
		const context: ValidationContext = { decisions };
		const diagnosticsContext = buildDiagnosticsContext(context);

		const validationResult = createEmptyValidationResult();
		const result = runDeterministicDiagnostics(
			validationResult,
			diagnosticsContext,
		);

		// Verify no mutations occurred
		expect(decisions[0].status).toBe('confirmed');
		expect(decisions[1].status).toBe('proposed');
		expect(result.affectedDecisions).toEqual([]);
	});
});
