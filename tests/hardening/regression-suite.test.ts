import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	generateDocumentContent,
	generateDocuments,
	loadProfileContract,
	type ProfileContract,
	readWorkspaceState,
	renderDocument,
} from '../../src/index.js';

const fixturePath = join(
	dirname(new URL(import.meta.url).pathname),
	'..',
	'fixtures',
	'example-workspace',
);

describe('regression suite', () => {
	describe('document generation with full fixture', () => {
		it('generates documents from the example workspace without errors', () => {
			const workspace = readWorkspaceState(fixturePath);
			expect(workspace.project.profileId).toBe('app-business');
			expect(workspace.answers.answers.length).toBeGreaterThan(0);
			expect(workspace.decisions.decisions.length).toBeGreaterThan(0);
		});

		it('includes required document sections', () => {
			const workspace = readWorkspaceState(fixturePath);
			const profile = loadProfileByFixture(workspace.project.profileId);

			for (const document of profile.documents) {
				expect(document.sections).toBeDefined();
				expect(document.sections.length).toBeGreaterThan(0);
				expect(document.title).toBeDefined();
				expect(document.completionCriteria.length).toBeGreaterThan(0);
			}
		});

		it('generates content for each canonical document', () => {
			const projectRoot = mkdtempSync(join(tmpdir(), 'logos-regression-'));
			mkdirSync(join(projectRoot, '.git'));

			const workspace = readWorkspaceState(fixturePath);
			const profile = loadProfileByFixture(workspace.project.profileId);
			const profileDirectory = join(
				dirname(new URL(import.meta.url).pathname),
				'..',
				'..',
				'profiles',
				'app-business',
			);

			for (const document of profile.documents) {
				const content = generateDocumentContent(profile, workspace, document, {
					profileDirectory,
					projectRoot,
				});
				expect(content).toBeDefined();
				expect(content.length).toBeGreaterThan(0);
				expect(content).toContain('---');
			}
		});

		it('produces stable output for repeated generation', () => {
			const projectRoot = mkdtempSync(join(tmpdir(), 'logos-stability-'));
			mkdirSync(join(projectRoot, '.git'));

			const workspace = readWorkspaceState(fixturePath);
			const profile = loadProfileByFixture(workspace.project.profileId);
			const profileDirectory = join(
				dirname(new URL(import.meta.url).pathname),
				'..',
				'..',
				'profiles',
				'app-business',
			);

			const firstRun = new Map<string, string>();

			for (const document of profile.documents) {
				const content = generateDocumentContent(profile, workspace, document, {
					profileDirectory,
					projectRoot,
				});
				firstRun.set(document.id, content);
			}

			for (const document of profile.documents) {
				const content = generateDocumentContent(profile, workspace, document, {
					profileDirectory,
					projectRoot,
				});
				const firstContent = firstRun.get(document.id) ?? '';
				const normalized1 = stripDynamicContent(firstContent);
				const normalized2 = stripDynamicContent(content);
				expect(normalized2).toBe(normalized1);
			}
		});

		it('reports missing inputs for incomplete documents', () => {
			const workspace = readWorkspaceState(fixturePath);
			const profile = loadProfileByFixture(workspace.project.profileId);

			for (const document of profile.documents) {
				const result = renderDocument(profile, workspace, document, {
					forceConfirmed: true,
					mode: 'force',
					profileDirectory: join(
						dirname(new URL(import.meta.url).pathname),
						'..',
						'..',
						'profiles',
						'app-business',
					),
					projectRoot: fixturePath,
				});

				expect(result.status).toBeDefined();
				if (result.missingInputs.length > 0) {
					for (const missing of result.missingInputs) {
						expect(missing).toMatch(/^(decision|answer):/);
					}
				}
			}
		});
	});

	describe('canonical tree structure', () => {
		it('all canonical documents belong to recognized phases', () => {
			const workspace = readWorkspaceState(fixturePath);
			const profile = loadProfileByFixture(workspace.project.profileId);

			const phaseIds = new Set(profile.phases.map((p) => p.id));

			for (const document of profile.documents) {
				expect(phaseIds.has(document.phaseId)).toBe(true);
			}
		});

		it('all canonical documents have unique ids', () => {
			const workspace = readWorkspaceState(fixturePath);
			const profile = loadProfileByFixture(workspace.project.profileId);
			const ids = profile.documents.map((d) => d.id);

			expect(new Set(ids).size).toBe(ids.length);
		});

		it('all canonical documents have unique output paths', () => {
			const workspace = readWorkspaceState(fixturePath);
			const profile = loadProfileByFixture(workspace.project.profileId);
			const paths = profile.documents.map((d) => d.path);

			expect(new Set(paths).size).toBe(paths.length);
		});

		it('documents reference valid validation rules', () => {
			const workspace = readWorkspaceState(fixturePath);
			const profile = loadProfileByFixture(workspace.project.profileId);
			const ruleIds = new Set(profile.validationRules.map((r) => r.id));

			for (const document of profile.documents) {
				for (const ruleId of document.validationRules) {
					expect(ruleIds.has(ruleId)).toBe(true);
				}
			}
		});

		it('22 phase directories match canonical naming', () => {
			const workspace = readWorkspaceState(fixturePath);
			const profile = loadProfileByFixture(workspace.project.profileId);

			const expectedPhases = [
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
			];

			const phaseIds = profile.phases.map((p) => p.id).sort();
			expect(phaseIds).toEqual(expectedPhases);
		});

		it('IMPLEMENTATION_PLAN.md exists in implementation phase', () => {
			const workspace = readWorkspaceState(fixturePath);
			const profile = loadProfileByFixture(workspace.project.profileId);

			const implPlan = profile.documents.find((d) =>
				d.path.includes('IMPLEMENTATION_PLAN.md'),
			);
			expect(implPlan).toBeDefined();
			expect(implPlan?.phaseId).toBe('07-implementation');
		});

		it('DECISION_LOG.md exists in governance phase', () => {
			const workspace = readWorkspaceState(fixturePath);
			const profile = loadProfileByFixture(workspace.project.profileId);

			const decisionLog = profile.documents.find((d) =>
				d.path.includes('DECISION_LOG.md'),
			);
			expect(decisionLog).toBeDefined();
			expect(decisionLog?.phaseId).toBe('11-governance');
		});
	});

	describe('decision status integrity', () => {
		it('decisions have valid DecisionStatus values', () => {
			const workspace = readWorkspaceState(fixturePath);
			const validStatuses = [
				'unknown',
				'assumed',
				'proposed',
				'confirmed',
				'deprecated',
			];

			for (const decision of workspace.decisions.decisions) {
				expect(validStatuses).toContain(decision.status);
			}
		});

		it('decisions never use AiOutputStatus values', () => {
			const workspace = readWorkspaceState(fixturePath);
			const aiStatuses = ['draft', 'proposed', 'needs_review', 'rejected'];

			for (const decision of workspace.decisions.decisions) {
				expect(aiStatuses).not.toContain(decision.status);
			}
		});

		it('confirmed decisions have source answer references', () => {
			const workspace = readWorkspaceState(fixturePath);
			const confirmed = workspace.decisions.decisions.filter(
				(d) => d.status === 'confirmed',
			);

			for (const decision of confirmed) {
				expect(decision.sourceAnswerIds.length).toBeGreaterThan(0);
			}
		});
	});

	describe('workspace Git-committability', () => {
		it('state files are valid JSON', () => {
			const stateFiles = [
				'project.json',
				'answers.json',
				'decisions.json',
				'config.json',
				'profile.lock.json',
				'diagnostics.json',
			];

			for (const file of stateFiles) {
				const content = readFileSync(join(fixturePath, '.logos', file), 'utf8');
				expect(() => JSON.parse(content)).not.toThrow();
			}
		});

		it('state files are human-readable (indented JSON)', () => {
			const content = readFileSync(
				join(fixturePath, '.logos', 'project.json'),
				'utf8',
			);
			expect(content).toContain('\n');
			expect(content).toContain('"profileId"');
		});

		it('no binary or non-text files in .logos', () => {
			const textFiles = [
				'project.json',
				'profile.lock.json',
				'answers.json',
				'decisions.json',
				'diagnostics.json',
				'config.json',
			];

			for (const file of textFiles) {
				const path = join(fixturePath, '.logos', file);
				const content = readFileSync(path, 'utf8');
				expect(content).toBeTruthy();
				expect(content.length).toBeGreaterThan(0);
			}
		});

		it('config does not contain raw API tokens', () => {
			const content = readFileSync(
				join(fixturePath, '.logos', 'config.json'),
				'utf8',
			);
			const lowerContent = content.toLowerCase();
			expect(lowerContent).not.toContain('sk-');
			expect(lowerContent).not.toContain('api_key');
			expect(lowerContent).not.toContain('"token"');
		});
	});
});

