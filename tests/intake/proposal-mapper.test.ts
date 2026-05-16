/** Proposal Mapper tests — Step 4.3 */
import { describe, expect, it } from 'vitest';
import {
	mapAnswersToProposals,
	type ProposalMappingInput,
} from '../../src/index.js';

// ---------------------------------------------------------------------------
// Deterministic factories
// ---------------------------------------------------------------------------

let idCounter = 0;
function deterministicId(): string {
	idCounter += 1;
	return `prop-test-${String(idCounter).padStart(3, '0')}`;
}

function deterministicClock(): { now(): string } {
	return { now: () => '2024-01-15T00:00:00.000Z' };
}

function makeInput(
	overrides: Partial<ProposalMappingInput> = {},
): ProposalMappingInput {
	return {
		answers: [],
		clock: deterministicClock(),
		idFactory: deterministicId,
		sessionId: 'session-001',
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('proposal-mapper', () => {
	describe('mapAnswersToProposals', () => {
		it('returns error when no answers provided', () => {
			const result = mapAnswersToProposals(makeInput({ answers: [] }));
			expect(result.success).toBe(false);
			expect(result.proposals).toHaveLength(0);
			expect(result.diagnostics.some((d) => d.code === 'E_NO_ANSWERS')).toBe(
				true,
			);
		});

		it('maps a user answer into proposed decision', () => {
			const result = mapAnswersToProposals(
				makeInput({
					answers: [
						{
							answer: 'We will decide to use TypeScript for the frontend.',
							answerId: 'ans-001',
							questionId: 'q-001',
							questionText: 'What language?',
						},
					],
				}),
			);

			expect(result.success).toBe(true);
			expect(result.proposals.length).toBeGreaterThanOrEqual(1);
			const decisionProposal = result.proposals.find(
				(p) => p.kind === 'decision',
			);
			expect(decisionProposal).toBeDefined();
			expect(decisionProposal?.status).toBe('proposed');
			expect(decisionProposal?.source.answerId).toBe('ans-001');
			expect(decisionProposal?.source.questionId).toBe('q-001');
			expect(decisionProposal?.source.sessionId).toBe('session-001');
		});

		it('maps a user answer into proposed assumption', () => {
			const result = mapAnswersToProposals(
				makeInput({
					answers: [
						{
							answer: 'We assume the backend API is already available.',
							answerId: 'ans-002',
							questionId: undefined,
							questionText: undefined,
						},
					],
				}),
			);

			const assumptionProposal = result.proposals.find(
				(p) => p.kind === 'assumption',
			);
			expect(assumptionProposal).toBeDefined();
			expect(assumptionProposal?.status).toBe('proposed');
			expect(assumptionProposal?.source.answerId).toBe('ans-002');
		});

		it('maps a user answer into proposed hypothesis', () => {
			const result = mapAnswersToProposals(
				makeInput({
					answers: [
						{
							answer:
								'Perhaps we could use microservices to improve scalability.',
							answerId: 'ans-003',
							questionId: undefined,
							questionText: undefined,
						},
					],
				}),
			);

			const hypothesisProposal = result.proposals.find(
				(p) => p.kind === 'hypothesis',
			);
			expect(hypothesisProposal).toBeDefined();
			expect(hypothesisProposal?.status).toBe('proposed');
		});

		it('maps a user answer into proposed open question', () => {
			const result = mapAnswersToProposals(
				makeInput({
					answers: [
						{
							answer: 'What authentication strategy should we use?',
							answerId: 'ans-004',
							questionId: undefined,
							questionText: undefined,
						},
					],
				}),
			);

			const questionProposal = result.proposals.find(
				(p) => p.kind === 'open_question',
			);
			expect(questionProposal).toBeDefined();
			expect(questionProposal?.status).toBe('proposed');
		});

		it('maps a user answer into proposed risk', () => {
			const result = mapAnswersToProposals(
				makeInput({
					answers: [
						{
							answer: 'There is a risk of data loss during migration.',
							answerId: 'ans-005',
							questionId: undefined,
							questionText: undefined,
						},
					],
				}),
			);

			const riskProposal = result.proposals.find((p) => p.kind === 'risk');
			expect(riskProposal).toBeDefined();
			expect(riskProposal?.status).toBe('proposed');
		});

		it('maps a user answer into proposed document content hint', () => {
			const result = mapAnswersToProposals(
				makeInput({
					answers: [
						{
							answer: 'Write documentation about the deployment process.',
							answerId: 'ans-006',
							questionId: undefined,
							questionText: undefined,
						},
					],
				}),
			);

			const hintProposal = result.proposals.find(
				(p) => p.kind === 'document_content_hint',
			);
			expect(hintProposal).toBeDefined();
			expect(hintProposal?.status).toBe('proposed');
		});

		it('all mapped proposals have status proposed', () => {
			const result = mapAnswersToProposals(
				makeInput({
					answers: [
						{
							answer: 'We will decide to use PostgreSQL.',
							answerId: 'ans-007',
							questionId: undefined,
							questionText: undefined,
						},
					],
				}),
			);

			for (const p of result.proposals) {
				expect(p.status).toBe('proposed');
			}
		});

		it('all mapped proposals preserve source answer id', () => {
			const result = mapAnswersToProposals(
				makeInput({
					answers: [
						{
							answer: 'We assume the network is reliable.',
							answerId: 'ans-008',
							questionId: undefined,
							questionText: undefined,
						},
					],
				}),
			);

			for (const p of result.proposals) {
				expect(p.source.answerId).toBe('ans-008');
			}
		});

		it('all mapped proposals preserve source session id', () => {
			const result = mapAnswersToProposals(
				makeInput({
					answers: [
						{
							answer: 'We assume the network is reliable.',
							answerId: 'ans-009',
							questionId: undefined,
							questionText: undefined,
						},
					],
					sessionId: 'session-xyz',
				}),
			);

			for (const p of result.proposals) {
				expect(p.source.sessionId).toBe('session-xyz');
			}
		});

		it('source question id is preserved when available', () => {
			const result = mapAnswersToProposals(
				makeInput({
					answers: [
						{
							answer: 'We decide on React.',
							answerId: 'ans-010',
							questionId: 'q-framework',
							questionText: 'Which frontend framework?',
						},
					],
				}),
			);

			const proposal = result.proposals[0];
			expect(proposal?.source.questionId).toBe('q-framework');
		});

		it('source document id and phase id are preserved from question cluster', () => {
			const result = mapAnswersToProposals(
				makeInput({
					answers: [
						{
							answer: 'We decide on React.',
							answerId: 'ans-011',
							questionId: 'q-framework',
							questionText: 'Which frontend framework?',
						},
					],
					questionCluster: {
						questions: [
							{
								id: 'q-framework',
								source: {
									documentCanonicalId: 'doc-tech-stack',
									documentTitle: 'Tech Stack',
									phaseId: 'phase-architecture',
								},
								text: 'Which frontend framework?',
							},
						],
						sourceDocuments: ['doc-tech-stack'],
					},
				}),
			);

			const proposal = result.proposals[0];
			expect(proposal?.source.documentCanonicalId).toBe('doc-tech-stack');
			expect(proposal?.source.phaseId).toBe('phase-architecture');
		});

		it('no confirmed records are created by mapping', () => {
			const result = mapAnswersToProposals(
				makeInput({
					answers: [
						{
							answer: 'We will decide to use Node.js.',
							answerId: 'ans-012',
							questionId: undefined,
							questionText: undefined,
						},
					],
				}),
			);

			// All proposals should be proposed, not accepted/confirmed
			expect(result.proposals.every((p) => p.status === 'proposed')).toBe(true);
		});

		it('maps validated fake provider structured extraction into proposals', () => {
			const result = mapAnswersToProposals(
				makeInput({
					answers: [
						{
							answer: 'placeholder for extraction mapping',
							answerId: 'ans-ext-001',
							questionId: undefined,
							questionText: undefined,
						},
					],
					providerMetadata: {
						operation: 'structured_extraction',
						providerId: 'fake',
						providerKind: 'fake',
						responseId: 'resp-001',
					},
					validatedExtractions: [
						{
							confidence: 'high',
							fields: {
								body: 'The system shall use JWT for authentication',
								title: 'Authentication Decision',
							},
							isProposed: true,
							recordId: 'ext-001',
							recordType: 'decision',
						},
						{
							confidence: 'medium',
							fields: {
								body: 'The network is assumed to be reliable',
								title: 'Network Assumption',
							},
							isProposed: true,
							recordId: 'ext-002',
							recordType: 'assumption',
						},
					],
				}),
			);

			expect(result.success).toBe(true);
			expect(result.proposals).toHaveLength(3); // 1 answer fallback + 2 extractions
			expect(result.proposals.some((p) => p.kind === 'decision')).toBe(true);
			expect(result.proposals.some((p) => p.kind === 'assumption')).toBe(true);
		});

		it('invalid provider response (not proposed) is rejected before mapping', () => {
			const result = mapAnswersToProposals(
				makeInput({
					answers: [],
					validatedExtractions: [
						{
							confidence: 'high',
							fields: { body: 'Not proposed', title: 'Bad extraction' },
							isProposed: false,
							recordId: 'ext-bad',
							recordType: 'decision',
						},
					],
				}),
			);

			expect(result.proposals).toHaveLength(0);
			expect(
				result.unmappableItems.some(
					(d) => d.code === 'E_EXTRACTION_NOT_PROPOSED',
				),
			).toBe(true);
		});

		it('unmappable extraction item returns diagnostic', () => {
			const result = mapAnswersToProposals(
				makeInput({
					answers: [],
					validatedExtractions: [
						{
							confidence: 'low',
							fields: {},
							isProposed: true,
							recordId: 'ext-empty',
							recordType: 'decision',
						},
					],
				}),
			);

			expect(
				result.unmappableItems.some((d) => d.code === 'E_EMPTY_EXTRACTION'),
			).toBe(true);
		});
	});

	describe('mapper purity', () => {
		it('mapper is pure — no side effects', () => {
			// Use a non-stateful deterministic id factory for purity testing
			let localCounter = 0;
			const pureIdFactory = () => {
				localCounter += 1;
				return `prop-pure-${String(localCounter).padStart(3, '0')}`;
			};

			const pureInput = {
				answers: [
					{
						answer: 'We decide on TypeScript.',
						answerId: 'ans-pure-1',
						questionId: undefined,
						questionText: undefined,
					},
				],
				clock: deterministicClock(),
				idFactory: pureIdFactory,
				sessionId: 'session-pure',
			};

			// Create two fresh inputs with the same factory
			const input1 = {
				...pureInput,
				idFactory: () => {
					localCounter += 1;
					return `prop-pure-${String(localCounter).padStart(3, '0')}`;
				},
			};
			localCounter = 0;
			const input2 = {
				...pureInput,
				idFactory: () => {
					localCounter += 1;
					return `prop-pure-${String(localCounter).padStart(3, '0')}`;
				},
			};

			const result1 = mapAnswersToProposals(input1);
			localCounter = 0;
			const result2 = mapAnswersToProposals(input2);

			expect(result1.proposals).toHaveLength(result2.proposals.length);
			// Pure mapping with same inputs produces same proposal IDs
			expect(result1.proposals[0]?.kind).toBe(result2.proposals[0]?.kind);
			expect(result1.proposals[0]?.status).toBe(result2.proposals[0]?.status);
			expect(result1.proposals[0]?.title).toBe(result2.proposals[0]?.title);
		});
	});
});
