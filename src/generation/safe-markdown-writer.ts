/** Safe Markdown Writer — safe writes, manual edit detection, checksums, and write policies */

import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import {
	basename,
	dirname,
	extname,
	isAbsolute,
	join,
	normalize,
	relative,
	resolve,
} from 'node:path';
import { checkPathSafety } from '../fs/safe-filesystem.js';
import type {
	GeneratedMarkdownMetadata,
	ManualEditDetectionInput,
	ManualEditDetectionResult,
	ManualEditDiagnostic,
	ManualEditFsAdapter,
	ManualEditStatus,
	MarkdownWriteChangedPath,
	MarkdownWriteCollision,
	MarkdownWriteDiagnostic,
	MarkdownWritePlan,
	MarkdownWritePlanItem,
	MarkdownWritePlanSummary,
	MarkdownWriteStatus,
	SafeMarkdownWriteInput,
	SafeMarkdownWriteOptions,
	SafeMarkdownWritePolicy,
	SafeMarkdownWriteResult,
} from './markdown-writer-types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_DOCUMENTATION_ROOT = 'logos';
const _CHECKSUM_ALGORITHM = 'sha256';
const CHECKSUM_FIELD = 'contentChecksum';
const FRONTMATTER_DELIMITER = '---';

// ---------------------------------------------------------------------------
// Default filesystem adapter
// ---------------------------------------------------------------------------

const defaultFsAdapter: ManualEditFsAdapter = {
	async readFile(path: string, _encoding: 'utf-8') {
		return readFile(path, { encoding: 'utf-8' });
	},
	async stat(path: string) {
		const s = await stat(path);
		return {
			isDirectory: () => s.isDirectory(),
			isFile: () => s.isFile(),
		};
	},
};

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function _resolveTargetPath(relativePath: string, projectRoot: string): string {
	return normalize(resolve(projectRoot, relativePath));
}

function resolveDocumentationRoot(options: SafeMarkdownWriteOptions): string {
	if (options.documentationRoot) return options.documentationRoot;
	return DEFAULT_DOCUMENTATION_ROOT;
}

function _isPathWithinRoot(targetPath: string, root: string): boolean {
	const normalizedTarget = normalize(resolve(targetPath));
	const normalizedRoot = normalize(resolve(root));
	const rel = relative(normalizedRoot, normalizedTarget);
	if (rel.startsWith('..') || isAbsolute(rel)) return false;
	return true;
}

// ---------------------------------------------------------------------------
// Checksum helpers
// ---------------------------------------------------------------------------

function computeSha256(content: string): string {
	return createHash('sha256').update(content, 'utf-8').digest('hex');
}

function computeBodyChecksum(markdown: string): string {
	const body = extractBodyAfterFrontmatter(markdown);
	return computeSha256(body);
}

function computeFullChecksum(content: string): string {
	return computeSha256(content);
}

function extractBodyAfterFrontmatter(markdown: string): string {
	const trimmed = markdown.trimStart();
	if (!trimmed.startsWith(FRONTMATTER_DELIMITER)) {
		return markdown;
	}

	const rest = trimmed.slice(FRONTMATTER_DELIMITER.length);
	const closingIdx = rest.indexOf(`\n${FRONTMATTER_DELIMITER}`);

	if (closingIdx === -1) {
		return markdown;
	}

	let bodyStart = closingIdx + `\n${FRONTMATTER_DELIMITER}`.length;
	if (rest[bodyStart] === '\n') bodyStart++;
	return rest.slice(bodyStart);
}

// ---------------------------------------------------------------------------
// YAML frontmatter parser
// ---------------------------------------------------------------------------

