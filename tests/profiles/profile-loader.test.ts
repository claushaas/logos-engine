import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	loadAvailableProfileContracts,
	loadProfileById,
	loadProfileContract,
	loadProfileContracts,
	ProfileValidationError,
} from '../../src/index.js';

const canonicalAppBusinessDocumentPaths = [
	'docs/00-intake/ASSUMPTIONS.md',
	'docs/00-intake/IDEA_BRIEF.md',
	'docs/00-intake/OPEN_QUESTIONS.md',
	'docs/01-market/COMPETITOR_MATRIX.md',
	'docs/01-market/ICP.md',
	'docs/01-market/MARKET_ANALYSIS.md',
	'docs/02-business/BUSINESS_MODEL.md',
	'docs/02-business/POSITIONING.md',
	'docs/03-economics/BREAK_EVEN.md',
	'docs/03-economics/FINANCIAL_MODEL.md',
	'docs/03-economics/PRICING.md',
	'docs/04-product/MVP_SCOPE.md',
	'docs/04-product/PRODUCT_THESIS.md',
	'docs/04-product/ROADMAP.md',
	'docs/05-design/DESIGN_DIRECTION.md',
	'docs/05-design/ONBOARDING.md',
	'docs/05-design/UX_FLOWS.md',
	'docs/06-architecture/API_SPEC.md',
	'docs/06-architecture/ARCHITECTURE.md',
	'docs/06-architecture/DATA_MODEL.md',
	'docs/06-architecture/TECH_STACK.md',
	'docs/07-implementation/DEVELOPMENT_STANDARDS.md',
	'docs/07-implementation/IMPLEMENTATION_PLAN.md',
	'docs/08-testing/TESTING_STRATEGY.md',
	'docs/09-go-to-market/CONTENT_STRATEGY.md',
	'docs/09-go-to-market/LAUNCH_PLAN.md',
	'docs/09-go-to-market/MARKETING_STRATEGY.md',
	'docs/10-operations/METRICS.md',
	'docs/10-operations/OPERATIONS.md',
	'docs/10-operations/SUPPORT_MODEL.md',
	'docs/11-governance/DECISION_LOG.md',
	'docs/11-governance/RISK_REGISTER.md',
];

