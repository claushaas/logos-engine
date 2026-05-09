import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	continueGuidedIntake,
	createLogosApplicationServices,
	getCurrentSessionPath,
	handleSlashCommand,
	initializeWorkspace,
	loadCommandContext,
	parseSlashCommand,
	readCurrentIntakeSession,
	readWorkspaceState,
} from '../../src/index.js';

describe('/continue conversation resume', () => {
	it('starts a new conversation when no session exists', async () => {
		const projectRoot = createProjectRoot();
		initializeWorkspace(projectRoot);

		const result = await runCommand(projectRoot, '/continue');

		expect(result).toMatchObject({
			exitRequested: false,
			status: 'ok',
			title: 'Conversation resumed',
		});
		expect(result.body.join('\n')).toContain('Conversation:');
	});

	it('does not render question-id hints in user-facing output', async () => {
		const projectRoot = createProjectRoot();
		initializeWorkspace(projectRoot);

		const result = await runCommand(projectRoot, '/continue');

		expect(result.body.join('\n')).not.toContain(
			'/continue answer <question-id>',
		);
		expect(result.body.join('\n')).not.toContain('<question-id>');
	});
});

describe('guided intake — internal service API', () => {
	it('selects foundation questions with help and examples', async () => {
		const projectRoot = createProjectRoot();
		initializeWorkspace(projectRoot);

		const result = await continueGuidedIntake(projectRoot, ['show']);

		expect(result).toMatchObject({
			status: 'ok',
			title: 'Guided intake',
		});
		expect(result.body.join('\n')).toContain('[foundation.idea]');
		expect(result.body.join('\n')).toContain('Help:');
		expect(result.body.join('\n')).toContain('Examples:');
		expect(result.body.join('\n')).toContain('Internal usage:');
		expect(existsSync(getCurrentSessionPath(projectRoot))).toBe(true);
	});

	it('renders choice and multi-choice options', async () => {
		const projectRoot = createProjectRoot();
		initializeWorkspace(projectRoot);

		for (const questionId of [
			'foundation.idea',
			'foundation.primary_user',
			'foundation.problem',
			'foundation.current_alternative',
			'foundation.why_now',
			'foundation.smallest_valuable_version',
		]) {
			await continueGuidedIntake(projectRoot, [
				'answer',
				questionId,
				'test answer',
			]);
		}

		const result = await continueGuidedIntake(projectRoot, ['show']);

		expect(result.body.join('\n')).toContain('[market.alternative_types]');
		expect(result.body.join('\n')).toContain('Options:');
		expect(result.body.join('\n')).toContain(
			'direct_competitors: Direct competitors',
		);
	});

	it('stores raw answers with separate AI summaries', async () => {
		const projectRoot = createProjectRoot();
		initializeWorkspace(projectRoot);

		const result = await continueGuidedIntake(projectRoot, [
			'answer',
			'foundation.idea',
			'A local-first app planner',
		]);
		const state = readWorkspaceState(projectRoot);

		expect(result.status).toBe('ok');
		expect(state.answers.answers).toMatchObject([
			{
				answer: 'A local-first app planner',
				questionId: 'foundation.idea',
				rawAnswer: 'A local-first app planner',
				status: 'answered',
				summary: 'Deterministic mock summary.',
			},
		]);
		expect(state.decisions.decisions).toEqual([]);
	});

	it('creates derived open questions for unknown answers', async () => {
		const projectRoot = createProjectRoot();
		initializeWorkspace(projectRoot);

		const result = await continueGuidedIntake(projectRoot, [
			'unknown',
			'foundation.primary_user',
		]);
		const state = readWorkspaceState(projectRoot);

		expect(result.title).toBe('Open question created');
		expect(result.body.join('\n')).toContain('Open questions now derived');
		expect(state.answers.answers).toMatchObject([
			{
				questionId: 'foundation.primary_user',
				status: 'unknown',
			},
		]);
		expect(state.decisions.decisions).toMatchObject([
			{
				id: 'foundation.target_user',
				status: 'unknown',
				value: null,
			},
		]);
	});

	it('tracks assumptions without confirming decisions', async () => {
		const projectRoot = createProjectRoot();
		initializeWorkspace(projectRoot);

		const result = await continueGuidedIntake(projectRoot, [
			'assume',
			'foundation.primary_user',
			'Solo founders',
		]);
		const state = readWorkspaceState(projectRoot);

		expect(result.title).toBe('Assumption stored');
		expect(result.body.join('\n')).toContain('not a confirmed decision');
		expect(state.answers.answers).toMatchObject([
			{
				questionId: 'foundation.primary_user',
				rawAnswer: 'Solo founders',
				status: 'assumption',
			},
		]);
		expect(state.decisions.decisions).toMatchObject([
			{
				id: 'foundation.target_user',
				status: 'assumed',
				value: 'Solo founders',
			},
		]);
	});

	it('saves skipped questions and resumes unfinished sessions', async () => {
		const projectRoot = createProjectRoot();
		initializeWorkspace(projectRoot);
		await continueGuidedIntake(projectRoot, ['show']);

		const skipResult = await continueGuidedIntake(projectRoot, [
			'skip',
			'foundation.primary_user',
		]);
		const saveResult = await continueGuidedIntake(projectRoot, ['save']);
		const session = readCurrentIntakeSession(projectRoot);

		expect(skipResult.title).toBe('Question skipped');
		expect(saveResult.title).toBe('Intake saved');
		expect(session).toMatchObject({
			skippedQuestionIds: ['foundation.primary_user'],
			status: 'saved',
		});
	});

	it('stores AI follow-ups as proposed until accepted', async () => {
		const projectRoot = createProjectRoot();
		initializeWorkspace(projectRoot);
		await continueGuidedIntake(projectRoot, ['show']);

		const proposed = await continueGuidedIntake(projectRoot, [
			'propose-followups',
		]);
		const proposedSession = readCurrentIntakeSession(projectRoot);
		const accepted = await continueGuidedIntake(projectRoot, [
			'accept-followups',
			'--all',
		]);
		const acceptedSession = readCurrentIntakeSession(projectRoot);

		expect(proposed.title).toBe('Follow-ups proposed');
		expect(proposed.body.join('\n')).toContain('stored as proposed');
		expect(proposedSession?.proposedFollowUpQuestions).toMatchObject([
			{
				id: 'mock.follow_up_1',
				status: 'proposed',
			},
		]);
		expect(accepted.title).toBe('Follow-ups accepted');
		expect(acceptedSession?.proposedFollowUpQuestions).toMatchObject([
			{
				id: 'mock.follow_up_1',
				status: 'accepted',
			},
		]);
	});
});

async function runCommand(projectRoot: string, input: string) {
	const parsed = parseSlashCommand(input);
	expect(parsed.ok).toBe(true);
	if (!parsed.ok) {
		throw new Error(parsed.error.message);
	}

	return await handleSlashCommand(
		parsed.command,
		loadCommandContext(projectRoot),
		createLogosApplicationServices(),
	);
}

function createProjectRoot(): string {
	const projectRoot = mkdtempSync(join(tmpdir(), 'logos-intake-'));
	mkdirSync(join(projectRoot, '.git'));

	return projectRoot;
}
