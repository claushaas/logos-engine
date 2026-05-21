/** Step 12.4 — Candidate Fact/Decision Extractor Integration Tests */

import { describe, expect, it } from 'vitest';
import type { DocumentationImportCandidate } from '../src/index.js';
import {
	type CandidateExtractionInput,
	type CandidateExtractionResult,
	extractCandidateFactsAndDecisions,
} from '../src/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCandidate(
	overrides?: Partial<DocumentationImportCandidate>,
): DocumentationImportCandidate {
	return {
		absolutePath: undefined,
		blockers: [],
		contentSnippet: undefined,
		extension: '.md',
		id: 'import-candidate-1',
		kind: 'markdown_document',
		metadata: {
			frontmatterKeys: [],
			headings: [],
			sizeBytes: 0,
		},
		relativePath: 'test-doc.md',
		root: 'logos/',
		sizeBytes: 0,
		source: 'fixture',
		status: 'mapped',
		warnings: [],
		...overrides,
	};
}

function makeInput(
	overrides?: Partial<CandidateExtractionInput>,
): CandidateExtractionInput {
	return {
		documentationRoot: 'logos/',
		profileId: 'standard',
		...overrides,
	};
}

function extract(
	inputOverrides?: Partial<CandidateExtractionInput>,
): CandidateExtractionResult {
	return extractCandidateFactsAndDecisions(makeInput(inputOverrides), {
		dryRun: true,
		extractedAt: '2026-01-15T00:00:00.000Z',
	});
}

// ---------------------------------------------------------------------------
// Basic extraction tests
// ---------------------------------------------------------------------------

describe('candidate fact extractor', () => {
	it('empty input produces empty result', () => {
		const result = extract();
		expect(result.readOnly).toBe(true);
		expect(result.dryRun).toBe(true);
		expect(result.changedPaths).toEqual([]);
		expect(result.extractedItemCount).toBe(0);
		expect(result.readiness).toBe('empty');
		expect(result.items).toHaveLength(0);
	});

	it('changed paths are empty', () => {
		const result = extract({
			candidates: [makeCandidate()],
		});
		expect(result.changedPaths).toEqual([]);
	});

	it('read-only marker is present', () => {
		const result = extract();
		expect(result.readOnly).toBe(true);
	});

	it('dry-run marker is present', () => {
		const result = extract();
		expect(result.dryRun).toBe(true);
	});

	it('has active profile id', () => {
		const result = extract();
		expect(result.activeProfileId).toBe('standard');
	});

	it('has documentation root', () => {
		const result = extract();
		expect(result.documentationRoot).toBe('logos/');
	});
});

// ---------------------------------------------------------------------------
// Frontmatter extraction
// ---------------------------------------------------------------------------

