/**
 * Agent Pack exporter — writes a portable context package for
 * downstream AI agents as JSON.
 *
 * `exportAgentPack` aggregates all accepted canonical answers from
 * one or more source documents, together with document structure,
 * dependency information, and source traceability metadata.
 *
 * The output is labelled `[derived]` and non-canonical — the
 * canonical source remains the Markdown documents.
 *
 * Gating rules (same as `exportMarkdown` and `exportHtml`):
 * 1. At least one document must be requested.
 * 2. Each document must have a materialization rule.
 * 3. Each document must be **ready** / **drafted** / **accepted**
 *    (not `"not_ready"`, `"partially_ready"`, or `"stale"`).
 * 4. The materialized draft for each document must be complete
 *    and non-stale.
 * 5. The target output path must not already exist (collision policy).
 *
 * Side effects: creates parent directories and writes the JSON file
 * via `fs/promises`.  Does NOT mutate runtime state — the caller is
 * responsible for recording the `GeneratedArtifact` in the session.
 *
 * All filesystem errors are caught and returned as `ExportError` —
 * this function never throws for expected I/O failure paths.
 *
 * @see {@link https://logos-engine/docs/architecture/10-local-development-and-deployment.md §11}
 * @see {@link https://logos-engine/docs/13-prototypes.md §3.12}
 */

import { constants } from 'node:fs';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type {
	CanonicalAnswer,
	DocumentDefinition,
	DocumentMaterializationRule,
	GeneratedArtifact,
	LogosProfile,
	LogosRuntimeState,
	NodeDefinition,
	NodeRuntimeState,
} from '../contracts/index.js';
import { materializeDocument } from '../materialization/document-materializer.js';
import type { DocumentId, NodeId, Result } from '../shared/index.js';
import { err, generateId, nowIso, ok } from '../shared/index.js';
import { computeDocumentReadiness } from '../state-engine/document-readiness.js';
import type { ExportError } from './markdown-exporter.js';

// ─── Agent Pack JSON types ──────────────────────────────────────────────────

/**
 * A single accepted answer entry within the agent pack.
 */
interface AgentPackAnswer {
	readonly nodeId: string;
	readonly nodeTitle: string;
	readonly canonicalQuestion: string;
	readonly content: string;
	readonly format: CanonicalAnswer['format'];
	readonly confidence: CanonicalAnswer['confidence'];
	readonly generatedAt: string;
	readonly acceptedAt: string | undefined;
	readonly generatedFromMessageIds: readonly string[];
}

/**
 * A document entry in the agent pack, including its structure and
 * collected accepted answers.
 */
interface AgentPackDocument {
	readonly id: string;
	readonly title: string;
	readonly phaseId: string;
	readonly order: number;
	readonly purpose: string;
	readonly outputPath: string;
	readonly requiredNodeIds: readonly string[];
	readonly optionalNodeIds: readonly string[];
	readonly sections: readonly AgentPackSection[];
	readonly answers: readonly AgentPackAnswer[];
}

/**
 * A materialization section descriptor within an agent pack document.
 */
interface AgentPackSection {
	readonly id: string;
	readonly title: string;
	readonly required: boolean;
	readonly sourceNodeIds: readonly string[];
}

/**
 * A dependency-graph node entry.
 */
interface AgentPackDependencyNode {
	readonly nodeId: string;
	readonly title: string;
	readonly requiredNodeIds: readonly string[];
	readonly blockedBy: readonly string[];
	readonly unlocks: readonly string[];
}

/**
 * Top-level agent pack structure — written as JSON.
 */
interface AgentPack {
	readonly kind: '[derived] agent_pack';
	readonly canonical: false;
	readonly metadata: {
		readonly profile: {
			readonly id: string;
			readonly title: string;
			readonly version: string;
		};
		readonly sessionId: string;
		readonly generatedAt: string;
	};
	readonly documents: readonly AgentPackDocument[];
	readonly dependencyGraph: {
		readonly nodes: readonly AgentPackDependencyNode[];
	};
	readonly sourceTraceability: {
		readonly sourceDocumentIds: readonly string[];
		readonly sourceNodeIds: readonly string[];
		readonly profileId: string;
		readonly profileVersion: string;
		readonly sessionId: string;
	};
}

// ─── Internal helpers ──────────────────────────────────────────────────────

/**
 * Determine whether a node has a fully accepted, non-stale canonical answer
 * eligible for inclusion in the agent pack.
 *
 * All three conditions must hold:
 * 1. The node exists in `nodeStates`.
 * 2. Its lifecycle is `"accepted"`.
 * 3. It has a canonical answer with `accepted === true` and `stale === false`.
 */