describe('profile loader', () => {
	it('loads the App Business profile with canonical document metadata', () => {
		const profile = loadProfileById('app-business');

		expect(profile).toMatchObject({
			documentsVersion: '0.1.0',
			id: 'app-business',
			name: 'App Business',
			questionsVersion: '0.1.0',
			validationsVersion: '0.1.0',
			version: '0.1.0',
		});
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
		expect(profile.documentPaths).toEqual(canonicalAppBusinessDocumentPaths);
		expect(profile.riskPatterns.length).toBeGreaterThan(0);

		for (const document of profile.documents) {
			expect(document.primaryQuestions.length, document.id).toBeGreaterThan(0);
			expect(document.sections.length, document.id).toBeGreaterThan(0);
			expect(document.generatedOutputs.length, document.id).toBeGreaterThan(0);
			expect(document.completionCriteria.length, document.id).toBeGreaterThan(
				0,
			);
			expect(document.requiredInputs, document.id).toMatchObject({
				answers: expect.any(Array),
				assumptions: expect.any(Array),
				decisions: expect.any(Array),
			});
			expect(document.dependencies, document.id).toMatchObject({
				decisions: expect.any(Array),
				documents: expect.any(Array),
			});
			expect(document.promptContext, document.id).toMatchObject({
				includeAssumptions: expect.any(Boolean),
				includeConfirmedDecisions: expect.any(Boolean),
				includeOpenQuestions: expect.any(Boolean),
			});
		}
	});

	it('loads profiles generically from the standard profiles directory', () => {
		const byId = loadProfileById('app-business');
		const availableProfiles = loadAvailableProfileContracts();

		expect(byId.id).toBe('app-business');
		expect(availableProfiles.map((profile) => profile.id)).toContain(
			'app-business',
		);
	});

	it('keeps docs profile contracts mirrored with the runtime profile contracts', () => {
		for (const fileName of [
			'profile.yml',
			'documents.yml',
			'questions.yml',
			'validations.yml',
		]) {
			expect(readProfileContract(`profiles/app-business/${fileName}`)).toBe(
				readProfileContract(`docs/05-profiles/app-business/${fileName}`),
			);
		}
	});

	it('rejects duplicate profile ids when loading a profile collection', () => {
		const firstProfile = createProfileFixture();
		const secondProfile = createProfileFixture();

		expect(() => loadProfileContracts([firstProfile, secondProfile])).toThrow(
			/Duplicate profile id: fixture-profile/,
		);
	});

	it('rejects duplicate phase ids, document ids, and document output paths', () => {
		const profileDirectory = createProfileFixture({
			documents: validDocumentsYaml({
				extraDocument: `
  - id: fixture.idea_brief
    phaseId: 00-intake
    path: docs/00-intake/IDEA_BRIEF.md
    title: Duplicate
    template: templates/00-intake/DUPLICATE.md
    purpose: Duplicate output path.
    primaryQuestions:
      - What is duplicated?
    requiredInputs:
      decisions: []
      answers: []
      assumptions: []
    sections:
      - { id: duplicate, title: Duplicate, required: true }
    generatedOutputs:
      - duplicate
    completionCriteria:
      - Duplicate output path is detected.
    dependencies:
      documents: []
      decisions: []
    validationRules: []
    promptContext:
      includeConfirmedDecisions: true
      includeAssumptions: true
      includeOpenQuestions: true
`,
			}),
			profile: validProfileYaml({
				extraPhase: `
  - id: 00-intake
    title: Duplicate Intake
    purpose: Duplicate phase.
`,
			}),
		});

		expectProfileValidationError(profileDirectory, [
			'Duplicate phase id: 00-intake',
			'Duplicate document id: fixture.idea_brief',
			'Duplicate document output path: docs/00-intake/IDEA_BRIEF.md',
		]);
	});

	it('rejects invalid document references before runtime', () => {
		const profileDirectory = createProfileFixture({
			documents: validDocumentsYaml({
				dependencyDocument: 'missing.document',
				validationRules: ['fixture.missing_rule'],
			}),
			validations: validValidationsYaml({
				affectedDocuments: ['missing.document'],
			}),
		});

		expectProfileValidationError(profileDirectory, [
			'Document fixture.idea_brief references unknown dependency document missing.document.',
			'Document fixture.idea_brief references unknown validation rule fixture.missing_rule.',
			'Validation rule fixture.required references unknown document missing.document.',
		]);
	});

	it('rejects documents without completion criteria during schema validation', () => {
		const profileDirectory = createProfileFixture({
			documents: validDocumentsYaml({ completionCriteria: [] }),
		});

		expect(() => loadProfileContract(profileDirectory)).toThrow(
			/Profile contract .*documents.yml failed schema validation/,
		);
	});

	it('rejects missing template references when templates are implemented', () => {
		const profileDirectory = createProfileFixture();
		mkdirSync(join(profileDirectory, 'templates'), { recursive: true });

		expectProfileValidationError(profileDirectory, [
			'Document fixture.idea_brief references missing template templates/00-intake/IDEA_BRIEF.md.',
		]);
	});
});

function expectProfileValidationError(
	profileDirectory: string,
	expectedIssues: readonly string[],
): void {
	try {
		loadProfileContract(profileDirectory);
		throw new Error('Expected profile validation to fail.');
	} catch (error) {
		expect(error).toBeInstanceOf(ProfileValidationError);
		const message = error instanceof Error ? error.message : String(error);

		for (const issue of expectedIssues) {
			expect(message).toContain(issue);
		}
	}
}

function readProfileContract(path: string): string {
	return readFileSync(join(process.cwd(), path), 'utf8');
}

