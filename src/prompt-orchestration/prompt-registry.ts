/**
 * Prompt registry — centralized store for prompt definitions with
 * hierarchical fallback chains.
 *
 * Exports:
 * - `PromptScopeLevel`, `PromptScope` — scope discriminated union for registration.
 * - `PromptDefinition` — full prompt template descriptor.
 * - `PromptRegistry` — class for register, lookup, and filesystem loading.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { PromptState } from '../contracts/node-state.js';
import type { PromptId } from '../shared/index.js';
import { DEFAULT_FALLBACK_PROMPTS } from './default-prompts.js';

// ─── PromptRegistryOptions ─────────────────────────────────────────────────

/**
 * Options for constructing a `PromptRegistry`.
 */
export type PromptRegistryOptions = {
	/**
	 * Whether to load the default global fallback prompts on construction.
	 *
	 * @default true
	 */
	readonly loadDefaults?: boolean;

	/**
	 * Custom default fallback prompts to use instead of `DEFAULT_FALLBACK_PROMPTS`.
	 *
	 * Only applies when `loadDefaults` is `true`. Useful for tests that want
	 * to inject a different set of defaults.
	 */
	readonly defaults?: readonly PromptDefinition[];
};

// ─── PromptScope ────────────────────────────────────────────────────────────

/**
 * Granularity level at which a prompt is registered.
 *
 * Ordered from most generic to most specific — used by the fallback chain
 * in `PromptRegistry.lookup`.
 */
export type PromptScopeLevel =
	| 'global'
	| 'profile'
	| 'phase'
	| 'document'
	| 'node';

/**
 * Discriminated union describing where a prompt applies.
 *
 * - `global` — applies to every profile and node.
 * - `profile` — applies to a specific profile, any node within it.
 * - `phase` — applies to a specific phase within a profile.
 * - `document` — applies to a specific document within a profile.
 * - `node` — applies to a specific node within a profile.
 */
export type PromptScope =
	| { readonly level: 'global' }
	| { readonly level: 'profile'; readonly profileId: string }
	| {
			readonly level: 'phase';
			readonly profileId: string;
			readonly phaseId: string;
	  }
	| {
			readonly level: 'document';
			readonly profileId: string;
			readonly documentId: string;
			readonly phaseId?: string;
	  }
	| {
			readonly level: 'node';
			readonly profileId: string;
			readonly nodeType: string;
			readonly documentId?: string;
			readonly phaseId?: string;
	  };

// ─── PromptDefinition ───────────────────────────────────────────────────────

/**
 * A complete prompt template registered in the prompt registry.
 *
 * Each definition combines a scope (where it applies), a prompt state
 * (when it applies), and the content the LLM receives.
 */
export type PromptDefinition = {
	/** Unique prompt identifier (branded). */
	readonly id: PromptId;

	/** Where this prompt applies (global, profile, phase, document, node). */
	readonly scope: PromptScope;

	/** The prompt state this template is designed for. */
	readonly promptState: PromptState;

	/** The full prompt body (system instruction + template). */
	readonly content: string;

	/** Optional reference to an output validation schema. */
	readonly outputSchemaRef?: string;

	/** Semantic version of this prompt template. */
	readonly version: string;
};

// ─── Internal key generation ────────────────────────────────────────────────

/**
 * Build a deterministic storage key from a scope and prompt state.
 *
 * Keys never change format — they are internal to the registry and
 * used only for map storage.
 */
function scopeKey(scope: PromptScope, promptState: PromptState): string {
	switch (scope.level) {
		case 'global':
			return `global::${promptState}`;
		case 'profile':
			return `profile::${scope.profileId}::${promptState}`;
		case 'phase':
			return `phase::${scope.profileId}::${scope.phaseId}::${promptState}`;
		case 'document':
			return `document::${scope.profileId}::${scope.documentId}::${promptState}`;
		case 'node':
			return `node::${scope.profileId}::${scope.nodeType}::${promptState}`;
	}
}

// ─── PromptRegistry ─────────────────────────────────────────────────────────

/**
 * Centralized store that maps prompt definitions by scope and state.
 *
 * Supports exact lookups and hierarchical fallback:
 *   node → document → phase → profile → global.
 *
 * When a node-scoped prompt is registered with optional `documentId` or
 * `phaseId` metadata, those levels are also queried during fallback.
 *
 * Additionally, a dotted `nodeType` like `"a.b.c"` triggers a best-effort
 * hierarchical fallback: document `"a.b"`, phase `"a"`.
 */
