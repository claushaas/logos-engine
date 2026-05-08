import type { Decision } from '../domain/decision-registry.js';
import type { RiskPattern, ValidationRule } from '../domain/profile-loader.js';
import type { ValidationSeverity } from '../foundation/status-contracts.js';

export type ValidationFinding = {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly severity: ValidationSeverity;
	readonly phaseId: string;
	readonly affectedDocuments: readonly string[];
	readonly affectedDecisionIds: readonly string[];
	readonly suggestedNextAction: string | undefined;
	readonly ruleType:
		| 'required_decision'
		| 'dependency'
		| 'consistency'
		| 'risk';
};

export type ValidationResult = {
	readonly findings: readonly ValidationFinding[];
	readonly summary: {
		readonly criticalCount: number;
		readonly errorCount: number;
		readonly warningCount: number;
		readonly infoCount: number;
		readonly totalCount: number;
	};
	readonly byPhase: ReadonlyMap<string, readonly ValidationFinding[]>;
};

export type ValidationContext = {
	readonly decisions: readonly Decision[];
};

export function createEmptyValidationResult(): ValidationResult {
	return {
		byPhase: new Map(),
		findings: [],
		summary: {
			criticalCount: 0,
			errorCount: 0,
			infoCount: 0,
			totalCount: 0,
			warningCount: 0,
		},
	};
}

export function evaluateValidationRule(
	rule: ValidationRule,
	context: ValidationContext,
): ValidationFinding | null {
	if (rule.condition) {
		const conditionMet = evaluateCondition(rule.condition, context);
		if (!conditionMet) {
			return null;
		}
	}

	const missingDecisionIds = getMissingConfirmedDecisionIds(
		rule.requiredDecisionIds,
		context,
	);

	if (missingDecisionIds.length === 0 && rule.requiredDecisionIds.length > 0) {
		return null;
	}

	if (
		missingDecisionIds.length === 0 &&
		rule.requiredDecisionIds.length === 0 &&
		!rule.condition
	) {
		return null;
	}

	return {
		affectedDecisionIds: missingDecisionIds,
		affectedDocuments: rule.affectedDocuments,
		description: rule.description,
		id: rule.id,
		phaseId: rule.phaseId,
		ruleType: inferRuleType(rule),
		severity: rule.severity,
		suggestedNextAction: rule.suggestedNextAction,
		title: rule.title,
	};
}

export function evaluateRiskPattern(
	pattern: RiskPattern,
	context: ValidationContext,
): ValidationFinding | null {
	if (pattern.condition) {
		const conditionMet = evaluateCondition(pattern.condition, context);
		if (!conditionMet) {
			return null;
		}
	}

	return {
		affectedDecisionIds: [],
		affectedDocuments: pattern.affectedDocuments,
		description: pattern.description,
		id: pattern.id,
		phaseId: pattern.phaseId,
		ruleType: 'risk',
		severity: pattern.severity,
		suggestedNextAction: pattern.suggestedNextAction,
		title: pattern.title,
	};
}

export function runValidation(
	rules: readonly ValidationRule[],
	riskPatterns: readonly RiskPattern[],
	context: ValidationContext,
	options?: { phaseId?: string },
): ValidationResult {
	const findings: ValidationFinding[] = [];

	const filteredRules = options?.phaseId
		? rules.filter((rule) => rule.phaseId === options.phaseId)
		: rules;

	const filteredPatterns = options?.phaseId
		? riskPatterns.filter((pattern) => pattern.phaseId === options.phaseId)
		: riskPatterns;

	for (const rule of filteredRules) {
		const finding = evaluateValidationRule(rule, context);
		if (finding) {
			findings.push(finding);
		}
	}

	for (const pattern of filteredPatterns) {
		const finding = evaluateRiskPattern(pattern, context);
		if (finding) {
			findings.push(finding);
		}
	}

	return buildValidationResult(findings);
}

function buildValidationResult(
	findings: readonly ValidationFinding[],
): ValidationResult {
	const summary = {
		criticalCount: findings.filter((f) => f.severity === 'critical').length,
		errorCount: findings.filter((f) => f.severity === 'error').length,
		infoCount: findings.filter((f) => f.severity === 'info').length,
		totalCount: findings.length,
		warningCount: findings.filter((f) => f.severity === 'warning').length,
	};

	const byPhase = new Map<string, ValidationFinding[]>();
	for (const finding of findings) {
		const phaseFindings = byPhase.get(finding.phaseId) ?? [];
		phaseFindings.push(finding);
		byPhase.set(finding.phaseId, phaseFindings);
	}

	return {
		byPhase,
		findings,
		summary,
	};
}

function inferRuleType(rule: ValidationRule): ValidationFinding['ruleType'] {
	if (rule.condition) {
		if (rule.requiredDecisionIds.length > 0) {
			return 'dependency';
		}
		return 'consistency';
	}
	return 'required_decision';
}

function getMissingConfirmedDecisionIds(
	requiredDecisionIds: readonly string[],
	context: ValidationContext,
): readonly string[] {
	const missing: string[] = [];

	for (const decisionId of requiredDecisionIds) {
		const decision = context.decisions.find((d) => d.id === decisionId);
		if (!decision || decision.status !== 'confirmed') {
			missing.push(decisionId);
		}
	}

	return missing;
}

export type ValidationCondition = {
	readonly all?: readonly ValidationCondition[] | undefined;
	readonly any?: readonly ValidationCondition[] | undefined;
	readonly decision?: string | undefined;
	readonly equals?: unknown | undefined;
	readonly in?: readonly unknown[] | undefined;
};

export function evaluateCondition(
	condition: ValidationCondition,
	context: ValidationContext,
): boolean {
	if (condition.all !== undefined) {
		return condition.all.every((subCondition) =>
			evaluateCondition(subCondition, context),
		);
	}

	if (condition.any !== undefined) {
		return condition.any.some((subCondition) =>
			evaluateCondition(subCondition, context),
		);
	}

	if (condition.decision !== undefined) {
		const decision = context.decisions.find((d) => d.id === condition.decision);

		if (!decision || decision.status !== 'confirmed') {
			return false;
		}

		const decisionValue = decision.value;

		if (condition.equals !== undefined) {
			return deepEqual(decisionValue, condition.equals);
		}

		if (condition.in !== undefined) {
			return condition.in.some((value) => deepEqual(decisionValue, value));
		}

		return true;
	}

	return true;
}

function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (typeof a !== typeof b) return false;
	if (typeof a !== 'object' || a === null || b === null) return false;

	const aObj = a as Record<string, unknown>;
	const bObj = b as Record<string, unknown>;
	const aKeys = Object.keys(aObj);
	const bKeys = Object.keys(bObj);

	if (aKeys.length !== bKeys.length) return false;

	return aKeys.every((key) => deepEqual(aObj[key], bObj[key]));
}