function isFreshAccepted(nodeState: NodeRuntimeState | undefined): boolean {
	return (
		nodeState !== undefined &&
		nodeState.lifecycle === 'accepted' &&
		nodeState.canonicalAnswer !== null &&
		nodeState.canonicalAnswer.accepted === true &&
		nodeState.canonicalAnswer.stale === false
	);
}

/**
 * Find the materialization rule for `documentId` in the profile.
 */
function findRule(
	profile: LogosProfile,
	documentId: DocumentId,
): DocumentMaterializationRule | undefined {
	return profile.materializationRules.find((r) => r.documentId === documentId);
}

/**
 * Find a node definition in the profile by its ID.
 */
function findNodeDef(
	profile: LogosProfile,
	nodeId: NodeId,
): NodeDefinition | undefined {
	return profile.nodes.find((n) => n.id === nodeId);
}

/**
 * Find a document definition in the profile by its ID.
 */
function findDocDef(
	profile: LogosProfile,
	documentId: DocumentId,
): DocumentDefinition | undefined {
	return profile.documents.find((d) => d.id === documentId);
}

/**
 * Derive the agent pack output path.
 *
 * For a single document: derive from the rule's `.md`/`.markdown` path
 * by replacing the extension with `.agent-pack.json`.
 *
 * For multiple documents: use the profile's first directory-like
 * output path as anchor, falling back to a stable name in cwd.
 */
function derivePackPath(
	documentIds: readonly DocumentId[],
	profile: LogosProfile,
): string {
	if (documentIds.length === 1) {
		const singleId = documentIds[0];
		if (!singleId) {
			// Fallback: should never happen for length === 1, but guard.
			return `${profile.id}.agent-pack.json`;
		}
		const rule = findRule(profile, singleId);
		if (rule) {
			const base = rule.outputPath;
			if (base.endsWith('.md')) {
				return `${base.slice(0, -3)}.agent-pack.json`;
			}
			if (base.endsWith('.markdown')) {
				return `${base.slice(0, -9)}.agent-pack.json`;
			}
			return `${base}.agent-pack.json`;
		}
	}

	// Multiple documents — derive from the first rule's directory.
	const firstRule = profile.materializationRules[0];
	if (firstRule) {
		const dir = dirname(firstRule.outputPath);
		return join(dir, `${profile.id}.agent-pack.json`);
	}

	// Fallback: no rules at all.
	return `${profile.id}.agent-pack.json`;
}

/**
 * Gate a single document for agent pack eligibility.
 *
 * Returns `ok(undefined)` when the document passes all checks, or an
 * `ExportError` when blocked.
 */
function gateDocument(
	documentId: DocumentId,
	state: LogosRuntimeState,
	profile: LogosProfile,
): Result<undefined, ExportError> {
	const rule = findRule(profile, documentId);
	if (!rule) {
		return err({
			code: 'RULE_NOT_FOUND',
			documentId,
			message: `No materialization rule found for document "${documentId}".`,
		});
	}

	const readiness = computeDocumentReadiness(documentId, state, profile);

	const exportableStatuses = new Set(['ready', 'drafted', 'accepted']);

	if (!exportableStatuses.has(readiness.status)) {
		if (readiness.status === 'stale') {
			return err({
				code: 'DOCUMENT_STALE',
				documentId,
				message: `Document "${documentId}" is stale and cannot be exported.`,
			});
		}
		if (readiness.status === 'partially_ready') {
			const missing = readiness.missingRequiredNodeIds.join(', ');
			return err({
				code: 'DOCUMENT_INCOMPLETE',
				documentId,
				message: `Document "${documentId}" is incomplete. Missing required nodes: ${missing || '(none known)'}.`,
			});
		}
		return err({
			code: 'DOCUMENT_NOT_READY',
			documentId,
			message: `Document "${documentId}" is not ready for export (status: ${readiness.status}).`,
		});
	}

	// Cross-check with materializer.
	const draftResult = materializeDocument(documentId, state, profile);
	if (!draftResult.ok) {
		return err({
			code: 'MATERIALIZATION_FAILED',
			documentId,
			message: draftResult.error.message,
		});
	}

	const draft = draftResult.value;
	if (draft.stale) {
		return err({
			code: 'DRAFT_STALE',
			documentId,
			message: `Materialized draft for "${documentId}" is stale.`,
		});
	}

	if (draft.missingSections.length > 0) {
		const sections = draft.missingSections.join(', ');
		return err({
			code: 'DRAFT_INCOMPLETE',
			documentId,
			message: `Document "${documentId}" has missing required sections: ${sections}.`,
		});
	}

	return ok(undefined);
}