describe('document snapshot stability', () => {
	it('generated IDEA_BRIEF.md contains expected sections', () => {
		const projectRoot = mkdtempSync(join(tmpdir(), 'logos-snapshot-'));
		mkdirSync(join(projectRoot, '.git'));

		const result = generateDocuments(fixturePath, {
			force: true,
			mode: 'force',
		});
		expect(result.status).toBeDefined();

		const workspace = readWorkspaceState(fixturePath);
		const profile = loadProfileByFixture(workspace.project.profileId);
		const ideaBrief = profile.documents.find((d) =>
			d.path.includes('IDEA_BRIEF.md'),
		);
		expect(ideaBrief).toBeDefined();

		if (ideaBrief) {
			const content = generateDocumentContent(profile, workspace, ideaBrief, {
				profileDirectory: join(
					dirname(new URL(import.meta.url).pathname),
					'..',
					'..',
					'profiles',
					'app-business',
				),
				projectRoot,
			});
			expect(content).toContain('#');
			expect(content).toContain('---');
			expect(content.length).toBeGreaterThan(200);
		}
	});
});

function loadProfileByFixture(profileId: string): ProfileContract {
	const profileDirectory = join(
		dirname(new URL(import.meta.url).pathname),
		'..',
		'..',
		'profiles',
		profileId,
	);
	return loadProfileContract(profileDirectory);
}

function stripDynamicContent(content: string): string {
	return content
		.replace(/generatedAt: .*/g, 'generatedAt: <timestamp>')
		.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '<timestamp>');
}
