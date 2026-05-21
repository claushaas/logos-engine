/** Step 12.4 — Candidate Extraction Model Tests */

import { describe, expect, it } from 'vitest';
import {
	CANDIDATE_EXTRACTED_ITEM_CONFIDENCE_ORDER,
	CANDIDATE_EXTRACTED_ITEM_KIND_ORDER,
	CANDIDATE_EXTRACTED_ITEM_STATUS_ORDER,
	CANDIDATE_EXTRACTION_ACTION_KIND_ORDER,
	CANDIDATE_EXTRACTION_CONFLICT_KIND_ORDER,
	CANDIDATE_EXTRACTION_READINESS_ORDER,
	CANDIDATE_EXTRACTION_SOURCE_KIND_ORDER,
} from '../src/index.js';

// ---------------------------------------------------------------------------
// Model validation
// ---------------------------------------------------------------------------

describe('candidate extraction model', () => {
	it('supports all source kinds', () => {
		const kinds = Object.keys(CANDIDATE_EXTRACTION_SOURCE_KIND_ORDER);
		expect(kinds).toContain('import_candidate');
		expect(kinds).toContain('markdown_frontmatter');
		expect(kinds).toContain('markdown_heading');
		expect(kinds).toContain('markdown_bounded_snippet');
		expect(kinds).toContain('yaml_descriptor');
		expect(kinds).toContain('json_descriptor');
		expect(kinds).toContain('repository_scan_fact');
		expect(kinds).toContain('docs_code_consistency_finding');
		expect(kinds).toContain('profile_contract');
		expect(kinds).toContain('existing_register_item');
		expect(kinds).toContain('validation_finding');
		expect(kinds).toContain('unknown');
	});

	it('supports all extracted item kinds', () => {
		const kinds = Object.keys(CANDIDATE_EXTRACTED_ITEM_KIND_ORDER);
		expect(kinds).toContain('fact');
		expect(kinds).toContain('decision');
		expect(kinds).toContain('assumption');
		expect(kinds).toContain('hypothesis');
		expect(kinds).toContain('risk');
		expect(kinds).toContain('open_question');
		expect(kinds).toContain('constraint');
		expect(kinds).toContain('requirement');
		expect(kinds).toContain('acceptance_criterion');
		expect(kinds).toContain('non_goal');
		expect(kinds).toContain('evidence_reference');
		expect(kinds).toContain('unknown');
	});

	it('supports all item statuses', () => {
		const statuses = Object.keys(CANDIDATE_EXTRACTED_ITEM_STATUS_ORDER);
		expect(statuses).toContain('candidate');
		expect(statuses).toContain('requires_review');
		expect(statuses).toContain('ambiguous');
		expect(statuses).toContain('conflicting');
		expect(statuses).toContain('unsupported');
		expect(statuses).toContain('blocked');
		expect(statuses).toContain('duplicate');
		expect(statuses).toContain('unknown');
	});

	it('supports all confidence values', () => {
		const confidences = Object.keys(CANDIDATE_EXTRACTED_ITEM_CONFIDENCE_ORDER);
		expect(confidences).toContain('high');
		expect(confidences).toContain('medium');
		expect(confidences).toContain('low');
		expect(confidences).toContain('unknown');
	});

	it('supports all conflict kinds', () => {
		const kinds = Object.keys(CANDIDATE_EXTRACTION_CONFLICT_KIND_ORDER);
		expect(kinds).toContain('contradicts_existing_confirmed_record');
		expect(kinds).toContain('contradicts_profile_contract');
		expect(kinds).toContain('contradicts_scanner_observation');
		expect(kinds).toContain('contradicts_docs_code_consistency');
		expect(kinds).toContain('duplicate_candidate');
		expect(kinds).toContain('ambiguous_source');
		expect(kinds).toContain('missing_source_reference');
		expect(kinds).toContain('unsupported_claim');
		expect(kinds).toContain('derived_artifact_source');
		expect(kinds).toContain('secret_or_sensitive_content');
		expect(kinds).toContain('unsafe_path');
		expect(kinds).toContain('unknown_conflict');
	});

	it('supports all readiness values', () => {
		const readinesses = Object.keys(CANDIDATE_EXTRACTION_READINESS_ORDER);
		expect(readinesses).toContain('ready_for_review');
		expect(readinesses).toContain('requires_manual_review');
		expect(readinesses).toContain('blocked');
		expect(readinesses).toContain('empty');
		expect(readinesses).toContain('unknown');
	});

	it('supports all review action kinds', () => {
		const kinds = Object.keys(CANDIDATE_EXTRACTION_ACTION_KIND_ORDER);
		expect(kinds).toContain('review_candidate_fact');
		expect(kinds).toContain('review_candidate_decision');
		expect(kinds).toContain('review_candidate_assumption');
		expect(kinds).toContain('review_candidate_hypothesis');
		expect(kinds).toContain('review_candidate_risk');
		expect(kinds).toContain('review_candidate_open_question');
		expect(kinds).toContain('review_candidate_constraint');
		expect(kinds).toContain('review_candidate_requirement');
		expect(kinds).toContain('review_candidate_acceptance_criterion');
		expect(kinds).toContain('review_candidate_non_goal');
		expect(kinds).toContain('review_evidence_reference');
		expect(kinds).toContain('resolve_candidate_conflict');
		expect(kinds).toContain('discard_unsupported_candidate');
		expect(kinds).toContain('defer_transcript_extraction');
	});
});
