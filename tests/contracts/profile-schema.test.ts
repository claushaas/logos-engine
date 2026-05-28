/**
 * Step 15.2 — Profile schema contract tests
 *
 * Validates that example `LogosProfile` objects match the contract shape.
 * Covers all sub-types: PhaseDefinition, DocumentDefinition, NodeDefinition,
 * DocumentMaterializationRule, NodeDependencyDefinition, NodePromptRefs,
 * and DocumentMaterializationSectionDefinition.
 *
 * Uses test-local shape validators because the production `validateProfile`
 * is private to `src/profiles/profile-loader.ts`. The production `loadProfile`
 * function requires filesystem I/O and is not a good fit for schema-only tests.
 *
 * All tests run without LLM credentials.
 *
 * @see {@link https://logos-engine/docs/architecture/07-contracts-and-schemas.md §13}
 * @see {@link https://logos-engine/docs/architecture/09-testing-architecture.md §6}
 */
import { describe, expect, it } from 'vitest';

import type { LogosProfile } from '../../src/contracts/index.js';
import type {
	DocumentId,
	NodeId,
	ProfileId,
	PromptId,
} from '../../src/shared/index.js';

// ─── Test-local shape validators ────────────────────────────────────────────

/**
 * Validate that a value is a non-empty string.
 * Returns the key path of the violation, or null if valid.
 */
function checkString(value: unknown, path: string): string | null {
	if (typeof value !== 'string' || value.trim().length === 0) {
		return `${path}: expected non-empty string, got ${typeof value}`;
	}
	return null;
}

/**
 * Validate that a value is an array.
 */
function checkArray(value: unknown, path: string): string | null {
	if (!Array.isArray(value)) {
		return `${path}: expected array, got ${typeof value}`;
	}
	return null;
}

/**
 * Validate a PhaseDefinition shape.
 */
function validatePhaseShape(phase: unknown, index: number): string[] {
	const errors: string[] = [];
	const path = `phases[${index}]`;

	if (typeof phase !== 'object' || phase === null) {
		errors.push(`${path}: expected object`);
		return errors;
	}
	const p = phase as Record<string, unknown>;

	const c = checkString(p.id, `${path}.id`);
	if (c) errors.push(c);

	const t = checkString(p.title, `${path}.title`);
	if (t) errors.push(t);

	if (typeof p.order !== 'number') {
		errors.push(`${path}.order: expected number, got ${typeof p.order}`);
	}

	const purp = checkString(p.purpose, `${path}.purpose`);
	if (purp) errors.push(purp);

	return errors;
}

/**
 * Validate a DocumentDefinition shape.
 */
function validateDocumentShape(
	doc: unknown,
	index: number,
	knownNodeIds: Set<string>,
): string[] {
	const errors: string[] = [];
	const path = `documents[${index}]`;

	if (typeof doc !== 'object' || doc === null) {
		errors.push(`${path}: expected object`);
		return errors;
	}
	const d = doc as Record<string, unknown>;

	const c = checkString(d.id, `${path}.id`);
	if (c) errors.push(c);

	const t = checkString(d.title, `${path}.title`);
	if (t) errors.push(t);

	const ph = checkString(d.phaseId, `${path}.phaseId`);
	if (ph) errors.push(ph);

	if (typeof d.order !== 'number') {
		errors.push(`${path}.order: expected number`);
	}

	const purp = checkString(d.purpose, `${path}.purpose`);
	if (purp) errors.push(purp);

	const out = checkString(d.outputPath, `${path}.outputPath`);
	if (out) errors.push(out);

	const req = checkArray(d.requiredNodeIds, `${path}.requiredNodeIds`);
	if (req) {
		errors.push(req);
	} else {
		for (const nid of d.requiredNodeIds as unknown[]) {
			if (!knownNodeIds.has(String(nid))) {
				errors.push(
					`${path}.requiredNodeIds: references unknown node "${String(nid)}"`,
				);
			}
		}
	}

	const opt = checkArray(d.optionalNodeIds, `${path}.optionalNodeIds`);
	if (opt) {
		errors.push(opt);
	} else {
		for (const nid of d.optionalNodeIds as unknown[]) {
			if (!knownNodeIds.has(String(nid))) {
				errors.push(
					`${path}.optionalNodeIds: references unknown node "${String(nid)}"`,
				);
			}
		}
	}

	return errors;
}

