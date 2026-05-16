import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	buildContractGraph,
	canTransitionStatus,
	loadDocumentationContract,
} from '../src/index.js';

const FIXTURES_ROOT = resolve(process.cwd(), 'tests', 'fixtures', 'profiles');
const STANDARD_SCHEMA_PATH = resolve(
	process.cwd(),
	'profiles',
	'standard',
	'document.schema.yml',
);

describe('buildContractGraph', () => {
	describe('Standard profile success', () => {
		it('builds the ContractGraph from the Standard contract successfully', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const result = buildContractGraph(contract);

			expect(result.graph).toBeDefined();
			expect(result.diagnostics).toBeDefined();
		});

		it('the graph contains all Standard document nodes in deterministic order', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const result = buildContractGraph(contract);

			expect(result.graph.nodes.length).toBe(contract.documents.length);
			for (let i = 0; i < contract.documents.length; i++) {
				expect(result.graph.nodes[i].document.canonicalId).toBe(
					contract.documents[i].canonicalId,
				);
			}
		});

		it('the graph reports all declared outputs in deterministic order', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const result = buildContractGraph(contract);

			expect(result.graph.outputs.length).toBeGreaterThan(0);

			// Every document should have at least a canonical output.
			for (const doc of contract.documents) {
				const docOutputs = result.graph.getOutputsByDocumentId(doc.canonicalId);
				expect(docOutputs.length).toBeGreaterThan(0);
				const canonical = docOutputs.find((o) => o.kind === 'canonical');
				expect(canonical).toBeDefined();
			}
		});

		it('the graph reports all declared dependency references in deterministic order', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const result = buildContractGraph(contract);

			// Standard profile has dependencies.
			expect(result.graph.dependencies.length).toBeGreaterThan(0);

			// Every dependency should have a known source.
			for (const dep of result.graph.dependencies) {
				expect(dep.sourceDocumentCanonicalId).toBeTruthy();
			}
		});

		it('has no circular dependency diagnostics for the bundled Standard profile', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const result = buildContractGraph(contract);

			const circularDiags = result.diagnostics.filter(
				(d) => d.code === 'E_GRAPH_CIRCULAR_DEPENDENCY',
			);
			expect(circularDiags.length).toBe(0);
		});

		it('every Standard document status is valid according to the modeled status workflow', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const result = buildContractGraph(contract);

			for (const node of result.graph.nodes) {
				expect(node.statusValid).toBe(true);
			}

			const statusDiags = result.diagnostics.filter(
				(d) => d.code === 'E_GRAPH_INVALID_STATUS',
			);
			expect(statusDiags.length).toBe(0);
		});
	});

	describe('Status workflow', () => {
		it('accepts valid statuses', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const result = buildContractGraph(contract);
			const workflow = result.graph.statusWorkflow;

			for (const node of result.graph.nodes) {
				expect(
					workflow.allowedStatuses.has(node.document.descriptor.status),
				).toBe(true);
			}
		});

		it('reports invalid status with field-path diagnostic', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'invalid-status',
				profileRoot: join(FIXTURES_ROOT, 'invalid-status'),
				schemaPath: STANDARD_SCHEMA_PATH,
			});
			const result = buildContractGraph(contract);

			const statusDiag = result.diagnostics.find(
				(d) => d.code === 'E_GRAPH_INVALID_STATUS',
			);
			expect(statusDiag).toBeDefined();
			expect(statusDiag?.fieldPath).toBe('status');
			expect(statusDiag?.severity).toBe('error');
			expect(statusDiag?.message).toContain('drafting');
		});

		it('canTransitionStatus accepts valid explicit transitions', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const result = buildContractGraph(contract);
			const workflow = result.graph.statusWorkflow;

			// From the Standard registry:
			// not_started -> drafting
			const r1 = canTransitionStatus(workflow, 'not_started', 'drafting');
			expect(r1.allowed).toBe(true);

			// drafted -> needs_review
			const r2 = canTransitionStatus(workflow, 'drafted', 'needs_review');
			expect(r2.allowed).toBe(true);
		});

		it('canTransitionStatus rejects invalid explicit transitions', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const result = buildContractGraph(contract);
			const workflow = result.graph.statusWorkflow;

			// not_started -> approved is not explicitly allowed
			const r1 = canTransitionStatus(workflow, 'not_started', 'approved');
			expect(r1.allowed).toBe(false);
			expect(r1.reason).toContain('not explicitly allowed');
		});

		it('canTransitionStatus uses conservative fallback when no explicit transitions exist', async () => {
			// Use the status-workflow-conservative fixture which has multiple allowed
			// statuses but empty transitions.
			const contract = await loadDocumentationContract({
				profileId: 'status-workflow-conservative',
				profileRoot: join(FIXTURES_ROOT, 'status-workflow-conservative'),
				schemaPath: STANDARD_SCHEMA_PATH,
			});
			const result = buildContractGraph(contract);
			const workflow = result.graph.statusWorkflow;

			// Same status is always allowed (idempotent).
			const r1 = canTransitionStatus(workflow, 'not_started', 'not_started');
			expect(r1.allowed).toBe(true);

			// No explicit transitions defined, but fromStatus is not terminal.
			// Conservative fallback allows any transition between allowed statuses.
			const r2 = canTransitionStatus(workflow, 'not_started', 'drafting');
			expect(r2.allowed).toBe(true);

			// Terminal status with no explicit transitions: disallowed to other statuses.
			const r3 = canTransitionStatus(workflow, 'drafted', 'not_started');
			expect(r3.allowed).toBe(false);
			expect(r3.reason).toContain('terminal');
		});
	});

	describe('Output declarations', () => {
		it('normalizes canonical Markdown outputs', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const result = buildContractGraph(contract);

			const canonicalOutputs = result.graph.outputs.filter(
				(o) => o.kind === 'canonical',
			);
			expect(canonicalOutputs.length).toBeGreaterThan(0);

			for (const out of canonicalOutputs) {
				expect(out.format).toBe('markdown');
				expect(out.isCanonical).toBe(true);
				expect(out.role).toBe('canonical');
				expect(out.fieldPath).toBe('outputs.canonical');
			}
		});

		it('normalizes HTML/artifact outputs', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const result = buildContractGraph(contract);

			const artifactOutputs = result.graph.outputs.filter(
				(o) => o.kind === 'artifact',
			);
			expect(artifactOutputs.length).toBeGreaterThan(0);

			for (const out of artifactOutputs) {
				expect(out.format).toBe('html');
				expect(out.isCanonical).toBe(false);
				expect(out.role).toBe('presentation');
				expect(out.fieldPath.startsWith('outputs.artifacts')).toBe(true);
			}
		});

		it('normalizes agent-pack outputs', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const result = buildContractGraph(contract);

			const agentPackOutputs = result.graph.outputs.filter(
				(o) => o.kind === 'agentPack',
			);
			expect(agentPackOutputs.length).toBeGreaterThan(0);

			for (const out of agentPackOutputs) {
				expect(out.format).toBe('markdown');
				expect(out.isCanonical).toBe(false);
				expect(out.role).toBe('agentPack');
				expect(out.fieldPath.startsWith('outputs.agentPacks')).toBe(true);
			}
		});

		it('normalizes data and executive outputs', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'output-targets',
				profileRoot: join(FIXTURES_ROOT, 'output-targets'),
				schemaPath: STANDARD_SCHEMA_PATH,
			});
			const result = buildContractGraph(contract);

			const dataOutput = result.graph.outputs.find((o) => o.kind === 'data');
			expect(dataOutput).toBeDefined();
			expect(dataOutput?.format).toBe('json');
			expect(dataOutput?.role).toBe('data');
			expect(dataOutput?.isCanonical).toBe(false);

			const executiveOutput = result.graph.outputs.find(
				(o) => o.kind === 'executive',
			);
			expect(executiveOutput).toBeDefined();
			expect(executiveOutput?.format).toBe('json');
			expect(executiveOutput?.role).toBe('execution_plan');
			expect(executiveOutput?.isCanonical).toBe(false);
		});

		it('preserves source paths and field pointers for outputs', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const result = buildContractGraph(contract);

			for (const out of result.graph.outputs) {
				expect(out.sourcePath).toBeTruthy();
				expect(out.sourcePath.endsWith('.yml')).toBe(true);
				expect(out.fieldPath).toBeTruthy();
			}
		});
	});

	describe('Dependencies', () => {
		it('normalizes dependency references from descriptor data', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const result = buildContractGraph(contract);

			const dependsOnDeps = result.graph.dependencies.filter(
				(d) => d.kind === 'dependsOn',
			);
			const feedsDeps = result.graph.dependencies.filter(
				(d) => d.kind === 'feeds',
			);

			expect(dependsOnDeps.length).toBeGreaterThan(0);
			expect(feedsDeps.length).toBeGreaterThan(0);

			for (const dep of result.graph.dependencies) {
				expect(dep.sourceDocumentCanonicalId).toBeTruthy();
				expect(dep.targetDocumentId).toBeTruthy();
				expect(dep.sourcePath).toBeTruthy();
				expect(dep.fieldPath).toBeTruthy();
			}
		});

		it('fails with structured diagnostic for unknown dependency target', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'unknown-dependency',
				profileRoot: join(FIXTURES_ROOT, 'unknown-dependency'),
				schemaPath: STANDARD_SCHEMA_PATH,
			});
			const result = buildContractGraph(contract);

			const diag = result.diagnostics.find(
				(d) => d.code === 'E_GRAPH_UNKNOWN_DEPENDENCY_TARGET',
			);
			expect(diag).toBeDefined();
			expect(diag?.severity).toBe('error');
			expect(diag?.fieldPath).toBe('dependsOn[0]');
			expect(diag?.message).toContain('nonexistent-doc');
		});

		it('resolves feeds to declared output ids and paths', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'output-targets',
				profileRoot: join(FIXTURES_ROOT, 'output-targets'),
				schemaPath: STANDARD_SCHEMA_PATH,
			});
			const result = buildContractGraph(contract);

			const outputRefs = result.graph.dependencies.filter(
				(d) => d.targetKind === 'output',
			);
			expect(outputRefs).toHaveLength(2);
			expect(outputRefs[0]?.targetOutputId).toBe('data.test_summary');
			expect(outputRefs[0]?.targetOutputPath).toBe(
				'out/data/test-summary.json',
			);
			expect(outputRefs[1]?.targetOutputId).toBe('executive.test_plan');
			expect(outputRefs[1]?.targetOutputPath).toBe(
				'out/executive/test-plan.json',
			);
			expect(
				result.diagnostics.some(
					(d) => d.code === 'E_GRAPH_UNKNOWN_DEPENDENCY_TARGET',
				),
			).toBe(false);
		});

		it('detects direct circular dependencies', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'circular-dependency-direct',
				profileRoot: join(FIXTURES_ROOT, 'circular-dependency-direct'),
				schemaPath: STANDARD_SCHEMA_PATH,
			});
			const result = buildContractGraph(contract);

			const diag = result.diagnostics.find(
				(d) => d.code === 'E_GRAPH_CIRCULAR_DEPENDENCY',
			);
			expect(diag).toBeDefined();
			expect(diag?.severity).toBe('error');
			expect(diag?.cyclePath).toBeDefined();
			expect(diag?.cyclePath?.length).toBeGreaterThanOrEqual(2);
			expect(diag?.recoveryHint).toBeTruthy();
		});

		it('detects multi-node circular dependencies', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'circular-dependency-multi',
				profileRoot: join(FIXTURES_ROOT, 'circular-dependency-multi'),
				schemaPath: STANDARD_SCHEMA_PATH,
			});
			const result = buildContractGraph(contract);

			const diag = result.diagnostics.find(
				(d) => d.code === 'E_GRAPH_CIRCULAR_DEPENDENCY',
			);
			expect(diag).toBeDefined();
			expect(diag?.severity).toBe('error');
			expect(diag?.cyclePath).toBeDefined();
			expect(diag?.cyclePath?.length).toBeGreaterThanOrEqual(3);
		});

		it('passes for non-circular dependency chain', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'non-circular-chain',
				profileRoot: join(FIXTURES_ROOT, 'non-circular-chain'),
				schemaPath: STANDARD_SCHEMA_PATH,
			});
			const result = buildContractGraph(contract);

			const diag = result.diagnostics.find(
				(d) => d.code === 'E_GRAPH_CIRCULAR_DEPENDENCY',
			);
			expect(diag).toBeUndefined();
		});

		it('returns the same ordered node/edge/output index when built twice', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const result1 = buildContractGraph(contract);
			const result2 = buildContractGraph(contract);

			expect(result1.graph.nodes.length).toBe(result2.graph.nodes.length);
			expect(result1.graph.outputs.length).toBe(result2.graph.outputs.length);
			expect(result1.graph.dependencies.length).toBe(
				result2.graph.dependencies.length,
			);

			for (let i = 0; i < result1.graph.nodes.length; i++) {
				expect(result1.graph.nodes[i].document.canonicalId).toBe(
					result2.graph.nodes[i].document.canonicalId,
				);
			}

			for (let i = 0; i < result1.graph.outputs.length; i++) {
				expect(result1.graph.outputs[i].documentCanonicalId).toBe(
					result2.graph.outputs[i].documentCanonicalId,
				);
				expect(result1.graph.outputs[i].fieldPath).toBe(
					result2.graph.outputs[i].fieldPath,
				);
			}
		});
	});

	describe('Graph query helpers', () => {
		it('getNodeByCanonicalId returns the correct node', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const result = buildContractGraph(contract);

			const node = result.graph.getNodeByCanonicalId('01-thesis');
			expect(node).toBeDefined();
			expect(node?.document.canonicalId).toBe('01-thesis');
		});

		it('getOutputsByDocumentId returns outputs for a specific document', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const result = buildContractGraph(contract);

			const outputs = result.graph.getOutputsByDocumentId('01-thesis');
			expect(outputs.length).toBeGreaterThan(0);
			for (const out of outputs) {
				expect(out.documentCanonicalId).toBe('01-thesis');
			}
		});

		it('getDependenciesBySourceDocumentId returns outgoing dependencies', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const result = buildContractGraph(contract);

			const deps = result.graph.getDependenciesBySourceDocumentId('02-problem');
			expect(deps.length).toBeGreaterThan(0);
			for (const dep of deps) {
				expect(dep.sourceDocumentCanonicalId).toBe('02-problem');
			}
		});

		it('getDependentsByTargetDocumentId returns incoming dependencies', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const result = buildContractGraph(contract);

			const deps = result.graph.getDependentsByTargetDocumentId('01-thesis');
			expect(deps.length).toBeGreaterThan(0);
			for (const dep of deps) {
				expect(dep.targetDocumentCanonicalId).toBe('01-thesis');
			}
		});
	});

	describe('Snapshot', () => {
		it('matches a stable Standard graph index snapshot', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const result = buildContractGraph(contract);

			const snapshot = result.graph.nodes.map((node) => ({
				canonicalDocumentId: node.document.canonicalId,
				dependencies: result.graph
					.getDependenciesBySourceDocumentId(node.document.canonicalId)
					.filter((d) => d.targetDocumentCanonicalId !== undefined)
					.map((d) => ({
						kind: d.kind,
						target: d.targetDocumentCanonicalId,
					})),
				outputs: result.graph
					.getOutputsByDocumentId(node.document.canonicalId)
					.map((o) => ({
						kind: o.kind,
						path: o.path,
						role: o.role,
					})),
				phaseId: node.document.phaseId,
				status: node.document.descriptor.status,
			}));

			expect(snapshot).toMatchSnapshot();
		});
	});
});