function parseFrontmatter(markdown: string): GeneratedMarkdownMetadata {
	const parseErrors: string[] = [];
	const trimmed = markdown.trimStart();

	if (!trimmed.startsWith(FRONTMATTER_DELIMITER)) {
		return {
			checksum: '',
			contentAfterFrontmatter: markdown,
			frontmatterRaw: '',
			metadata: {
				canonicalOutput: '',
				documentId: '',
				generatedAt: '',
				generatedBy: '',
				generationStatus: '',
				phaseId: '',
				profileId: '',
				sourceStateSchemaVersion: '',
				traceability: [],
			},
			parsedSuccessfully: false,
			parseErrors: ['no_frontmatter_delimiter'],
		};
	}

	const rest = trimmed.slice(FRONTMATTER_DELIMITER.length);
	const closingIdx = rest.indexOf(`\n${FRONTMATTER_DELIMITER}`);

	if (closingIdx === -1) {
		return {
			checksum: '',
			contentAfterFrontmatter: markdown,
			frontmatterRaw: rest,
			metadata: {
				canonicalOutput: '',
				documentId: '',
				generatedAt: '',
				generatedBy: '',
				generationStatus: '',
				phaseId: '',
				profileId: '',
				sourceStateSchemaVersion: '',
				traceability: [],
			},
			parsedSuccessfully: false,
			parseErrors: ['unclosed_frontmatter'],
		};
	}

	const frontmatterRaw = rest.slice(0, closingIdx);
	let contentAfterFrontmatter = rest.slice(
		closingIdx + `\n${FRONTMATTER_DELIMITER}`.length,
	);
	if (contentAfterFrontmatter.startsWith('\n')) {
		contentAfterFrontmatter = contentAfterFrontmatter.slice(1);
	}

	const yamlLines = frontmatterRaw.split('\n');
	const metadata = parseYamlLines(yamlLines, parseErrors);

	const checksumLine = yamlLines.find((l) =>
		l.trimStart().startsWith(`${CHECKSUM_FIELD}:`),
	);
	const checksum = checksumLine
		? checksumLine.trimStart().slice(`${CHECKSUM_FIELD}:`.length).trim()
		: '';

	return {
		checksum,
		contentAfterFrontmatter,
		frontmatterRaw,
		metadata,
		parsedSuccessfully: parseErrors.length === 0,
		parseErrors,
	};
}

function parseYamlLines(
	lines: string[],
	errors: string[],
): GeneratedMarkdownMetadata['metadata'] {
	const metadata: GeneratedMarkdownMetadata['metadata'] = {
		canonicalOutput: '',
		documentId: '',
		generatedAt: '',
		generatedBy: '',
		generationStatus: '',
		phaseId: '',
		profileId: '',
		sourceStateSchemaVersion: '',
		traceability: [],
	};

	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i];
		if (raw === undefined) continue;
		const line = raw;
		const trimmed = line.trimStart();

		if (trimmed === '' || trimmed.startsWith('#')) {
			continue;
		}

		const colonIdx = trimmed.indexOf(':');
		if (colonIdx === -1) {
			continue;
		}

		const key = trimmed.slice(0, colonIdx).trim();
		const value = trimmed.slice(colonIdx + 1).trim();

		if (value === '') {
			if (key === 'traceability' || key === 'nonCanonicalArtifacts') {
				const listResult = parseYamlList(lines, i + 1, errors);
				if (key === 'traceability') {
					metadata.traceability = listResult.items.map(parseTraceabilityItem);
				} else if (key === 'nonCanonicalArtifacts') {
					metadata.nonCanonicalArtifacts = listResult.items.map(
						(item: Record<string, string>) => item._value as string,
					);
				}
				i = listResult.nextIndex;
				continue;
			}
			continue;
		}

		setMetadataField(metadata, key, value);
	}

	return metadata;
}

function setMetadataField(
	metadata: GeneratedMarkdownMetadata['metadata'],
	key: string,
	value: string,
): void {
	switch (key) {
		case 'documentId':
			metadata.documentId = value;
			break;
		case 'phaseId':
			metadata.phaseId = value;
			break;
		case 'profileId':
			metadata.profileId = value;
			break;
		case 'canonicalOutput':
			metadata.canonicalOutput = value;
			break;
		case 'generatedBy':
			metadata.generatedBy = value;
			break;
		case 'generatedAt':
			metadata.generatedAt = value;
			break;
		case 'generationStatus':
			metadata.generationStatus = value;
			break;
		case 'sourceStateSchemaVersion':
			metadata.sourceStateSchemaVersion = value;
			break;
	}
}