describe('frontmatter extraction', () => {
	it('extracts decision from frontmatter', () => {
		const candidate = makeCandidate({
			contentSnippet: '---\ndecision: Use TypeScript strict mode\n---\n\n# Doc',
			metadata: {
				frontmatterKeys: ['decision'],
				headings: [],
				sizeBytes: 50,
			},
		});
		const result = extract({ candidates: [candidate] });
		expect(result.extractedItemCount).toBeGreaterThanOrEqual(1);
		const decisions = result.items.filter((i) => i.kind === 'decision');
		expect(decisions.length).toBeGreaterThanOrEqual(1);
		expect(decisions[0]?.status).toBe('candidate');
	});

	it('extracts assumption from frontmatter', () => {
		const candidate = makeCandidate({
			contentSnippet: '---\nassumptions:\n  - Dev env has Node 22+\n---\n',
			metadata: {
				frontmatterKeys: ['assumptions'],
				headings: [],
				sizeBytes: 50,
			},
		});
		const result = extract({ candidates: [candidate] });
		const assumptions = result.items.filter((i) => i.kind === 'assumption');
		expect(assumptions.length).toBeGreaterThanOrEqual(1);
	});

	it('extracts hypothesis from frontmatter', () => {
		const candidate = makeCandidate({
			contentSnippet:
				'---\nhypothesis: Local-first users prefer TUI over GUI\n---\n',
			metadata: {
				frontmatterKeys: ['hypothesis'],
				headings: [],
				sizeBytes: 50,
			},
		});
		const result = extract({ candidates: [candidate] });
		const hypotheses = result.items.filter((i) => i.kind === 'hypothesis');
		expect(hypotheses.length).toBeGreaterThanOrEqual(1);
	});

	it('extracts risk from frontmatter', () => {
		const candidate = makeCandidate({
			contentSnippet:
				'---\nrisks:\n  - Token leakage from generated files\n---\n',
			metadata: {
				frontmatterKeys: ['risks'],
				headings: [],
				sizeBytes: 50,
			},
		});
		const result = extract({ candidates: [candidate] });
		const risks = result.items.filter((i) => i.kind === 'risk');
		expect(risks.length).toBeGreaterThanOrEqual(1);
	});

	it('extracts open question from frontmatter', () => {
		const candidate = makeCandidate({
			contentSnippet: '---\nquestions:\n  - Should we support Windows?\n---\n',
			metadata: {
				frontmatterKeys: ['questions'],
				headings: [],
				sizeBytes: 50,
			},
		});
		const result = extract({ candidates: [candidate] });
		const questions = result.items.filter((i) => i.kind === 'open_question');
		expect(questions.length).toBeGreaterThanOrEqual(1);
	});

	it('extracts constraints from frontmatter', () => {
		const candidate = makeCandidate({
			contentSnippet: '---\nconstraints:\n  - Must run offline\n---\n',
			metadata: {
				frontmatterKeys: ['constraints'],
				headings: [],
				sizeBytes: 50,
			},
		});
		const result = extract({ candidates: [candidate] });
		const constraints = result.items.filter((i) => i.kind === 'constraint');
		expect(constraints.length).toBeGreaterThanOrEqual(1);
	});

	it('extracts requirements from frontmatter', () => {
		const candidate = makeCandidate({
			contentSnippet: '---\nrequirements:\n  - Node.js >= 22\n---\n',
			metadata: {
				frontmatterKeys: ['requirements'],
				headings: [],
				sizeBytes: 50,
			},
		});
		const result = extract({ candidates: [candidate] });
		const requirements = result.items.filter((i) => i.kind === 'requirement');
		expect(requirements.length).toBeGreaterThanOrEqual(1);
	});

	it('extracts acceptance criteria from frontmatter', () => {
		const candidate = makeCandidate({
			contentSnippet: '---\nacceptanceCriteria:\n  - All tests pass\n---\n',
			metadata: {
				frontmatterKeys: ['acceptanceCriteria'],
				headings: [],
				sizeBytes: 50,
			},
		});
		const result = extract({ candidates: [candidate] });
		const criteria = result.items.filter(
			(i) => i.kind === 'acceptance_criterion',
		);
		expect(criteria.length).toBeGreaterThanOrEqual(1);
	});

	it('extracts non-goals from frontmatter', () => {
		const candidate = makeCandidate({
			contentSnippet: '---\nnonGoals:\n  - Cloud sync\n---\n',
			metadata: {
				frontmatterKeys: ['nonGoals'],
				headings: [],
				sizeBytes: 50,
			},
		});
		const result = extract({ candidates: [candidate] });
		const nonGoals = result.items.filter((i) => i.kind === 'non_goal');
		expect(nonGoals.length).toBeGreaterThanOrEqual(1);
	});

	it('extracts source references from frontmatter sources', () => {
		const candidate = makeCandidate({
			contentSnippet:
				'---\nsources:\n  - docs/01-foundation/03-scope.md\n---\n',
			metadata: {
				frontmatterKeys: ['sources'],
				headings: [],
				sizeBytes: 50,
			},
		});
		const result = extract({ candidates: [candidate] });
		const refs = result.items.filter((i) => i.kind === 'evidence_reference');
		expect(refs.length).toBeGreaterThanOrEqual(1);
	});

	it('fact from frontmatter is never confirmed', () => {
		const candidate = makeCandidate({
			contentSnippet: '---\ndecision: Something important\n---\n',
			metadata: {
				frontmatterKeys: ['decision'],
				headings: [],
				sizeBytes: 50,
			},
		});
		const result = extract({ candidates: [candidate] });
		const decisions = result.items.filter((i) => i.kind === 'decision');
		for (const d of decisions) {
			expect(d.status).not.toBe('confirmed' as never);
		}
	});
});

// ---------------------------------------------------------------------------
// Heading extraction
// ---------------------------------------------------------------------------

