/** Step 7.2 Source Fingerprint — deterministic stable fingerprints for staleness comparison */

import { createHash } from 'node:crypto';
import type {
	CanonicalDocumentId,
	PhaseId,
} from '../profiles/documentation-contract.js';
import type {
	StalenessFingerprint,
	StalenessSourceKind,
} from './staleness-types.js';

const FINGERPRINT_ALGORITHM = 'sha256';

// ---------------------------------------------------------------------------
// Stable serialization
// ---------------------------------------------------------------------------

function stableStringify(value: unknown): string {
	if (value === null) return 'null:';
	if (value === undefined) return 'undef:';
	if (typeof value === 'boolean') return `bool:${value ? '1' : '0'}`;
	if (typeof value === 'number') return `num:${value}`;
	if (typeof value === 'string') return `str:${value}`;
	if (Array.isArray(value)) {
		const parts = value.map((v, i) => `[${i}]:${stableStringify(v)}`);
		return `arr:${parts.join(',')}`;
	}
	if (typeof value === 'object') {
		const keys = Object.keys(value as Record<string, unknown>).sort();
		const parts = keys.map(
			(k) => `${k}:${stableStringify((value as Record<string, unknown>)[k])}`,
		);
		return `obj:{${parts.join(',')}}`;
	}
	return `raw:${String(value)}`;
}

// ---------------------------------------------------------------------------
// Hash
// ---------------------------------------------------------------------------

export function computeStableFingerprint(
	kind: StalenessSourceKind,
	obj: unknown,
): StalenessFingerprint {
	const serialized = stableStringify(obj);
	const hash = createHash(FINGERPRINT_ALGORITHM)
		.update(serialized, 'utf-8')
		.digest('hex');
	return {
		algorithm: FINGERPRINT_ALGORITHM,
		kind,
		value: hash,
	};
}

// ---------------------------------------------------------------------------
// Secret-like redaction for fingerprint inputs
// ---------------------------------------------------------------------------

function looksLikeSecret(value: string): boolean {
	const lower = value.toLowerCase();
	if (lower.startsWith('sk-') || lower.startsWith('sk_')) return true;
	if (lower.startsWith('bearer ') || lower.startsWith('basic ')) return true;
	if (lower.startsWith('api-') || lower.startsWith('api_')) return true;
	if (
		value.length > 40 &&
		!value.includes('_') &&
		/[a-zA-Z0-9+/]{30,}/.test(value)
	)
		return true;
	if (
		value.length > 20 &&
		/^(ghp|gho|ghu|ghs|ghr|xoxb|xoxp|dapi|sl|AKIA)/.test(value)
	)
		return true;
	return false;
}

function redactSecretValues(obj: unknown): unknown {
	if (typeof obj === 'string' && looksLikeSecret(obj)) {
		return '<REDACTED_SECRET>';
	}
	if (Array.isArray(obj)) {
		return obj.map(redactSecretValues);
	}
	if (obj !== null && typeof obj === 'object') {
		const result: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
			const lowerKey = key.toLowerCase();
			if (
				lowerKey.includes('secret') ||
				lowerKey.includes('token') ||
				lowerKey.includes('apikey') ||
				lowerKey.includes('api_key') ||
				lowerKey.includes('password') ||
				lowerKey.includes('credential')
			) {
				result[key] = '<REDACTED>';
			} else {
				result[key] = redactSecretValues(val);
			}
		}
		return result;
	}
	return obj;
}

// ---------------------------------------------------------------------------
// Profile contract fingerprint
// ---------------------------------------------------------------------------

export function computeProfileContractFingerprint(fingerprintArgs: {
	profileId: string;
	profileVersion: string | undefined;
	source: string | undefined;
	registryPath: string | undefined;
	phaseDescriptors: readonly {
		id: PhaseId;
		title: string;
	}[];
}): StalenessFingerprint {
	const cleaned = redactSecretValues(fingerprintArgs);
	return computeStableFingerprint('profile_contract', cleaned);
}

// ---------------------------------------------------------------------------
// Document descriptor fingerprint
// ---------------------------------------------------------------------------

export function computeDocumentDescriptorFingerprint(descriptor: {
	documentCanonicalId: CanonicalDocumentId;
	title: string;
	phaseId: PhaseId;
	canonicalOutput: string;
	outputs: readonly {
		kind: string;
		path: string | undefined;
		format: string | undefined;
	}[];
	inputs: readonly {
		type: string;
		id: string;
		required: boolean | undefined;
	}[];
	status: string | undefined;
}): StalenessFingerprint {
	const cleaned = redactSecretValues({
		canonicalOutput: descriptor.canonicalOutput,
		documentCanonicalId: descriptor.documentCanonicalId,
		inputs: descriptor.inputs.map((i) => ({
			id: i.id,
			required: i.required ?? null,
			type: i.type,
		})),
		outputs: descriptor.outputs.map((o) => ({
			format: o.format ?? null,
			kind: o.kind,
			path: o.path ?? null,
		})),
		phaseId: descriptor.phaseId,
		status: descriptor.status ?? null,
		title: descriptor.title,
	});
	return computeStableFingerprint('document_descriptor', cleaned);
}

// ---------------------------------------------------------------------------
// Dependency graph fingerprint for a target
// ---------------------------------------------------------------------------