interface YamlListResult {
	items: Array<Record<string, string>>;
	nextIndex: number;
}

function parseYamlList(
	lines: string[],
	startIndex: number,
	_errors: string[],
): YamlListResult {
	const items: Array<Record<string, string>> = [];
	let i = startIndex;
	let currentItem: Record<string, string> | null = null;

	while (i < lines.length) {
		const raw = lines[i];
		if (raw === undefined) break;
		const line = raw;
		const trimmed = line.trimStart();

		if (trimmed === '') {
			i++;
			continue;
		}

		const indent = line.length - trimmed.length;

		if (trimmed.startsWith('- ')) {
			if (currentItem) {
				items.push(currentItem);
			}
			currentItem = {};
			const dashValue = trimmed.slice(2).trim();
			if (dashValue !== '') {
				const dashColonIdx = dashValue.indexOf(':');
				if (dashColonIdx !== -1) {
					const dashKey = dashValue.slice(0, dashColonIdx).trim();
					const dashVal = dashValue.slice(dashColonIdx + 1).trim();
					currentItem[dashKey] = dashVal;
				} else {
					currentItem._value = dashValue;
				}
			}
		} else if (currentItem && indent > 0 && trimmed.includes(':')) {
			const colonIdx = trimmed.indexOf(':');
			const subKey = trimmed.slice(0, colonIdx).trim();
			const subValue = trimmed.slice(colonIdx + 1).trim();
			currentItem[subKey] = subValue;
		} else {
			break;
		}
		i++;
	}

	if (currentItem) {
		items.push(currentItem);
	}

	return { items, nextIndex: i };
}

function parseTraceabilityItem(
	item: Record<string, string>,
): GeneratedMarkdownMetadata['metadata']['traceability'][number] {
	return {
		recordType: item.recordType ?? item.recordId ?? '',
		sourceAnswerId: item.sourceAnswerId,
		sourceDocumentId: item.sourceDocumentId,
		sourcePhaseId: item.sourcePhaseId,
		sourceProposalId: item.sourceProposalId,
		sourceQuestionId: item.sourceQuestionId,
		sourceSessionId: item.sourceSessionId,
		workspaceRecordId: item.workspaceRecordId ?? item.recordId ?? '',
	};
}

// ---------------------------------------------------------------------------
// Checksum injection
// ---------------------------------------------------------------------------

function injectChecksumIntoMarkdown(
	markdown: string,
	checksum: string,
): string {
	const trimmed = markdown.trimStart();
	if (!trimmed.startsWith(FRONTMATTER_DELIMITER)) {
		return markdown;
	}

	const closingIdx = trimmed.indexOf(
		`\n${FRONTMATTER_DELIMITER}`,
		FRONTMATTER_DELIMITER.length,
	);
	if (closingIdx === -1) {
		return markdown;
	}

	const frontmatterLines = trimmed.slice(0, closingIdx).split('\n');
	const indent = '';

	const hasChecksum = frontmatterLines.some((l) =>
		l.trimStart().startsWith(`${CHECKSUM_FIELD}:`),
	);

	if (hasChecksum) {
		const updated = frontmatterLines
			.map((l) => {
				if (l.trimStart().startsWith(`${CHECKSUM_FIELD}:`)) {
					return `${indent}${CHECKSUM_FIELD}: ${checksum}`;
				}
				return l;
			})
			.join('\n');
		return `${updated}${trimmed.slice(closingIdx)}`;
	}

	const insertIdx = findChecksumInsertIndex(frontmatterLines);
	const updatedLines = [
		...frontmatterLines.slice(0, insertIdx),
		`${indent}${CHECKSUM_FIELD}: ${checksum}`,
		...frontmatterLines.slice(insertIdx),
	];

	return `${updatedLines.join('\n')}${trimmed.slice(closingIdx)}`;
}