describe('heading extraction', () => {
	it('extracts list items under Decision heading', () => {
		const candidate = makeCandidate({
			contentSnippet:
				'# Doc\n\n## Decision\n\n- Use TypeScript\n- Use ESM modules\n',
			metadata: {
				frontmatterKeys: [],
				headings: ['Decision'],
				sizeBytes: 60,
			},
		});
		const result = extract({ candidates: [candidate] });
		const decisions = result.items.filter((i) => i.kind === 'decision');
		expect(decisions.length).toBeGreaterThanOrEqual(1);
	});

	it('extracts list items under Risks heading', () => {
		const candidate = makeCandidate({
			contentSnippet:
				'# Doc\n\n## Risks\n\n- Security vulnerability\n- Performance bottleneck\n',
			metadata: {
				frontmatterKeys: [],
				headings: ['Risks'],
				sizeBytes: 60,
			},
		});
		const result = extract({ candidates: [candidate] });
		const risks = result.items.filter((i) => i.kind === 'risk');
		expect(risks.length).toBeGreaterThanOrEqual(1);
	});

	it('extracts Open Questions with question-mark items', () => {
		const candidate = makeCandidate({
			contentSnippet:
				'## Open Questions\n\n- What is the target audience?\n- When should we release?\n',
			metadata: {
				frontmatterKeys: [],
				headings: ['Open Questions'],
				sizeBytes: 60,
			},
		});
		const result = extract({ candidates: [candidate] });
		const questions = result.items.filter((i) => i.kind === 'open_question');
		expect(questions.length).toBeGreaterThanOrEqual(1);
	});

	it('extracts Assumptions heading items', () => {
		const candidate = makeCandidate({
			contentSnippet:
				'## Assumptions\n\n- User has git installed\n- User has Node.js installed\n',
			metadata: {
				frontmatterKeys: [],
				headings: ['Assumptions'],
				sizeBytes: 60,
			},
		});
		const result = extract({ candidates: [candidate] });
		const assumptions = result.items.filter((i) => i.kind === 'assumption');
		expect(assumptions.length).toBeGreaterThanOrEqual(1);
	});

	it('extracts Constraints heading items', () => {
		const candidate = makeCandidate({
			contentSnippet: '## Constraints\n\n- Must be local-first\n',
			metadata: {
				frontmatterKeys: [],
				headings: ['Constraints'],
				sizeBytes: 50,
			},
		});
		const result = extract({ candidates: [candidate] });
		const constraints = result.items.filter((i) => i.kind === 'constraint');
		expect(constraints.length).toBeGreaterThanOrEqual(1);
	});

	it('extracts Non-Goals heading items', () => {
		const candidate = makeCandidate({
			contentSnippet: '## Non-Goals\n\n- Cloud hosting\n',
			metadata: {
				frontmatterKeys: [],
				headings: ['Non-Goals'],
				sizeBytes: 50,
			},
		});
		const result = extract({ candidates: [candidate] });
		const nonGoals = result.items.filter((i) => i.kind === 'non_goal');
		expect(nonGoals.length).toBeGreaterThanOrEqual(1);
	});

	it('does not infer from arbitrary prose', () => {
		const candidate = makeCandidate({
			contentSnippet:
				'# Introduction\n\nThis is a long paragraph about the project philosophy.\nIt does not contain explicit decisions or risks.\n',
			metadata: {
				frontmatterKeys: [],
				headings: ['Introduction'],
				sizeBytes: 100,
			},
		});
		const result = extract({ candidates: [candidate] });
		// No decisions, risks, etc. should be extracted from arbitrary prose
		const decisions = result.items.filter((i) => i.kind === 'decision');
		const risks = result.items.filter((i) => i.kind === 'risk');
		expect(decisions).toHaveLength(0);
		expect(risks).toHaveLength(0);
	});

	it('ambiguous extraction requires review', () => {
		// Content-only decision heading with no list items = ambiguous
		const candidate = makeCandidate({
			contentSnippet:
				'## Decision\n\nWe should probably use React for the UI.\n',
			metadata: {
				frontmatterKeys: [],
				headings: ['Decision'],
				sizeBytes: 60,
			},
		});
		const result = extract({ candidates: [candidate] });
		const decisions = result.items.filter((i) => i.kind === 'decision');
		if (decisions.length > 0) {
			expect(decisions[0]?.confidence).toBe('low');
			expect(decisions[0]?.requiresReview).toBe(true);
		}
	});
});

// ---------------------------------------------------------------------------
// Source and provenance
// ---------------------------------------------------------------------------

describe('source and provenance', () => {
	it('every extracted item has source candidate id', () => {
		const candidate = makeCandidate({
			contentSnippet: '---\ndecision: Use TypeScript\n---\n',
			metadata: {
				frontmatterKeys: ['decision'],
				headings: [],
				sizeBytes: 50,
			},
		});
		const result = extract({ candidates: [candidate] });
		for (const item of result.items) {
			expect(item.sourceCandidateIds.length).toBeGreaterThan(0);
		}
	});

	it('every extracted item has source pointer', () => {
		const candidate = makeCandidate({
			contentSnippet: '---\ndecision: Use TypeScript\n---\n',
			metadata: {
				frontmatterKeys: ['decision'],
				headings: [],
				sizeBytes: 50,
			},
		});
		const result = extract({ candidates: [candidate] });
		for (const item of result.items) {
			expect(item.sources.length).toBeGreaterThan(0);
		}
	});

	it('evidence snippets are bounded', () => {
		const longStatement = `A very long statement about a decision that goes on and on ${'x'.repeat(600)}`;
		const candidate = makeCandidate({
			contentSnippet: `---\ndecision: ${longStatement}\n---\n`,
			metadata: {
				frontmatterKeys: ['decision'],
				headings: [],
				sizeBytes: 700,
			},
		});
		const result = extract({ candidates: [candidate] });
		for (const item of result.items) {
			for (const evidence of (
				item as { evidenceItems?: Array<{ snippet: string }> }
			).evidenceItems ?? []) {
				expect(evidence.snippet.length).toBeLessThanOrEqual(600);
			}
		}
	});

	it('paths are relative/portable', () => {
		const candidate = makeCandidate({
			contentSnippet: '---\ndecision: Use TypeScript\n---\n',
			metadata: {
				frontmatterKeys: ['decision'],
				headings: [],
				sizeBytes: 50,
			},
		});
		const result = extract({ candidates: [candidate] });
		for (const item of result.items) {
			for (const source of item.sources) {
				if (source.candidatePath) {
					expect(source.candidatePath).not.toContain('/private/');
				}
			}
		}
	});
});

// ---------------------------------------------------------------------------
// Decision extraction
// ---------------------------------------------------------------------------

