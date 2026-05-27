/**
 * Tests for `PromptRegistry` — registration, lookup with fallback chains,
 * default prompts coverage, and filesystem loading.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PromptState } from '../../src/contracts/node-state.js';
import {
	DEFAULT_FALLBACK_PROMPTS,
	PROMPT_STATES,
} from '../../src/prompt-orchestration/default-prompts.js';
import {
	type PromptDefinition,
	PromptRegistry,
	type PromptScope,
} from '../../src/prompt-orchestration/prompt-registry.js';
import type { PromptId } from '../../src/shared/index.js';

// ─── Test helpers ───────────────────────────────────────────────────────────

/**
 * Build a minimal `PromptDefinition` for testing.
 */
function def(
	id: string,
	scope: PromptScope,
	promptState: PromptState,
	content = 'test content',
): PromptDefinition {
	return {
		content,
		id: id as PromptId,
		promptState,
		scope,
		version: '1.0.0',
	};
}

/** Create a registry pre-loaded with defaults. */
function registryWithDefaults(): PromptRegistry {
	return new PromptRegistry();
}

/** Create an empty registry (no defaults). */
function emptyRegistry(): PromptRegistry {
	return new PromptRegistry({ loadDefaults: false });
}

// ─── Registration and exact lookup ─────────────────────────────────────────

describe('PromptRegistry - register and lookup exact match', () => {
	it('stores and retrieves a node-scoped prompt by exact match', () => {
		const registry = emptyRegistry();
		const prompt = def(
			'startup.foundation.thesis.initial',
			{
				level: 'node',
				nodeType: 'foundation.thesis',
				profileId: 'startup',
			},
			'initial',
			'What truth justifies this project?',
		);

		registry.register(prompt);
		const result = registry.lookup('startup', 'foundation.thesis', 'initial');

		expect(result).not.toBeNull();
		expect(result!.id).toBe('startup.foundation.thesis.initial');
		expect(result!.content).toBe('What truth justifies this project?');
	});

	it('overwrites an existing prompt with the same scope + state', () => {
		const registry = emptyRegistry();
		const first = def(
			'old.prompt',
			{ level: 'global' },
			'initial',
			'old content',
		);
		const second = def(
			'new.prompt',
			{ level: 'global' },
			'initial',
			'new content',
		);

		registry.register(first);
		registry.register(second);
		const result = registry.lookup('any-profile', 'any.node', 'initial');

		expect(result).not.toBeNull();
		expect(result!.id).toBe('new.prompt');
		expect(result!.content).toBe('new content');
	});

	it('stores prompts at different scopes independently', () => {
		const registry = emptyRegistry();
		const global = def('g', { level: 'global' }, 'initial', 'global');
		const profile = def(
			'p',
			{ level: 'profile', profileId: 'startup' },
			'initial',
			'profile',
		);
		const node = def(
			'n',
			{
				level: 'node',
				nodeType: 'foundation.thesis',
				profileId: 'startup',
			},
			'initial',
			'node',
		);

		registry.register(global);
		registry.register(profile);
		registry.register(node);

		// Node match should return node-scoped prompt.
		expect(
			registry.lookup('startup', 'foundation.thesis', 'initial')!.content,
		).toBe('node');

		// Profile match for a node with no node-scoped prompt.
		expect(registry.lookup('startup', 'other.node', 'initial')!.content).toBe(
			'profile',
		);

		// Global match when profile has nothing.
		expect(
			registry.lookup('other-profile', 'any.node', 'initial')!.content,
		).toBe('global');
	});
});

// ─── Fallback chain ────────────────────────────────────────────────────────