function findChecksumInsertIndex(lines: string[]): number {
	for (let i = lines.length - 1; i >= 0; i--) {
		const raw = lines[i];
		if (raw === undefined) continue;
		const trimmed = raw.trimStart();
		if (
			trimmed.startsWith('sourceStateSchemaVersion:') ||
			trimmed === '' ||
			trimmed.startsWith('#')
		) {
			continue;
		}
		return i + 1;
	}
	return lines.length;
}

// ---------------------------------------------------------------------------
// Manual edit detection
// ---------------------------------------------------------------------------

async function detectManualEdit(
	input: ManualEditDetectionInput,
): Promise<ManualEditDetectionResult> {
	const fsAdapter = input.fs ?? defaultFsAdapter;
	const diagnostics: ManualEditDiagnostic[] = [];
	const targetPath = normalize(input.targetPath);

	let targetExists = false;
	try {
		const s = await fsAdapter.stat(targetPath);
		if (s.isDirectory()) {
			diagnostics.push({
				code: 'directory_target',
				message: `Target path is an existing directory, not a file.`,
				recoveryHint: 'Provide a file path, not a directory.',
				severity: 'error',
			});
			return {
				currentChecksum: undefined,
				diagnostics,
				parsedMetadata: undefined,
				previousChecksum: undefined,
				status: 'unknown',
				targetExists,
				targetPath,
			};
		}
		targetExists = s.isFile();
	} catch {
		targetExists = false;
	}

	if (!targetExists) {
		return {
			currentChecksum: undefined,
			diagnostics,
			parsedMetadata: undefined,
			previousChecksum: undefined,
			status: 'new_file',
			targetExists: false,
			targetPath,
		};
	}

	let fileContent: string;
	try {
		fileContent = await fsAdapter.readFile(targetPath, 'utf-8');
	} catch {
		diagnostics.push({
			code: 'read_failed',
			message: `Could not read target file for edit detection.`,
			recoveryHint: 'Check file permissions.',
			severity: 'error',
		});
		return {
			currentChecksum: undefined,
			diagnostics,
			parsedMetadata: undefined,
			previousChecksum: undefined,
			status: 'unknown',
			targetExists,
			targetPath,
		};
	}

	const parsed = parseFrontmatter(fileContent);
	const currentChecksum = computeBodyChecksum(fileContent);

	if (!parsed.parsedSuccessfully) {
		diagnostics.push({
			code: 'metadata_parse_failed',
			message: `Could not parse generated metadata from file: ${parsed.parseErrors.join(', ')}`,
			recoveryHint:
				'The file may have been manually created or the metadata format is corrupted.',
			severity: 'warning',
		});
		return {
			currentChecksum,
			diagnostics,
			parsedMetadata: parsed,
			previousChecksum: parsed.checksum || undefined,
			status: 'metadata_invalid',
			targetExists,
			targetPath,
		};
	}

	const renderMetadata = input.renderResult.metadata;

	if (
		parsed.metadata.documentId &&
		renderMetadata.documentId &&
		parsed.metadata.documentId !== renderMetadata.documentId
	) {
		diagnostics.push({
			code: 'document_id_mismatch',
			message: `Document ID in file metadata (${parsed.metadata.documentId}) does not match render result (${renderMetadata.documentId}).`,
			recoveryHint: 'The target file may belong to a different document.',
			severity: 'warning',
		});
		return {
			currentChecksum,
			diagnostics,
			parsedMetadata: parsed,
			previousChecksum: parsed.checksum || undefined,
			status: 'metadata_invalid',
			targetExists,
			targetPath,
		};
	}

	if (
		parsed.metadata.canonicalOutput &&
		renderMetadata.canonicalOutput &&
		parsed.metadata.canonicalOutput !== renderMetadata.canonicalOutput
	) {
		diagnostics.push({
			code: 'canonical_output_mismatch',
			message: `Canonical output path in file metadata (${parsed.metadata.canonicalOutput}) does not match render result (${renderMetadata.canonicalOutput}).`,
			recoveryHint:
				'The target file may have been moved or the profile changed.',
			severity: 'warning',
		});
		return {
			currentChecksum,
			diagnostics,
			parsedMetadata: parsed,
			previousChecksum: parsed.checksum || undefined,
			status: 'metadata_invalid',
			targetExists,
			targetPath,
		};
	}

	const previousChecksum =
		parsed.checksum || input.artifactRecord?.checksum || undefined;

	if (
		input.artifactRecord?.checksum &&
		previousChecksum &&
		input.artifactRecord.checksum !== previousChecksum
	) {
		diagnostics.push({
			code: 'registry_checksum_mismatch',
			message: `Checksum in artifact registry does not match checksum in file metadata.`,
			recoveryHint: 'The file may have been manually edited after generation.',
			severity: 'warning',
		});
		return {
			currentChecksum,
			diagnostics,
			parsedMetadata: parsed,
			previousChecksum,
			status: 'registry_mismatch',
			targetExists,
			targetPath,
		};
	}

	if (!previousChecksum) {
		diagnostics.push({
			code: 'no_previous_checksum',
			message: 'No previous checksum available for comparison.',
			recoveryHint:
				'Cannot determine if file was manually edited. Treating as possible edit.',
			severity: 'info',
		});
		return {
			currentChecksum,
			diagnostics,
			parsedMetadata: parsed,
			previousChecksum: undefined,
			status: 'unknown',
			targetExists,
			targetPath,
		};
	}

	if (currentChecksum === previousChecksum) {
		return {
			currentChecksum,
			diagnostics,
			parsedMetadata: parsed,
			previousChecksum,
			status: 'unchanged_generated',
			targetExists,
			targetPath,
		};
	}

	diagnostics.push({
		code: 'checksum_changed',
		message: 'File content checksum has changed since last generation.',
		recoveryHint:
			'The file may have been manually edited. Use backup_and_write or overwrite policy to replace.',
		severity: 'warning',
	});

	return {
		currentChecksum,
		diagnostics,
		parsedMetadata: parsed,
		previousChecksum,
		status: 'modified_since_generation',
		targetExists,
		targetPath,
	};
}