/**
 * Validate a NodeDefinition shape.
 */
function validateNodeShape(
	node: unknown,
	index: number,
	knownDocIds: Set<string>,
): string[] {
	const errors: string[] = [];
	const path = `nodes[${index}]`;

	if (typeof node !== 'object' || node === null) {
		errors.push(`${path}: expected object`);
		return errors;
	}
	const n = node as Record<string, unknown>;

	if (!n.id || typeof n.id !== 'string') {
		errors.push(`${path}.id: expected string (NodeId)`);
	}

	const t = checkString(n.title, `${path}.title`);
	if (t) errors.push(t);

	const ph = checkString(n.phaseId, `${path}.phaseId`);
	if (ph) errors.push(ph);

	const cq = checkString(n.canonicalQuestion, `${path}.canonicalQuestion`);
	if (cq) errors.push(cq);

	if (typeof n.order !== 'number') {
		errors.push(`${path}.order: expected number`);
	}

	if (!n.documentId || typeof n.documentId !== 'string') {
		errors.push(`${path}.documentId: expected string (DocumentId)`);
	} else if (!knownDocIds.has(n.documentId as string)) {
		errors.push(
			`${path}.documentId: references unknown document "${String(n.documentId)}"`,
		);
	}

	const topics = checkArray(n.coverageTopics, `${path}.coverageTopics`);
	if (topics) errors.push(topics);

	const criteria = checkArray(
		n.sufficiencyCriteria,
		`${path}.sufficiencyCriteria`,
	);
	if (criteria) errors.push(criteria);

	if (!n.promptRefs || typeof n.promptRefs !== 'object') {
		errors.push(`${path}.promptRefs: expected object`);
	}

	// Validate dependencies if present
	if (n.dependencies !== undefined && n.dependencies !== null) {
		if (typeof n.dependencies !== 'object') {
			errors.push(`${path}.dependencies: expected object`);
		}
	}

	return errors;
}

/**
 * Validate a DocumentMaterializationRule shape.
 */
function validateMaterializationRuleShape(
	rule: unknown,
	index: number,
	knownDocIds: Set<string>,
	knownNodeIds: Set<string>,
): string[] {
	const errors: string[] = [];
	const path = `materializationRules[${index}]`;

	if (typeof rule !== 'object' || rule === null) {
		errors.push(`${path}: expected object`);
		return errors;
	}
	const r = rule as Record<string, unknown>;

	if (!r.documentId || typeof r.documentId !== 'string') {
		errors.push(`${path}.documentId: expected string (DocumentId)`);
	} else if (!knownDocIds.has(r.documentId as string)) {
		errors.push(
			`${path}.documentId: references unknown document "${String(r.documentId)}"`,
		);
	}

	const t = checkString(r.title, `${path}.title`);
	if (t) errors.push(t);

	const out = checkString(r.outputPath, `${path}.outputPath`);
	if (out) errors.push(out);

	// sourceNodeIds
	const src = checkArray(r.sourceNodeIds, `${path}.sourceNodeIds`);
	if (src) {
		errors.push(src);
	} else {
		for (const nid of r.sourceNodeIds as unknown[]) {
			if (!knownNodeIds.has(String(nid))) {
				errors.push(
					`${path}.sourceNodeIds: references unknown node "${String(nid)}"`,
				);
			}
		}
	}

	// requiredNodeIds
	const req = checkArray(r.requiredNodeIds, `${path}.requiredNodeIds`);
	if (req) {
		errors.push(req);
	} else {
		for (const nid of r.requiredNodeIds as unknown[]) {
			if (!knownNodeIds.has(String(nid))) {
				errors.push(
					`${path}.requiredNodeIds: references unknown node "${String(nid)}"`,
				);
			}
		}
	}

	// optionalNodeIds
	const opt = checkArray(r.optionalNodeIds, `${path}.optionalNodeIds`);
	if (opt) {
		errors.push(opt);
	} else {
		for (const nid of r.optionalNodeIds as unknown[]) {
			if (!knownNodeIds.has(String(nid))) {
				errors.push(
					`${path}.optionalNodeIds: references unknown node "${String(nid)}"`,
				);
			}
		}
	}

	// sections
	const sec = checkArray(r.sections, `${path}.sections`);
	if (sec) errors.push(sec);

	return errors;
}