export function computeDependencyGraphFingerprint(targetArgs: {
	upstreamDocumentIds: readonly CanonicalDocumentId[];
	upstreamEdgeKinds: readonly string[];
}): StalenessFingerprint {
	const sortedIds = [...targetArgs.upstreamDocumentIds].sort();
	const sortedKinds = [...targetArgs.upstreamEdgeKinds].sort();
	const cleaned = redactSecretValues({
		upstreamDocumentIds: sortedIds,
		upstreamEdgeKinds: sortedKinds,
	});
	return computeStableFingerprint('dependency_graph', cleaned);
}

// ---------------------------------------------------------------------------
// Workspace relevant-state fingerprint
// ---------------------------------------------------------------------------

export function computeRelevantStateFingerprint(stateArgs: {
	decisions: readonly {
		id: string;
		title: string;
		status: string;
		body: string | undefined;
		createdAt: string | undefined;
		updatedAt: string | undefined;
	}[];
	assumptions: readonly {
		id: string;
		title: string;
		status: string;
		body: string | undefined;
		createdAt: string | undefined;
		updatedAt: string | undefined;
	}[];
	openQuestions: readonly {
		id: string;
		question: string;
		status: string;
		createdAt: string | undefined;
		updatedAt: string | undefined;
	}[];
	risks: readonly {
		id: string;
		title: string;
		status: string;
		severity: string;
		createdAt: string | undefined;
		updatedAt: string | undefined;
	}[];
}): StalenessFingerprint {
	const sortedDecisions = [...stateArgs.decisions]
		.map((d) => ({
			id: d.id,
			status: d.status,
			title: d.title,
			updatedAt: d.updatedAt ?? null,
		}))
		.sort((a, b) => a.id.localeCompare(b.id));

	const sortedAssumptions = [...stateArgs.assumptions]
		.map((a) => ({
			id: a.id,
			status: a.status,
			title: a.title,
			updatedAt: a.updatedAt ?? null,
		}))
		.sort((a, b) => a.id.localeCompare(b.id));

	const sortedQuestions = [...stateArgs.openQuestions]
		.map((q) => ({
			id: q.id,
			question: q.question,
			status: q.status,
			updatedAt: q.updatedAt ?? null,
		}))
		.sort((a, b) => a.id.localeCompare(b.id));

	const sortedRisks = [...stateArgs.risks]
		.map((r) => ({
			id: r.id,
			severity: r.severity,
			status: r.status,
			title: r.title,
			updatedAt: r.updatedAt ?? null,
		}))
		.sort((a, b) => a.id.localeCompare(b.id));

	const cleaned = redactSecretValues({
		assumptions: sortedAssumptions,
		decisions: sortedDecisions,
		openQuestions: sortedQuestions,
		risks: sortedRisks,
	});

	return computeStableFingerprint('workspace_state', cleaned);
}

// ---------------------------------------------------------------------------
// Artifact metadata fingerprint
// ---------------------------------------------------------------------------

export function computeArtifactMetadataFingerprint(artifact: {
	artifactId: string;
	artifactType: string;
	path: string;
	status: string;
	checksum: string | undefined;
	generatedAt: string | undefined;
	runId: string | undefined;
	isCanonical: boolean;
	sourceDocumentIds: readonly string[];
}): StalenessFingerprint {
	const cleaned = redactSecretValues({
		artifactId: artifact.artifactId,
		artifactType: artifact.artifactType,
		checksum: artifact.checksum ?? null,
		generatedAt: artifact.generatedAt ?? null,
		isCanonical: artifact.isCanonical,
		path: artifact.path,
		runId: artifact.runId ?? null,
		sourceDocumentIds: [...artifact.sourceDocumentIds].sort(),
		status: artifact.status,
	});
	return computeStableFingerprint('artifact_registry', cleaned);
}

// ---------------------------------------------------------------------------
// Generated metadata fingerprint
// ---------------------------------------------------------------------------

export function computeGeneratedMetadataFingerprint(metadata: {
	documentId: string;
	phaseId: string;
	profileId: string;
	canonicalOutput: string;
	generatedAt: string;
	generationStatus: string;
}): StalenessFingerprint {
	const cleaned = redactSecretValues({
		canonicalOutput: metadata.canonicalOutput,
		documentId: metadata.documentId,
		generatedAt: metadata.generatedAt,
		generationStatus: metadata.generationStatus,
		phaseId: metadata.phaseId,
		profileId: metadata.profileId,
	});
	return computeStaleFingerprint('generated_metadata', cleaned);
}

// ---------------------------------------------------------------------------
// Simple hash of a string value
// ---------------------------------------------------------------------------

export function computeStringFingerprint(
	kind: StalenessSourceKind,
	value: string | undefined,
): StalenessFingerprint {
	const safe = value ?? '';
	const hash = createHash(FINGERPRINT_ALGORITHM)
		.update(safe, 'utf-8')
		.digest('hex');
	return {
		algorithm: FINGERPRINT_ALGORITHM,
		kind,
		value: hash,
	};
}

// ---------------------------------------------------------------------------
// Convenience alias for generated_metadata kind (matching spec name)
// ---------------------------------------------------------------------------

function computeStaleFingerprint(
	kind: StalenessSourceKind,
	obj: unknown,
): StalenessFingerprint {
	return computeStableFingerprint(kind, obj);
}

export { redactSecretValues };