// ---------------------------------------------------------------------------
// Write policy resolution for markdown writes
// ---------------------------------------------------------------------------

function resolveMarkdownWriteAction(
	policy: SafeMarkdownWritePolicy | undefined,
	manualEditStatus: ManualEditStatus,
): {
	action: 'write' | 'skip' | 'fail' | 'backup_then_write';
	diagnostics: MarkdownWriteDiagnostic[];
} {
	if (!policy) {
		return {
			action: 'fail',
			diagnostics: [
				{
					code: 'policy_required',
					message: 'No write policy specified.',
					recoveryHint:
						'Provide a write policy: skip, fail, backup_and_write, or overwrite.',
					severity: 'error',
				},
			],
		};
	}

	const isPossibleManualEdit =
		manualEditStatus !== 'new_file' &&
		manualEditStatus !== 'unchanged_generated';

	switch (policy) {
		case 'skip':
			if (isPossibleManualEdit) {
				return {
					action: 'skip',
					diagnostics: [
						{
							code: 'manual_edit_skipped',
							manualEditStatus,
							message: `Possible manual edit detected (status: ${manualEditStatus}); skipping write per policy "skip".`,
							recoveryHint:
								'Use backup_and_write or overwrite to replace the file.',
							severity: 'warning',
						},
					],
				};
			}
			if (manualEditStatus === 'unchanged_generated') {
				return {
					action: 'skip',
					diagnostics: [
						{
							code: 'unchanged_skipped',
							message:
								'File is unchanged from last generation; skipping write.',
							recoveryHint:
								'Use overwrite or backup_and_write to force rewrite.',
							severity: 'info',
						},
					],
				};
			}
			return { action: 'write', diagnostics: [] };

		case 'fail':
			if (isPossibleManualEdit) {
				return {
					action: 'fail',
					diagnostics: [
						{
							code: 'manual_edit_collision',
							manualEditStatus,
							message: `Possible manual edit detected (status: ${manualEditStatus}); refusing write per policy "fail".`,
							recoveryHint:
								'Use backup_and_write to create a backup before writing, or overwrite to replace.',
							severity: 'error',
						},
					],
				};
			}
			return { action: 'write', diagnostics: [] };

		case 'backup_and_write':
			if (isPossibleManualEdit) {
				return {
					action: 'backup_then_write',
					diagnostics: [
						{
							code: 'manual_edit_backup_warn',
							manualEditStatus,
							message: `Possible manual edit detected (status: ${manualEditStatus}); creating backup before overwriting per policy "backup_and_write".`,
							recoveryHint:
								'The existing file will be backed up before the new content is written.',
							severity: 'warning',
						},
					],
				};
			}
			if (manualEditStatus === 'new_file') {
				return { action: 'write', diagnostics: [] };
			}
			return {
				action: 'backup_then_write',
				diagnostics: [],
			};

		case 'overwrite':
			if (isPossibleManualEdit) {
				return {
					action: 'write',
					diagnostics: [
						{
							code: 'manual_edit_overwritten',
							manualEditStatus,
							message: `Possible manual edit detected (status: ${manualEditStatus}); overwriting per explicit "overwrite" policy. Manual edits will be lost.`,
							recoveryHint:
								'Consider using backup_and_write to preserve the previous version.',
							severity: 'warning',
						},
					],
				};
			}
			return { action: 'write', diagnostics: [] };

		default:
			return {
				action: 'fail',
				diagnostics: [
					{
						code: 'unknown_policy',
						message: `Unknown write policy: ${policy as string}.`,
						recoveryHint:
							'Use one of: skip, fail, backup_and_write, or overwrite.',
						severity: 'error',
					},
				],
			};
	}
}

