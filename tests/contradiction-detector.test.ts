import { describe, expect, it } from 'vitest';
import { runConsistencyCheck } from '../src/consistency/contradiction-detector.js';
import type {
	ClaimRecord,
	ConsistencyCheckInput,
	RegisterCollections,
	SourceRecord,
} from '../src/consistency/index.js';

function baseInput(
	overrides: Partial<ConsistencyCheckInput> = {},
): ConsistencyCheckInput {
	return {
		documentationRoot: 'logos/',
		profileId: 'standard',
		projectRoot: '/tmp/test',
		workspacePath: '/tmp/test/.logos/workspace.json',
		...overrides,
	};
}

function emptyRegisters(): RegisterCollections {
	return {
		assumptions: [],
		decisions: [],
		hypotheses: [],
		lifecycleEvents: [],
		openQuestions: [],
		risks: [],
	};
}

describe('contradiction detector', () => {
	describe('root path consistency', () => {
		it('passes when root is logos/', () => {
			const result = runConsistencyCheck(baseInput());
			const rootFindings = result.findings.filter(
				(f) => f.code === 'consistency_root_path_consistency',
			);
			expect(rootFindings).toHaveLength(0);
		});

		it('produces finding when artifact path is under docs/ while config says logos/', () => {
			const input = baseInput({
				state: {
					artifacts: [
						{
							artifactId: 'art-1',
							artifactType: 'canonical_markdown',
							path: 'docs/01-intro.md',
						},
					],
					documentation: { rootPath: 'logos/' },
				},
			});
			const result = runConsistencyCheck(input);
			const finding = result.findings.find(
				(f) => f.code === 'consistency_root_path_consistency',
			);
			expect(finding).toBeDefined();
			expect(finding?.severity).toBe('error');
		});

		it('produces fatal finding for path traversal', () => {
			const input = baseInput({
				state: {
					artifacts: [
						{
							artifactId: 'art-1',
							artifactType: 'canonical_markdown',
							path: '../outside.md',
						},
					],
					documentation: { rootPath: 'logos/' },
				},
			});
			const result = runConsistencyCheck(input);
			const finding = result.findings.find(
				(f) =>
					f.code === 'consistency_root_path_consistency' &&
					f.severity === 'fatal',
			);
			expect(finding).toBeDefined();
		});
	});

	describe('profile identity consistency', () => {
		it('passes when profile matches', () => {
			const input = baseInput({
				profileId: 'standard',
				state: {
					profile: { profileId: 'standard' },
				},
			});
			const result = runConsistencyCheck(input);
			const findings = result.findings.filter(
				(f) => f.code === 'consistency_profile_identity_consistency',
			);
			expect(findings).toHaveLength(0);
		});

		it('produces finding when workspace profile lock mismatches', () => {
			const input = baseInput({
				profileId: 'standard',
				state: {
					profile: { profileId: 'custom' },
				},
			});
			const result = runConsistencyCheck(input);
			const finding = result.findings.find(
				(f) => f.code === 'consistency_profile_identity_consistency',
			);
			expect(finding).toBeDefined();
			expect(finding?.severity).toBe('error');
		});

		it('produces finding when generated output metadata profile mismatches', () => {
			const input = baseInput({
				generatedOutputs: [
					{
						documentId: 'doc-1',
						path: 'logos/test.md',
						profileId: 'custom',
					},
				],
				profileId: 'standard',
			});
			const result = runConsistencyCheck(input);
			const finding = result.findings.find(
				(f) => f.code === 'consistency_profile_identity_consistency',
			);
			expect(finding).toBeDefined();
			expect(finding?.severity).toBe('error');
		});
	});

	describe('canonical source-of-truth boundary', () => {
		it('passes when canonical markdown is canonical', () => {
			const input = baseInput({
				state: {
					artifacts: [
						{
							artifactId: 'art-1',
							artifactType: 'canonical_markdown',
							isCanonical: true,
							path: 'logos/test.md',
						},
					],
				},
			});
			const result = runConsistencyCheck(input);
			const findings = result.findings.filter(
				(f) => f.code === 'consistency_canonical_source_of_truth_boundary',
			);
			expect(findings).toHaveLength(0);
		});

		it('produces finding when HTML artifact is marked canonical', () => {
			const input = baseInput({
				state: {
					artifacts: [
						{
							artifactId: 'art-1',
							artifactType: 'html',
							isCanonical: true,
							path: 'logos/test.html',
						},
					],
				},
			});
			const result = runConsistencyCheck(input);
			const finding = result.findings.find(
				(f) => f.code === 'consistency_canonical_source_of_truth_boundary',
			);
			expect(finding).toBeDefined();
			expect(finding?.severity).toBe('error');
		});
	});

	describe('derived artifact boundary', () => {
		it('produces finding when derived artifact metadata claims canonical', () => {
			const input = baseInput({
				generatedOutputs: [
					{
						artifactType: 'html',
						isCanonical: true,
						path: 'logos/test.html',
					},
				],
			});
			const result = runConsistencyCheck(input);
			const finding = result.findings.find(
				(f) => f.code === 'consistency_derived_artifact_boundary',
			);
			expect(finding).toBeDefined();
			expect(finding?.severity).toBe('error');
		});
	});

	describe('validation overclaim boundary', () => {
		it('produces finding for validated hypothesis without evidence', () => {
			const input = baseInput({
				registerCollections: {
					...emptyRegisters(),
					hypotheses: [
						{
							affectedDocumentLinks: [],
							confidence: 'explicit',
							createdAt: '2024-01-01T00:00:00Z',
							diagnostics: [],
							hypothesisStatement: 'Users will pay',
							id: 'hyp-1',
							kind: 'hypothesis',
							lifecycleHistory: [],
							reviewState: 'not_required',
							sourceLinks: [],
							status: 'validated',
							title: 'Market demand validated',
							updatedAt: '2024-01-01T00:00:00Z',
						} as never,
					],
				},
			});
			const result = runConsistencyCheck(input);
			const finding = result.findings.find(
				(f) => f.code === 'consistency_validation_overclaim_boundary',
			);
			expect(finding).toBeDefined();
			expect(finding?.severity).toBe('error');
		});

		it('passes for supported claim with explicit evidence', () => {
			const input = baseInput({
				registerCollections: {
					...emptyRegisters(),
					hypotheses: [
						{
							affectedDocumentLinks: [],
							confidence: 'explicit',
							createdAt: '2024-01-01T00:00:00Z',
							diagnostics: [],
							evidenceSourceIds: ['src-1'],
							hypothesisStatement: 'Users will pay',
							id: 'hyp-1',
							kind: 'hypothesis',
							lifecycleHistory: [],
							reviewState: 'not_required',
							sourceLinks: [],
							status: 'validated',
							title: 'Market demand validated',
							updatedAt: '2024-01-01T00:00:00Z',
						} as never,
					],
				},
			});
			const result = runConsistencyCheck(input);
			const finding = result.findings.find(
				(f) => f.code === 'consistency_validation_overclaim_boundary',
			);
			expect(finding).toBeUndefined();
		});
	});

	describe('hosted/saas scope boundary', () => {
		it('produces finding for hosted SaaS claimed as MVP', () => {
			const input = baseInput({
				registerCollections: {
					...emptyRegisters(),
					decisions: [
						{
							affectedDocumentLinks: [],
							confidence: 'explicit',
							createdAt: '2024-01-01T00:00:00Z',
							decisionStatement: 'We will use a hosted backend as MVP',
							diagnostics: [],
							id: 'dec-1',
							kind: 'decision',
							lifecycleHistory: [],
							reviewState: 'not_required',
							sourceLinks: [],
							status: 'confirmed',
							title: 'Use hosted backend',
							updatedAt: '2024-01-01T00:00:00Z',
						} as never,
					],
				},
			});
			const result = runConsistencyCheck(input);
			const finding = result.findings.find(
				(f) => f.code === 'consistency_hosted_saas_scope_boundary',
			);
			expect(finding).toBeDefined();
			expect(finding?.severity).toBe('error');
		});

		it('does not fail for future/deferred mention', () => {
			const input = baseInput({
				registerCollections: {
					...emptyRegisters(),
					decisions: [
						{
							affectedDocumentLinks: [],
							confidence: 'explicit',
							createdAt: '2024-01-01T00:00:00Z',
							decisionStatement: 'We may use a hosted backend in the future',
							diagnostics: [],
							id: 'dec-1',
							kind: 'decision',
							lifecycleHistory: [],
							reviewState: 'not_required',
							sourceLinks: [],
							status: 'confirmed',
							title: 'Future hosted backend',
							updatedAt: '2024-01-01T00:00:00Z',
						} as never,
					],
				},
			});
			const result = runConsistencyCheck(input);
			const finding = result.findings.find(
				(f) => f.code === 'consistency_hosted_saas_scope_boundary',
			);
			expect(finding).toBeUndefined();
		});
	});

	describe('external sync scope boundary', () => {
		it('produces finding for live external sync as MVP', () => {
			const input = baseInput({
				registerCollections: {
					...emptyRegisters(),
					decisions: [
						{
							affectedDocumentLinks: [],
							confidence: 'explicit',
							createdAt: '2024-01-01T00:00:00Z',
							decisionStatement:
								'We will implement live external sync as current MVP',
							diagnostics: [],
							id: 'dec-1',
							kind: 'decision',
							lifecycleHistory: [],
							reviewState: 'not_required',
							sourceLinks: [],
							status: 'confirmed',
							title: 'Live sync',
							updatedAt: '2024-01-01T00:00:00Z',
						} as never,
					],
				},
			});
			const result = runConsistencyCheck(input);
			const finding = result.findings.find(
				(f) => f.code === 'consistency_external_sync_scope_boundary',
			);
			expect(finding).toBeDefined();
			expect(finding?.severity).toBe('error');
		});
	});

	describe('token storage boundary', () => {
		it('produces redacted finding for raw provider token in state', () => {
			const input = baseInput({
				state: {
					apiKey: 'sk-abc123def456ghi789jkl012mno345pqr678stu901vwx234yz',
				},
			});
			const result = runConsistencyCheck(input);
			const finding = result.findings.find(
				(f) => f.code === 'consistency_token_storage_boundary',
			);
			expect(finding).toBeDefined();
			expect(finding?.severity).toBe('error');
			expect(finding?.message).toContain('Raw secret-like value');
			expect(JSON.stringify(result.findings)).not.toContain(
				'sk-abc123def456ghi789jkl012mno345pqr678stu901vwx234yz',
			);
		});

		it('does not flag environment variable name reference', () => {
			const input = baseInput({
				state: {
					apiKeyRef: 'OPENAI_API_KEY',
				},
			});
			const result = runConsistencyCheck(input);
			const finding = result.findings.find(
				(f) => f.code === 'consistency_token_storage_boundary',
			);
			expect(finding).toBeUndefined();
		});
	});

	describe('AI authority boundary', () => {
		it('produces finding for inferred claim marked confirmed', () => {
			const input = baseInput({
				state: {
					claims: [
						{
							claimId: 'claim-1',
							claimType: 'fact',
							confidence: 'inferred',
							diagnostics: [],
							reviewState: 'not_required',
							sourceCount: 0,
							sourceLinks: [],
							status: 'confirmed',
							summary: 'Something is true',
						} as ClaimRecord,
					],
				},
			});
			const result = runConsistencyCheck(input);
			const finding = result.findings.find(
				(f) => f.code === 'consistency_ai_authority_boundary',
			);
			expect(finding).toBeDefined();
			expect(finding?.severity).toBe('error');
		});

		it('does not flag an explicitly accepted AI-sourced proposal', () => {
			const input = baseInput({
				state: {
					proposals: [
						{
							proposalId: 'prop-1',
							sourceAnswerId: 'ans-1',
							status: 'accepted',
							targetConfirmedRecordId: 'rec-1',
						},
					],
				},
			});
			const result = runConsistencyCheck(input);
			const finding = result.findings.find(
				(f) => f.code === 'consistency_ai_authority_boundary',
			);
			expect(finding).toBeUndefined();
		});

		it('flags an AI-sourced proposal recorded as confirmed', () => {
			const input = baseInput({
				state: {
					proposals: [
						{
							proposalId: 'prop-1',
							sourceAnswerId: 'ans-1',
							status: 'confirmed',
						},
					],
				},
			});
			const result = runConsistencyCheck(input);
			const finding = result.findings.find(
				(f) => f.code === 'consistency_ai_authority_boundary',
			);
			expect(finding).toBeDefined();
			expect(finding?.severity).toBe('error');
		});
	});

	describe('unresolved question visibility', () => {
		it('produces finding for blocking open question on completed document', () => {
			const input = baseInput({
				registerCollections: {
					...emptyRegisters(),
					openQuestions: [
						{
							affectedDocumentLinks: [
								{
									documentCanonicalId: 'doc-1',
									linkedAt: '2024-01-01T00:00:00Z',
								},
							],
							confidence: 'explicit',
							createdAt: '2024-01-01T00:00:00Z',
							diagnostics: [],
							id: 'q-1',
							isBlocking: true,
							kind: 'open_question',
							lifecycleHistory: [],
							questionText: 'Who owns this?',
							reviewState: 'not_required',
							sourceLinks: [],
							status: 'open',
							title: 'Who owns this?',
							updatedAt: '2024-01-01T00:00:00Z',
						} as never,
					],
				},
			});
			const result = runConsistencyCheck(input);
			const finding = result.findings.find(
				(f) => f.code === 'consistency_unresolved_question_visibility',
			);
			expect(finding).toBeDefined();
			expect(finding?.severity).toBe('warning');
		});
	});

	describe('register lifecycle consistency', () => {
		it('produces finding for invalid lifecycle transition', () => {
			const input = baseInput({
				registerCollections: {
					...emptyRegisters(),
					decisions: [
						{
							affectedDocumentLinks: [],
							confidence: 'explicit',
							createdAt: '2024-01-01T00:00:00Z',
							decisionStatement: 'Test',
							diagnostics: [],
							id: 'dec-1',
							kind: 'decision',
							lifecycleHistory: [
								{
									eventId: 'evt-1',
									eventType: 'confirmed',
									fromStatus: 'confirmed',
									occurredAt: '2024-01-01T00:00:00Z',
									registerItemId: 'dec-1',
									toStatus: 'rejected',
								},
							],
							reviewState: 'not_required',
							sourceLinks: [],
							status: 'confirmed',
							title: 'Invalid transition test',
							updatedAt: '2024-01-01T00:00:00Z',
						} as never,
					],
				},
			});
			const result = runConsistencyCheck(input);
			const finding = result.findings.find(
				(f) => f.code === 'consistency_register_lifecycle_consistency',
			);
			expect(finding).toBeDefined();
			expect(finding?.severity).toBe('error');
		});
	});

	describe('risk acceptance consistency', () => {
		it('produces warning for accepted risk without mitigation', () => {
			const input = baseInput({
				registerCollections: {
					...emptyRegisters(),
					risks: [
						{
							affectedDocumentLinks: [],
							confidence: 'explicit',
							createdAt: '2024-01-01T00:00:00Z',
							diagnostics: [],
							id: 'risk-1',
							kind: 'risk',
							lifecycleHistory: [],
							reviewState: 'not_required',
							riskStatement: 'We might leak data',
							sourceLinks: [],
							status: 'accepted',
							title: 'Security risk',
							updatedAt: '2024-01-01T00:00:00Z',
						} as never,
					],
				},
			});
			const result = runConsistencyCheck(input);
			const finding = result.findings.find(
				(f) => f.code === 'consistency_risk_acceptance_consistency',
			);
			expect(finding).toBeDefined();
			expect(finding?.severity).toBe('warning');
		});
	});

	describe('hypothesis evidence consistency', () => {
		it('produces finding for validated hypothesis without evidence', () => {
			const input = baseInput({
				registerCollections: {
					...emptyRegisters(),
					hypotheses: [
						{
							affectedDocumentLinks: [],
							confidence: 'explicit',
							createdAt: '2024-01-01T00:00:00Z',
							diagnostics: [],
							hypothesisStatement: 'X causes Y',
							id: 'hyp-1',
							kind: 'hypothesis',
							lifecycleHistory: [],
							reviewState: 'not_required',
							sourceLinks: [],
							status: 'validated',
							title: 'Hypothesis test',
							updatedAt: '2024-01-01T00:00:00Z',
						} as never,
					],
				},
			});
			const result = runConsistencyCheck(input);
			const finding = result.findings.find(
				(f) => f.code === 'consistency_hypothesis_evidence_consistency',
			);
			expect(finding).toBeDefined();
			expect(finding?.severity).toBe('error');
		});
	});

	describe('executive axis scope boundary', () => {
		it('produces finding for executive live task manager claim', () => {
			const input = baseInput({
				registerCollections: {
					...emptyRegisters(),
					decisions: [
						{
							affectedDocumentLinks: [],
							confidence: 'explicit',
							createdAt: '2024-01-01T00:00:00Z',
							decisionStatement: 'Executive Axis will be a live task manager',
							diagnostics: [],
							id: 'dec-1',
							kind: 'decision',
							lifecycleHistory: [],
							reviewState: 'not_required',
							sourceLinks: [],
							status: 'confirmed',
							title: 'Executive live manager',
							updatedAt: '2024-01-01T00:00:00Z',
						} as never,
					],
				},
			});
			const result = runConsistencyCheck(input);
			const finding = result.findings.find(
				(f) => f.code === 'consistency_executive_axis_scope_boundary',
			);
			expect(finding).toBeDefined();
			expect(finding?.severity).toBe('error');
		});
	});

	describe('readme profile drift', () => {
		it('produces finding for stale profile name in readme metadata', () => {
			const input = baseInput({
				readmeMetadata: {
					contentSnippet: 'Using app-business profile',
					profileReference: 'app-business',
				},
			});
			const result = runConsistencyCheck(input);
			const findings = result.findings.filter(
				(f) => f.code === 'consistency_readme_profile_drift',
			);
			expect(findings.length).toBeGreaterThanOrEqual(1);
			expect(findings[0].severity).toBe('warning');
		});
	});

	describe('generated output metadata consistency', () => {
		it('produces finding for document id mismatch', () => {
			const input = baseInput({
				contract: {
					documentsByCanonicalId: new Map(),
					phases: [],
				},
				generatedOutputs: [
					{
						documentId: 'unknown-doc',
						path: 'logos/test.md',
					},
				],
			});
			const result = runConsistencyCheck(input);
			const finding = result.findings.find(
				(f) => f.code === 'consistency_generated_output_metadata_consistency',
			);
			expect(finding).toBeDefined();
			expect(finding?.severity).toBe('error');
		});
	});

	describe('register contradictions', () => {
		it('produces finding for two confirmed decisions with explicit contradiction', () => {
			const input = baseInput({
				registerCollections: {
					...emptyRegisters(),
					decisions: [
						{
							affectedDocumentLinks: [
								{
									documentCanonicalId: 'doc-1',
									linkedAt: '2024-01-01T00:00:00Z',
								},
							],
							confidence: 'explicit',
							createdAt: '2024-01-01T00:00:00Z',
							decisionStatement: 'We will use React',
							diagnostics: [],
							id: 'dec-1',
							kind: 'decision',
							lifecycleHistory: [],
							reviewState: 'not_required',
							sourceLinks: [],
							status: 'confirmed',
							title: 'Use React',
							updatedAt: '2024-01-01T00:00:00Z',
						} as never,
						{
							affectedDocumentLinks: [
								{
									documentCanonicalId: 'doc-1',
									linkedAt: '2024-01-01T00:00:00Z',
								},
							],
							confidence: 'explicit',
							createdAt: '2024-01-01T00:00:00Z',
							decisionStatement: 'We will not use React',
							diagnostics: [],
							id: 'dec-2',
							kind: 'decision',
							lifecycleHistory: [],
							reviewState: 'not_required',
							sourceLinks: [],
							status: 'confirmed',
							title: 'Do not use React',
							updatedAt: '2024-01-01T00:00:00Z',
						} as never,
					],
				},
			});
			const result = runConsistencyCheck(input);
			const finding = result.findings.find(
				(f) =>
					f.code === 'consistency_register_lifecycle_consistency' &&
					f.message.includes('contradictory'),
			);
			expect(finding).toBeDefined();
			expect(finding?.severity).toBe('error');
		});

		it('does not produce false contradiction for uncertain differences', () => {
			const input = baseInput({
				registerCollections: {
					...emptyRegisters(),
					decisions: [
						{
							affectedDocumentLinks: [
								{
									documentCanonicalId: 'doc-1',
									linkedAt: '2024-01-01T00:00:00Z',
								},
							],
							confidence: 'explicit',
							createdAt: '2024-01-01T00:00:00Z',
							decisionStatement: 'We will use React',
							diagnostics: [],
							id: 'dec-1',
							kind: 'decision',
							lifecycleHistory: [],
							reviewState: 'not_required',
							sourceLinks: [],
							status: 'confirmed',
							title: 'Use React',
							updatedAt: '2024-01-01T00:00:00Z',
						} as never,
						{
							affectedDocumentLinks: [
								{
									documentCanonicalId: 'doc-1',
									linkedAt: '2024-01-01T00:00:00Z',
								},
							],
							confidence: 'explicit',
							createdAt: '2024-01-01T00:00:00Z',
							decisionStatement: 'We will use Vue',
							diagnostics: [],
							id: 'dec-2',
							kind: 'decision',
							lifecycleHistory: [],
							reviewState: 'not_required',
							sourceLinks: [],
							status: 'confirmed',
							title: 'Use Vue',
							updatedAt: '2024-01-01T00:00:00Z',
						} as never,
					],
				},
			});
			const result = runConsistencyCheck(input);
			const finding = result.findings.find(
				(f) =>
					f.code === 'consistency_register_lifecycle_consistency' &&
					f.message.includes('contradictory'),
			);
			expect(finding).toBeUndefined();
		});
	});

	describe('provenance consistency', () => {
		it('produces finding for confirmed claim without source', () => {
			const input = baseInput({
				state: {
					claims: [
						{
							claimId: 'claim-1',
							claimType: 'fact',
							confidence: 'explicit',
							diagnostics: [],
							reviewState: 'not_required',
							sourceCount: 0,
							sourceLinks: [],
							status: 'confirmed',
							summary: 'A fact',
						} as ClaimRecord,
					],
				},
			});
			const result = runConsistencyCheck(input);
			const finding = result.findings.find(
				(f) =>
					f.code === 'consistency_provenance_consistency' &&
					f.message.includes('no source links'),
			);
			expect(finding).toBeDefined();
		});

		it('produces finding for external reference confirmed but not fetched', () => {
			const input = baseInput({
				state: {
					sources: [
						{
							confidence: 'explicit',
							location: {},
							metadata: {},
							orderIndex: 0,
							sourceId: 'src-1',
							sourceType: 'external_reference',
							status: 'confirmed',
							timestamp: {},
							title: 'External doc',
						} as SourceRecord,
					],
				},
			});
			const result = runConsistencyCheck(input);
			const finding = result.findings.find(
				(f) =>
					f.code === 'consistency_provenance_consistency' &&
					f.message.includes('fetched/verified'),
			);
			expect(finding).toBeDefined();
		});
	});

	describe('gate and readiness', () => {
		it('passes when no violations', () => {
			const result = runConsistencyCheck(baseInput());
			expect(result.gateStatus).toBe('pass');
			expect(result.exportReadiness).toBe('ready');
		});

		it('fails when fatal finding exists', () => {
			const input = baseInput({
				state: {
					artifacts: [
						{
							artifactId: 'art-1',
							artifactType: 'canonical_markdown',
							path: '../escape.md',
						},
					],
				},
			});
			const result = runConsistencyCheck(input);
			expect(result.gateStatus).toBe('fail');
			expect(result.exportReadiness).toBe('blocked');
		});

		it('pass_with_warnings when only warnings', () => {
			const input = baseInput({
				readmeMetadata: {
					profileReference: 'app-business',
				},
			});
			const result = runConsistencyCheck(input);
			expect(result.gateStatus).toBe('pass_with_warnings');
			expect(result.exportReadiness).toBe('ready_with_warnings');
		});
	});

	describe('non-mutation', () => {
		it('does not mutate input', () => {
			const input = baseInput();
			const before = JSON.stringify(input);
			runConsistencyCheck(input);
			expect(JSON.stringify(input)).toBe(before);
		});

		it('returns empty changedPaths', () => {
			const result = runConsistencyCheck(baseInput());
			expect(result.changedPaths).toEqual([]);
			expect(result.readOnly).toBe(true);
		});
	});
});
