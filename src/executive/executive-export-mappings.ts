/** Step 11.3 — Executive Export Mapping loader/normalizer */

import { readFileSync } from 'node:fs';
import type {
	ExecutiveExportAdapterKind,
	ExecutiveExportDiagnostic,
	ExecutiveExportMapping,
	ExecutiveExportMappingOutput,
	ExecutiveExportMappingTarget,
	ExecutiveExportSupportStatus,
} from './executive-export-model.js';

// ---------------------------------------------------------------------------
// Mapping file declaration
// ---------------------------------------------------------------------------

export interface ExecutiveExportMappingFile {
	readonly sourcePath: string;
	readonly data: unknown;
}

// ---------------------------------------------------------------------------
// Load result
// ---------------------------------------------------------------------------

export interface ExecutiveExportMappingLoadResult {
	readonly mappings: readonly ExecutiveExportMapping[];
	readonly diagnostics: readonly ExecutiveExportDiagnostic[];
	readonly loadedCount: number;
	readonly malformedCount: number;
	readonly plannedCount: number;
	readonly supportedCount: number;
}

// ---------------------------------------------------------------------------
// Known mapping paths relative to profiles/standard/executive/mappings/
// ---------------------------------------------------------------------------

const KNOWN_MAPPINGS: Array<{
	id: string;
	filename: string;
	adapterKind: ExecutiveExportAdapterKind;
	defaultStatus: ExecutiveExportSupportStatus;
}> = [
	{
		adapterKind: 'markdown',
		defaultStatus: 'supported_file_export',
		filename: 'markdown.mapping.yml',
		id: 'markdown',
	},
	{
		adapterKind: 'html',
		defaultStatus: 'supported_file_export',
		filename: 'html.mapping.yml',
		id: 'html',
	},
	{
		adapterKind: 'github_issue_file',
		defaultStatus: 'supported_file_export',
		filename: 'github-issues.mapping.yml',
		id: 'github-issues',
	},
	{
		adapterKind: 'agent_pack_file',
		defaultStatus: 'supported_file_export',
		filename: 'agent-pack.mapping.yml',
		id: 'agent-pack',
	},
	{
		adapterKind: 'linear_mapping',
		defaultStatus: 'planned_adapter_contract',
		filename: 'linear.mapping.yml',
		id: 'linear',
	},
	{
		adapterKind: 'notion_mapping',
		defaultStatus: 'planned_adapter_contract',
		filename: 'notion.mapping.yml',
		id: 'notion',
	},
];

// ---------------------------------------------------------------------------
// Minimal YAML parsing without external dependency
// ---------------------------------------------------------------------------

function parseMinimalYaml(raw: string): Record<string, unknown> {
	// Parse only the simple key-value and nested structures used by mapping files
	const result: Record<string, unknown> = {};
	const lines = raw.split('\n');
	let currentKey: string | null = null;
	let _currentList: unknown[] | undefined;
	let _currentMap: Record<string, unknown> | undefined;
	let listDepth = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined) continue;
		const trimmed = line.trimEnd();
		if (trimmed.trim() === '' || trimmed.startsWith('#')) continue;

		const indent = line.length - line.trimStart().length;

		// Simple key: value
		const keyValMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)/);
		if (keyValMatch) {
			const key = keyValMatch[1] as string;
			let val = keyValMatch[2]?.trim() ?? '';

			// Handle multiline > or |
			if (val === '>' || val === '|') {
				const blockLines: string[] = [];
				const baseIndent = indent + 2;
				for (let j = i + 1; j < lines.length; j++) {
					const nextLine = lines[j] ?? '';
					const nextIndent = nextLine.length - nextLine.trimStart().length;
					if (
						nextLine.trim() === '' ||
						(nextIndent >= baseIndent && nextLine.trimStart().length > 0)
					) {
						blockLines.push(nextLine.slice(baseIndent));
					} else {
						i = j - 1;
						break;
					}
				}
				val = blockLines.join(val === '|' ? '\n' : ' ').trim();
			}

			if (val === '' || val === 'null') {
				result[key] = null;
			} else if (val === 'true') {
				result[key] = true;
			} else if (val === 'false') {
				result[key] = false;
			} else {
				result[key] = val;
			}
			currentKey = key;
			_currentList = undefined;
			_currentMap = undefined;
			listDepth = indent;
			continue;
		}

		// List item: - value
		const listMatch = trimmed.match(/^-\s+(.*)/);
		if (listMatch) {
			const item = listMatch[1]?.trim() ?? '';
			if (currentKey) {
				const existing = result[currentKey];
				if (Array.isArray(existing)) {
					existing.push(item);
				} else {
					result[currentKey] = [item];
				}
				_currentList = result[currentKey] as unknown[];
			}
			continue;
		}

		// Sub-key:   key: value
		if (indent > listDepth && currentKey && trimmed.match(/^[a-zA-Z_]/)) {
			const subKeyVal = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)/);
			if (subKeyVal) {
				const subKey = subKeyVal[1] as string;
				const subVal = subKeyVal[2]?.trim() ?? '';
				const existing = result[currentKey];
				if (
					typeof existing === 'object' &&
					existing !== null &&
					!Array.isArray(existing)
				) {
					(existing as Record<string, unknown>)[subKey] =
						subVal === 'true'
							? true
							: subVal === 'false'
								? false
								: subVal || null;
				} else {
					const subMap: Record<string, unknown> = {
						[subKey]:
							subVal === 'true'
								? true
								: subVal === 'false'
									? false
									: subVal || null,
					};
					result[currentKey] = subMap;
				}
			}
		}
	}

	return result;
}

