import { describe, expect, it } from 'vitest';
import {
	aiOutputStatuses,
	decisionStatuses,
	defaultTestPolicy,
	renderModes,
	statusContracts,
	validationSeverities,
} from '../../src/index.js';

describe('foundation status contracts', () => {
	it('keeps decision status separate from AI output status', () => {
		expect(statusContracts.decision.name).toBe('DecisionStatus');
		expect(statusContracts.aiOutput.name).toBe('AiOutputStatus');
		expect(decisionStatuses).toEqual([
			'unknown',
			'assumed',
			'proposed',
			'confirmed',
			'deprecated',
		]);
		expect(aiOutputStatuses).toEqual([
			'draft',
			'proposed',
			'needs_review',
			'rejected',
			'confirmed',
		]);
	});

	it('defines deterministic validation and render contracts', () => {
		expect(validationSeverities).toEqual([
			'info',
			'warning',
			'error',
			'critical',
		]);
		expect(renderModes).toEqual(['safe', 'refresh', 'force']);
	});
});

describe('default test policy', () => {
	it('does not require network access or live model credentials', () => {
		expect(defaultTestPolicy.requiresNetwork).toBe(false);
		expect(defaultTestPolicy.requiresLiveModel).toBe(false);
		expect(defaultTestPolicy.credentialSource).toBe('none');
	});
});