export class PromptRegistry {
	/** Internal map: scope key → definition. */
	private readonly _prompts = new Map<string, PromptDefinition>();

	/**
	 * Create a registry. By default, loads `DEFAULT_FALLBACK_PROMPTS`
	 * so every `PromptState` has at least a global fallback.
	 *
	 * Pass `{ loadDefaults: false }` to create an empty registry (useful
	 * in tests that do not want any pre-seeded prompts).
	 *
	 * Pass `{ defaults: [...] }` to use a custom set of fallback prompts.
	 */
	constructor(options: PromptRegistryOptions = {}) {
		const loadDefaults = options.loadDefaults ?? true;
		if (loadDefaults) {
			const defaults = options.defaults ?? DEFAULT_FALLBACK_PROMPTS;
			for (const prompt of defaults) {
				this.register(prompt);
			}
		}
	}

	// ── Registration ──────────────────────────────────────────────────────

	/**
	 * Register a prompt definition.
	 *
	 * If a prompt with the same scope + promptState already exists, it is
	 * overwritten (last-write-wins).
	 */
	register(prompt: PromptDefinition): void {
		const key = scopeKey(prompt.scope, prompt.promptState);
		this._prompts.set(key, prompt);
	}

	// ── Lookup ────────────────────────────────────────────────────────────

	/**
	 * Find the most specific prompt for the given profile, node type,
	 * and prompt state.
	 *
	 * Fallback chain (ordered):
	 * 1. Node-scoped: `{ profileId, nodeType }`
	 * 2. Node's optional `documentId` → document-scoped
	 * 3. Node's optional `phaseId` → phase-scoped
	 * 4. Hierarchical from dotted `nodeType`: `a.b.c` → document `a.b`, phase `a`
	 * 5. Profile-scoped: `{ profileId }`
	 * 6. Global prompt-state fallback.
	 *
	 * @returns The matching `PromptDefinition`, or `null` if no fallback exists.
	 */
	lookup(
		profileId: string,
		nodeType: string,
		promptState: PromptState,
	): PromptDefinition | null {
		// 1. Direct node-scoped match.
		let def = this._get('node', { nodeType, profileId }, promptState);
		if (def) return def;

		// 2. Derive document & phase from registered node-scoped metadata.
		const meta = this._getNodeScopeMeta(profileId, nodeType);
		if (meta) {
			if (meta.documentId) {
				def = this._get(
					'document',
					{ documentId: meta.documentId, profileId },
					promptState,
				);
				if (def) return def;
			}
			if (meta.phaseId) {
				def = this._get(
					'phase',
					{ phaseId: meta.phaseId, profileId },
					promptState,
				);
				if (def) return def;
			}
		}

		// 3. Hierarchical fallback from dotted nodeType.
		const parts = nodeType.split('.');
		if (parts.length > 1) {
			// Document-level: all segments except the last.
			const docFromType = parts.slice(0, -1).join('.');
			def = this._get(
				'document',
				{ documentId: docFromType, profileId },
				promptState,
			);
			if (def) return def;

			// Phase-level: first segment only.
			if (parts.length > 2 && parts[0] !== undefined) {
				const phaseFromType = parts[0];
				def = this._get(
					'phase',
					{ phaseId: phaseFromType, profileId },
					promptState,
				);
				if (def) return def;
			}
		}

		// 4. Profile-scoped.
		def = this._get('profile', { profileId }, promptState);
		if (def) return def;

		// 5. Global fallback.
		return this._get('global', {}, promptState);
	}

	// ── ID lookup ───────────────────────────────────────────────────────

	/**
	 * Look up a prompt definition by its unique `PromptId`.
	 *
	 * This is used when `NodePromptRefs` provide a direct prompt reference
	 * for a specific state, bypassing the scope-based fallback chain.
	 *
	 * @returns The matching `PromptDefinition`, or `null` if not found.
	 */
	getById(id: PromptId): PromptDefinition | null {
		for (const def of this._prompts.values()) {
			if (def.id === id) return def;
		}
		return null;
	}