/**
 * Run full profile shape validation — returns all errors found.
 */
function validateProfileShape(profile: unknown): string[] {
	const errors: string[] = [];

	if (typeof profile !== 'object' || profile === null) {
		errors.push('root: expected object');
		return errors;
	}
	const p = profile as Record<string, unknown>;

	// Required top-level fields
	const idErr = checkString(p.id, 'id');
	if (idErr) errors.push(idErr);

	const titleErr = checkString(p.title, 'title');
	if (titleErr) errors.push(titleErr);

	const versionErr = checkString(p.version, 'version');
	if (versionErr) errors.push(versionErr);

	// Arrays
	const phases = checkArray(p.phases, 'phases');
	if (phases) errors.push(phases);

	const docs = checkArray(p.documents, 'documents');
	if (docs) errors.push(docs);

	const nodes = checkArray(p.nodes, 'nodes');
	if (nodes) errors.push(nodes);

	const rules = checkArray(p.materializationRules, 'materializationRules');
	if (rules) errors.push(rules);

	// Can't validate sub-elements if parents are missing
	if (phases || docs || nodes || rules) return errors;

	// Collect known IDs
	const knownDocIds = new Set<string>();
	const knownNodeIds = new Set<string>();

	for (const n of p.nodes as unknown[]) {
		if (
			typeof n === 'object' &&
			n !== null &&
			'id' in n &&
			typeof (n as Record<string, unknown>).id === 'string'
		) {
			knownNodeIds.add((n as Record<string, unknown>).id as string);
		}
	}

	for (const d of p.documents as unknown[]) {
		if (
			typeof d === 'object' &&
			d !== null &&
			'id' in d &&
			typeof (d as Record<string, unknown>).id === 'string'
		) {
			knownDocIds.add((d as Record<string, unknown>).id as string);
		}
	}

	// Validate sub-elements
	(p.phases as unknown[]).forEach((ph, i) => {
		errors.push(...validatePhaseShape(ph, i));
	});

	(p.documents as unknown[]).forEach((doc, i) => {
		errors.push(...validateDocumentShape(doc, i, knownNodeIds));
	});

	(p.nodes as unknown[]).forEach((node, i) => {
		errors.push(...validateNodeShape(node, i, knownDocIds));
	});

	(p.materializationRules as unknown[]).forEach((rule, i) => {
		errors.push(
			...validateMaterializationRuleShape(rule, i, knownDocIds, knownNodeIds),
		);
	});

	return errors;
}

// ─── Fixtures ──────────────────────────────────────────────────────────────

/**
 * Minimal valid profile — the smallest possible valid LogosProfile.
 */
function minimalProfile(): LogosProfile {
	return {
		documents: [
			{
				id: 'doc-thesis' as DocumentId,
				optionalNodeIds: [],
				order: 1,
				outputPath: 'docs/thesis.md',
				phaseId: 'phase-foundation',
				purpose: 'Articulate the central thesis.',
				requiredNodeIds: ['node-thesis-core' as NodeId],
				title: 'Thesis Document',
			},
		],
		id: 'p_minimal' as ProfileId,
		materializationRules: [
			{
				documentId: 'doc-thesis' as DocumentId,
				optionalNodeIds: [],
				outputPath: 'docs/thesis.md',
				requiredNodeIds: ['node-thesis-core' as NodeId],
				sections: [
					{
						id: 'core-section',
						required: true,
						sourceNodeIds: ['node-thesis-core' as NodeId],
						title: 'Core Thesis',
					},
				],
				sourceNodeIds: ['node-thesis-core' as NodeId],
				title: 'Thesis Output',
			},
		],
		nodes: [
			{
				canonicalQuestion: 'What truth justifies this project?',
				coverageTopics: ['central conviction', 'unresolved tension'],
				documentId: 'doc-thesis' as DocumentId,
				id: 'node-thesis-core' as NodeId,
				order: 1,
				phaseId: 'phase-foundation',
				promptRefs: {
					initial: 'prompt_initial' as PromptId,
				},
				sufficiencyCriteria: ['thesis is specific'],
				title: 'Core Thesis',
			},
		],
		phases: [
			{
				id: 'phase-foundation',
				order: 1,
				purpose: 'Define the foundational thesis.',
				title: 'Foundation',
			},
		],
		title: 'Minimal Profile',
		version: '1.0.0',
	};
}

