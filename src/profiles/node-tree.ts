/**
 * Node tree — builds a nested Phase → Document → Node structure from a LogosProfile.
 *
 * Used by the sidebar render model to display the profile structure with
 * phases, documents, and nodes grouped and ordered correctly.
 *
 * This module produces domain types only — it does NOT import TUI or render
 * snapshot types. The application/render layer maps `NodeTree` → `SidebarRenderModel`.
 */
import type { LogosProfile } from '../contracts/index.js';
import type { DocumentId, NodeId } from '../shared/index.js';

// ─── NodeTree types ─────────────────────────────────────────────────────────

/**
 * A single node in the tree — profile data only, no runtime state.
 */
export type NodeTreeNode = {
	/** Unique node identifier (branded). */
	readonly nodeId: NodeId;

	/** Human-readable node title. */
	readonly title: string;

	/** Display/sort order within the document. */
	readonly order: number;

	/** The single canonical question that anchors the node's semantic intent. */
	readonly canonicalQuestion: string;
};

/**
 * A document grouping within a phase — contains its nodes.
 */
export type NodeTreeDocument = {
	/** Unique document identifier (branded). */
	readonly documentId: DocumentId;

	/** Human-readable document title. */
	readonly title: string;

	/** Display/sort order within the phase. */
	readonly order: number;

	/** The phase this document belongs to. */
	readonly phaseId: string;

	/** Nodes belonging to this document, sorted by order. */
	readonly nodes: NodeTreeNode[];
};

/**
 * A phase grouping — contains its documents.
 *
 * Phases enforce ordering boundaries and provide the top-level
 * sidebar grouping.
 */
export type NodeTreePhase = {
	/** Phase identifier. */
	readonly phaseId: string;

	/** Human-readable phase title. */
	readonly title: string;

	/** Display/sort order within the profile. */
	readonly order: number;

	/** Documents within this phase, sorted by order. */
	readonly documents: NodeTreeDocument[];
};

/**
 * The complete node tree — a nested Phase → Document → Node hierarchy.
 *
 * Built from a `LogosProfile` by `buildNodeTree()`.
 */
export type NodeTree = {
	/** Top-level phases in display order. */
	readonly phases: NodeTreePhase[];
};

// ─── buildNodeTree ──────────────────────────────────────────────────────────

/**
 * Build a `NodeTree` from a loaded `LogosProfile`.
 *
 * Groups nodes by their `documentId`, documents by their `phaseId`,
 * and sorts everything by `order`.
 *
 * Phases without documents and documents without nodes are excluded
 * from the output (no empty entries in the tree).
 *
 * @param profile - A validated `LogosProfile` (from Step 2.1).
 * @returns A `NodeTree` with the nested phase/document/node hierarchy.
 */
export function buildNodeTree(profile: LogosProfile): NodeTree {
	const { phases, documents, nodes } = profile;

	// ── Group nodes by documentId ──────────────────────────────────────

	const nodesByDoc = new Map<DocumentId, NodeTreeNode[]>();
	for (const node of nodes) {
		const list = nodesByDoc.get(node.documentId) ?? [];
		list.push({
			canonicalQuestion: node.canonicalQuestion,
			nodeId: node.id,
			order: node.order,
			title: node.title,
		});
		nodesByDoc.set(node.documentId, list);
	}

	// Sort nodes within each document group by order.
	for (const [, nodeList] of nodesByDoc) {
		nodeList.sort((a, b) => a.order - b.order);
	}

	// ── Build documents ────────────────────────────────────────────────

	const documentsByPhase = new Map<string, NodeTreeDocument[]>();

	for (const doc of documents) {
		const docNodes = nodesByDoc.get(doc.id);
		// Skip documents with no nodes.
		if (!docNodes || docNodes.length === 0) continue;

		const treeDoc: NodeTreeDocument = {
			documentId: doc.id,
			nodes: docNodes,
			order: doc.order,
			phaseId: doc.phaseId,
			title: doc.title,
		};

		const list = documentsByPhase.get(doc.phaseId) ?? [];
		list.push(treeDoc);
		documentsByPhase.set(doc.phaseId, list);
	}

	// Sort documents within each phase group by order.
	for (const [, docList] of documentsByPhase) {
		docList.sort((a, b) => a.order - b.order);
	}

	// ── Build phases ───────────────────────────────────────────────────

	const phaseList: NodeTreePhase[] = [];

	for (const phase of phases) {
		const phaseDocs = documentsByPhase.get(phase.id);
		// Skip phases with no documents (or whose documents had no nodes).
		if (!phaseDocs || phaseDocs.length === 0) continue;

		phaseList.push({
			documents: phaseDocs,
			order: phase.order,
			phaseId: phase.id,
			title: phase.title,
		});
	}

	// Sort phases by order.
	phaseList.sort((a, b) => a.order - b.order);

	return { phases: phaseList };
}
