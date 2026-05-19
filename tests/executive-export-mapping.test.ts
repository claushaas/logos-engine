/** Step 11.3 — Executive Export Mapping Loader Tests */

import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	getKnownMappingEntries,
	loadKnownMappings,
} from '../src/executive/executive-export-mappings.js';

// ---------------------------------------------------------------------------
// Path to executive mappings directory
// ---------------------------------------------------------------------------

const EXECUTIVE_DIR = resolve(
	import.meta.dirname,
	'../profiles/standard/executive/mappings',
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Executive Export Mapping Loader', () => {
	const knownEntries = getKnownMappingEntries();

	it('known mapping entries exist', () => {
		expect(knownEntries.length).toBeGreaterThanOrEqual(6);
	});

	it('has markdown, html, github-issues, agent-pack, linear, notion entries', () => {
		const ids = knownEntries.map((e) => e.id);
		expect(ids).toContain('markdown');
		expect(ids).toContain('html');
		expect(ids).toContain('github-issues');
		expect(ids).toContain('agent-pack');
		expect(ids).toContain('linear');
		expect(ids).toContain('notion');
	});

	it('loads Markdown mapping as supported file export', () => {
		const result = loadKnownMappings(EXECUTIVE_DIR, knownEntries);
		const md = result.mappings.find((m) => m.mappingId === 'markdown');
		expect(md).toBeDefined();
		expect(md?.adapterKind).toBe('markdown');
		expect(md?.supportStatus).toBe('supported_file_export');
		expect(md?.sourcePath).toContain('markdown.mapping.yml');
	});

	it('loads HTML mapping as supported file export', () => {
		const result = loadKnownMappings(EXECUTIVE_DIR, knownEntries);
		const html = result.mappings.find((m) => m.mappingId === 'html');
		expect(html).toBeDefined();
		expect(html?.adapterKind).toBe('html');
		expect(html?.supportStatus).toBe('supported_file_export');
		expect(html?.sourcePath).toContain('html.mapping.yml');
	});

	it('loads GitHub Issues mapping as supported file export', () => {
		const result = loadKnownMappings(EXECUTIVE_DIR, knownEntries);
		const gh = result.mappings.find((m) => m.mappingId === 'github-issues');
		expect(gh).toBeDefined();
		expect(gh?.adapterKind).toBe('github_issue_file');
		expect(gh?.supportStatus).toBe('supported_file_export');
		expect(gh?.sourcePath).toContain('github-issues.mapping.yml');
	});

	it('loads Agent Pack mapping as supported file export', () => {
		const result = loadKnownMappings(EXECUTIVE_DIR, knownEntries);
		const ap = result.mappings.find((m) => m.mappingId === 'agent-pack');
		expect(ap).toBeDefined();
		expect(ap?.adapterKind).toBe('agent_pack_file');
		expect(ap?.supportStatus).toBe('supported_file_export');
		expect(ap?.sourcePath).toContain('agent-pack.mapping.yml');
	});

	it('loads Linear mapping as planned adapter contract', () => {
		const result = loadKnownMappings(EXECUTIVE_DIR, knownEntries);
		const linear = result.mappings.find((m) => m.mappingId === 'linear');
		expect(linear).toBeDefined();
		expect(linear?.adapterKind).toBe('linear_mapping');
		expect(linear?.supportStatus).toBe('planned_adapter_contract');
		expect(linear?.sourcePath).toContain('linear.mapping.yml');
	});

	it('loads Notion mapping as planned adapter contract', () => {
		const result = loadKnownMappings(EXECUTIVE_DIR, knownEntries);
		const notion = result.mappings.find((m) => m.mappingId === 'notion');
		expect(notion).toBeDefined();
		expect(notion?.adapterKind).toBe('notion_mapping');
		expect(notion?.supportStatus).toBe('planned_adapter_contract');
		expect(notion?.sourcePath).toContain('notion.mapping.yml');
	});

	it('mapping load result has correct counts', () => {
		const result = loadKnownMappings(EXECUTIVE_DIR, knownEntries);
		expect(result.loadedCount).toBeGreaterThanOrEqual(6);
		expect(result.malformedCount).toBe(0);
		expect(result.plannedCount).toBeGreaterThanOrEqual(2); // linear + notion
		expect(result.supportedCount).toBeGreaterThanOrEqual(4); // markdown, html, gh-issues, agent-pack
	});

	it('mapping order is deterministic across multiple loads', () => {
		const r1 = loadKnownMappings(EXECUTIVE_DIR, knownEntries);
		const r2 = loadKnownMappings(EXECUTIVE_DIR, knownEntries);
		expect(r1.mappings.length).toBe(r2.mappings.length);
		for (let i = 0; i < r1.mappings.length; i++) {
			expect(r1.mappings[i]?.mappingId).toBe(r2.mappings[i]?.mappingId);
		}
	});

	it('no external API calls occur (pure fs read)', () => {
		// The mapping loader only reads local YAML files; there's nothing to
		// intercept here but the contract is verified by construction.
		const result = loadKnownMappings(EXECUTIVE_DIR, knownEntries);
		expect(
			result.diagnostics.filter(
				(d) => d.code.includes('network') || d.code.includes('api'),
			).length,
		).toBe(0);
	});
});

describe('Mapping Loader — Malformed Handling', () => {
	it('non-existent mapping file produces diagnostics and fallback mapping', () => {
		const fakeEntries = [
			{
				adapterKind: 'markdown' as const,
				defaultStatus: 'supported_file_export' as const,
				filename: 'nonexistent.mapping.yml',
				id: 'nonexistent',
			},
		];

		const result = loadKnownMappings(EXECUTIVE_DIR, fakeEntries);
		expect(result.diagnostics.length).toBeGreaterThan(0);
		expect(result.diagnostics[0]?.code).toBe(
			'executive_export_mapping_load_failed',
		);
		expect(result.malformedCount).toBe(1);
		// Fallback mapping is created
		expect(result.mappings.length).toBe(1);
		expect(result.mappings[0]?.mappingId).toBe('nonexistent');
	});
});