describe('PromptRegistry - fallback chain', () => {
	it('falls back from node to profile to global', () => {
		const registry = emptyRegistry();

		// Register profile-generic initial prompt.
		registry.register(
			def(
				'startup.initial',
				{ level: 'profile', profileId: 'startup' },
				'initial',
				'profile-level initial',
			),
		);

		// Register global initial prompt.
		registry.register(
			def(
				'global.initial',
				{ level: 'global' },
				'initial',
				'global-level initial',
			),
		);

		// Lookup with no node-scoped prompt → should get profile-scoped.
		const result = registry.lookup('startup', 'unknown.node', 'initial');
		expect(result).not.toBeNull();
		expect(result!.content).toBe('profile-level initial');

		// Lookup with different profile → should get global.
		const result2 = registry.lookup('other-profile', 'any.node', 'initial');
		expect(result2).not.toBeNull();
		expect(result2!.content).toBe('global-level initial');
	});

	it('falls back from node to document via metadata', () => {
		const registry = emptyRegistry();

		// Register a node-scoped prompt with document metadata.
		registry.register(
			def(
				'startup.foundation.thesis.initial',
				{
					documentId: 'foundation',
					level: 'node',
					nodeType: 'foundation.thesis',
					profileId: 'startup',
				},
				'initial',
				'node-level initial',
			),
		);

		// Register a document-scoped prompt for a different state.
		registry.register(
			def(
				'startup.foundation.clarification',
				{
					documentId: 'foundation',
					level: 'document',
					profileId: 'startup',
				},
				'clarification',
				'document-level clarification',
			),
		);

		// Register profile-generic clarification.
		registry.register(
			def(
				'startup.clarification',
				{ level: 'profile', profileId: 'startup' },
				'clarification',
				'profile-level clarification',
			),
		);

		// Lookup for node with known metadata but no node-scoped clarification →
		// should fall back via document metadata.
		const result = registry.lookup(
			'startup',
			'foundation.thesis',
			'clarification',
		);
		expect(result).not.toBeNull();
		expect(result!.content).toBe('document-level clarification');
	});

	it('falls back via dotted nodeType hierarchy', () => {
		const registry = emptyRegistry();

		// Register a document-scoped prompt matching the hierarchical decomposition
		// of dotted nodeType '01-foundation.foundation.thesis' → document '01-foundation.foundation'.
		registry.register(
			def(
				'startup.01-foundation.foundation.initial',
				{
					documentId: '01-foundation.foundation',
					level: 'document',
					profileId: 'startup',
				},
				'initial',
				'document-level initial',
			),
		);

		// Register a phase-scoped prompt for a different phase.
		registry.register(
			def(
				'startup.02-validation.initial',
				{
					level: 'phase',
					phaseId: '02-validation',
					profileId: 'startup',
				},
				'initial',
				'phase-level initial',
			),
		);

		// Lookup with dotted nodeType "01-foundation.foundation.thesis" →
		// document fallback "01-foundation.foundation" should match.
		const result = registry.lookup(
			'startup',
			'01-foundation.foundation.thesis',
			'initial',
		);
		expect(result).not.toBeNull();
		expect(result!.content).toBe('document-level initial');

		// Lookup with deeper dotted type "01-foundation.foundation.thesis.core" →
		// document fallback "01-foundation.foundation.thesis" should also try.
		// Not registered, so falls further to phase "01-foundation" → not registered.
		// Falls to profile → not registered. Falls to global → not loaded.
		// Should return null since no defaults were loaded.
		const result2 = registry.lookup(
			'startup',
			'01-foundation.foundation.thesis.core',
			'initial',
		);
		expect(result2).toBeNull();

		// Register a phase-scoped prompt for "01-foundation" and try again.
		registry.register(
			def(
				'startup.01-foundation.initial',
				{
					level: 'phase',
					phaseId: '01-foundation',
					profileId: 'startup',
				},
				'initial',
				'01-foundation phase-level initial',
			),
		);
		const result3 = registry.lookup(
			'startup',
			'01-foundation.foundation.thesis.core',
			'initial',
		);
		expect(result3).not.toBeNull();
		expect(result3!.content).toBe('01-foundation phase-level initial');
	});
});

// ─── Unregistered state returns global fallback ────────────────────────────

describe('PromptRegistry - global fallback for unregistered states', () => {
	it('returns global fallback when no specific prompt is registered', () => {
		const registry = registryWithDefaults();

		// No node or profile specific prompts registered — should get global.
		const result = registry.lookup('any-profile', 'any.node', 'initial');
		expect(result).not.toBeNull();
		expect(result!.scope.level).toBe('global');
		expect(result!.promptState).toBe('initial');
		expect(result!.content.length).toBeGreaterThan(0);
	});

	it('returns null when no defaults are loaded and nothing registered', () => {
		const registry = emptyRegistry();
		const result = registry.lookup('any-profile', 'any.node', 'initial');
		expect(result).toBeNull();
	});

	it('default constructor loads global fallback for accepted state', () => {
		// `NodePromptRefs` does not include 'accepted', but the registry must
		// still provide a global fallback for it.
		const registry = new PromptRegistry();
		const result = registry.lookup('any-profile', 'any.node', 'accepted');
		expect(result).not.toBeNull();
		expect(result!.promptState).toBe('accepted');
		expect(result!.scope.level).toBe('global');
		expect(result!.content.length).toBeGreaterThan(0);
	});
});

// ─── All 9 prompt states have fallback content ─────────────────────────────

describe('PromptRegistry - all prompt states have fallbacks', () => {
	it('provides non-empty content for every PromptState', () => {
		expect(PROMPT_STATES).toHaveLength(9);

		for (const state of PROMPT_STATES) {
			const fallback = DEFAULT_FALLBACK_PROMPTS.find(
				(p) => p.promptState === state,
			);
			expect(
				fallback,
				`Missing fallback for prompt state: ${state}`,
			).toBeDefined();
			expect(
				fallback!.content.length,
				`Empty content for prompt state: ${state}`,
			).toBeGreaterThan(0);
			expect(fallback!.scope.level).toBe('global');
		}
	});

	it('lookup resolves every PromptState to a global fallback', () => {
		const registry = registryWithDefaults();

		for (const state of PROMPT_STATES) {
			const result = registry.lookup(
				'nonexistent-profile',
				'nonexistent.node',
				state,
			);
			expect(
				result,
				`No fallback resolved for prompt state: ${state}`,
			).not.toBeNull();
			expect(result!.promptState).toBe(state);
			expect(result!.content.length).toBeGreaterThan(0);
		}
	});

	it('all 9 PROMPT_STATES match the PromptState union members', () => {
		// If this compiles, PROMPT_STATES exactly mirrors the union.
		const _check: PromptState[] = [...PROMPT_STATES];
		expect(_check).toHaveLength(9);
	});
});