function createProfileFixture(
	overrides: {
		readonly documents?: string;
		readonly profile?: string;
		readonly questions?: string;
		readonly validations?: string;
	} = {},
): string {
	const profileDirectory = mkdtempSync(join(tmpdir(), 'logos-profile-'));

	writeFileSync(
		join(profileDirectory, 'profile.yml'),
		overrides.profile ?? validProfileYaml(),
	);
	writeFileSync(
		join(profileDirectory, 'documents.yml'),
		overrides.documents ?? validDocumentsYaml(),
	);
	writeFileSync(
		join(profileDirectory, 'questions.yml'),
		overrides.questions ?? validQuestionsYaml(),
	);
	writeFileSync(
		join(profileDirectory, 'validations.yml'),
		overrides.validations ?? validValidationsYaml(),
	);

	return profileDirectory;
}

function validProfileYaml(
	options: { readonly extraPhase?: string } = {},
): string {
	return `id: fixture-profile
version: 0.1.0
name: Fixture Profile
description: Fixture profile for validation tests.
targetUser: Test user.
outcomes:
  - test outcome
phases:
  - id: 00-intake
    title: Intake
    purpose: Capture the initial idea.
${options.extraPhase ?? ''}contracts:
  documents: documents.yml
  questions: questions.yml
  validations: validations.yml
  templatesDir: templates
`;
}

function validDocumentsYaml(
	options: {
		readonly completionCriteria?: readonly string[];
		readonly dependencyDocument?: string;
		readonly extraDocument?: string;
		readonly validationRules?: readonly string[];
	} = {},
): string {
	const completionCriteria = options.completionCriteria ?? [
		'Idea brief is complete.',
	];
	const dependencyDocuments = options.dependencyDocument
		? `\n        - ${options.dependencyDocument}`
		: ' []';
	const validationRules =
		options.validationRules
			?.map((validationRule) => `\n      - ${validationRule}`)
			.join('') ?? '\n      - fixture.required';
	const completionCriteriaYaml =
		completionCriteria.length === 0
			? ' []'
			: completionCriteria
					.map((criterion) => `\n      - ${criterion}`)
					.join('');

	return `version: 0.1.0
profileId: fixture-profile
documents:
  - id: fixture.idea_brief
    phaseId: 00-intake
    path: docs/00-intake/IDEA_BRIEF.md
    title: Idea Brief
    template: templates/00-intake/IDEA_BRIEF.md
    purpose: Capture the idea.
    primaryQuestions:
      - What is the idea?
    requiredInputs:
      decisions:
        - fixture.idea
      answers:
        - fixture.idea
      assumptions: []
    sections:
      - { id: idea, title: Idea, required: true }
    generatedOutputs:
      - idea summary
    completionCriteria:${completionCriteriaYaml}
    dependencies:
      documents:${dependencyDocuments}
      decisions: []
    validationRules:${validationRules}
    promptContext:
      includeConfirmedDecisions: true
      includeAssumptions: true
      includeOpenQuestions: true
${options.extraDocument ?? ''}`;
}

function validQuestionsYaml(): string {
	return `version: 0.1.0
profileId: fixture-profile
questionSets:
  - id: fixture
    phaseId: 00-intake
    title: Fixture
    purpose: Ask fixture questions.
    questions:
      - id: fixture.idea
        text: What is the idea?
        helpText: Describe the idea.
        answerType: text
        mapsToDecisionIds:
          - fixture.idea
`;
}

function validValidationsYaml(
	options: { readonly affectedDocuments?: readonly string[] } = {},
): string {
	const affectedDocuments = options.affectedDocuments ?? ['fixture.idea_brief'];

	return `version: 0.1.0
profileId: fixture-profile
riskPatterns:
  - id: fixture.risk
    phaseId: 00-intake
    title: Fixture Risk
    severity: warning
    description: Fixture risk.
    affectedDocuments:
      - fixture.idea_brief
rules:
  - id: fixture.required
    phaseId: 00-intake
    title: Fixture Required
    severity: error
    description: Fixture decision is required.
    requiredDecisionIds:
      - fixture.idea
    affectedDocuments:${affectedDocuments
			.map((documentId) => `\n      - ${documentId}`)
			.join('')}
`;
}
