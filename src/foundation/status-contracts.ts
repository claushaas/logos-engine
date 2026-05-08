export const decisionStatuses = [
	'unknown',
	'assumed',
	'proposed',
	'confirmed',
	'deprecated',
] as const;

export type DecisionStatus = (typeof decisionStatuses)[number];

export const aiOutputStatuses = [
	'draft',
	'proposed',
	'needs_review',
	'rejected',
	'confirmed',
] as const;

export type AiOutputStatus = (typeof aiOutputStatuses)[number];

export const validationSeverities = [
	'info',
	'warning',
	'error',
	'critical',
] as const;

export type ValidationSeverity = (typeof validationSeverities)[number];

export const renderModes = ['safe', 'refresh', 'force'] as const;

export type RenderMode = (typeof renderModes)[number];

export const statusContracts = {
	aiOutput: {
		name: 'AiOutputStatus',
		values: aiOutputStatuses,
	},
	decision: {
		name: 'DecisionStatus',
		values: decisionStatuses,
	},
	renderMode: {
		name: 'RenderMode',
		values: renderModes,
	},
	validationSeverity: {
		name: 'ValidationSeverity',
		values: validationSeverities,
	},
} as const;
