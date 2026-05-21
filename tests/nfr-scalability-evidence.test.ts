/**
 * NFR Scalability Evidence Tests
 *
 * Phase 8: NFR Evidence And Release Hardening
 */

import { describe, expect, it } from 'vitest';
import { runScalabilityEvidence } from '../src/evidence/scalability-evidence.js';

/**
 * Generate a large array of deterministic items for scale testing.
 */
function generateScaleItems(count: number, prefix: string) {
	return Array.from({ length: count }, (_, i) => ({
		affectedDocuments: [`doc-${i % 28}`, `doc-${(i + 1) % 28}`],
		createdAt: new Date(2025, 0, 1, 0, 0, 0, i).toISOString(),
		dependencies: i > 0 ? [`${prefix}-${i - 1}`] : [],
		id: `${prefix}-${i}`,
		index: i,
		source: i % 2 === 0 ? 'user' : 'ai',
		statement: `${prefix} item number ${i} with some descriptive text to simulate real content that would be present in a project workspace.`,
		status: i % 4 === 0 ? 'confirmed' : i % 4 === 1 ? 'proposed' : 'assumed',
	}));
}

describe('Scalability Evidence', () => {
	it('produces evidence for hundreds of decisions', () => {
		const decisions = generateScaleItems(500, 'decision');
		const items = runScalabilityEvidence({
			_injectScaleData: { decisions },
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const decItem = items.find((i) => i.id === 'scale-decisions');
		expect(decItem).toBeDefined();
		expect(decItem?.status).toBe('pass');
		expect(decItem?.summary).toContain('500');
		expect(decItem?.nfrIds).toContain('NFR-SCAL-003');
	});

	it('produces evidence for hundreds of assumptions', () => {
		const assumptions = generateScaleItems(500, 'assumption');
		const items = runScalabilityEvidence({
			_injectScaleData: { assumptions },
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const asmItem = items.find((i) => i.id === 'scale-assumptions');
		expect(asmItem).toBeDefined();
		expect(asmItem?.status).toBe('pass');
		expect(asmItem?.summary).toContain('500');
	});

	it('produces evidence for hundreds of open questions', () => {
		const openQuestions = generateScaleItems(500, 'question');
		const items = runScalabilityEvidence({
			_injectScaleData: { openQuestions },
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const qItem = items.find((i) => i.id === 'scale-openQuestions');
		expect(qItem).toBeDefined();
		expect(qItem?.status).toBe('pass');
	});

	it('produces evidence for hundreds of risks', () => {
		const risks = generateScaleItems(500, 'risk');
		const items = runScalabilityEvidence({
			_injectScaleData: { risks },
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const riskItem = items.find((i) => i.id === 'scale-risks');
		expect(riskItem).toBeDefined();
		expect(riskItem?.status).toBe('pass');
	});

	it('produces evidence for hundreds of proposals', () => {
		const proposals = generateScaleItems(500, 'proposal');
		const items = runScalabilityEvidence({
			_injectScaleData: { proposals },
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const propItem = items.find((i) => i.id === 'scale-proposals');
		expect(propItem).toBeDefined();
		expect(propItem?.status).toBe('pass');
	});

	it('produces evidence for many artifacts', () => {
		const artifacts = generateScaleItems(200, 'artifact');
		const items = runScalabilityEvidence({
			_injectScaleData: { artifacts },
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const artItem = items.find((i) => i.id === 'scale-artifacts');
		expect(artItem).toBeDefined();
		expect(artItem?.status).toBe('pass');
		expect(artItem?.summary).toContain('200');
	});

	it('produces evidence for many diagnostic findings', () => {
		const findings = generateScaleItems(300, 'finding');
		const items = runScalabilityEvidence({
			_injectScaleData: { findings },
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const findItem = items.find((i) => i.id === 'scale-findings');
		expect(findItem).toBeDefined();
		expect(findItem?.status).toBe('pass');
		expect(findItem?.summary).toContain('300');
	});

	it('produces evidence for standard profile document tree', () => {
		const items = runScalabilityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const treeItem = items.find((i) => i.id === 'scale-standard-profile-tree');
		expect(treeItem).toBeDefined();
		expect(treeItem?.status).toBe('pass');
		expect(treeItem?.nfrIds).toContain('NFR-SCAL-002');
	});

	it('report includes Standard profile tree scalability', () => {
		const items = runScalabilityEvidence();
		const profileItem = items.find(
			(i) => i.id === 'scale-standard-profile-tree',
		);
		expect(profileItem).toBeDefined();
	});

	it('warns when scale data is below threshold', () => {
		const decisions = generateScaleItems(50, 'decision'); // Only 50 items
		const items = runScalabilityEvidence({
			_injectScaleData: { decisions },
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const decItem = items.find((i) => i.id === 'scale-decisions');
		expect(decItem).toBeDefined();
		expect(decItem?.status).toBe('pass_with_warnings');
		expect(decItem?.diagnostics.length).toBeGreaterThan(0);
	});

	it('items are deterministic for same input', () => {
		const decisions = generateScaleItems(100, 'decision');
		const run1 = runScalabilityEvidence({
			_injectScaleData: { decisions },
			checkedAt: '2025-01-01T00:00:00.000Z',
		});
		const run2 = runScalabilityEvidence({
			_injectScaleData: { decisions },
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		expect(run1).toEqual(run2);
	});
});