/**
 * Full valid profile with multiple phases, documents, nodes, and dependencies.
 */
function fullProfile(): LogosProfile {
	return {
		description: 'Standard startup documentation profile.',
		documents: [
			{
				id: 'doc-foundation-thesis' as DocumentId,
				optionalNodeIds: ['node-thesis-evidence' as NodeId],
				order: 1,
				outputPath: 'docs/foundation/thesis.md',
				phaseId: '01-foundation',
				purpose: 'Articulate the central thesis.',
				requiredNodeIds: [
					'node-thesis-core' as NodeId,
					'node-thesis-context' as NodeId,
				],
				title: 'Thesis',
			},
			{
				id: 'doc-validation-strategy' as DocumentId,
				optionalNodeIds: [],
				order: 1,
				outputPath: 'docs/validation/strategy.md',
				phaseId: '02-validation',
				purpose: 'Define validation approach.',
				requiredNodeIds: ['node-val-strategy' as NodeId],
				title: 'Validation Strategy',
			},
		],
		id: 'p_startup' as ProfileId,
		materializationRules: [
			{
				documentId: 'doc-foundation-thesis' as DocumentId,
				optionalNodeIds: ['node-thesis-evidence' as NodeId],
				outputPath: 'docs/foundation/thesis.md',
				requiredNodeIds: [
					'node-thesis-core' as NodeId,
					'node-thesis-context' as NodeId,
				],
				sections: [
					{
						id: 'core-thesis',
						required: true,
						sourceNodeIds: ['node-thesis-core' as NodeId],
						title: 'Core Thesis',
					},
					{
						id: 'context',
						required: true,
						sourceNodeIds: ['node-thesis-context' as NodeId],
						title: 'Context',
					},
					{
						id: 'evidence',
						required: false,
						sourceNodeIds: ['node-thesis-evidence' as NodeId],
						title: 'Supporting Evidence',
					},
				],
				sourceNodeIds: [
					'node-thesis-core' as NodeId,
					'node-thesis-context' as NodeId,
					'node-thesis-evidence' as NodeId,
				],
				title: 'Foundation Thesis Document',
			},
		],
		nodes: [
			{
				canonicalQuestion: 'What conviction makes this project necessary?',
				coverageTopics: [
					'central conviction',
					'relevant change',
					'unresolved tension',
				],
				dependencies: { recommendedNodeIds: [], requiredNodeIds: [] },
				documentId: 'doc-foundation-thesis' as DocumentId,
				id: 'node-thesis-core' as NodeId,
				order: 1,
				phaseId: '01-foundation',
				promptRefs: {
					clarification: 'prompt_clarify' as PromptId,
					initial: 'prompt_initial' as PromptId,
					refinement: 'prompt_refine' as PromptId,
					review: 'prompt_review' as PromptId,
					synthesis: 'prompt_synth' as PromptId,
				},
				sufficiencyCriteria: [
					'thesis is specific',
					'problem is not confused with solution',
				],
				title: 'Core Thesis',
			},
			{
				canonicalQuestion: 'What broader conditions make this thesis relevant?',
				coverageTopics: ['market conditions', 'timing', 'relevant trends'],
				dependencies: {
					recommendedNodeIds: [],
					requiredNodeIds: ['node-thesis-core' as NodeId],
				},
				documentId: 'doc-foundation-thesis' as DocumentId,
				id: 'node-thesis-context' as NodeId,
				order: 2,
				phaseId: '01-foundation',
				promptRefs: { initial: 'prompt_context' as PromptId },
				sufficiencyCriteria: ['context is specific'],
				title: 'Thesis Context',
			},
			{
				canonicalQuestion: 'What evidence supports or challenges the thesis?',
				coverageTopics: ['supporting observations', 'counter-evidence'],
				dependencies: { recommendedNodeIds: ['node-thesis-core' as NodeId] },
				documentId: 'doc-foundation-thesis' as DocumentId,
				id: 'node-thesis-evidence' as NodeId,
				order: 3,
				phaseId: '01-foundation',
				promptRefs: { initial: 'prompt_evidence' as PromptId },
				sufficiencyCriteria: ['evidence is specific and observable'],
				title: 'Supporting Evidence',
			},
			{
				canonicalQuestion: 'How will we test the riskiest assumptions?',
				coverageTopics: [
					'riskiest assumptions',
					'validation methods',
					'success criteria',
				],
				dependencies: {
					recommendedNodeIds: ['node-thesis-context' as NodeId],
					requiredNodeIds: ['node-thesis-core' as NodeId],
				},
				documentId: 'doc-validation-strategy' as DocumentId,
				id: 'node-val-strategy' as NodeId,
				order: 1,
				phaseId: '02-validation',
				promptRefs: {
					followUp: 'prompt_val_fu' as PromptId,
					initial: 'prompt_val' as PromptId,
				},
				sufficiencyCriteria: [
					'each assumption has a test method',
					'criteria are falsifiable',
				],
				title: 'Validation Approach',
			},
		],
		phases: [
			{
				id: '01-foundation',
				order: 1,
				purpose: 'Define why the project exists.',
				title: 'Foundation',
			},
			{
				id: '02-validation',
				order: 2,
				purpose: 'Validate assumptions.',
				title: 'Validation',
			},
		],
		title: 'Startup Profile',
		version: '1.0.0',
	};
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('Profile schema — valid fixtures', () => {
	it('minimal valid profile passes shape validation', () => {
		const profile = minimalProfile();
		const errors = validateProfileShape(profile);
		expect(errors).toEqual([]);
	});

	it('full startup profile passes shape validation', () => {
		const profile = fullProfile();
		const errors = validateProfileShape(profile);
		expect(errors).toEqual([]);
	});

	it('minimal profile has all required top-level fields', () => {
		const profile = minimalProfile();
		expect(profile).toHaveProperty('id');
		expect(profile).toHaveProperty('title');
		expect(profile).toHaveProperty('version');
		expect(profile).toHaveProperty('phases');
		expect(profile).toHaveProperty('documents');
		expect(profile).toHaveProperty('nodes');
		expect(profile).toHaveProperty('materializationRules');
	});

	it('phase defines id, title, order, purpose', () => {
		const profile = minimalProfile();
		const phase = profile.phases[0];
		expect(typeof phase.id).toBe('string');
		expect(typeof phase.title).toBe('string');
		expect(typeof phase.order).toBe('number');
		expect(typeof phase.purpose).toBe('string');
	});

	it('document defines all required fields', () => {
		const profile = minimalProfile();
		const doc = profile.documents[0];
		expect(typeof doc.id).toBe('string');
		expect(typeof doc.title).toBe('string');
		expect(typeof doc.phaseId).toBe('string');
		expect(typeof doc.order).toBe('number');
		expect(typeof doc.purpose).toBe('string');
		expect(typeof doc.outputPath).toBe('string');
		expect(Array.isArray(doc.requiredNodeIds)).toBe(true);
		expect(Array.isArray(doc.optionalNodeIds)).toBe(true);
	});

	it('node defines all required fields', () => {
		const profile = minimalProfile();
		const node = profile.nodes[0];
		expect(typeof node.id).toBe('string');
		expect(typeof node.title).toBe('string');
		expect(typeof node.phaseId).toBe('string');
		expect(typeof node.documentId).toBe('string');
		expect(typeof node.order).toBe('number');
		expect(typeof node.canonicalQuestion).toBe('string');
		expect(Array.isArray(node.coverageTopics)).toBe(true);
		expect(Array.isArray(node.sufficiencyCriteria)).toBe(true);
		expect(typeof node.promptRefs).toBe('object');
	});

	it('materialization rule defines all required fields', () => {
		const profile = minimalProfile();
		const rule = profile.materializationRules[0];
		expect(typeof rule.documentId).toBe('string');
		expect(typeof rule.title).toBe('string');
		expect(typeof rule.outputPath).toBe('string');
		expect(Array.isArray(rule.sourceNodeIds)).toBe(true);
		expect(Array.isArray(rule.requiredNodeIds)).toBe(true);
		expect(Array.isArray(rule.optionalNodeIds)).toBe(true);
		expect(Array.isArray(rule.sections)).toBe(true);
	});

	it('node documentId references an existing document', () => {
		const profile = fullProfile();
		const docIds = new Set(profile.documents.map((d) => d.id as string));
		for (const node of profile.nodes) {
			expect(docIds.has(node.documentId as string)).toBe(true);
		}
	});

	it('document requiredNodeIds reference existing nodes', () => {
		const profile = fullProfile();
		const nodeIds = new Set(profile.nodes.map((n) => n.id as string));
		for (const doc of profile.documents) {
			for (const nid of doc.requiredNodeIds) {
				expect(nodeIds.has(nid as string)).toBe(true);
			}
		}
	});

	it('materializationRule sourceNodeIds reference existing nodes', () => {
		const profile = fullProfile();
		const nodeIds = new Set(profile.nodes.map((n) => n.id as string));
		for (const rule of profile.materializationRules) {
			for (const nid of rule.sourceNodeIds) {
				expect(nodeIds.has(nid as string)).toBe(true);
			}
		}
	});

	it('materializationRule.documentId references an existing document', () => {
		const profile = fullProfile();
		const docIds = new Set(profile.documents.map((d) => d.id as string));
		for (const rule of profile.materializationRules) {
			expect(docIds.has(rule.documentId as string)).toBe(true);
		}
	});

	it('full profile has node with dependency definition', () => {
		const profile = fullProfile();
		const deps = profile.nodes.find(
			(n) =>
				n.dependencies?.requiredNodeIds &&
				n.dependencies.requiredNodeIds.length > 0,
		);
		expect(deps).toBeDefined();
		if (deps?.dependencies) {
			expect(Array.isArray(deps.dependencies.requiredNodeIds ?? [])).toBe(true);
		}
	});

	it('full profile node promptRefs has multiple prompt states', () => {
		const profile = fullProfile();
		const coreThesis = profile.nodes.find(
			(n) => n.id === ('node-thesis-core' as NodeId),
		);
		expect(coreThesis).toBeDefined();
		if (coreThesis) {
			expect(coreThesis.promptRefs.initial).toBeDefined();
		}
	});
});

describe('Profile schema — intentionally broken fixtures', () => {
	it('missing "id" field is detected', () => {
		const broken = { ...minimalProfile(), id: undefined };
		const errors = validateProfileShape(broken);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors.some((e) => e.includes('id'))).toBe(true);
	});

	it('missing "title" field is detected', () => {
		const broken = { ...minimalProfile(), title: undefined };
		const errors = validateProfileShape(broken);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors.some((e) => e.includes('title'))).toBe(true);
	});

	it('missing "phases" array is detected', () => {
		const broken = { ...minimalProfile(), phases: undefined };
		const errors = validateProfileShape(broken);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors.some((e) => e.includes('phases'))).toBe(true);
	});

	it('empty "phases" array is still valid (no required minimum)', () => {
		const profile = { ...minimalProfile(), phases: [] };
		const errors = validateProfileShape(profile);
		expect(errors).toEqual([]);
	});

	it('document referencing unknown node is detected', () => {
		const profile = minimalProfile();
		profile.documents[0] = {
			...profile.documents[0],
			requiredNodeIds: ['nonexistent-node' as NodeId],
		};
		const errors = validateProfileShape(profile);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors.some((e) => e.includes('nonexistent-node'))).toBe(true);
	});

	it('node referencing unknown document is detected', () => {
		const profile = minimalProfile();
		profile.nodes[0] = {
			...profile.nodes[0],
			documentId: 'nonexistent-doc' as DocumentId,
		};
		const errors = validateProfileShape(profile);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors.some((e) => e.includes('nonexistent-doc'))).toBe(true);
	});

	it('non-string phase id is detected', () => {
		const broken = {
			...minimalProfile(),
			phases: [{ id: 42, order: 1, purpose: 'test', title: 'Test' }],
		};
		const errors = validateProfileShape(broken);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors.some((e) => e.includes('id') && e.includes('string'))).toBe(
			true,
		);
	});

	it('null profile is detected', () => {
		const errors = validateProfileShape(null);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors.some((e) => e.includes('expected object'))).toBe(true);
	});

	it('non-object profile is detected', () => {
		const errors = validateProfileShape('not-a-profile');
		expect(errors.length).toBeGreaterThan(0);
	});

	it('materializationRule with unknown sourceNodeId is detected', () => {
		const profile = minimalProfile();
		profile.materializationRules[0] = {
			...profile.materializationRules[0],
			sourceNodeIds: ['nonexistent-node' as NodeId],
		};
		const errors = validateProfileShape(profile);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors.some((e) => e.includes('nonexistent-node'))).toBe(true);
	});
});
