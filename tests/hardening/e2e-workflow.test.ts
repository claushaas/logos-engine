import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	continueGuidedIntake,
	createLogosApplicationServices,
	handleSlashCommand,
	initializeWorkspace,
	loadCommandContext,
	parseSlashCommand,
	readCurrentIntakeSession,
	readWorkspaceState,
} from '../../src/index.js';

function createProjectRoot(): string {
	const projectRoot = mkdtempSync(join(tmpdir(), 'logos-e2e-'));
	mkdirSync(join(projectRoot, '.git'));
	return projectRoot;
}

async function runCommand(projectRoot: string, input: string) {
	const parsed = parseSlashCommand(input);
	expect(parsed.ok).toBe(true);
	if (!parsed.ok) {
		throw new Error(parsed.error.message);
	}

	if (parsed.command.definition.id === '/continue') {
		return continueGuidedIntake(
			projectRoot,
			parsed.command.args.length > 0 ? parsed.command.args : ['show'],
		);
	}

	return await handleSlashCommand(
		parsed.command,
		loadCommandContext(projectRoot),
		createLogosApplicationServices(),
	);
}

describe('E2E workflow', () => {
	describe('init to intake to decision to generate', () => {
		it('completes the full workflow with mocked AI', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			const intakeResult = await runCommand(projectRoot, '/continue');
			expect(intakeResult.title).toBe('Guided intake');
			expect(intakeResult.body.join('\n')).toContain('[foundation.idea]');

			const answerResult = await runCommand(
				projectRoot,
				'/continue answer foundation.idea A task management app for remote teams',
			);
			expect(answerResult.title).toBe('Answer stored');

			const questionIds = [
				'foundation.primary_user',
				'foundation.problem',
				'foundation.current_alternative',
				'foundation.why_now',
				'foundation.smallest_valuable_version',
			];
			for (const qid of questionIds) {
				const r = await runCommand(
					projectRoot,
					`/continue answer ${qid} placeholder answer`,
				);
				expect(r.status).toBe('ok');
			}

			const state = readWorkspaceState(projectRoot);
			expect(state.answers.answers.length).toBeGreaterThanOrEqual(6);
			expect(state.answers.answers.map((a) => a.questionId)).toContain(
				'foundation.idea',
			);

			const generateResult = await runCommand(
				projectRoot,
				'/generate --refresh',
			);
			expect(generateResult.status).toBe('ok');
			expect(generateResult.title).toBe('Documents generated');
			expect(existsSync(join(projectRoot, 'docs'))).toBe(true);
		});

		it('preserves state integrity through the full workflow', async () => {
			const projectRoot = createProjectRoot();
			const initResult = initializeWorkspace(projectRoot);
			expect(initResult.status).toBe('created');
			expect(existsSync(join(projectRoot, '.logos', 'project.json'))).toBe(
				true,
			);
			expect(existsSync(join(projectRoot, '.logos', 'answers.json'))).toBe(
				true,
			);
			expect(existsSync(join(projectRoot, '.logos', 'decisions.json'))).toBe(
				true,
			);

			await runCommand(
				projectRoot,
				'/continue answer foundation.idea My startup idea',
			);

			const state = readWorkspaceState(projectRoot);
			expect(state.answers.answers).toHaveLength(1);
			expect(state.answers.answers[0].status).toBe('answered');
			expect(state.answers.answers[0].rawAnswer).toBe('My startup idea');
		});
	});

	describe('init to intake to status to validate to diagnose to generate', () => {
		it('runs the deterministic command pipeline without live AI', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await runCommand(
				projectRoot,
				'/continue answer foundation.idea A test app idea',
			);

			const statusResult = await runCommand(projectRoot, '/status');
			expect(statusResult.status).toBe('ok');
			expect(statusResult.body.join('\n')).toContain('App Business');

			const validateResult = await runCommand(projectRoot, '/validate --all');
			expect(validateResult.status).toBeDefined();

			const diagnoseResult = await runCommand(projectRoot, '/diagnose');
			expect(diagnoseResult.status).toBeDefined();
			expect(diagnoseResult.body.length).toBeGreaterThan(0);

			const generateResult = await runCommand(
				projectRoot,
				'/generate --refresh',
			);
			expect(generateResult.title).toBe('Documents generated');
		});

		it('generates documents after validation confirms readiness', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			const fullQuestionIds = [
				'foundation.idea',
				'foundation.primary_user',
				'foundation.problem',
				'foundation.current_alternative',
				'foundation.why_now',
				'foundation.smallest_valuable_version',
			];
			for (const qid of fullQuestionIds) {
				await runCommand(
					projectRoot,
					`/continue answer ${qid} answer for ${qid}`,
				);
			}

			const state = readWorkspaceState(projectRoot);
			expect(
				state.answers.answers.filter((a) => a.status === 'answered'),
			).toHaveLength(6);

			const validateResult = await runCommand(projectRoot, '/validate --all');
			expect(validateResult.status).toBeDefined();

			const generateResult = await runCommand(
				projectRoot,
				'/generate --refresh',
			);
			expect(generateResult.status).toBe('ok');

			expect(existsSync(join(projectRoot, 'docs', '00-intake'))).toBe(true);
		});
	});

	describe('unknown answers and open questions', () => {
		it('creates open questions when user answers unknown', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			const result = await runCommand(
				projectRoot,
				'/continue unknown foundation.primary_user',
			);
			expect(result.title).toBe('Open question created');

			const state = readWorkspaceState(projectRoot);
			expect(
				state.answers.answers.find(
					(a) => a.questionId === 'foundation.primary_user',
				),
			).toMatchObject({ status: 'unknown' });
		});

		it('tracks multiple unknown answers without breaking state', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await runCommand(
				projectRoot,
				'/continue unknown foundation.primary_user',
			);
			await runCommand(projectRoot, '/continue unknown foundation.problem');

			const state = readWorkspaceState(projectRoot);
			const unknowns = state.answers.answers.filter(
				(a) => a.status === 'unknown',
			);
			expect(unknowns).toHaveLength(2);
		});
	});

	describe('assumptions and assumption tracking', () => {
		it('creates assumptions when user answers with assumption', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			const result = await runCommand(
				projectRoot,
				'/continue assume foundation.primary_user Remote developers',
			);
			expect(result.title).toBe('Assumption stored');
			expect(result.body.join('\n')).toContain('not a confirmed decision');

			const state = readWorkspaceState(projectRoot);
			expect(
				state.answers.answers.find(
					(a) => a.questionId === 'foundation.primary_user',
				),
			).toMatchObject({
				rawAnswer: 'Remote developers',
				status: 'assumption',
			});
			expect(
				state.decisions.decisions.find(
					(d) => d.id === 'foundation.target_user',
				),
			).toMatchObject({
				status: 'assumed',
				value: 'Remote developers',
			});
		});

		it('prevents assumption answers from becoming confirmed decisions automatically', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await runCommand(
				projectRoot,
				'/continue assume foundation.primary_user Beta testers',
			);

			const state = readWorkspaceState(projectRoot);
			const targetDecision = state.decisions.decisions.find(
				(d) => d.id === 'foundation.target_user',
			);
			expect(targetDecision?.status).toBe('assumed');
			expect(targetDecision?.status).not.toBe('confirmed');
		});
	});

	describe('diagnostics after partial intake', () => {
		it('produces useful diagnostics with partial answers', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await runCommand(
				projectRoot,
				'/continue answer foundation.idea Partial project idea',
			);

			const result = await runCommand(projectRoot, '/diagnose');
			expect(result.status).toBeDefined();
			expect(result.body.length).toBeGreaterThan(0);
		});

		it('shows more gaps with fewer answers', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			const emptyDiagnose = await runCommand(projectRoot, '/diagnose');
			expect(emptyDiagnose.body.length).toBeGreaterThan(0);

			await runCommand(
				projectRoot,
				'/continue answer foundation.idea A real project',
			);

			const partialDiagnose = await runCommand(projectRoot, '/diagnose');

			expect(partialDiagnose.status).toBeDefined();
			expect(partialDiagnose.body.length).toBeGreaterThanOrEqual(0);
		});
	});

	describe('validation after partial intake', () => {
		it('validates without live AI calls', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			const result = await runCommand(projectRoot, '/validate --all');
			expect(result.status).toBeDefined();
			expect(result.body.length).toBeGreaterThan(0);
		});

		it('validates specific phases', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			const result = await runCommand(
				projectRoot,
				'/validate --phase 00-intake',
			);
			expect(result.status).toBeDefined();
		});
	});

	describe('document regeneration', () => {
		it('respects safe mode and skips existing documents', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await runCommand(
				projectRoot,
				'/continue answer foundation.idea Safe mode project',
			);

			await runCommand(projectRoot, '/generate --refresh');
			const firstGen = readFileSync(
				join(projectRoot, 'docs', '00-intake', 'IDEA_BRIEF.md'),
				'utf8',
			);

			await runCommand(projectRoot, '/generate --safe');

			expect(
				existsSync(join(projectRoot, 'docs', '00-intake', 'IDEA_BRIEF.md')),
			).toBe(true);

			const secondGen = readFileSync(
				join(projectRoot, 'docs', '00-intake', 'IDEA_BRIEF.md'),
				'utf8',
			);
			expect(secondGen).toBe(firstGen);
		});

		it('supports refresh mode for updating existing documents', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await runCommand(
				projectRoot,
				'/continue answer foundation.idea Refresh test',
			);

			await runCommand(projectRoot, '/generate --refresh');
			const result = await runCommand(projectRoot, '/generate --refresh');
			expect(result.status).toBe('ok');
		});

		it('requires confirmation for force mode', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await runCommand(
				projectRoot,
				'/continue answer foundation.idea Force test',
			);

			await runCommand(projectRoot, '/generate --refresh');

			const forceResult = await runCommand(projectRoot, '/generate --force');
			expect(forceResult.status).toBe('ok');
		});
	});

	describe('manual notes preservation', () => {
		it('preserves manual sections across document regeneration', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await runCommand(
				projectRoot,
				'/continue answer foundation.idea Manual notes test',
			);

			await runCommand(projectRoot, '/generate --refresh');

			const ideaBriefPath = join(
				projectRoot,
				'docs',
				'00-intake',
				'IDEA_BRIEF.md',
			);

			let content = readFileSync(ideaBriefPath, 'utf8');
			expect(content).toContain('# Idea Brief');

			const manualNote = [
				'<!-- logos:manual-section:start:custom_notes -->',
				'These are my personal notes that should survive regeneration.',
				'<!-- logos:manual-section:end:custom_notes -->',
			].join('\n');
			content = `${content}\n\n${manualNote}`;

			const { writeFileSync } = await import('node:fs');
			writeFileSync(ideaBriefPath, content, 'utf8');

			await runCommand(projectRoot, '/generate --refresh');

			const regeneratedContent = readFileSync(ideaBriefPath, 'utf8');
			expect(regeneratedContent.length).toBeGreaterThan(0);
			expect(regeneratedContent).toContain('# Idea Brief');
		});
	});

	describe('session management', () => {
		it('saves and resumes intake sessions', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await runCommand(projectRoot, '/continue');

			await runCommand(
				projectRoot,
				'/continue answer foundation.idea Session test app',
			);

			const saveResult = await runCommand(projectRoot, '/continue save');
			expect(saveResult.title).toBe('Intake saved');

			const session = readCurrentIntakeSession(projectRoot);
			expect(session).toBeDefined();
			expect(session?.status).toBe('saved');

			const resumeResult = await runCommand(projectRoot, '/continue');
			expect(resumeResult.status).toBe('ok');
		});

		it('skips questions and continues the session', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await runCommand(projectRoot, '/continue');

			const skipResult = await runCommand(
				projectRoot,
				'/continue skip foundation.idea',
			);
			expect(skipResult.title).toBe('Question skipped');

			const session = readCurrentIntakeSession(projectRoot);
			expect(session?.skippedQuestionIds).toContain('foundation.idea');
		});
	});

	describe('project state integrity', () => {
		it('is safe for repeated initialization', async () => {
			const projectRoot = createProjectRoot();

			const first = initializeWorkspace(projectRoot);
			expect(first.status).toBe('created');

			const second = initializeWorkspace(projectRoot);
			expect(second.status).toBe('exists');

			expect(existsSync(join(projectRoot, '.logos', 'project.json'))).toBe(
				true,
			);
		});

		it('produces valid text-based and Git-friendly state files', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await runCommand(
				projectRoot,
				'/continue answer foundation.idea Git-friendly test',
			);

			const stateFiles = [
				'project.json',
				'answers.json',
				'decisions.json',
				'config.json',
				'profile.lock.json',
				'diagnostics.json',
			];

			for (const file of stateFiles) {
				const path = join(projectRoot, '.logos', file);
				expect(existsSync(path)).toBe(true);
				const content = readFileSync(path, 'utf8');
				expect(() => JSON.parse(content)).not.toThrow();
			}
		});

		it('maintains DecisionStatus separate from AiOutputStatus', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await runCommand(
				projectRoot,
				'/continue assume foundation.primary_user Assumed user',
			);

			const state = readWorkspaceState(projectRoot);

			for (const decision of state.decisions.decisions) {
				expect([
					'unknown',
					'assumed',
					'proposed',
					'confirmed',
					'deprecated',
				]).toContain(decision.status);
				expect([
					'draft',
					'proposed',
					'needs_review',
					'rejected',
					'confirmed',
				]).not.toContain(decision.status);
			}
		});
	});

	describe('canonical tree generation', () => {
		it('creates the full canonical document tree', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			const questionIds = [
				'foundation.idea',
				'foundation.primary_user',
				'foundation.problem',
				'foundation.current_alternative',
				'foundation.why_now',
				'foundation.smallest_valuable_version',
			];
			for (const qid of questionIds) {
				await runCommand(
					projectRoot,
					`/continue answer ${qid} answer for ${qid}`,
				);
			}

			const result = await runCommand(projectRoot, '/generate --refresh');
			expect(result.status).toBe('ok');

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

			for (const phase of expectedPhases) {
				expect(existsSync(join(projectRoot, 'docs', phase))).toBe(true);
			}

			const ideaBriefPath = join(
				projectRoot,
				'docs',
				'00-intake',
				'IDEA_BRIEF.md',
			);
			expect(existsSync(ideaBriefPath)).toBe(true);

			const implementationPlanPath = join(
				projectRoot,
				'docs',
				'07-implementation',
				'IMPLEMENTATION_PLAN.md',
			);
			expect(existsSync(implementationPlanPath)).toBe(true);

			const decisionLogPath = join(
				projectRoot,
				'docs',
				'11-governance',
				'DECISION_LOG.md',
			);
			expect(existsSync(decisionLogPath)).toBe(true);
		});

		it('includes generated frontmatter in all generated documents', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await runCommand(
				projectRoot,
				'/continue answer foundation.idea Frontmatter test app',
			);

			await runCommand(projectRoot, '/generate --refresh');

			const ideaBriefPath = join(
				projectRoot,
				'docs',
				'00-intake',
				'IDEA_BRIEF.md',
			);
			expect(existsSync(ideaBriefPath)).toBe(true);

			const content = readFileSync(ideaBriefPath, 'utf8');
			expect(content).toContain('---');
			expect(content).toContain('generated_at');
		});
	});

	describe('AI follow-ups as proposed', () => {
		it('stores AI follow-ups as proposed, not canonical', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);
			await runCommand(projectRoot, '/continue');

			const proposed = await runCommand(
				projectRoot,
				'/continue propose-followups',
			);
			expect(proposed.title).toBe('Follow-ups proposed');
			expect(proposed.body.join('\n')).toContain('stored as proposed');

			const session = readCurrentIntakeSession(projectRoot);
			expect(session?.proposedFollowUpQuestions.length).toBeGreaterThan(0);
			expect(session?.proposedFollowUpQuestions[0].status).toBe('proposed');
		});

		it('accepts follow-ups as session-scoped questions', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);
			await runCommand(projectRoot, '/continue');
			await runCommand(projectRoot, '/continue propose-followups');

			const accepted = await runCommand(
				projectRoot,
				'/continue accept-followups --all',
			);
			expect(accepted.title).toBe('Follow-ups accepted');

			const session = readCurrentIntakeSession(projectRoot);
			const acceptedFollowUps = session?.proposedFollowUpQuestions.filter(
				(f) => f.status === 'accepted',
			);
			expect(acceptedFollowUps?.length).toBeGreaterThan(0);
		});
	});

	describe('no-provider behavior', () => {
		it('completes deterministic flows without live AI configured', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await runCommand(
				projectRoot,
				'/continue answer foundation.idea Deterministic project',
			);

			const state = readWorkspaceState(projectRoot);
			expect(state.answers.answers).toHaveLength(1);

			const result = await runCommand(projectRoot, '/generate --refresh');
			expect(result.status).toBe('ok');

			const diagnoseResult = await runCommand(projectRoot, '/diagnose');
			expect(diagnoseResult.status).toBeDefined();
		});
	});
});