	// ── Filesystem loading ────────────────────────────────────────────────

	/**
	 * Recursively load `.md` prompt files from a directory.
	 *
	 * Each file may optionally include YAML frontmatter delimited by `---`:
	 *
	 * ```md
	 * ---
	 * id: startup.foundation.thesis.initial
	 * promptState: initial
	 * version: 1.0.0
	 * scope:
	 *   level: node
	 *   profileId: startup
	 *   nodeType: foundation.thesis
	 *   documentId: foundation
	 *   phaseId: 01-foundation
	 * outputSchemaRef: optional
	 * ---
	 * Content of the prompt…
	 * ```
	 *
	 * If a file has no frontmatter, the registry attempts to infer a
	 * global-scope prompt from the filename (e.g., `initial.md` →
	 * `promptState: 'initial'`, `scope: { level: 'global' }`).
	 *
	 * Non-`.md` files and directories that cannot be read are silently skipped.
	 */
	async loadPromptsFromDirectory(dir: string): Promise<void> {
		const entries = readdirSync(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = join(dir, entry.name);

			if (entry.isDirectory()) {
				await this.loadPromptsFromDirectory(fullPath);
				continue;
			}

			if (!entry.isFile() || extname(entry.name) !== '.md') {
				continue;
			}

			try {
				const raw = readFileSync(fullPath, 'utf-8');
				const parsed = this._parsePromptFile(raw, entry.name);
				if (parsed) {
					this.register(parsed);
				}
			} catch {
				// Silently skip unreadable files.
			}
		}
	}

	// ── Private helpers ────────────────────────────────────────────────────

	/**
	 * Look up a prompt by scope level and partial scope properties.
	 */
	private _get(
		level: PromptScopeLevel,
		props: Partial<{
			profileId: string;
			nodeType: string;
			documentId: string;
			phaseId: string;
		}>,
		promptState: PromptState,
	): PromptDefinition | null {
		let scope: PromptScope;
		switch (level) {
			case 'global':
				scope = { level: 'global' };
				break;
			case 'profile':
				if (!props.profileId) return null;
				scope = { level: 'profile', profileId: props.profileId };
				break;
			case 'phase':
				if (!props.profileId || !props.phaseId) return null;
				scope = {
					level: 'phase',
					phaseId: props.phaseId,
					profileId: props.profileId,
				};
				break;
			case 'document':
				if (!props.profileId || !props.documentId) return null;
				scope = {
					documentId: props.documentId,
					level: 'document',
					profileId: props.profileId,
				};
				break;
			case 'node':
				if (!props.profileId || !props.nodeType) return null;
				scope = {
					level: 'node',
					nodeType: props.nodeType,
					profileId: props.profileId,
				};
				break;
		}
		return this._prompts.get(scopeKey(scope, promptState)) ?? null;
	}

	/**
	 * Scan registered node-scoped prompts for a given profile + nodeType
	 * and return any optional `documentId` or `phaseId` metadata.
	 */
	private _getNodeScopeMeta(
		profileId: string,
		nodeType: string,
	): { documentId?: string; phaseId?: string } | null {
		// We iterate over all registered prompts to find any node-scoped
		// entry for this profile + nodeType. In practice, a node will
		// have at most a handful of state-specific prompts, so O(n) is fine.
		for (const def of this._prompts.values()) {
			if (
				def.scope.level === 'node' &&
				def.scope.profileId === profileId &&
				def.scope.nodeType === nodeType
			) {
				const result: { documentId?: string; phaseId?: string } = {};
				if (def.scope.documentId !== undefined) {
					result.documentId = def.scope.documentId;
				}
				if (def.scope.phaseId !== undefined) {
					result.phaseId = def.scope.phaseId;
				}
				return result;
			}
		}
		return null;
	}

	/**
	 * Parse a raw `.md` file string into a `PromptDefinition`, or return
	 * `null` if the file cannot be parsed.
	 */
	private _parsePromptFile(
		raw: string,
		filename: string,
	): PromptDefinition | null {
		// Try frontmatter parsing first.
		const fm = this._extractFrontmatter(raw);
		if (fm) {
			const content = raw.slice(fm.contentStart).trim();
			return this._frontmatterToDefinition(fm.data, content);
		}

		// Fallback: infer global prompt from filename.
		const inferredState = this._inferPromptStateFromFilename(filename);
		if (!inferredState) return null;

		return {
			content: raw.trim(),
			id: `global.${inferredState}` as PromptId,
			promptState: inferredState,
			scope: { level: 'global' },
			version: '0.0.0',
		};
	}

