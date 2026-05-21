import { describe, expect, it } from 'vitest';
import {
	CONSISTENCY_RULE_ORDER,
	getAllConsistencyRules,
	getConsistencyRuleById,
} from '../src/consistency/consistency-rules.js';
import type { ConsistencyRuleId } from '../src/consistency/consistency-types.js';

const REQUIRED_RULE_IDS: ConsistencyRuleId[] = [
	'root_path_consistency',
	'profile_identity_consistency',
	'canonical_source_of_truth_boundary',
	'derived_artifact_boundary',
	'validation_overclaim_boundary',
	'hosted_saas_scope_boundary',
	'external_sync_scope_boundary',
	'token_storage_boundary',
	'ai_authority_boundary',
	'unresolved_question_visibility',
	'register_lifecycle_consistency',
	'risk_acceptance_consistency',
	'hypothesis_evidence_consistency',
	'executive_axis_scope_boundary',
	'readme_profile_drift',
	'generated_output_metadata_consistency',
	'provenance_consistency',
];

const REQUIRED_CATEGORIES = [
	'root_path',
	'profile_identity',
	'scope_boundary',
	'source_of_truth',
	'validation_claim',
	'security_boundary',
	'register_state',
	'provenance',
	'artifact_boundary',
	'executive_scope',
	'generation_readiness',
];

describe('consistency rule registry', () => {
	it('includes all required rules', () => {
		const all = getAllConsistencyRules();
		const ids = new Set(all.map((r) => r.id));
		for (const required of REQUIRED_RULE_IDS) {
			expect(ids.has(required)).toBe(true);
		}
	});

	it('every rule has id/title/category/default severity', () => {
		for (const rule of getAllConsistencyRules()) {
			expect(rule.id).toBeTruthy();
			expect(rule.title).toBeTruthy();
			expect(rule.category).toBeTruthy();
			expect(rule.defaultSeverity).toMatch(/^(info|warning|error|fatal)$/);
		}
	});

	it('every rule explains what it checks and does not check', () => {
		for (const rule of getAllConsistencyRules()) {
			expect(rule.checks.length).toBeGreaterThan(0);
			expect(rule.doesNotCheck.length).toBeGreaterThan(0);
		}
	});

	it('release-blocking metadata exists for blocking rules', () => {
		const blockingRules = getAllConsistencyRules().filter(
			(r) => r.canBlockExport || r.canBlockGeneration,
		);
		expect(blockingRules.length).toBeGreaterThan(0);
		for (const rule of blockingRules) {
			expect(rule.canBlockExport || rule.canBlockGeneration).toBe(true);
		}
	});

	it('rule ordering is deterministic', () => {
		const all = getAllConsistencyRules();
		for (let i = 0; i < all.length; i++) {
			expect(all[i].order).toBe(i + 1);
		}
	});

	it('rule ids match CONSISTENCY_RULE_ORDER', () => {
		const all = getAllConsistencyRules();
		expect(all.map((r) => r.id)).toEqual(CONSISTENCY_RULE_ORDER);
	});

	it('covers all required categories', () => {
		const categories = new Set(getAllConsistencyRules().map((r) => r.category));
		for (const cat of REQUIRED_CATEGORIES) {
			expect(categories.has(cat as never)).toBe(true);
		}
	});

	it('getConsistencyRuleById returns undefined for unknown id', () => {
		expect(
			getConsistencyRuleById('unknown' as ConsistencyRuleId),
		).toBeUndefined();
	});
});
