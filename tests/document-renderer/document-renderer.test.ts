import { describe, expect, it } from 'vitest';
import {
	buildTemplateContext,
	collectMissingInputs,
	collectMissingRequiredSections,
} from '../../src/document-renderer/document-renderer.js';
import type { CanonicalDocument } from '../../src/domain/profile-loader.js';
import type { WorkspaceState } from '../../src/domain/workspace-state.js';

describe('document-renderer', () => {
	const mockDocument: CanonicalDocument = {
		completionCriteria: ['Criterion 1'],
		dependencies: { decisions: [], documents: [] },
		generatedOutputs: ['Output 1'],
		id: 'test.document',
		path: 'docs/test/DOCUMENT.md',
		phaseId: '00-intake',
		primaryQuestions: ['Question 1?'],
		promptContext: {
			includeAssumptions: true,
			includeConfirmedDecisions: true,
			includeOpenQuestions: true,
		},
		purpose: 'Test purpose',
		requiredInputs: {
			answers: ['foundation.idea'],
			assumptions: [],
			decisions: ['foundation.target_user'],
		},
		sections: [
			{ id: 'purpose', required: true, title: 'Purpose' },
			{ id: 'details', required: false, title: 'Details' },
		],
		template: 'templates/test.md',
		title: 'Test Document',
		validationRules: [],
	};

	const emptyWorkspace: WorkspaceState = {
		answers: {
			answers: [],
			schemaVersion: '0.1.0',
		},
		config: {
			ai: {
				adapter: 'mock',
				model: 'mock-model',
				preset: 'mock',
				timeoutMs: 30000,
				tokenSource: { source: 'none' },
			},
			schemaVersion: '0.1.0',
		},
		decisions: {
			decisions: [],
			schemaVersion: '0.1.0',
		},
		diagnostics: {
			diagnostics: [],
			generatedAt: '2026-01-01T00:00:00Z',
			schemaVersion: '0.1.0',
		},
		profileLock: {
			documentCount: 1,
			lockedAt: '2026-01-01T00:00:00Z',
			profileId: 'app-business',
			profileName: 'App Business',
			profileVersion: '0.1.0',
			schemaVersion: '0.1.0',
		},
		project: {
			createdAt: '2026-01-01T00:00:00Z',
			profileId: 'app-business',
			projectName: 'Test Project',
			projectRoot: '.',
			schemaVersion: '0.1.0',
			updatedAt: '2026-01-01T00:00:00Z',
		},
	};

	describe('buildTemplateContext', () => {
		it('builds context with confirmed decisions', () => {
			const workspace: WorkspaceState = {
				...emptyWorkspace,
				decisions: {
					decisions: [
						{
							affectedDocuments: [],
							confidence: 'high',
							createdAt: '2026-01-01T00:00:00Z',
							id: 'foundation.target_user',
							impacts: [],
							rationale: 'Test rationale',
							revisionHistory: [],
							sourceAnswerIds: [],
							status: 'confirmed',
							title: 'Target User',
							updatedAt: '2026-01-01T00:00:00Z',
							value: 'Developers',
						},
					],
					schemaVersion: '0.1.0',
				},
			};

			const context = buildTemplateContext(mockDocument, workspace);

			expect(context.decisions['foundation.target_user']).toBe('Developers');
		});

		it('builds context with answered questions', () => {
			const workspace: WorkspaceState = {
				...emptyWorkspace,
				answers: {
					answers: [
						{
							answer: 'My idea',
							answeredAt: '2026-01-01T00:00:00Z',
							id: 'foundation.idea',
							questionId: 'foundation.idea',
							status: 'answered',
						},
					],
					schemaVersion: '0.1.0',
				},
			};

			const context = buildTemplateContext(mockDocument, workspace);

			expect(context.decisions['foundation.idea']).toBe('My idea');
		});

		it('collects assumptions from answers', () => {
			const workspace: WorkspaceState = {
				...emptyWorkspace,
				answers: {
					answers: [
						{
							answer: 'We assume X',
							answeredAt: '2026-01-01T00:00:00Z',
							id: 'q1',
							questionId: 'q1',
							status: 'assumption',
						},
					],
					schemaVersion: '0.1.0',
				},
			};

			const context = buildTemplateContext(mockDocument, workspace);

			expect(context.assumptions).toContain('q1: We assume X');
		});
	});

	describe('collectMissingInputs', () => {
		it('reports missing decisions', () => {
			const missing = collectMissingInputs(mockDocument, emptyWorkspace);

			expect(missing).toContain('decision:foundation.target_user');
		});

		it('reports missing answers', () => {
			const missing = collectMissingInputs(mockDocument, emptyWorkspace);

			expect(missing).toContain('answer:foundation.idea');
		});

		it('returns empty when all inputs are present', () => {
			const workspace: WorkspaceState = {
				...emptyWorkspace,
				answers: {
					answers: [
						{
							answer: 'My idea',
							answeredAt: '2026-01-01T00:00:00Z',
							id: 'foundation.idea',
							questionId: 'foundation.idea',
							status: 'answered',
						},
					],
					schemaVersion: '0.1.0',
				},
				decisions: {
					decisions: [
						{
							affectedDocuments: [],
							confidence: 'high',
							createdAt: '2026-01-01T00:00:00Z',
							id: 'foundation.target_user',
							impacts: [],
							rationale: 'Test',
							revisionHistory: [],
							sourceAnswerIds: [],
							status: 'confirmed',
							title: 'Target User',
							updatedAt: '2026-01-01T00:00:00Z',
							value: 'Developers',
						},
					],
					schemaVersion: '0.1.0',
				},
			};

			const missing = collectMissingInputs(mockDocument, workspace);

			expect(missing).toHaveLength(0);
		});
	});

	describe('collectMissingRequiredSections', () => {
		it('reports sections without content', () => {
			const missing = collectMissingRequiredSections(
				mockDocument,
				emptyWorkspace,
			);

			expect(missing).toContain('purpose');
		});

		it('does not report optional sections', () => {
			const missing = collectMissingRequiredSections(
				mockDocument,
				emptyWorkspace,
			);

			expect(missing).not.toContain('details');
		});
	});
});