	/**
	 * Extract YAML frontmatter delimited by `---`.
	 *
	 * Returns the parsed data and the byte offset where content begins,
	 * or `null` if no frontmatter is present.
	 */
	private _extractFrontmatter(
		raw: string,
	): { data: Record<string, unknown>; contentStart: number } | null {
		const trimmed = raw.trimStart();
		if (!trimmed.startsWith('---')) return null;

		const secondDelim = trimmed.indexOf('---', 3);
		if (secondDelim === -1) return null;

		const yamlBlock = trimmed.slice(3, secondDelim).trim();
		if (!yamlBlock) return null;

		try {
			const data = parseYaml(yamlBlock) as Record<string, unknown>;
			return { contentStart: secondDelim + 3, data };
		} catch {
			return null;
		}
	}

	/**
	 * Convert parsed frontmatter data to a `PromptDefinition`.
	 */
	private _frontmatterToDefinition(
		data: Record<string, unknown>,
		content: string,
	): PromptDefinition | null {
		const id = typeof data.id === 'string' ? (data.id as PromptId) : null;
		const promptState = this._asPromptState(data.promptState);
		const version = typeof data.version === 'string' ? data.version : '0.0.0';

		if (!id || !promptState) return null;

		const scope = this._parseScope(data.scope);
		if (!scope) return null;

		const hasSchemaRef = typeof data.outputSchemaRef === 'string';

		return {
			content,
			id,
			promptState,
			scope,
			version,
			...(hasSchemaRef
				? { outputSchemaRef: data.outputSchemaRef as string }
				: {}),
		};
	}

	/**
	 * Parse a scope value from frontmatter data.
	 */
	private _parseScope(raw: unknown): PromptScope | null {
		if (typeof raw !== 'object' || raw === null) return null;
		const s = raw as Record<string, unknown>;

		const level = s.level;
		if (typeof level !== 'string') return null;

		switch (level) {
			case 'global':
				return { level: 'global' };
			case 'profile': {
				const profileId = s.profileId;
				if (typeof profileId !== 'string') return null;
				return { level: 'profile', profileId };
			}
			case 'phase': {
				const profileId = s.profileId;
				const phaseId = s.phaseId;
				if (typeof profileId !== 'string' || typeof phaseId !== 'string')
					return null;
				return { level: 'phase', phaseId, profileId };
			}
			case 'document': {
				const profileId = s.profileId;
				const documentId = s.documentId;
				if (typeof profileId !== 'string' || typeof documentId !== 'string')
					return null;
				const hasPhase = typeof s.phaseId === 'string';
				return {
					documentId,
					level: 'document' as const,
					profileId,
					...(hasPhase ? { phaseId: s.phaseId as string } : {}),
				};
			}
			case 'node': {
				const profileId = s.profileId;
				const nodeType = s.nodeType;
				if (typeof profileId !== 'string' || typeof nodeType !== 'string')
					return null;
				const hasDoc = typeof s.documentId === 'string';
				const hasPhase = typeof s.phaseId === 'string';
				return {
					level: 'node' as const,
					nodeType,
					profileId,
					...(hasDoc ? { documentId: s.documentId as string } : {}),
					...(hasPhase ? { phaseId: s.phaseId as string } : {}),
				};
			}
			default:
				return null;
		}
	}

	/** Type-narrow a value to `PromptState`. */
	private _asPromptState(raw: unknown): PromptState | null {
		const valid = new Set<PromptState>([
			'initial',
			'follow_up',
			'clarification',
			'refinement',
			'synthesis',
			'review',
			'repair',
			'blocked',
			'accepted',
		]);
		if (typeof raw === 'string' && valid.has(raw as PromptState)) {
			return raw as PromptState;
		}
		return null;
	}

	/**
	 * Infer a `PromptState` from a filename like `initial.md`.
	 */
	private _inferPromptStateFromFilename(filename: string): PromptState | null {
		const base = basename(filename, extname(filename)).toLowerCase();
		return this._asPromptState(base);
	}
}