/**
 * Collect all accepted (fresh, non-stale) answers for a document.
 *
 * Iterates over the materialization rule's source nodes and collects
 * `AgentPackAnswer` entries from nodes in `accepted` lifecycle with
 * an accepted, non-stale canonical answer.
 */
function collectAnswers(
	rule: DocumentMaterializationRule,
	state: LogosRuntimeState,
	profile: LogosProfile,
): AgentPackAnswer[] {
	const seen = new Set<string>();
	const answers: AgentPackAnswer[] = [];

	for (const nodeId of rule.sourceNodeIds) {
		if (seen.has(String(nodeId))) continue;
		seen.add(String(nodeId));

		const nodeState = state.nodeStates[nodeId];
		if (!isFreshAccepted(nodeState) || !nodeState?.canonicalAnswer) continue;

		const ca = nodeState.canonicalAnswer;
		const nodeDef = findNodeDef(profile, nodeId);

		answers.push({
			acceptedAt: ca.acceptedAt,
			canonicalQuestion: nodeDef?.canonicalQuestion ?? '',
			confidence: ca.confidence,
			content: ca.content,
			format: ca.format,
			generatedAt: ca.generatedAt,
			generatedFromMessageIds: ca.generatedFromMessageIds,
			nodeId: String(nodeId),
			nodeTitle: nodeDef?.title ?? String(nodeId),
		});
	}

	return answers;
}

/**
 * Build a dependency-graph entry for a node.
 *
 * Includes runtime dependency state (blockedBy, unlocks) from the
 * state engine and static requiredNodeIds from the node definition.
 */
function buildDependencyNode(
	nodeId: NodeId,
	state: LogosRuntimeState,
	profile: LogosProfile,
): AgentPackDependencyNode | null {
	const nodeState = state.nodeStates[nodeId];
	const nodeDef = findNodeDef(profile, nodeId);

	if (!nodeDef) return null;

	return {
		blockedBy: (nodeState?.dependencies.blockedBy ?? []).map(String),
		nodeId: String(nodeId),
		requiredNodeIds: (nodeDef.dependencies?.requiredNodeIds ?? []).map(String),
		title: nodeDef.title,
		unlocks: (nodeState?.dependencies.unlocks ?? []).map(String),
	};
}

// ─── Pack builder ───────────────────────────────────────────────────────────

/**
 * Build the complete Agent Pack JSON object.
 */