// ---------------------------------------------------------------------------
// Map status string from mapping to support status
// ---------------------------------------------------------------------------

function mapStatusToSupportStatus(
	status: string,
	defaultStatus: ExecutiveExportSupportStatus,
): ExecutiveExportSupportStatus {
	switch (status) {
		case 'supported':
			return 'supported_file_export';
		case 'planned':
			return 'planned_adapter_contract';
		case 'unsupported':
			return 'unsupported';
		case 'blocked':
			return 'blocked';
		default:
			return defaultStatus;
	}
}

// ---------------------------------------------------------------------------
// Normalize a single mapping file
// ---------------------------------------------------------------------------

function normalizeMapping(
	data: Record<string, unknown>,
	sourcePath: string,
	adapterKind: ExecutiveExportAdapterKind,
	defaultStatus: ExecutiveExportSupportStatus,
): {
	mapping: ExecutiveExportMapping;
	diagnostics: ExecutiveExportDiagnostic[];
} {
	const diagnostics: ExecutiveExportDiagnostic[] = [];
	const mappingId = (data.id as string) ?? adapterKind;
	const version = (data.version as string) ?? '1.0.0';
	const statusStr = (data.status as string) ?? 'unknown';
	const supportStatus = mapStatusToSupportStatus(statusStr, defaultStatus);
	const exportType = (data.exportType as string) ?? 'file_export';
	const outputFormat = (data.outputFormat as string) ?? 'markdown';
	const purpose = (data.purpose as string) ?? '';
	const templatePath = (data.template as string) ?? undefined;

	// Parse outputs
	let outputs: ExecutiveExportMappingOutput[] | undefined;
	if (data.outputs && typeof data.outputs === 'object') {
		const outputsMap = data.outputs as Record<string, Record<string, unknown>>;
		outputs = Object.entries(outputsMap).map(([id, entry]) => ({
			id,
			includes: Array.isArray(entry.includes)
				? (entry.includes as string[])
				: undefined,
			path: (entry.path as string) ?? `${id}.md`,
			templatePath: (entry.template as string) ?? undefined,
		}));
	}

	// Parse targets
	let targets: ExecutiveExportMappingTarget[] | undefined;
	if (data.targets && typeof data.targets === 'object') {
		const targetsMap = data.targets as Record<string, Record<string, unknown>>;
		targets = Object.entries(targetsMap).map(([id, entry]) => ({
			id,
			outputPath: (entry.outputPath as string) ?? `${id}/`,
			supportedItemTypes: Array.isArray(entry.supportedItemTypes)
				? (entry.supportedItemTypes as string[])
				: undefined,
		}));
	}

	// Determine primary output path
	let outputPath: string | undefined;
	if (outputs && outputs.length > 0) {
		outputPath = outputs[0]?.path;
	} else if (targets && targets.length > 0) {
		outputPath = targets[0]?.outputPath;
	}

	const mapping: ExecutiveExportMapping = {
		adapterKind,
		exportType,
		fields: (data.fields as Record<string, string>) ?? undefined,
		labels: (data.labels as Record<string, unknown>) ?? undefined,
		mappingId,
		maps: (data.maps as Record<string, string>) ?? undefined,
		metadata: (data.metadata as Record<string, unknown>) ?? undefined,
		name: mappingId,
		outputFormat,
		outputPath,
		outputs,
		pointer: undefined,
		promptRules: (data.promptRules as Record<string, unknown>) ?? undefined,
		purpose,
		rules: (data.rules as Record<string, unknown>) ?? undefined,
		sourcePath,
		supportStatus,
		targets,
		templatePath,
		unsupportedStrategy:
			((data.unsupported as Record<string, unknown>)?.strategy as string) ??
			undefined,
		version,
	};

	return { diagnostics, mapping };
}

// ---------------------------------------------------------------------------
// Load an individual mapping file
// ---------------------------------------------------------------------------

