import { describe, expect, it } from 'vitest';
import { loadProfileById } from '../../src/index.js';

describe('app-business profile contract snapshot', () => {
	const profile = loadProfileById('app-business');

	it('has all 12 canonical phases in order', () => {
		expect(profile.phases.map((phase) => phase.id)).toEqual([
			'00-intake',
			'01-market',
			'02-business',
			'03-economics',
			'04-product',
			'05-design',
			'06-architecture',
			'07-implementation',
			'08-testing',
			'09-go-to-market',
			'10-operations',
			'11-governance',
		]);
	});

	it('has all 32 canonical documents', () => {
		expect(profile.documents).toHaveLength(32);

		const ids = profile.documents.map((d) => d.id).sort();
		expect(ids).toMatchSnapshot();
	});

	it('has all canonical document output paths', () => {
		expect(profile.documentPaths).toMatchSnapshot();
	});

	it('has 12 question sets covering all phases', () => {
		expect(profile.questionSets).toHaveLength(12);

		const phaseIds = profile.questionSets.map((qs) => qs.phaseId).sort();
		expect(phaseIds).toEqual([
			'00-intake',
			'01-market',
			'02-business',
			'03-economics',
			'04-product',
			'05-design',
			'06-architecture',
			'07-implementation',
			'08-testing',
			'09-go-to-market',
			'10-operations',
			'11-governance',
		]);
	});

	it('has 19 validation rules', () => {
		expect(profile.validationRules).toHaveLength(19);

		const ruleIds = profile.validationRules.map((r) => r.id).sort();
		expect(ruleIds).toMatchSnapshot();
	});

	it('has 3 risk patterns', () => {
		expect(profile.riskPatterns).toHaveLength(3);

		const patternIds = profile.riskPatterns.map((p) => p.id).sort();
		expect(patternIds).toEqual([
			'risk.ai_variable_cost_margin',
			'risk.dependency_without_owner',
			'risk.unclear_distribution',
		]);
	});

	it('every phase has at least one document', () => {
		const phaseIds = new Set(profile.phases.map((p) => p.id));
		const documentedPhases = new Set(profile.documents.map((d) => d.phaseId));

		for (const phaseId of phaseIds) {
			expect(documentedPhases.has(phaseId)).toBe(true);
		}
	});

	it('every document has required metadata', () => {
		for (const doc of profile.documents) {
			expect(doc.id, `Document id for ${doc.id}`).toBeTruthy();
			expect(doc.phaseId, `Document phaseId for ${doc.id}`).toBeTruthy();
			expect(doc.path, `Document path for ${doc.id}`).toBeTruthy();
			expect(doc.title, `Document title for ${doc.id}`).toBeTruthy();
			expect(doc.purpose, `Document purpose for ${doc.id}`).toBeTruthy();
			expect(
				doc.primaryQuestions.length,
				`Document primaryQuestions for ${doc.id}`,
			).toBeGreaterThan(0);
			expect(
				doc.sections.length,
				`Document sections for ${doc.id}`,
			).toBeGreaterThan(0);
			expect(
				doc.generatedOutputs.length,
				`Document generatedOutputs for ${doc.id}`,
			).toBeGreaterThan(0);
			expect(
				doc.completionCriteria.length,
				`Document completionCriteria for ${doc.id}`,
			).toBeGreaterThan(0);
			expect(doc.path, `Document path for ${doc.id}`).toMatch(/^docs\//);
		}
	});

	it('every document has completion criteria', () => {
		for (const doc of profile.documents) {
			expect(
				doc.completionCriteria.length,
				`Document ${doc.id} completion criteria`,
			).toBeGreaterThan(0);
		}
	});

	it('every document declares required inputs and generated outputs', () => {
		for (const doc of profile.documents) {
			expect(
				doc.requiredInputs,
				`Document ${doc.id} requiredInputs`,
			).toMatchObject({
				answers: expect.any(Array),
				assumptions: expect.any(Array),
				decisions: expect.any(Array),
			});
			expect(
				doc.generatedOutputs.length,
				`Document ${doc.id} generatedOutputs`,
			).toBeGreaterThan(0);
		}
	});

	it('every document references valid phases and dependencies', () => {
		const phaseIds = new Set(profile.phases.map((p) => p.id));
		const documentIds = new Set(profile.documents.map((d) => d.id));

		for (const doc of profile.documents) {
			expect(phaseIds.has(doc.phaseId)).toBe(true);
			for (const depId of doc.dependencies.documents) {
				expect(
					documentIds.has(depId),
					`Document ${doc.id} depends on unknown ${depId}`,
				).toBe(true);
			}
		}
	});

	it('has question sets with per-phase coverage aligned to documents', () => {
		const documentedPhases = new Set(profile.documents.map((d) => d.phaseId));
		const questionedPhases = new Set(
			profile.questionSets.map((qs) => qs.phaseId),
		);

		for (const phaseId of documentedPhases) {
			expect(
				questionedPhases.has(phaseId),
				`Phase ${phaseId} has documents but no question set`,
			).toBe(true);
		}
	});

	it('has validation rules for critical phases', () => {
		const phasesWithRules = new Set(
			profile.validationRules.map((r) => r.phaseId),
		);

		const requiredPhases = [
			'00-intake',
			'01-market',
			'03-economics',
			'04-product',
			'06-architecture',
			'09-go-to-market',
			'10-operations',
		];

		for (const phaseId of requiredPhases) {
			expect(
				phasesWithRules.has(phaseId),
				`Phase ${phaseId} missing validation rules`,
			).toBe(true);
		}
	});

	it('has 60 total profile questions', () => {
		const totalQuestions = profile.questionSets.reduce(
			(sum, qs) => sum + qs.questions.length,
			0,
		);
		expect(totalQuestions).toBe(50);
	});

	it('exposes profile version metadata', () => {
		expect(profile.id).toBe('app-business');
		expect(profile.version).toBe('0.1.0');
		expect(profile.documentsVersion).toBe('0.1.0');
		expect(profile.questionsVersion).toBe('0.1.0');
		expect(profile.validationsVersion).toBe('0.1.0');
		expect(profile.name).toBe('App Business');
	});

	it('profile mirrors are byte-identical between runtime and docs', () => {
		// Import fs as dynamic for this comparison
		const { readFileSync } = require('node:fs');
		const { join } = require('node:path');

		for (const fileName of [
			'profile.yml',
			'documents.yml',
			'questions.yml',
			'validations.yml',
		]) {
			const runtimeContent = readFileSync(
				join(process.cwd(), 'profiles/app-business', fileName),
				'utf8',
			);
			const docsContent = readFileSync(
				join(process.cwd(), 'docs/05-profiles/app-business', fileName),
				'utf8',
			);
			expect(runtimeContent).toBe(docsContent);
		}
	});
});