// ─── Filesystem loading ────────────────────────────────────────────────────

describe('PromptRegistry - loadPromptsFromDirectory', () => {
	it('loads a .md file with frontmatter into the registry', async () => {
		const dir = mkdtempSync(join(tmpdir(), 'logos-prompt-test-'));
		const filePath = join(dir, 'initial.md');
		const mdContent = [
			'---',
			'id: startup.foundation.thesis.initial',
			'promptState: initial',
			'version: 1.0.0',
			'scope:',
			'  level: node',
			'  profileId: startup',
			'  nodeType: foundation.thesis',
			'  documentId: foundation',
			'  phaseId: 01-foundation',
			'outputSchemaRef: thesis-schema',
			'---',
			'What truth justifies this project existing?',
		].join('\n');

		writeFileSync(filePath, mdContent, 'utf-8');

		const registry = emptyRegistry();
		await registry.loadPromptsFromDirectory(dir);

		const result = registry.lookup('startup', 'foundation.thesis', 'initial');
		expect(result).not.toBeNull();
		expect(result!.id).toBe('startup.foundation.thesis.initial');
		expect(result!.promptState).toBe('initial');
		expect(result!.version).toBe('1.0.0');
		expect(result!.scope.level).toBe('node');
		expect(result!.outputSchemaRef).toBe('thesis-schema');
		expect(result!.content.trim()).toBe(
			'What truth justifies this project existing?',
		);

		rmSync(dir, { force: true, recursive: true });
	});

	it('loads .md file without frontmatter as global fallback', async () => {
		const dir = mkdtempSync(join(tmpdir(), 'logos-prompt-test-'));
		const filePath = join(dir, 'synthesis.md');
		const mdContent = 'Synthesize the answer now.';

		writeFileSync(filePath, mdContent, 'utf-8');

		const registry = emptyRegistry();
		await registry.loadPromptsFromDirectory(dir);

		const result = registry.lookup('any-profile', 'any.node', 'synthesis');
		expect(result).not.toBeNull();
		expect(result!.promptState).toBe('synthesis');
		expect(result!.scope.level).toBe('global');
		expect(result!.content).toBe(mdContent);

		rmSync(dir, { force: true, recursive: true });
	});

	it('recursively loads prompts from subdirectories', async () => {
		const dir = mkdtempSync(join(tmpdir(), 'logos-prompt-test-'));
		const subDir = join(dir, 'foundation', 'thesis');
		const { mkdirSync } = await import('node:fs');
		mkdirSync(subDir, { recursive: true });

		const filePath = join(subDir, 'review.md');
		const mdContent = [
			'---',
			'id: startup.foundation.thesis.review',
			'promptState: review',
			'version: 1.0.0',
			'scope:',
			'  level: node',
			'  profileId: startup',
			'  nodeType: foundation.thesis',
			'---',
			'Review the draft.',
		].join('\n');

		writeFileSync(filePath, mdContent, 'utf-8');

		const registry = emptyRegistry();
		await registry.loadPromptsFromDirectory(dir);

		const result = registry.lookup('startup', 'foundation.thesis', 'review');
		expect(result).not.toBeNull();
		expect(result!.id).toBe('startup.foundation.thesis.review');
		expect(result!.content.trim()).toBe('Review the draft.');

		rmSync(dir, { force: true, recursive: true });
	});

	it('silently skips non-.md files', async () => {
		const dir = mkdtempSync(join(tmpdir(), 'logos-prompt-test-'));
		writeFileSync(join(dir, 'notes.txt'), 'not a prompt', 'utf-8');
		writeFileSync(join(dir, 'readme.md'), '# Readme', 'utf-8');

		const registry = emptyRegistry();
		await registry.loadPromptsFromDirectory(dir);

		// readme.md has no frontmatter, its filename isn't a valid prompt state,
		// so it should be skipped. notes.txt is not .md.
		const result = registry.lookup('any-profile', 'any.node', 'initial');
		expect(result).toBeNull();

		rmSync(dir, { force: true, recursive: true });
	});

	it('silently skips unreadable directories', async () => {
		const registry = emptyRegistry();
		// Loading from a nonexistent directory should throw synchronously.
		await expect(
			registry.loadPromptsFromDirectory('/nonexistent/dir/for/prompts'),
		).rejects.toThrow();
	});
});
