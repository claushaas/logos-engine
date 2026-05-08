import { describe, expect, it } from 'vitest';
import {
	calculateProjectStatus,
	formatProjectStatus,
	renderProgressBar,
} from '../../src/application/status-service.js';

describe('status service', () => {
	describe('calculateProjectStatus', () => {
		it('calculates 0% progress for empty workspace', () => {
			const workspace = createMockWorkspace({
				answers: [],
				decisions: [],
			});
			const profile = createMockProfile();

			const status = calculateProjectStatus(workspace, profile);

			expect(status.overallProgressPercent).toBe(0);
			expect(status.totalConfirmedDecisions).toBe(0);
			expect(status.totalAnswers).toBe(0);
		});

		it('calculates progress based on confirmed decisions per phase', () => {
			const workspace = createMockWorkspace({
				answers: [],
				decisions: [
					{
						id: 'decision-1',
						status: 'confirmed',
						value: 'yes',
					},
				],
			});
			const profile = createMockProfile();

			const status = calculateProjectStatus(workspace, profile);

			expect(status.totalConfirmedDecisions).toBe(1);
			expect(status.phaseProgress[0]?.confirmedDecisions).toBe(1);
		});

		it('counts unknown answers separately', () => {
			const workspace = createMockWorkspace({
				answers: [
					{
						id: 'answer-1',
						questionId: 'q1',
						status: 'unknown',
						value: null,
					},
				],
				decisions: [],
			});
			const profile = createMockProfile();

			const status = calculateProjectStatus(workspace, profile);

			expect(status.totalUnknownAnswers).toBe(1);
		});
	});

	describe('formatProjectStatus', () => {
		it('formats empty workspace with helpful message', () => {
			const status = createMockStatus({ overallProgressPercent: 0 });
			const lines = formatProjectStatus(status);

			expect(lines).toContain('Overall progress: 0%');
			expect(lines.some((line) => line.includes('Run /continue'))).toBe(true);
		});

		it('formats partial progress with resume message', () => {
			const status = createMockStatus({ overallProgressPercent: 50 });
			const lines = formatProjectStatus(status);

			expect(lines).toContain('Overall progress: 50%');
			expect(lines.some((line) => line.includes('/continue'))).toBe(true);
		});

		it('formats complete progress with generate message', () => {
			const status = createMockStatus({ overallProgressPercent: 100 });
			const lines = formatProjectStatus(status);

			expect(lines).toContain('Overall progress: 100%');
			expect(lines.some((line) => line.includes('/generate'))).toBe(true);
		});

		it('shows phase progress bars', () => {
			const status = createMockStatus({
				phaseProgress: [
					{
						confirmedDecisions: 2,
						phaseId: 'phase-1',
						progressPercent: 50,
						title: 'Foundation',
						totalDecisions: 4,
					},
				],
			});
			const lines = formatProjectStatus(status);

			expect(lines.some((line) => line.includes('Foundation'))).toBe(true);
			expect(lines.some((line) => line.includes('50%'))).toBe(true);
		});
	});

	describe('renderProgressBar', () => {
		it('renders empty bar for 0%', () => {
			expect(renderProgressBar(0, 10)).toBe('[░░░░░░░░░░]');
		});

		it('renders full bar for 100%', () => {
			expect(renderProgressBar(100, 10)).toBe('[██████████]');
		});

		it('renders partial bar for 50%', () => {
			expect(renderProgressBar(50, 10)).toBe('[█████░░░░░]');
		});
	});
});

function createMockWorkspace(input: {
	answers: readonly {
		id: string;
		questionId: string;
		status: string;
		value: unknown;
	}[];
	decisions: readonly { id: string; status: string; value: unknown }[];
}) {
	return {
		answers: {
			answers: input.answers,
			schemaVersion: '0.1.0' as const,
		},
		config: {
			ai: {
				enabled: false,
				endpoint: null,
				model: null,
				provider: null,
				remoteContextDisclosureAccepted: false,
				timeoutMs: null,
				tokenSource: null,
			},
			schemaVersion: '0.1.0' as const,
		},
		decisions: {
			decisions: input.decisions.map((decision) => ({
				...decision,
				confidence: null,
				createdAt: new Date().toISOString(),
				rationale: '',
				sourceAnswerIds: [],
				sourceProposalId: null,
				title: decision.id,
				updatedAt: new Date().toISOString(),
			})),
			schemaVersion: '0.1.0' as const,
		},
		diagnostics: {
			diagnostics: [],
			generatedAt: new Date().toISOString(),
			schemaVersion: '0.1.0' as const,
		},
		profileLock: {
			documentCount: 1,
			lockedAt: new Date().toISOString(),
			profileId: 'app-business',
			profileName: 'App Business',
			profileVersion: '1.0.0',
			schemaVersion: '0.1.0' as const,
		},
		project: {
			createdAt: new Date().toISOString(),
			profileId: 'app-business',
			projectName: 'test-project',
			projectRoot: '.' as const,
			schemaVersion: '0.1.0' as const,
			updatedAt: new Date().toISOString(),
		},
	};
}

function createMockProfile() {
	return {
		description: 'Test profile',
		documentPaths: ['docs/01-test.md'],
		documents: [
			{
				completionCriteria: ['c1'],
				dependencies: { decisions: [], documents: [] },
				generatedOutputs: ['o1'],
				id: 'doc-1',
				path: 'docs/01-test.md',
				phaseId: 'phase-1',
				primaryQuestions: ['q1'],
				promptContext: {
					includeAssumptions: false,
					includeConfirmedDecisions: false,
					includeOpenQuestions: false,
				},
				purpose: 'Test',
				requiredInputs: {
					answers: [],
					assumptions: [],
					decisions: ['decision-1'],
				},
				sections: [{ id: 's1', required: true, title: 'Section 1' }],
				template: undefined,
				title: 'Test Document',
				validationRules: [],
			},
		],
		documentsVersion: '1.0.0',
		id: 'app-business',
		name: 'App Business',
		phases: [{ id: 'phase-1', purpose: 'Test', title: 'Foundation' }],
		questionDefaults: undefined,
		questionSets: [],
		questionsVersion: '1.0.0',
		riskPatterns: [],
		targetUser: 'Test user',
		validationRules: [],
		validationsVersion: '1.0.0',
		version: '1.0.0',
	};
}

function createMockStatus(overrides: {
	overallProgressPercent?: number;
	phaseProgress?: readonly {
		confirmedDecisions: number;
		phaseId: string;
		progressPercent: number;
		title: string;
		totalDecisions: number;
	}[];
}) {
	return {
		overallProgressPercent: overrides.overallProgressPercent ?? 0,
		phaseProgress: overrides.phaseProgress ?? [],
		profileName: 'App Business',
		projectName: 'test-project',
		totalAnswers: 0,
		totalConfirmedDecisions: 0,
		totalDecisions: 0,
		totalUnknownAnswers: 0,
	};
}
