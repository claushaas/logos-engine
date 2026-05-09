import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	continueGuidedIntake,
	initializeWorkspace,
	readCurrentIntakeSession,
	readWorkspaceState,
} from '../../src/index.js';

function createProjectRoot(): string {
	const projectRoot = mkdtempSync(join(tmpdir(), 'logos-legacy-intake-'));
	mkdirSync(join(projectRoot, '.git'));
	return projectRoot;
}

async function runIntakeCommand(projectRoot: string, args: string[]) {
	return continueGuidedIntake(projectRoot, args);
}

describe('guided intake (legacy, internal coverage)', () => {
	describe('question answering', () => {
		it('stores answers for individual question ids', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			const result = await runIntakeCommand(projectRoot, [
				'answer',
				'foundation.idea',
				'My startup idea',
			]);
			expect(result.title).toBe('Answer stored');

			const state = readWorkspaceState(projectRoot);
			expect(state.answers.answers).toHaveLength(1);
			expect(state.answers.answers[0].status).toBe('answered');
			expect(state.answers.answers[0].rawAnswer).toBe('My startup idea');
		});

		it('shows the guided intake screen with question groups', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			const intakeResult = await runIntakeCommand(projectRoot, ['show']);
			expect(intakeResult.title).toBe('Guided intake');
			expect(intakeResult.body.join('\n')).toContain('[foundation.idea]');
		});

		it('stores multiple answers in sequence', async () => {
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
				const r = await runIntakeCommand(projectRoot, [
					'answer',
					qid,
					`placeholder for ${qid}`,
				]);
				expect(r.status).toBe('ok');
			}

			const state = readWorkspaceState(projectRoot);
			expect(state.answers.answers.length).toBeGreaterThanOrEqual(6);
			expect(state.answers.answers.map((a) => a.questionId)).toContain(
				'foundation.idea',
			);
		});
	});

	describe('unknown answers and open questions', () => {
		it('creates open questions when user answers unknown', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			const result = await runIntakeCommand(projectRoot, [
				'unknown',
				'foundation.primary_user',
			]);
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

			await runIntakeCommand(projectRoot, [
				'unknown',
				'foundation.primary_user',
			]);
			await runIntakeCommand(projectRoot, ['unknown', 'foundation.problem']);

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

			const result = await runIntakeCommand(projectRoot, [
				'assume',
				'foundation.primary_user',
				'Remote developers',
			]);
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

			await runIntakeCommand(projectRoot, [
				'assume',
				'foundation.primary_user',
				'Beta testers',
			]);

			const state = readWorkspaceState(projectRoot);
			const targetDecision = state.decisions.decisions.find(
				(d) => d.id === 'foundation.target_user',
			);
			expect(targetDecision?.status).toBe('assumed');
			expect(targetDecision?.status).not.toBe('confirmed');
		});
	});

	describe('session management', () => {
		it('saves and resumes intake sessions', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await runIntakeCommand(projectRoot, ['show']);

			await runIntakeCommand(projectRoot, [
				'answer',
				'foundation.idea',
				'Session test app',
			]);

			const saveResult = await runIntakeCommand(projectRoot, ['save']);
			expect(saveResult.title).toBe('Intake saved');

			const session = readCurrentIntakeSession(projectRoot);
			expect(session).toBeDefined();
			expect(session?.status).toBe('saved');

			const resumeResult = await runIntakeCommand(projectRoot, ['show']);
			expect(resumeResult.status).toBe('ok');
		});

		it('skips questions and continues the session', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await runIntakeCommand(projectRoot, ['show']);

			const skipResult = await runIntakeCommand(projectRoot, [
				'skip',
				'foundation.idea',
			]);
			expect(skipResult.title).toBe('Question skipped');

			const session = readCurrentIntakeSession(projectRoot);
			expect(session?.skippedQuestionIds).toContain('foundation.idea');
		});
	});

	describe('AI follow-ups', () => {
		it('stores AI follow-ups as proposed, not canonical', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);
			await runIntakeCommand(projectRoot, ['show']);

			const proposed = await runIntakeCommand(projectRoot, [
				'propose-followups',
			]);
			expect(proposed.title).toBe('Follow-ups proposed');
			expect(proposed.body.join('\n')).toContain('stored as proposed');

			const session = readCurrentIntakeSession(projectRoot);
			expect(session?.proposedFollowUpQuestions.length).toBeGreaterThan(0);
			expect(session?.proposedFollowUpQuestions[0].status).toBe('proposed');
		});

		it('accepts follow-ups as session-scoped questions', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);
			await runIntakeCommand(projectRoot, ['show']);
			await runIntakeCommand(projectRoot, ['propose-followups']);

			const accepted = await runIntakeCommand(projectRoot, [
				'accept-followups',
				'--all',
			]);
			expect(accepted.title).toBe('Follow-ups accepted');

			const session = readCurrentIntakeSession(projectRoot);
			const acceptedFollowUps = session?.proposedFollowUpQuestions.filter(
				(f) => f.status === 'accepted',
			);
			expect(acceptedFollowUps?.length).toBeGreaterThan(0);
		});
	});
});