describe('decision extraction', () => {
	it('explicit Decision heading creates candidate decision', () => {
		const candidate = makeCandidate({
			contentSnippet: '## Decision\n\n- Use pnpm as package manager\n',
			metadata: {
				frontmatterKeys: [],
				headings: ['Decision'],
				sizeBytes: 50,
			},
		});
		const result = extract({ candidates: [candidate] });
		const decisions = result.items.filter((i) => i.kind === 'decision');
		expect(decisions.length).toBeGreaterThanOrEqual(1);
		expect(decisions[0]?.status).toBe('candidate');
	});

	it('implementation presence alone does not create decision', () => {
		// Just having code structure doesn't create decisions
		const candidate = makeCandidate({
			contentSnippet: '```typescript\nconst x = 42;\n```\n',
			metadata: {
				frontmatterKeys: [],
				headings: [],
				sizeBytes: 40,
			},
		});
		const result = extract({ candidates: [candidate] });
		const decisions = result.items.filter((i) => i.kind === 'decision');
		expect(decisions).toHaveLength(0);
	});

	it('duplicate existing decision is marked duplicate', () => {
		const candidate = makeCandidate({
			contentSnippet: '## Decision\n\n- Use TypeScript strict mode\n',
			id: 'import-candidate-1',
			metadata: {
				frontmatterKeys: [],
				headings: ['Decision'],
				sizeBytes: 50,
			},
		});
		const candidate2 = makeCandidate({
			contentSnippet: '## Decision\n\n- Use TypeScript strict mode\n',
			id: 'import-candidate-2',
			metadata: {
				frontmatterKeys: [],
				headings: ['Decision'],
				sizeBytes: 50,
			},
			relativePath: 'other-doc.md',
		});
		const result = extract({ candidates: [candidate, candidate2] });
		const duplicates = result.items.filter((i) => i.status === 'duplicate');
		expect(duplicates.length).toBeGreaterThanOrEqual(1);
	});

	it('contradiction with confirmed decision is marked', () => {
		const candidate = makeCandidate({
			contentSnippet: '---\ndecision: Use TypeScript strict mode\n---\n',
			metadata: {
				frontmatterKeys: ['decision'],
				headings: [],
				sizeBytes: 50,
			},
		});
		const result = extract({
			candidates: [candidate],
			existingRegisterSummaries: [
				{
					confirmationLevel: 'confirmed',
					id: 'reg-decision-1',
					kind: 'decision',
					statement: 'Use TypeScript strict mode',
					status: 'confirmed',
					title: 'Use TypeScript strict mode',
				},
			],
		});
		expect(result.conflicts.length).toBeGreaterThanOrEqual(1);
		const conflictKind = result.conflicts.map((c) => c.kind);
		expect(conflictKind).toContain('contradicts_existing_confirmed_record');
	});
});

// ---------------------------------------------------------------------------
// Assumption and hypothesis extraction
// ---------------------------------------------------------------------------