// ---------------------------------------------------------------------------
// Write planning
// ---------------------------------------------------------------------------

async function planMarkdownWrites(
	input: SafeMarkdownWriteInput,
	options: SafeMarkdownWriteOptions = {},
): Promise<MarkdownWritePlan> {
	const projectRoot = options.projectRoot ?? resolve('.');
	const documentationRoot = resolveDocumentationRoot(options);
	const policy = options.policy ?? 'fail';
	const diagnostics: MarkdownWriteDiagnostic[] = [];
	const changedPaths: MarkdownWriteChangedPath[] = [];
	const plannedDirectories: string[] = [];
	const items: MarkdownWritePlanItem[] = [];
	const planItemsLookup = new Map(
		(input.planItems ?? []).map((pi) => [pi.documentCanonicalId, pi]),
	);

	const artifactRecords = options.artifactRecords ?? new Map();

	for (const renderResult of input.renderResults) {
		const docId = renderResult.documentCanonicalId;
		const planItem = planItemsLookup.get(docId);
		const relativePath = renderResult.canonicalOutputPath.replace(
			/^docs\//,
			'',
		);
		const targetPath = join(projectRoot, documentationRoot, relativePath);

		const normalizedTarget = normalize(targetPath);

		const pathSafety = checkPathSafety(normalizedTarget, {
			allowedBaseDir: join(projectRoot, documentationRoot),
		});

		if (!pathSafety.safe) {
			const itemDiagnostics: MarkdownWriteDiagnostic[] =
				pathSafety.diagnostics.map((d) => ({
					code: d.code,
					documentCanonicalId: docId,
					message: d.message,
					recoveryHint: d.recoveryHint,
					severity: d.severity,
					targetPath: normalizedTarget,
				}));
			diagnostics.push(...itemDiagnostics);

			items.push({
				collision: undefined,
				diagnostics: itemDiagnostics,
				documentCanonicalId: docId,
				manualEditStatus: undefined,
				planItem,
				renderResult,
				status: 'failed',
				targetPath: normalizedTarget,
			});
			continue;
		}

		const artifactRecord = artifactRecords.get(normalizedTarget);
		const detectionResult = await detectManualEdit({
			artifactRecord,
			fs: options.fsOverride,
			renderResult,
			resolvedBaseDir: join(projectRoot, documentationRoot),
			targetPath: normalizedTarget,
		});

		const policyResult = resolveMarkdownWriteAction(
			policy,
			detectionResult.status,
		);

		const itemDiagnostics: MarkdownWriteDiagnostic[] = [
			...detectionResult.diagnostics.map((d) => ({
				code: d.code,
				documentCanonicalId: docId,
				manualEditStatus: detectionResult.status,
				message: d.message,
				recoveryHint: d.recoveryHint,
				severity: d.severity,
				targetPath: normalizedTarget,
			})),
			...policyResult.diagnostics.map((d) => ({
				...d,
				documentCanonicalId: docId,
				targetPath: normalizedTarget,
			})),
		];

		diagnostics.push(...itemDiagnostics);

		let status: MarkdownWriteStatus;
		switch (policyResult.action) {
			case 'write':
				status = options.dryRun
					? 'dry_run'
					: detectionResult.targetExists
						? 'updated'
						: 'created';
				break;
			case 'skip':
				status = 'skipped';
				break;
			case 'fail':
				status = 'collision';
				break;
			case 'backup_then_write':
				status = options.dryRun ? 'dry_run' : 'updated';
				break;
		}

		let collision: MarkdownWriteCollision | undefined;
		if (
			status === 'collision' ||
			detectionResult.status === 'modified_since_generation' ||
			detectionResult.status === 'metadata_missing' ||
			detectionResult.status === 'metadata_invalid' ||
			detectionResult.status === 'registry_mismatch' ||
			detectionResult.status === 'unknown'
		) {
			const suggestedActions: SafeMarkdownWritePolicy[] = [
				'backup_and_write',
				'overwrite',
			];
			if (status === 'skipped' || status === 'collision') {
				suggestedActions.unshift(
					policy === 'skip' ? 'backup_and_write' : 'skip',
				);
			}

			collision = {
				documentCanonicalId: docId,
				manualEditStatus: detectionResult.status,
				recoveryHint:
					'The file may have been manually edited. To proceed, use backup_and_write or overwrite policy.',
				selectedPolicy: policy,
				suggestedActions,
				targetPath: normalizedTarget,
			};
		}

		let backupPath: string | undefined;
		if (policyResult.action === 'backup_then_write') {
			const backupDir = options.backupDir ?? dirname(normalizedTarget);
			const ts =
				options.deterministicTimestamp ??
				new Date().toISOString().replace(/[:.]/g, '-');
			const base = basename(normalizedTarget);
			const ext = extname(base);
			const name = base.slice(0, -ext.length);
			backupPath = join(backupDir, `${ts}-${name}${ext}.bak`);
		}

		items.push({
			backupPath,
			collision,
			diagnostics: itemDiagnostics,
			documentCanonicalId: docId,
			manualEditStatus: detectionResult.status,
			planItem,
			renderResult,
			status,
			targetPath: normalizedTarget,
		});

		if (options.dryRun) {
			changedPaths.push({ path: normalizedTarget, role: 'planned' });
		}
	}

	const summary = computeWritePlanSummary(items);

	return {
		changedPaths,
		diagnostics,
		documentationRoot,
		dryRun: options.dryRun ?? false,
		items,
		plannedDirectories,
		policy,
		summary,
	};
}

