/**
 * Tests for the Startup sample profile — validates that
 * `profiles/startup.yml` can be loaded without errors and
 * has the expected structure.
 */
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadProfile } from '../../src/profiles/index.js';

const STARTUP_PROFILE_PATH = resolve(process.cwd(), 'profiles/startup.yml');

describe('Startup sample profile', () => {
	it('loads without errors', () => {
		const result = loadProfile(STARTUP_PROFILE_PATH);

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error(
				`Failed to load startup profile: ${result.error.message}`,
			);
		}
	});

	it('has the correct identity', () => {
		const result = loadProfile(STARTUP_PROFILE_PATH);
		if (!result.ok) throw new Error('Expected ok');

		expect(result.value.id).toBe('startup');
		expect(result.value.title).toBe('Startup Documentation');
		expect(result.value.version).toBe('1.0.0');
		expect(result.value.description).toBeTruthy();
	});

	it('has exactly 3 phases', () => {
		const result = loadProfile(STARTUP_PROFILE_PATH);
		if (!result.ok) throw new Error('Expected ok');

		expect(result.value.phases).toHaveLength(3);

		const phaseIds = result.value.phases.map((p) => p.id);
		expect(phaseIds).toContain('01-foundation');
		expect(phaseIds).toContain('02-validation');
		expect(phaseIds).toContain('03-product');

		// Phases are in order
		expect(result.value.phases[0]?.id).toBe('01-foundation');
		expect(result.value.phases[1]?.id).toBe('02-validation');
		expect(result.value.phases[2]?.id).toBe('03-product');
	});

	it('has exactly 6 documents (2 per phase)', () => {
		const result = loadProfile(STARTUP_PROFILE_PATH);
		if (!result.ok) throw new Error('Expected ok');

		expect(result.value.documents).toHaveLength(6);

		const foundationDocs = result.value.documents.filter(
			(d) => d.phaseId === '01-foundation',
		);
		const validationDocs = result.value.documents.filter(
			(d) => d.phaseId === '02-validation',
		);
		const productDocs = result.value.documents.filter(
			(d) => d.phaseId === '03-product',
		);

		expect(foundationDocs).toHaveLength(2);
		expect(validationDocs).toHaveLength(2);
		expect(productDocs).toHaveLength(2);
	});

	it('has exactly 12 nodes', () => {
		const result = loadProfile(STARTUP_PROFILE_PATH);
		if (!result.ok) throw new Error('Expected ok');

		expect(result.value.nodes).toHaveLength(12);
	});

	it('every node has a canonical question, coverage topics, sufficiency criteria, and prompt refs', () => {
		const result = loadProfile(STARTUP_PROFILE_PATH);
		if (!result.ok) throw new Error('Expected ok');

		for (const node of result.value.nodes) {
			expect(node.canonicalQuestion).toBeTruthy();
			expect(node.canonicalQuestion.length).toBeGreaterThan(10);
			expect(node.coverageTopics.length).toBeGreaterThan(0);
			expect(node.sufficiencyCriteria.length).toBeGreaterThan(0);
			expect(node.promptRefs).toBeDefined();
			expect(Object.keys(node.promptRefs).length).toBeGreaterThan(0);
		}
	});

	it('every node references an existing document', () => {
		const result = loadProfile(STARTUP_PROFILE_PATH);
		if (!result.ok) throw new Error('Expected ok');

		const docIds = new Set(result.value.documents.map((d) => d.id));

		for (const node of result.value.nodes) {
			expect(docIds.has(node.documentId)).toBe(true);
		}
	});

	it('every document references existing nodes', () => {
		const result = loadProfile(STARTUP_PROFILE_PATH);
		if (!result.ok) throw new Error('Expected ok');

		const nodeIds = new Set(result.value.nodes.map((n) => n.id));

		for (const doc of result.value.documents) {
			for (const requiredId of doc.requiredNodeIds) {
				expect(nodeIds.has(requiredId)).toBe(true);
			}
		}
	});

	it('has materialization rules for all 6 documents', () => {
		const result = loadProfile(STARTUP_PROFILE_PATH);
		if (!result.ok) throw new Error('Expected ok');

		expect(result.value.materializationRules).toHaveLength(6);

		const docIds = new Set(result.value.documents.map((d) => d.id));
		const ruleDocIds = new Set(
			result.value.materializationRules.map((r) => r.documentId),
		);

		expect(ruleDocIds).toEqual(docIds);
	});

	it('every materialization rule has requiredNodeIds as subset of sourceNodeIds', () => {
		const result = loadProfile(STARTUP_PROFILE_PATH);
		if (!result.ok) throw new Error('Expected ok');

		for (const rule of result.value.materializationRules) {
			const sourceSet = new Set(rule.sourceNodeIds);
			for (const requiredId of rule.requiredNodeIds) {
				expect(sourceSet.has(requiredId)).toBe(true);
			}
		}
	});

	it('every materialization rule section references existing nodes', () => {
		const result = loadProfile(STARTUP_PROFILE_PATH);
		if (!result.ok) throw new Error('Expected ok');

		const nodeIds = new Set(result.value.nodes.map((n) => n.id));

		for (const rule of result.value.materializationRules) {
			for (const section of rule.sections) {
				for (const snId of section.sourceNodeIds) {
					expect(nodeIds.has(snId)).toBe(true);
				}
			}
		}
	});

	it('has dependency declarations where specified', () => {
		const result = loadProfile(STARTUP_PROFILE_PATH);
		if (!result.ok) throw new Error('Expected ok');

		// Nodes that should have dependencies
		const nodeMap = new Map(result.value.nodes.map((n) => [n.id, n]));

		const coreAssumptions = nodeMap.get('validation.assumptions.core');
		expect(coreAssumptions?.dependencies?.requiredNodeIds).toContain(
			'foundation.thesis.core',
		);

		const risks = nodeMap.get('validation.assumptions.risks');
		expect(risks?.dependencies?.requiredNodeIds).toContain(
			'validation.assumptions.core',
		);

		const productPromise = nodeMap.get('product.brief.promise');
		expect(productPromise?.dependencies?.requiredNodeIds).toContain(
			'foundation.thesis.core',
		);

		const mvpScope = nodeMap.get('product.brief.mvp_scope');
		expect(mvpScope?.dependencies?.requiredNodeIds).toContain(
			'product.brief.promise',
		);

		const journey = nodeMap.get('product.experience.journey');
		expect(journey?.dependencies?.requiredNodeIds).toContain(
			'product.brief.promise',
		);

		const criteria = nodeMap.get('product.experience.criteria');
		expect(criteria?.dependencies?.requiredNodeIds).toContain(
			'product.experience.journey',
		);
	});

	it('has an acyclic dependency graph', () => {
		const result = loadProfile(STARTUP_PROFILE_PATH);
		if (!result.ok) throw new Error('Expected ok');

		// Build adjacency list
		const adj = new Map<string, Set<string>>();
		for (const node of result.value.nodes) {
			if (!adj.has(node.id)) adj.set(node.id, new Set());
			const deps = node.dependencies?.requiredNodeIds ?? [];
			adj.set(node.id, new Set(deps));
		}

		// DFS cycle detection
		const WHITE = 0;
		const GRAY = 1;
		const BLACK = 2;
		const color = new Map<string, number>();
		for (const nodeId of adj.keys()) {
			color.set(nodeId, WHITE);
		}

		function dfs(u: string): boolean {
			color.set(u, GRAY);
			for (const v of adj.get(u) ?? new Set()) {
				const cv = color.get(v) ?? WHITE;
				if (cv === GRAY) return true; // cycle
				if (cv === WHITE) {
					if (dfs(v)) return true;
				}
			}
			color.set(u, BLACK);
			return false;
		}

		for (const nodeId of adj.keys()) {
			if (color.get(nodeId) === WHITE) {
				expect(dfs(nodeId)).toBe(false);
			}
		}
	});

	it('has no isolated nodes (every node belongs to a document)', () => {
		const result = loadProfile(STARTUP_PROFILE_PATH);
		if (!result.ok) throw new Error('Expected ok');

		// Every node is referenced by at least one document or materialization rule
		const nodeIds = new Set(result.value.nodes.map((n) => n.id));

		const referencedIds = new Set<string>();
		for (const doc of result.value.documents) {
			for (const id of doc.requiredNodeIds) referencedIds.add(id);
			for (const id of doc.optionalNodeIds) referencedIds.add(id);
		}

		for (const nodeId of nodeIds) {
			expect(referencedIds.has(nodeId)).toBe(true);
		}
	});
});