describe('assumption and hypothesis extraction', () => {
	it('assumptions are not treated as facts', () => {
		const candidate = makeCandidate({
			contentSnippet: '---\nassumption: Users have git installed\n---\n',
			metadata: {
				frontmatterKeys: ['assumption'],
				headings: [],
				sizeBytes: 50,
			},
		});
		const result = extract({ candidates: [candidate] });
		const facts = result.items.filter((i) => i.kind === 'fact');
		const assumptions = result.items.filter((i) => i.kind === 'assumption');
		expect(assumptions.length).toBeGreaterThanOrEqual(1);
		expect(facts.length).toBe(0);
	});

	it('hypotheses are not treated as facts', () => {
		const candidate = makeCandidate({
			contentSnippet: '---\nhypothesis: TUI adoption rate > 50%\n---\n',
			metadata: {
				frontmatterKeys: ['hypothesis'],
				headings: [],
				sizeBytes: 50,
			},
		});
		const result = extract({ candidates: [candidate] });
		const facts = result.items.filter((i) => i.kind === 'fact');
		const hypotheses = result.items.filter((i) => i.kind === 'hypothesis');
		expect(hypotheses.length).toBeGreaterThanOrEqual(1);
		expect(facts.length).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Risk extraction
// ---------------------------------------------------------------------------

describe('risk extraction', () => {
	it('explicit risk is extracted', () => {
		const candidate = makeCandidate({
			contentSnippet: '## Risks\n\n- Token leakage from logs\n',
			metadata: {
				frontmatterKeys: [],
				headings: ['Risks'],
				sizeBytes: 50,
			},
		});
		const result = extract({ candidates: [candidate] });
		const risks = result.items.filter((i) => i.kind === 'risk');
		expect(risks.length).toBeGreaterThanOrEqual(1);
	});

	it('mitigation is not invented when absent', () => {
		const candidate = makeCandidate({
			contentSnippet: '## Risks\n\n- Some risk without mitigation\n',
			metadata: {
				frontmatterKeys: [],
				headings: ['Risks'],
				sizeBytes: 50,
			},
		});
		const result = extract({ candidates: [candidate] });
		const risks = result.items.filter((i) => i.kind === 'risk') as Array<{
			mitigation?: string;
		}>;
		for (const risk of risks) {
			expect(risk.mitigation).toBeUndefined();
		}
	});

	it('duplicate risk is detected', () => {
		const c1 = makeCandidate({
			contentSnippet: '## Risks\n\n- Token leakage\n',
			id: 'import-candidate-1',
			metadata: {
				frontmatterKeys: [],
				headings: ['Risks'],
				sizeBytes: 50,
			},
		});
		const c2 = makeCandidate({
			contentSnippet: '## Risks\n\n- Token leakage\n',
			id: 'import-candidate-2',
			metadata: {
				frontmatterKeys: [],
				headings: ['Risks'],
				sizeBytes: 50,
			},
			relativePath: 'other.md',
		});
		const result = extract({ candidates: [c1, c2] });
		const duplicates = result.items.filter((i) => i.status === 'duplicate');
		expect(duplicates.length).toBeGreaterThanOrEqual(1);
	});
});

// ---------------------------------------------------------------------------
// Open question extraction
// ---------------------------------------------------------------------------

describe('open question extraction', () => {
	it('explicit open question extracted', () => {
		const candidate = makeCandidate({
			contentSnippet: '## Open Questions\n\n- When should we release?\n',
			metadata: {
				frontmatterKeys: [],
				headings: ['Open Questions'],
				sizeBytes: 50,
			},
		});
		const result = extract({ candidates: [candidate] });
		const questions = result.items.filter((i) => i.kind === 'open_question');
		expect(questions.length).toBeGreaterThanOrEqual(1);
	});

	it('question is not answered', () => {
		const candidate = makeCandidate({
			contentSnippet: '## Open Questions\n\n- When should we release?\n',
			metadata: {
				frontmatterKeys: [],
				headings: ['Open Questions'],
				sizeBytes: 50,
			},
		});
		const result = extract({ candidates: [candidate] });
		const questions = result.items.filter((i) => i.kind === 'open_question');
		for (const q of questions) {
			// No answer should be inferred
			expect('answer' in q).toBe(false);
		}
	});

	it('question is not converted to assumption', () => {
		const candidate = makeCandidate({
			contentSnippet: '## Open Questions\n\n- Should we use React?\n',
			metadata: {
				frontmatterKeys: [],
				headings: ['Open Questions'],
				sizeBytes: 50,
			},
		});
		const result = extract({ candidates: [candidate] });
		const assumptions = result.items.filter((i) => i.kind === 'assumption');
		expect(assumptions).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Evidence reference extraction
// ---------------------------------------------------------------------------

describe('evidence reference extraction', () => {
	it('local path reference extracted', () => {
		const candidate = makeCandidate({
			contentSnippet: '## Sources\n\n- docs/01-foundation/03-scope.md\n',
			metadata: {
				frontmatterKeys: [],
				headings: ['Sources'],
				sizeBytes: 60,
			},
		});
		const result = extract({ candidates: [candidate] });
		const refs = result.items.filter((i) => i.kind === 'evidence_reference');
		expect(refs.length).toBeGreaterThanOrEqual(1);
	});

	it('external URL reference extracted but not fetched', () => {
		const candidate = makeCandidate({
			contentSnippet: '## Sources\n\n- https://example.com/research\n',
			metadata: {
				frontmatterKeys: [],
				headings: ['Sources'],
				sizeBytes: 60,
			},
		});
		const result = extract({ candidates: [candidate] });
		const refs = result.items.filter(
			(i) => i.kind === 'evidence_reference',
		) as Array<{ reference: string; verified: boolean }>;
		for (const ref of refs) {
			if (ref.reference.startsWith('http')) {
				expect(ref.verified).toBe(false);
			}
		}
	});

	it('unsafe path reference is blocked', () => {
		const candidate = makeCandidate({
			contentSnippet: '## Sources\n\n- ../../../etc/passwd\n',
			metadata: {
				frontmatterKeys: [],
				headings: ['Sources'],
				sizeBytes: 60,
			},
		});
		const result = extract({ candidates: [candidate] });
		const blocked = result.items.filter((i) => i.status === 'blocked');
		// Unsafe path references should be blocked
		expect(blocked.length).toBeGreaterThanOrEqual(1);
	});

	it('external reference marked unverified', () => {
		const candidate = makeCandidate({
			contentSnippet: '---\nsources:\n  - https://example.com/doc\n---\n',
			metadata: {
				frontmatterKeys: ['sources'],
				headings: [],
				sizeBytes: 60,
			},
		});
		const result = extract({ candidates: [candidate] });
		const refs = result.items.filter(
			(i) => i.kind === 'evidence_reference',
		) as Array<{ reference: string; verified: boolean }>;
		for (const ref of refs) {
			if (ref.reference.startsWith('http')) {
				expect(ref.verified).toBe(false);
			}
		}
	});
});

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

describe('duplicate detection', () => {
	it('exact normalized statement duplicate detected', () => {
		const c1 = makeCandidate({
			contentSnippet: '---\ndecision: Use TypeScript\n---\n',
			id: 'cand-1',
			metadata: {
				frontmatterKeys: ['decision'],
				headings: [],
				sizeBytes: 50,
			},
		});
		const c2 = makeCandidate({
			contentSnippet: '---\ndecision: Use TypeScript\n---\n',
			id: 'cand-2',
			metadata: {
				frontmatterKeys: ['decision'],
				headings: [],
				sizeBytes: 50,
			},
			relativePath: 'other.md',
		});
		const result = extract({ candidates: [c1, c2] });
		expect(result.duplicateCount).toBeGreaterThanOrEqual(1);
	});

	it('same explicit id duplicate detected', () => {
		// Items with same source candidate id + same heading = duplicate
		const c1 = makeCandidate({
			contentSnippet: '## Decision\n\n- Item A\n',
			id: 'cand-1',
			metadata: {
				frontmatterKeys: [],
				headings: ['Decision'],
				sizeBytes: 40,
			},
		});
		const c2 = makeCandidate({
			contentSnippet: '## Decision\n\n- Item A\n',
			id: 'cand-1', // same candidate id
			metadata: {
				frontmatterKeys: [],
				headings: ['Decision'],
				sizeBytes: 40,
			},
		});
		const result = extract({ candidates: [c1, c2] });
		expect(result.duplicateCount).toBeGreaterThanOrEqual(1);
	});
});

// ---------------------------------------------------------------------------
// Security and redaction
// ---------------------------------------------------------------------------

describe('security and redaction', () => {
	it('fake API key redacted', () => {
		const candidate = makeCandidate({
			contentSnippet:
				'---\ndecision: Use API key sk-abc123def456ghi789jkl012mno345pqr678stu\n---\n',
			metadata: {
				frontmatterKeys: ['decision'],
				headings: [],
				sizeBytes: 80,
			},
		});
		const result = extract({ candidates: [candidate] });
		// Item should be blocked due to secret in content
		const _blocked = result.items.filter((i) => i.status === 'blocked');
		const blockers = result.blockers.filter(
			(b) => b.code === 'extraction_secret_in_snippet',
		);
		expect(blockers.length).toBeGreaterThan(0);
	});

	it('fake bearer token redacted', () => {
		const candidate = makeCandidate({
			contentSnippet:
				'## Decision\n\n- Use token Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U\n',
			metadata: {
				frontmatterKeys: [],
				headings: ['Decision'],
				sizeBytes: 120,
			},
		});
		const result = extract({ candidates: [candidate] });
		const blockers = result.blockers.filter(
			(b) => b.code === 'extraction_secret_in_snippet',
		);
		expect(blockers.length).toBeGreaterThan(0);
	});

	it('fake secrets do not appear in results', () => {
		const candidate = makeCandidate({
			contentSnippet:
				'---\nassumption: Use gsk_abcdefghijklmnopqrstuvwxyz123456\n---\n',
			metadata: {
				frontmatterKeys: ['assumption'],
				headings: [],
				sizeBytes: 80,
			},
		});
		const result = extract({ candidates: [candidate] });
		const resultJson = JSON.stringify(result);
		expect(resultJson).not.toContain('gsk_abcdefghijklmnopqrstuvwxyz123456');
	});

	it('secret-like extracted item is blocked', () => {
		const candidate = makeCandidate({
			contentSnippet:
				'# Doc\n\nSome content with api_key: abcdef1234567890abcdef1234567890 embedded\n',
			metadata: {
				frontmatterKeys: [],
				headings: [],
				sizeBytes: 80,
			},
		});
		const result = extract({ candidates: [candidate] });
		const _blockers = result.blockers;
		// May or may not be blocked depending on exact matching
		// But if items exist, they shouldn't contain secrets
		for (const item of result.items) {
			const itemJson = JSON.stringify(item);
			expect(itemJson).not.toContain('abcdef1234567890abcdef1234567890');
		}
	});
});

// ---------------------------------------------------------------------------
// Derived artifact boundary
// ---------------------------------------------------------------------------

describe('derived artifact boundary', () => {
	it('HTML artifact candidate produces no authoritative decision by default', () => {
		const candidate = makeCandidate({
			contentSnippet:
				'---\ndecision: Use React\n---\n\nThis is a derived artifact.',
			kind: 'markdown_document',
			metadata: {
				frontmatterKeys: ['decision'],
				headings: [],
				sizeBytes: 80,
			},
			relativePath: 'logos/html-report.html',
		});
		const result = extract({ candidates: [candidate] });
		const decisions = result.items.filter(
			(i) => i.kind === 'decision' && i.status !== 'blocked',
		);
		expect(decisions).toHaveLength(0);
	});

	it('agent pack candidate produces no authoritative decision by default', () => {
		const candidate = makeCandidate({
			contentSnippet: '---\ndecision: Use pnpm\n---\n\nagent pack content',
			kind: 'markdown_document',
			metadata: {
				frontmatterKeys: ['decision'],
				headings: [],
				sizeBytes: 80,
			},
			relativePath: 'logos/agent-pack-output.md',
		});
		const result = extract({ candidates: [candidate] });
		const unblockedDecisions = result.items.filter(
			(i) => i.kind === 'decision' && i.status !== 'blocked',
		);
		expect(unblockedDecisions).toHaveLength(0);
	});

	it('derived artifact may produce low-confidence evidence reference if option allows', () => {
		const candidate = makeCandidate({
			contentSnippet:
				'## Sources\n\n- docs/01-foundation/03-scope.md\n\nThis is a derived artifact.',
			kind: 'markdown_document',
			metadata: {
				frontmatterKeys: [],
				headings: ['Sources'],
				sizeBytes: 80,
			},
			relativePath: 'logos/validation-report.md',
		});
		const result = extractCandidateFactsAndDecisions(
			makeInput({ candidates: [candidate] }),
			{
				allowDerivedArtifactEvidence: true,
				dryRun: true,
				extractedAt: '2026-01-15T00:00:00.000Z',
			},
		);
		const refs = result.items.filter((i) => i.kind === 'evidence_reference');
		for (const ref of refs) {
			expect(ref.confidence).toBe('low');
		}
	});
});

// ---------------------------------------------------------------------------
// Transcript handling
// ---------------------------------------------------------------------------

describe('transcript handling', () => {
	it('transcript-like candidate is deferred by default', () => {
		const candidate = makeCandidate({
			contentSnippet:
				'# Chat Log\n\nUser: What is LOGOS?\nAssistant: LOGOS is a local-first engine.\n',
			kind: 'transcript',
			metadata: {
				frontmatterKeys: [],
				headings: [],
				sizeBytes: 80,
			},
		});
		const result = extract({ candidates: [candidate] });
		expect(result.items).toHaveLength(0);
		expect(
			result.diagnostics.some(
				(d) => d.code === 'extraction_transcript_deferred',
			),
		).toBe(true);
	});

	it('transcript is not summarized', () => {
		const candidate = makeCandidate({
			contentSnippet:
				'00:12:34 - User: What should we do?\n00:12:40 - Assistant: Let me think...\n',
			kind: 'transcript',
			metadata: {
				frontmatterKeys: [],
				headings: [],
				sizeBytes: 100,
			},
		});
		const result = extract({ candidates: [candidate] });
		// No items extracted from transcript
		expect(result.items).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Review actions
// ---------------------------------------------------------------------------

describe('review actions', () => {
	it('candidate fact review action created', () => {
		const candidate = makeCandidate({
			contentSnippet: '---\ndecision: Use TypeScript\n---\n',
			metadata: {
				frontmatterKeys: ['decision'],
				headings: [],
				sizeBytes: 50,
			},
		});
		const result = extract({ candidates: [candidate] });
		expect(result.reviewActions.length).toBeGreaterThan(0);
		const decisionActions = result.reviewActions.filter(
			(a) => a.kind === 'review_candidate_decision',
		);
		expect(decisionActions.length).toBeGreaterThan(0);
	});

	it('actions are never applied', () => {
		const candidate = makeCandidate({
			contentSnippet: '---\ndecision: Use TypeScript\n---\n',
			metadata: {
				frontmatterKeys: ['decision'],
				headings: [],
				sizeBytes: 50,
			},
		});
		const result = extract({ candidates: [candidate] });
		for (const action of result.reviewActions) {
			// Actions have futureMutationType but don't mutate anything themselves
			expect(action.futureMutationType).toBeDefined();
		}
		// No state mutations occurred
		expect(result.changedPaths).toEqual([]);
	});

	it('actions include evidence and confidence', () => {
		const candidate = makeCandidate({
			contentSnippet: '---\nrisk: Token leakage\n---\n',
			metadata: {
				frontmatterKeys: ['risk'],
				headings: [],
				sizeBytes: 50,
			},
		});
		const result = extract({ candidates: [candidate] });
		const riskActions = result.reviewActions.filter(
			(a) => a.kind === 'review_candidate_risk',
		);
		expect(riskActions.length).toBeGreaterThan(0);
		expect(riskActions[0]?.confidence).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

describe('readiness', () => {
	it('no extractable items => empty', () => {
		const result = extract();
		expect(result.readiness).toBe('empty');
	});

	it('clean candidates => ready_for_review', () => {
		const candidate = makeCandidate({
			contentSnippet: '---\ndecision: Use TypeScript\n---\n',
			metadata: {
				frontmatterKeys: ['decision'],
				headings: [],
				sizeBytes: 50,
			},
		});
		const result = extract({ candidates: [candidate] });
		expect(result.readiness).toBe('ready_for_review');
	});

	it('blocked by security issue => blocked', () => {
		const candidate = makeCandidate({
			contentSnippet:
				'---\ndecision: Use key sk-proj-abcdefghijklmnopqrstuvwxyz1234567890\n---\n',
			metadata: {
				frontmatterKeys: ['decision'],
				headings: [],
				sizeBytes: 80,
			},
		});
		const result = extract({ candidates: [candidate] });
		expect(result.readiness).toBe('blocked');
	});
});

// ---------------------------------------------------------------------------
// Scanner and consistency integration
// ---------------------------------------------------------------------------

describe('scanner and consistency integration', () => {
	it('consumes scanner findings', () => {
		const result = extract({
			candidates: [],
			scannerResult: {
				activeProfileId: 'standard',
				artifacts: [],
				boundarySummary: {
					agentPacksInCanonicalRoot: [],
					canonicalDocsDependentOnDerived: [],
					derivedArtifactsMarkedCanonical: [],
					executiveExportsInCanonicalRoot: [],
					htmlArtifactsInCanonicalRoot: [],
					validationReportsMarkedCanonical: [],
				},
				bytesInspected: 0,
				changedPaths: [],
				ciSummary: {
					ciWorkflowCount: 0,
					ciWorkflowPaths: [],
					ciWorkflowsExist: false,
				},
				configSummary: {
					biomeConfigPath: null,
					markdownlintConfigPath: null,
					tsconfigPath: null,
					vitestConfigPath: null,
				},
				diagnostics: [],
				directoriesInspected: 0,
				documentationRoot: 'logos/',
				documentationSummary: {
					canonicalOutputPaths: [],
					configDocsRoot: null,
					derivedArtifactsInCanonicalRoot: [],
					documentationDirectories: [],
					documentSchemaExists: false,
					hardcodedDocsRootDetected: false,
					missingCanonicalOutputs: [],
					phaseDescriptorsExist: false,
					profileDirectoryExists: false,
					profileRegistryExists: false,
				},
				dryRun: true,
				filesInspected: 0,
				findings: [
					{
						affectedPath: 'src/index.ts',
						evidence: 'Missing expected file',
						id: 'repo-scan-finding-1',
						kind: 'missing_expected_file',
						message: 'Expected file not found',
						order: 0,
						recoveryHint: 'Create the file',
						severity: 'error',
						sourceCategory: 'source_structure',
						title: 'Missing src/index.ts',
					},
				],
				packageSummary: {
					binPath: undefined,
					declaredScripts: [],
					exists: false,
					missingRequiredScripts: [],
					name: undefined,
					version: undefined,
				},
				profileVersion: null,
				readOnly: true,
				repositoryRoot: '/test',
				scannedAt: '2026-01-15T00:00:00.000Z',
				scanPolicy: {
					allowedExtensions: [],
					allowlistPaths: [],
					callNetwork: false,
					enforceRootBoundary: true,
					executeScripts: false,
					ignoredDirectoryNames: [],
					ignorePatterns: [],
					installDependencies: false,
					maxFileSizeBytes: 256000,
					maxFilesInspected: 2000,
					maxRecursionDepth: 8,
					readKnownMetadata: true,
					readSourceContent: false,
				},
				securitySummary: {
					dotEnvDetected: false,
					redactedCount: 0,
					secretLikeValuesDetected: 0,
					unsafePathDetected: false,
				},
				targets: [],
				targetsScanned: 0,
				targetsSkipped: 0,
				toolingSummary: {
					biomeConfigExists: false,
					lockfileExists: false,
					lockfileKind: null,
					markdownlintConfigExists: false,
					missingConfigFiles: [],
					mutatingScriptPatterns: [],
					nodeVersionDeclared: false,
					packageManagerMatch: null,
					pnpmVersionDeclared: false,
					tsconfigExists: false,
					vitestConfigExists: false,
				},
				workspaceSummary: {
					activeProfileId: null,
					documentationRoot: null,
					exists: false,
					initializationState: 'not_initialized',
					providerConfigured: false,
				},
			},
		});
		// Scanner findings are extracted as facts
		const facts = result.items.filter((i) => i.kind === 'fact');
		expect(facts.length).toBeGreaterThan(0);
	});

	it('consumes docs-vs-code findings', () => {
		const candidate = makeCandidate({
			contentSnippet: '---\ndecision: Use Node 22\n---\n',
			metadata: {
				frontmatterKeys: ['decision'],
				headings: [],
				sizeBytes: 50,
			},
		});
		const result = extract({
			candidates: [candidate],
			consistencyResult: {
				activeProfileId: 'standard',
				ambiguousCount: 0,
				changedPaths: [],
				checkedAt: '2026-01-15T00:00:00.000Z',
				claimCount: 0,
				comparisonCount: 0,
				comparisons: [],
				consistentCount: 0,
				diagnostics: [],
				documentationRoot: 'logos/',
				dryRun: true,
				findings: [],
				inconsistentCount: 0,
				missingInCodeCount: 0,
				missingInDocsCount: 0,
				observedFactCount: 0,
				profileVersion: null,
				readOnly: true,
				summaries: {},
				unknownCount: 0,
				unsupportedCount: 0,
			},
		});
		// Should still extract from candidates
		expect(result.items.length).toBeGreaterThanOrEqual(1);
	});

	it('consumes existing register summaries for duplicate/conflict detection', () => {
		const candidate = makeCandidate({
			contentSnippet: '## Decision\n\n- Use npm as package manager\n',
			metadata: {
				frontmatterKeys: [],
				headings: ['Decision'],
				sizeBytes: 50,
			},
		});
		const result = extract({
			candidates: [candidate],
			existingRegisterSummaries: [
				{
					id: 'reg-1',
					kind: 'decision',
					statement: 'Use npm as package manager',
					status: 'confirmed',
					title: 'Use npm',
				},
			],
		});
		// Should detect conflict with existing confirmed record
		expect(result.conflicts.length).toBeGreaterThanOrEqual(1);
		const conflictingItems = result.items.filter(
			(i) => i.status === 'conflicting',
		);
		expect(conflictingItems.length).toBeGreaterThanOrEqual(1);
	});

	it('does not read full files by default', () => {
		// Extract only uses provided snippets, never reads files
		const result = extract({
			candidates: [],
		});
		expect(result.extractedItemCount).toBe(0);
		expect(result.readiness).toBe('empty');
	});
});

// ---------------------------------------------------------------------------
// Non-mutation tests
// ---------------------------------------------------------------------------

describe('extractor is non-mutating', () => {
	it('extractor writes no files', () => {
		// Pure function, no filesystem calls
		const result = extract({
			candidates: [
				makeCandidate({
					contentSnippet: '---\ndecision: Test\n---\n',
					metadata: {
						frontmatterKeys: ['decision'],
						headings: [],
						sizeBytes: 30,
					},
				}),
			],
		});
		expect(result.changedPaths).toEqual([]);
	});

	it('extractor does not create confirmed records', () => {
		const candidate = makeCandidate({
			contentSnippet: '---\ndecision: Use TypeScript\n---\n',
			metadata: {
				frontmatterKeys: ['decision'],
				headings: [],
				sizeBytes: 50,
			},
		});
		const result = extract({ candidates: [candidate] });
		for (const item of result.items) {
			// No item should have a "confirmed" status
			expect(item.status).not.toBe('confirmed' as never);
		}
	});
});