function computeWritePlanSummary(
	items: MarkdownWritePlanItem[],
): MarkdownWritePlanSummary {
	let created = 0;
	let updated = 0;
	let skipped = 0;
	let collisions = 0;
	let failed = 0;
	let dryRun = 0;

	for (const item of items) {
		switch (item.status) {
			case 'created':
				created++;
				break;
			case 'updated':
				updated++;
				break;
			case 'skipped':
				skipped++;
				break;
			case 'collision':
				collisions++;
				break;
			case 'failed':
				failed++;
				break;
			case 'dry_run':
				dryRun++;
				break;
		}
	}

	return {
		collisions,
		created,
		dryRun,
		failed,
		skipped,
		total: items.length,
		updated,
	};
}

// ---------------------------------------------------------------------------
// Write execution
// ---------------------------------------------------------------------------

async function writeMarkdownDocuments(
	input: SafeMarkdownWriteInput,
	options: SafeMarkdownWriteOptions = {},
): Promise<SafeMarkdownWriteResult> {
	const plan = await planMarkdownWrites(input, options);
	const changedPaths: MarkdownWriteChangedPath[] = [...plan.changedPaths];
	const diagnostics: MarkdownWriteDiagnostic[] = [...plan.diagnostics];

	if (options.dryRun) {
		return {
			changedPaths,
			diagnostics,
			documentationRoot: plan.documentationRoot,
			dryRun: true,
			items: plan.items,
			policy: plan.policy,
			status: 'dry_run',
			success: true,
			summary: plan.summary,
		};
	}

	let allSuccess = true;

	for (const item of plan.items) {
		if (
			item.status === 'failed' ||
			item.status === 'collision' ||
			item.status === 'skipped'
		) {
			if (item.status === 'failed' || item.status === 'collision')
				allSuccess = false;
			continue;
		}

		const markdown = item.renderResult.markdown;
		const bodyChecksum = computeBodyChecksum(markdown);
		const markdownWithChecksum = injectChecksumIntoMarkdown(
			markdown,
			bodyChecksum,
		);

		const targetDir = dirname(item.targetPath);

		try {
			await mkdir(targetDir, { recursive: true });
			changedPaths.push({ path: targetDir, role: 'directory_created' });
		} catch {
			diagnostics.push({
				code: 'mkdir_failed',
				documentCanonicalId: item.documentCanonicalId,
				message: `Failed to create directory: ${targetDir}`,
				recoveryHint: 'Check filesystem permissions and disk space.',
				severity: 'error',
				targetPath: item.targetPath,
			});
			item.status = 'failed';
			allSuccess = false;
			continue;
		}

		if (item.backupPath) {
			try {
				const backupDir = dirname(item.backupPath);
				await mkdir(backupDir, { recursive: true });

				const existingContent = await readFile(item.targetPath, {
					encoding: 'utf-8',
				});
				await writeFile(item.backupPath, existingContent, {
					encoding: 'utf-8',
					flush: true,
				});
				changedPaths.push({
					path: item.backupPath,
					role: 'backup_created',
				});
			} catch (err: unknown) {
				diagnostics.push({
					code: 'backup_failed',
					documentCanonicalId: item.documentCanonicalId,
					message: `Failed to create backup: ${String(err)}`,
					recoveryHint: 'The original file has not been modified.',
					severity: 'error',
					targetPath: item.targetPath,
				});
				item.status = 'failed';
				allSuccess = false;
				continue;
			}
		}

		const randomId =
			options.deterministicRandomId ??
			randomUUID().replace(/-/g, '').slice(0, 12);
		const tempPath = join(
			targetDir,
			`.${basename(item.targetPath)}.${randomId}.tmp`,
		);

		try {
			await writeFile(tempPath, markdownWithChecksum, {
				encoding: 'utf-8',
				flush: true,
			});

			await rename(tempPath, item.targetPath);

			changedPaths.push({
				path: item.targetPath,
				role: item.status === 'created' ? 'file_created' : 'file_updated',
			});
		} catch (err: unknown) {
			diagnostics.push({
				code: 'write_failed',
				documentCanonicalId: item.documentCanonicalId,
				message: `Failed to write markdown: ${String(err)}`,
				recoveryHint:
					'The target file should be untouched. A temp file may remain.',
				severity: 'error',
				targetPath: item.targetPath,
			});
			item.status = 'failed';
			allSuccess = false;

			try {
				const { rm } = await import('node:fs/promises');
				await rm(tempPath, { force: true });
			} catch {
				// Best effort cleanup
			}
		}
	}

	const finalSummary = computeWritePlanSummary(plan.items);

	return {
		changedPaths,
		diagnostics,
		documentationRoot: plan.documentationRoot,
		dryRun: false,
		items: plan.items,
		policy: plan.policy,
		status: allSuccess ? 'created' : 'failed',
		success: allSuccess,
		summary: finalSummary,
	};
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
	computeBodyChecksum,
	computeFullChecksum,
	detectManualEdit,
	injectChecksumIntoMarkdown,
	parseFrontmatter,
	planMarkdownWrites,
	resolveMarkdownWriteAction,
	writeMarkdownDocuments,
};