function loadMappingFile(sourcePath: string): {
	data: Record<string, unknown>;
	diagnostics: ExecutiveExportDiagnostic[];
} {
	const diagnostics: ExecutiveExportDiagnostic[] = [];
	try {
		const raw = readFileSync(sourcePath, 'utf-8');
		const data = parseMinimalYaml(raw);
		return { data, diagnostics };
	} catch (err) {
		diagnostics.push({
			code: 'executive_export_mapping_load_failed',
			mappingPath: sourcePath,
			message: `Failed to load mapping file: ${sourcePath}`,
			recoveryHint: String(err),
			severity: 'error',
		});
		return { data: {}, diagnostics };
	}
}

// ---------------------------------------------------------------------------
// Load all declared mappings from the executive mappings directory
// ---------------------------------------------------------------------------

export function loadExecutiveExportMappings(
	mappingsDir: string,
): ExecutiveExportMappingLoadResult {
	const diagnostics: ExecutiveExportDiagnostic[] = [];
	const mappings: ExecutiveExportMapping[] = [];
	let malformedCount = 0;

	for (const entry of KNOWN_MAPPINGS) {
		const sourcePath = `${mappingsDir}/${entry.filename}`;
		const { data, diagnostics: loadDiags } = loadMappingFile(sourcePath);
		diagnostics.push(...loadDiags);

		if (
			Object.keys(data as Record<string, unknown>).length === 0 &&
			loadDiags.length > 0
		) {
			malformedCount++;
			// Create a fallback mapping
			mappings.push({
				adapterKind: entry.adapterKind,
				exportType: 'file_export',
				mappingId: entry.id,
				name: entry.id,
				outputFormat: entry.adapterKind === 'html' ? 'html' : 'markdown',
				purpose: '',
				sourcePath,
				supportStatus: entry.defaultStatus,
				version: '1.0.0',
			});
			continue;
		}

		const { mapping, diagnostics: normDiags } = normalizeMapping(
			data as Record<string, unknown>,
			sourcePath,
			entry.adapterKind,
			entry.defaultStatus,
		);
		diagnostics.push(...normDiags);
		mappings.push(mapping);
	}

	const plannedCount = mappings.filter(
		(m) => m.supportStatus === 'planned_adapter_contract',
	).length;
	const supportedCount = mappings.filter(
		(m) => m.supportStatus === 'supported_file_export',
	).length;

	return {
		diagnostics,
		loadedCount: mappings.length - malformedCount,
		malformedCount,
		mappings,
		plannedCount,
		supportedCount,
	};
}

// ---------------------------------------------------------------------------
// Load mappings with known explicit files (used in tests)
// ---------------------------------------------------------------------------

export interface KnownMappingEntry {
	readonly id: string;
	readonly filename: string;
	readonly adapterKind: ExecutiveExportAdapterKind;
	readonly defaultStatus: ExecutiveExportSupportStatus;
}

export function loadKnownMappings(
	mappingsDir: string,
	known: readonly KnownMappingEntry[],
): ExecutiveExportMappingLoadResult {
	const diagnostics: ExecutiveExportDiagnostic[] = [];
	const mappings: ExecutiveExportMapping[] = [];
	let malformedCount = 0;

	for (const entry of known) {
		const sourcePath = `${mappingsDir}/${entry.filename}`;
		const { data, diagnostics: loadDiags } = loadMappingFile(sourcePath);
		diagnostics.push(...loadDiags);

		if (
			Object.keys(data as Record<string, unknown>).length === 0 &&
			loadDiags.length > 0
		) {
			malformedCount++;
			mappings.push({
				adapterKind: entry.adapterKind,
				exportType: 'file_export',
				mappingId: entry.id,
				name: entry.id,
				outputFormat: entry.adapterKind === 'html' ? 'html' : 'markdown',
				purpose: '',
				sourcePath,
				supportStatus: entry.defaultStatus,
				version: '1.0.0',
			});
			continue;
		}

		const { mapping, diagnostics: normDiags } = normalizeMapping(
			data as Record<string, unknown>,
			sourcePath,
			entry.adapterKind,
			entry.defaultStatus,
		);
		diagnostics.push(...normDiags);
		mappings.push(mapping);
	}

	const plannedCount = mappings.filter(
		(m) => m.supportStatus === 'planned_adapter_contract',
	).length;
	const supportedCount = mappings.filter(
		(m) => m.supportStatus === 'supported_file_export',
	).length;

	return {
		diagnostics,
		loadedCount: mappings.length - malformedCount,
		malformedCount,
		mappings,
		plannedCount,
		supportedCount,
	};
}

/**
 * Get the known mapping entries for tests and runtime.
 */
export function getKnownMappingEntries(): readonly KnownMappingEntry[] {
	return KNOWN_MAPPINGS;
}