function buildAgentPack(
	documentIds: readonly DocumentId[],
	state: LogosRuntimeState,
	profile: LogosProfile,
): AgentPack {
	const documents: AgentPackDocument[] = [];
	const allSourceNodeIds = new Set<NodeId>();

	for (const documentId of documentIds) {
		const rule = findRule(profile, documentId);
		const docDef = findDocDef(profile, documentId);

		if (!rule || !docDef) continue;

		const answers = collectAnswers(rule, state, profile);
		for (const a of answers) {
			allSourceNodeIds.add(a.nodeId as NodeId);
		}

		documents.push({
			answers,
			id: String(documentId),
			optionalNodeIds: rule.optionalNodeIds.map(String),
			order: docDef.order,
			outputPath: rule.outputPath,
			phaseId: docDef.phaseId,
			purpose: docDef.purpose,
			requiredNodeIds: rule.requiredNodeIds.map(String),
			sections: rule.sections.map((s) => ({
				id: s.id,
				required: s.required,
				sourceNodeIds: s.sourceNodeIds.map(String),
				title: s.title,
			})),
			title: rule.title,
		});
	}

	// Build dependency graph from all nodes referenced in profile.
	const depNodes: AgentPackDependencyNode[] = [];
	for (const nodeDef of profile.nodes) {
		const entry = buildDependencyNode(nodeDef.id, state, profile);
		if (entry) depNodes.push(entry);
	}

	const sourceNodeIdStrings = [...allSourceNodeIds].map(String);

	return {
		canonical: false,
		dependencyGraph: { nodes: depNodes },
		documents,
		kind: '[derived] agent_pack',
		metadata: {
			generatedAt: nowIso(),
			profile: {
				id: String(profile.id),
				title: profile.title,
				version: profile.version,
			},
			sessionId: state.sessionId,
		},
		sourceTraceability: {
			profileId: String(profile.id),
			profileVersion: profile.version,
			sessionId: state.sessionId,
			sourceDocumentIds: documentIds.map(String),
			sourceNodeIds: sourceNodeIdStrings,
		},
	};
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Export an Agent Pack — a portable JSON context package for downstream
 * AI agents containing all accepted canonical answers across the
 * specified documents.
 *
 * Gating rules:
 * 1. At least one document must be requested (empty array → error).
 * 2. Each document must pass the same readiness gates as
 *    `exportMarkdown` / `exportHtml`.
 * 3. All requested documents must pass — if any document is
 *    incomplete or stale, the entire export is blocked.
 * 4. The target output path must not already exist (collision policy).
 *
 * The output JSON contains:
 * - All accepted, non-stale canonical answers per document.
 * - Document structure (sections, phases, source node IDs).
 * - Dependency graph across all profile nodes.
 * - Metadata (profile id/version, session id, generation timestamp).
 * - Source traceability (document IDs, node IDs).
 * - `kind: "[derived] agent_pack"` and `canonical: false` labels.
 *
 * On success, writes the JSON file and returns a `GeneratedArtifact`.
 *
 * @param documentIds - The documents to include in the agent pack (branded array).
 * @param state       - The current runtime state (not mutated).
 * @param profile     - The loaded profile.
 * @returns A `Promise` resolving to `Result<GeneratedArtifact, ExportError>`.
 */
export async function exportAgentPack(
	documentIds: readonly DocumentId[],
	state: LogosRuntimeState,
	profile: LogosProfile,
): Promise<Result<GeneratedArtifact, ExportError>> {
	// ── Step 1: Validate input ─────────────────────────────────────
	if (documentIds.length === 0) {
		return err({
			code: 'NO_DOCUMENTS_REQUESTED',
			message: 'At least one document must be requested for agent pack export.',
		});
	}

	// ── Step 2: Gate each document ─────────────────────────────────
	for (const documentId of documentIds) {
		const gateResult = gateDocument(documentId, state, profile);
		if (!gateResult.ok) return gateResult;
	}

	// ── Step 3: Resolve output path ─────────────────────────────────
	const outputPath = derivePackPath(documentIds, profile);

	// ── Step 4: Check for file collision ────────────────────────────
	try {
		await access(outputPath, constants.F_OK);
		return err({
			code: 'FILE_COLLISION',
			message: `Output file already exists: "${outputPath}". Use --overwrite to replace.`,
		});
	} catch (accessErr: unknown) {
		const accessError = accessErr as NodeJS.ErrnoException;
		if (accessError.code !== 'ENOENT') {
			return err({
				code: 'OUTPUT_PATH_ACCESS_FAILED',
				message: `Cannot access output path "${outputPath}": ${accessError.message}`,
			});
		}
	}

	// ── Step 5: Create parent directories ───────────────────────────
	try {
		await mkdir(dirname(outputPath), { recursive: true });
	} catch (mkdirErr: unknown) {
		const mkdirError = mkdirErr as NodeJS.ErrnoException;
		return err({
			code: 'OUTPUT_DIRECTORY_FAILED',
			message: `Cannot create output directory for "${outputPath}": ${mkdirError.message}`,
		});
	}

	// ── Step 6: Build the agent pack ───────────────────────────────
	const generatedAt = nowIso();
	const pack = buildAgentPack(documentIds, state, profile);
	// Override the metadata timestamp with the one used for the artifact.
	const finalPack: AgentPack = {
		...pack,
		metadata: { ...pack.metadata, generatedAt },
		sourceTraceability: { ...pack.sourceTraceability },
	};

	// ── Step 7: Write JSON ──────────────────────────────────────────
	try {
		await writeFile(outputPath, JSON.stringify(finalPack, null, 2), 'utf-8');
	} catch (writeErr: unknown) {
		const writeError = writeErr as NodeJS.ErrnoException;
		return err({
			code: 'WRITE_FAILED',
			message: `Failed to write "${outputPath}": ${writeError.message}`,
		});
	}

	// ── Step 8: Build artifact metadata ─────────────────────────────
	const allSourceNodeIds = finalPack.sourceTraceability.sourceNodeIds.map(
		String,
	) as unknown as NodeId[];

	const artifact: GeneratedArtifact = {
		generatedAt,
		id: generateId(),
		path: outputPath,
		sessionId: state.sessionId,
		sourceDocumentIds: [...documentIds],
		sourceNodeIds: allSourceNodeIds,
		stale: false,
		type: 'agent_pack',
	};

	return ok(artifact);
}
