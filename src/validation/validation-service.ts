/** Step 6.1 deterministic validation service. Read-only and AI-free. */

import { access, readFile, stat } from 'node:fs/promises';
import {
	basename,
	isAbsolute,
	join,
	normalize,
	relative,
	resolve,
} from 'node:path';
import { z } from 'zod';
import { parseFrontmatter } from '../generation/safe-markdown-writer.js';
import {
	buildContractGraph,
	type ContractGraph,
	type ContractGraphDiagnostic,
} from '../profiles/contract-graph.js';
import {
	type DocumentationContract,
	DocumentationContractError,
	loadDocumentationContract,
} from '../profiles/documentation-contract.js';
import {
	loadProfileRegistry,
	ProfileRegistryError,
} from '../profiles/profile-registry.js';
import {
	WORKSPACE_STATE_SCHEMA_VERSION,
	type WorkspaceArtifact,
	WorkspaceArtifactSchema,
	type WorkspaceState,
} from '../state/workspace-state.schema.js';
import { readWorkspaceState } from '../state/workspace-state-repository.js';
import { validateWorkspaceState as validateWorkspaceStateShape } from '../state/workspace-state-validation.js';
import {
	createValidationFinding,
	createValidationRunResult,
	looksLikeSecretLikeValue,
	redactValidationValue,
	type ValidationDiagnostic,
	type ValidationFinding,
	type ValidationFindingCode,
	type ValidationFindingSeverity,
	type ValidationFindingSource,
	type ValidationRunInput,
	type ValidationRunOptions,
	type ValidationRunResult,
	type ValidationScope,
} from './validation-finding.js';

const DEFAULT_PROFILE_ID = 'standard';
const DEFAULT_DOCUMENTATION_ROOT = 'logos/';
const WORKSPACE_RELATIVE_PATH = join('.logos', 'workspace.json');
const SHA256_RE = /^(sha256:)?[a-fA-F0-9]{64}$/;
const VALID_METADATA_STATUSES = new Set([
	'planned',
	'generated',
	'partial',
	'blocked',
	'failed',
	'skipped',
]);
const CANONICAL_ARTIFACT_TYPE = 'canonical_markdown';
const DERIVED_CANONICAL_FORBIDDEN = new Set([
	'html',
	'agent_pack',
	'executive_json',
	'executive_markdown',
	'executive_html',
]);

interface ValidationContext {
	projectRoot: string;
	profileId: string;
	profileRoot?: string | undefined;
	workspacePath: string;
	documentationRoot: string;
	state?: WorkspaceState | undefined;
	stateRaw?: unknown;
	contract?: DocumentationContract | undefined;
	graph?: ContractGraph | undefined;
	findings: ValidationFinding[];
	diagnostics: ValidationDiagnostic[];
	order: number;
}

interface LoadedWorkspaceStateResult {
	state?: WorkspaceState | undefined;
	raw?: unknown;
	workspacePath: string;
	documentationRoot?: string | undefined;
	profileId?: string | undefined;
}

function nextOrder(context: ValidationContext): number {
	const current = context.order;
	context.order += 1;
	return current;
}

function addFinding(
	context: ValidationContext,
	finding: Omit<ValidationFinding, 'id' | 'order'> & {
		order?: number | undefined;
	},
): void {
	context.findings.push(
		createValidationFinding({
			...finding,
			order: finding.order ?? nextOrder(context),
		}),
	);
}

function addDiagnostic(
	context: ValidationContext,
	diagnostic: ValidationDiagnostic,
): void {
	context.diagnostics.push({
		...diagnostic,
		message: String(redactValidationValue(diagnostic.message)),
	});
}

function normalizeScopes(scopes?: ValidationScope[]): ValidationScope[] {
	const requested = scopes?.length ? scopes : ['all'];
	if (requested.includes('all'))
		return ['contracts', 'state', 'artifacts', 'outputs'];
	const order: ValidationScope[] = [
		'contracts',
		'state',
		'artifacts',
		'outputs',
	];
	return order.filter((scope) => requested.includes(scope));
}

function defaultProjectRoot(input: ValidationRunInput): string {
	return resolve(input.projectRoot ?? process.cwd());
}

function defaultWorkspacePath(
	projectRoot: string,
	input: ValidationRunInput,
): string {
	return resolve(
		input.workspacePath ?? join(projectRoot, WORKSPACE_RELATIVE_PATH),
	);
}

function normalizeDocumentationRoot(root: string | undefined): string {
	const selected =
		root && root.trim().length > 0 ? root : DEFAULT_DOCUMENTATION_ROOT;
	return selected.endsWith('/') ? selected : `${selected}/`;
}

function pathIsWithin(child: string, parent: string): boolean {
	const rel = relative(resolve(parent), resolve(child));
	return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function pointer(path: string | undefined): string | undefined {
	if (!path) return undefined;
	return path.startsWith('/') ? path : `/${path.replace(/\./g, '/')}`;
}

function sourceFromCode(code: string): ValidationFindingSource {
	if (code.includes('PHASE')) return 'phase_descriptor';
	if (code.includes('DOCUMENT') || code.includes('DESCRIPTOR')) {
		return 'document_descriptor';
	}
	if (code.includes('GRAPH')) return 'contract_graph';
	if (code.includes('PROFILE')) return 'profile_registry';
	return 'validation_service';
}

function codeFromContractDiagnostic(code: string): ValidationFindingCode {
	switch (code) {
		case 'E_PHASE_MISSING_FILE':
			return 'phase_descriptor_missing';
		case 'E_PHASE_PARSE_ERROR':
			return 'phase_descriptor_malformed';
		case 'E_PHASE_SHAPE':
			return 'phase_descriptor_malformed';
		case 'E_PHASE_FIELD_TYPE':
		case 'E_PHASE_DOCUMENT_REF_TYPE':
		case 'E_PHASE_DOCUMENT_REF_FIELD':
			return 'phase_descriptor_invalid';
		case 'E_DOCUMENT_MISSING_FILE':
		case 'E_DESCRIPTOR_MISSING_FILE':
			return 'document_descriptor_missing';
		case 'E_DOCUMENT_DUPLICATE_ID':
			return 'document_duplicate_id';
		default:
			return 'document_descriptor_invalid';
	}
}

function severityFromGraphDiagnostic(
	diagnostic: ContractGraphDiagnostic,
): ValidationFindingSeverity {
	if (diagnostic.code === 'E_GRAPH_CIRCULAR_DEPENDENCY') return 'error';
	if (diagnostic.code === 'E_GRAPH_UNKNOWN_DEPENDENCY_TARGET') return 'info';
	return diagnostic.severity;
}

function codeFromGraphDiagnostic(code: string): ValidationFindingCode {
	switch (code) {
		case 'E_GRAPH_CIRCULAR_DEPENDENCY':
			return 'document_circular_dependency';
		case 'E_GRAPH_UNKNOWN_DEPENDENCY_TARGET':
			return 'document_missing_dependency';
		case 'E_GRAPH_INVALID_STATUS':
			return 'document_invalid_status';
		default:
			return code;
	}
}

async function exists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function fileExists(path: string): Promise<boolean> {
	try {
		const s = await stat(path);
		return s.isFile();
	} catch {
		return false;
	}
}

function resolvePathUnderProject(
	projectRoot: string,
	path: string,
): { resolved: string; relativePath: string; absolute: boolean } {
	const absolute = isAbsolute(path);
	const resolved = normalize(absolute ? path : resolve(projectRoot, path));
	return { absolute, relativePath: relative(projectRoot, resolved), resolved };
}

function validateRelativeSafePath(params: {
	context: ValidationContext;
	path: string;
	pointer: string;
	source: ValidationFindingSource;
	code: ValidationFindingCode;
	messagePrefix: string;
	allowedRoot: string;
	allowAbsoluteInsideRoot?: boolean | undefined;
	documentCanonicalId?: string | undefined;
	phaseId?: string | undefined;
}): string | undefined {
	const { absolute, resolved } = resolvePathUnderProject(
		params.context.projectRoot,
		params.path,
	);
	const hasTraversal = params.path.split(/[\\/]+/).includes('..');
	if (hasTraversal) {
		addFinding(params.context, {
			code: 'path_traversal',
			documentCanonicalId: params.documentCanonicalId,
			expected: 'path without .. traversal',
			location: { path: params.path, pointer: params.pointer },
			message: `${params.messagePrefix} must not traverse outside its allowed root.`,
			phaseId: params.phaseId,
			received: params.path,
			recoveryHint: {
				message:
					'Use a project-relative path under the configured documentation root.',
			},
			severity: 'error',
			source: { kind: params.source, path: params.path },
		});
		return undefined;
	}
	if (absolute && params.allowAbsoluteInsideRoot !== true) {
		addFinding(params.context, {
			code: params.code,
			documentCanonicalId: params.documentCanonicalId,
			expected: 'relative path',
			location: { path: params.path, pointer: params.pointer },
			message: `${params.messagePrefix} must be relative unless explicitly allowed.`,
			phaseId: params.phaseId,
			received: params.path,
			recoveryHint: {
				message: 'Store paths relative to the project or documentation root.',
			},
			severity: 'error',
			source: { kind: params.source, path: params.path },
		});
		return undefined;
	}
	if (!pathIsWithin(resolved, params.allowedRoot)) {
		addFinding(params.context, {
			code: params.code,
			documentCanonicalId: params.documentCanonicalId,
			expected: `path under ${params.allowedRoot}`,
			location: { path: params.path, pointer: params.pointer },
			message: `${params.messagePrefix} must stay under its allowed root.`,
			phaseId: params.phaseId,
			received: params.path,
			recoveryHint: {
				message:
					'Move the path under the configured documentation root or project root.',
			},
			severity: 'error',
			source: { kind: params.source, path: params.path },
		});
		return undefined;
	}
	return resolved;
}

function collectSecretFindings(
	context: ValidationContext,
	value: unknown,
	locationPath: string,
	source: ValidationFindingSource,
	basePointer = '',
): void {
	if (typeof value === 'string') {
		if (looksLikeSecretLikeValue(value)) {
			addFinding(context, {
				code: 'secret_like_value',
				expected: 'environment variable name or redacted metadata',
				location: { path: locationPath, pointer: basePointer || '/' },
				message:
					'A raw secret-like value was found in validation input metadata.',
				received: value,
				recoveryHint: {
					message:
						'Replace raw token-like values with environment variable names such as OPENAI_API_KEY.',
				},
				severity: 'error',
				source: { kind: 'secret_scan', path: locationPath },
			});
		}
		return;
	}
	if (Array.isArray(value)) {
		value.forEach((item, index) => {
			collectSecretFindings(
				context,
				item,
				locationPath,
				source,
				`${basePointer}/${index}`,
			);
		});
		return;
	}
	if (value !== null && typeof value === 'object') {
		for (const [key, item] of Object.entries(
			value as Record<string, unknown>,
		)) {
			const lowerKey = key.toLowerCase();
			if (lowerKey === 'checksum' || lowerKey === 'contentchecksum') continue;
			collectSecretFindings(
				context,
				item,
				locationPath,
				source,
				`${basePointer}/${key}`,
			);
		}
	}
}

async function readWorkspaceStateReadOnly(
	context: ValidationContext,
	input: ValidationRunInput,
): Promise<LoadedWorkspaceStateResult> {
	if (input.state !== undefined) {
		collectSecretFindings(
			context,
			input.state,
			context.workspacePath,
			'workspace_state',
		);
		const validation = validateWorkspaceStateShape(input.state);
		if (!validation.success) {
			for (const err of validation.errors) {
				addFinding(context, {
					code:
						err.path === 'schemaVersion'
							? 'workspace_schema_version_unsupported'
							: 'workspace_schema_invalid',
					location: { path: context.workspacePath, pointer: pointer(err.path) },
					message: err.message,
					recoveryHint: err.recoveryHint
						? { message: err.recoveryHint }
						: {
								message: 'Fix the workspace state to match the current schema.',
							},
					severity: 'error',
					source: { kind: 'workspace_state', path: context.workspacePath },
				});
			}
		} else {
			context.state = validation.state;
		}
		return {
			documentationRoot: validation.state?.documentation.rootPath,
			profileId: input.profileId
				? undefined
				: validation.state?.profile.profileId,
			raw: input.state,
			state: validation.state,
			workspacePath: context.workspacePath,
		};
	}

	const rawPath = context.workspacePath;
	const workspaceRoot = resolve(context.projectRoot, '.logos');
	if (
		!pathIsWithin(rawPath, workspaceRoot) ||
		basename(rawPath) !== 'workspace.json'
	) {
		addFinding(context, {
			code: 'workspace_root_invalid',
			expected: `${WORKSPACE_RELATIVE_PATH}`,
			location: { path: rawPath, pointer: '/workspacePath' },
			message:
				'Workspace state path must stay under .logos/ and point to workspace.json.',
			received: rawPath,
			recoveryHint: {
				message: 'Use the default .logos/workspace.json workspace state path.',
			},
			severity: 'error',
			source: { kind: 'root_path', path: rawPath },
		});
	}

	if (rawPath === resolve(context.projectRoot, WORKSPACE_RELATIVE_PATH)) {
		const readResult = await readWorkspaceState({
			projectRoot: context.projectRoot,
		});
		if (!readResult.success) {
			for (const diag of readResult.diagnostics) {
				addFinding(context, {
					code:
						diag.code === 'workspace_missing'
							? 'workspace_missing'
							: diag.code === 'workspace_json_invalid'
								? 'workspace_invalid_json'
								: 'workspace_schema_invalid',
					location: { path: diag.path ?? readResult.workspaceFilePath },
					message: diag.message,
					recoveryHint: diag.recoveryHint
						? { message: diag.recoveryHint }
						: { message: 'Recreate or repair the workspace state.' },
					severity: diag.code === 'workspace_missing' ? 'warning' : 'error',
					source: {
						kind: 'workspace_state',
						path: readResult.workspaceFilePath,
					},
				});
			}
			return { workspacePath: readResult.workspaceFilePath };
		}
		context.state = readResult.state;
		return {
			documentationRoot: readResult.state?.documentation.rootPath,
			profileId: input.profileId
				? undefined
				: readResult.state?.profile.profileId,
			state: readResult.state,
			workspacePath: readResult.workspaceFilePath,
		};
	}

	let rawText: string;
	try {
		rawText = await readFile(rawPath, 'utf-8');
	} catch {
		addFinding(context, {
			code: 'workspace_missing',
			location: { path: rawPath },
			message: `Workspace state file not found at ${rawPath}`,
			recoveryHint: {
				message: 'Run /init or provide a valid workspace state fixture.',
			},
			severity: 'warning',
			source: { kind: 'workspace_state', path: rawPath },
		});
		return { workspacePath: rawPath };
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(rawText);
	} catch {
		addFinding(context, {
			code: 'workspace_invalid_json',
			location: { path: rawPath },
			message: 'Workspace state file is not valid JSON.',
			recoveryHint: {
				message: 'Fix JSON syntax before running validation again.',
			},
			severity: 'error',
			source: { kind: 'workspace_state', path: rawPath },
		});
		return { workspacePath: rawPath };
	}

	return readWorkspaceStateReadOnly(context, { ...input, state: parsed });
}

async function createContractLoadOptions(
	context: ValidationContext,
): Promise<
	| { profileId: string; profileRoot: string; schemaPath?: string }
	| { profileId: string; repoRoot: string }
> {
	if (!context.profileRoot) {
		return { profileId: context.profileId, repoRoot: context.projectRoot };
	}
	const localSchemaPath = resolve(context.profileRoot, 'document.schema.yml');
	const bundledSchemaPath = resolve(
		process.cwd(),
		'profiles',
		'standard',
		'document.schema.yml',
	);
	if (!(await exists(localSchemaPath)) && (await exists(bundledSchemaPath))) {
		return {
			profileId: context.profileId,
			profileRoot: context.profileRoot,
			schemaPath: bundledSchemaPath,
		};
	}
	return { profileId: context.profileId, profileRoot: context.profileRoot };
}

async function loadContractContextOnly(
	context: ValidationContext,
): Promise<void> {
	if (context.contract && context.graph) return;
	try {
		context.contract = await loadDocumentationContract(
			await createContractLoadOptions(context),
		);
		context.graph = buildContractGraph(context.contract).graph;
	} catch (err) {
		addDiagnostic(context, {
			code: 'contract_context_unavailable',
			message:
				err instanceof Error
					? err.message
					: 'Contract context could not be loaded.',
			path: context.profileRoot ?? context.projectRoot,
			scope: 'contracts',
			severity: 'warning',
			source: 'contract_graph',
		});
	}
}

async function validateContractScope(
	context: ValidationContext,
): Promise<void> {
	let registryLoaded = false;
	try {
		const registry = await loadProfileRegistry(
			context.profileRoot
				? { profileId: context.profileId, profileRoot: context.profileRoot }
				: { profileId: context.profileId, repoRoot: context.projectRoot },
		);
		registryLoaded = true;
		const expectedProfileRoot = context.profileRoot
			? resolve(context.profileRoot)
			: resolve(context.projectRoot, 'profiles', context.profileId);
		if (!pathIsWithin(registry.paths.registryPath, expectedProfileRoot)) {
			addFinding(context, {
				code: 'profile_path_invalid',
				expected: `profile registry under ${expectedProfileRoot}`,
				location: { path: registry.paths.registryPath },
				message: 'Profile registry path must remain under the profile root.',
				received: registry.paths.registryPath,
				recoveryHint: {
					message: 'Move docs.yml under the selected profile root.',
				},
				severity: 'error',
				source: { kind: 'profile_registry', path: registry.paths.registryPath },
			});
		}
		for (let i = 0; i < registry.phaseRegistry.files.length; i++) {
			const entry = registry.phaseRegistry.files[i];
			if (entry === undefined) continue;
			const phasePath = resolve(registry.paths.profileRoot, entry.path);
			if (!pathIsWithin(phasePath, registry.paths.profileRoot)) {
				addFinding(context, {
					code: 'profile_path_invalid',
					expected: 'phase path under profile root',
					location: {
						path: registry.paths.registryPath,
						pointer: `/phaseRegistry/files/${i}/path`,
					},
					message: 'Phase descriptor path must remain under the profile root.',
					received: entry.path,
					recoveryHint: {
						message:
							'Use a relative phase descriptor path under the profile root.',
					},
					severity: 'error',
					source: {
						kind: 'profile_registry',
						path: registry.paths.registryPath,
					},
				});
			}
		}
	} catch (err) {
		if (err instanceof ProfileRegistryError) {
			for (const diag of err.diagnostics) {
				addFinding(context, {
					code:
						diag.code === 'E_PROFILE_MISSING_FILE'
							? 'profile_registry_missing'
							: 'profile_registry_invalid',
					location: { path: diag.path, pointer: pointer(diag.fieldPath) },
					message: diag.message,
					recoveryHint: {
						message:
							'Repair docs.yml so it matches the profile registry contract.',
					},
					severity: 'error',
					source: { kind: 'profile_registry', path: diag.path },
				});
			}
		} else {
			addFinding(context, {
				code: 'profile_registry_invalid',
				location: { path: context.profileRoot ?? context.projectRoot },
				message: 'Profile registry failed to load.',
				recoveryHint: { message: 'Check profile registry files and retry.' },
				severity: 'fatal',
				source: {
					kind: 'profile_registry',
					path: context.profileRoot ?? context.projectRoot,
				},
			});
		}
	}

	try {
		context.contract = await loadDocumentationContract(
			await createContractLoadOptions(context),
		);
	} catch (err) {
		if (err instanceof DocumentationContractError) {
			for (const diag of err.diagnostics) {
				addFinding(context, {
					code: codeFromContractDiagnostic(diag.code),
					expected: diag.expected,
					location: { path: diag.path, pointer: pointer(diag.fieldPath) },
					message: diag.message,
					received: diag.received,
					recoveryHint: {
						message:
							'Repair the referenced phase or document descriptor and rerun validation.',
					},
					severity: 'error',
					source: { kind: sourceFromCode(diag.code), path: diag.path },
				});
			}
		} else if (registryLoaded) {
			addFinding(context, {
				code: 'validation_scope_failed',
				location: { path: context.profileRoot ?? context.projectRoot },
				message: 'Documentation contract validation failed unexpectedly.',
				recoveryHint: {
					message: 'Check profile files for parse or schema errors.',
				},
				severity: 'fatal',
				source: {
					kind: 'validation_service',
					path: context.profileRoot ?? context.projectRoot,
				},
			});
		}
		return;
	}

	const graphResult = buildContractGraph(context.contract);
	context.graph = graphResult.graph;
	for (const diag of graphResult.diagnostics) {
		addFinding(context, {
			code: codeFromGraphDiagnostic(diag.code),
			documentCanonicalId: diag.cyclePath?.[0],
			expected: diag.expected,
			location: { path: diag.path, pointer: pointer(diag.fieldPath) },
			message: diag.message,
			received: diag.received,
			recoveryHint: {
				message:
					diag.recoveryHint ??
					'Repair dependency/status declarations so they resolve within the active contract.',
			},
			severity: severityFromGraphDiagnostic(diag),
			source: { kind: 'contract_graph', path: diag.path },
		});
	}

	validateContractOutputs(context);
}

function validateContractOutputs(context: ValidationContext): void {
	if (!context.graph) return;
	const seen = new Map<string, string>();
	for (const output of context.graph.outputs) {
		if (output.kind === 'canonical') {
			if (output.format !== 'markdown') {
				addFinding(context, {
					code: 'output_invalid_kind',
					documentCanonicalId: output.documentCanonicalId,
					expected: 'markdown',
					location: {
						path: output.sourcePath,
						pointer: pointer(output.fieldPath),
					},
					message: 'Canonical output declarations must use markdown format.',
					phaseId: output.phaseId,
					received: output.format,
					recoveryHint: {
						message: 'Change the canonical output format to markdown.',
					},
					severity: 'error',
					source: { kind: 'document_descriptor', path: output.sourcePath },
				});
			}
		}
		const existing = seen.get(output.path);
		if (existing !== undefined && existing !== output.documentCanonicalId) {
			addFinding(context, {
				code: 'output_duplicate_path',
				documentCanonicalId: output.documentCanonicalId,
				expected: 'unique output path',
				location: {
					path: output.sourcePath,
					pointer: pointer(output.fieldPath),
				},
				message:
					'Output declarations conflict because multiple documents target the same path.',
				phaseId: output.phaseId,
				received: output.path,
				recoveryHint: {
					message: 'Assign a unique output path to each document artifact.',
				},
				severity: 'error',
				source: { kind: 'document_descriptor', path: output.sourcePath },
			});
		} else {
			seen.set(output.path, output.documentCanonicalId);
		}
	}
}

async function validateStateScope(
	context: ValidationContext,
	input: ValidationRunInput,
): Promise<void> {
	const loaded = await readWorkspaceStateReadOnly(context, input);
	context.state = loaded.state;
	context.stateRaw = loaded.raw;
	if (loaded.documentationRoot) {
		context.documentationRoot = normalizeDocumentationRoot(
			loaded.documentationRoot,
		);
	}
	if (loaded.profileId) {
		context.profileId = loaded.profileId;
	}
	if (!loaded.state) return;

	validateDocumentationRoot(context, loaded.state.documentation.rootPath);
	validateProfileLock(context, loaded.state);
	validateStateReferences(context, loaded.state);
}

function validateDocumentationRoot(
	context: ValidationContext,
	rootPath: string,
): void {
	const normalized = normalizeDocumentationRoot(rootPath);
	if (rootPath === 'docs/' || rootPath === 'docs') {
		addFinding(context, {
			code: 'workspace_root_invalid',
			expected: DEFAULT_DOCUMENTATION_ROOT,
			location: {
				path: context.workspacePath,
				pointer: '/documentation/rootPath',
			},
			message: 'The default documentation root is logos/, not docs/.',
			received: rootPath,
			recoveryHint: {
				message:
					'Use logos/ for the default documentation root, or explicitly configure a custom root.',
			},
			severity: 'error',
			source: { kind: 'root_path', path: context.workspacePath },
		});
	}
	const resolved = resolve(context.projectRoot, normalized);
	if (isAbsolute(rootPath) || !pathIsWithin(resolved, context.projectRoot)) {
		addFinding(context, {
			code: 'workspace_root_invalid',
			expected: 'relative documentation root under project root',
			location: {
				path: context.workspacePath,
				pointer: '/documentation/rootPath',
			},
			message:
				'Documentation root must be a project-relative path inside the project root.',
			received: rootPath,
			recoveryHint: { message: 'Use a relative root such as logos/.' },
			severity: 'error',
			source: { kind: 'root_path', path: context.workspacePath },
		});
	}
}

function validateProfileLock(
	context: ValidationContext,
	state: WorkspaceState,
): void {
	if (state.profile.profileId !== context.profileId) {
		addFinding(context, {
			code: 'profile_lock_mismatch',
			expected: context.profileId,
			location: { path: context.workspacePath, pointer: '/profile/profileId' },
			message:
				'Workspace active profile lock does not match the profile being validated.',
			received: state.profile.profileId,
			recoveryHint: {
				message:
					'Validate the locked profile or update the workspace through supported initialization flows.',
			},
			severity: 'error',
			source: { kind: 'workspace_state', path: context.workspacePath },
		});
	}
}

function validateStateReferences(
	context: ValidationContext,
	state: WorkspaceState,
): void {
	const knownDocs = context.contract?.documentsByCanonicalId ?? new Map();
	const knownArtifacts = new Set(state.artifacts.map((a) => a.artifactId));
	const knownRuns = new Set([
		...state.runs.map((r) => r.runId),
		...state.generationRuns.map((r) => r.runId),
		...state.validationRuns.map((r) => r.runId),
	]);
	const knownSessions = new Set(state.sessions.map((s) => s.sessionId));

	function checkDocs(
		ids: string[],
		pointerPrefix: string,
		recordId: string,
	): void {
		ids.forEach((id, index) => {
			if (!knownDocs.has(id)) {
				addFinding(context, {
					code: 'workspace_reference_unknown',
					expected: 'known contract document ID',
					location: {
						path: context.workspacePath,
						pointer: `${pointerPrefix}/${index}`,
					},
					message: 'Workspace record references an unknown document ID.',
					received: id,
					recoveryHint: {
						message:
							'Update the record reference to a canonical document ID from the active profile.',
					},
					severity: 'warning',
					source: { kind: 'workspace_state', path: context.workspacePath },
					workspaceRecordId: recordId,
				});
			}
		});
	}

	state.decisions.forEach((record, i) => {
		checkDocs(
			record.affectedDocumentIds,
			`/decisions/${i}/affectedDocumentIds`,
			record.id,
		);
	});
	state.assumptions.forEach((record, i) => {
		checkDocs(
			record.affectedDocumentIds,
			`/assumptions/${i}/affectedDocumentIds`,
			record.id,
		);
	});
	state.openQuestions.forEach((record, i) => {
		checkDocs(
			record.affectedDocumentIds,
			`/openQuestions/${i}/affectedDocumentIds`,
			record.id,
		);
	});
	state.risks.forEach((record, i) => {
		checkDocs(
			record.affectedDocumentIds,
			`/risks/${i}/affectedDocumentIds`,
			record.id,
		);
	});
	state.proposals.forEach((record, i) => {
		if (
			record.sourceDocumentCanonicalId &&
			!knownDocs.has(record.sourceDocumentCanonicalId)
		) {
			addFinding(context, {
				code: 'workspace_reference_unknown',
				expected: 'known contract document ID',
				location: {
					path: context.workspacePath,
					pointer: `/proposals/${i}/sourceDocumentCanonicalId`,
				},
				message: 'Proposal references an unknown source document ID.',
				received: record.sourceDocumentCanonicalId,
				recoveryHint: {
					message: 'Point proposal metadata at a known canonical document ID.',
				},
				severity: 'warning',
				source: { kind: 'workspace_state', path: context.workspacePath },
				workspaceRecordId: record.proposalId,
			});
		}
		if (record.sourceSessionId && !knownSessions.has(record.sourceSessionId)) {
			addFinding(context, {
				code: 'workspace_reference_unknown',
				expected: 'known session ID',
				location: {
					path: context.workspacePath,
					pointer: `/proposals/${i}/sourceSessionId`,
				},
				message: 'Proposal references an unknown session ID.',
				received: record.sourceSessionId,
				recoveryHint: {
					message:
						'Remove stale session references or restore the referenced session record.',
				},
				severity: 'warning',
				source: { kind: 'workspace_state', path: context.workspacePath },
				workspaceRecordId: record.proposalId,
			});
		}
	});
	state.sessions.forEach((record, i) => {
		record.relatedArtifactIds.forEach((id, index) => {
			if (!knownArtifacts.has(id)) {
				addFinding(context, {
					code: 'workspace_reference_unknown',
					expected: 'known artifact ID',
					location: {
						path: context.workspacePath,
						pointer: `/sessions/${i}/relatedArtifactIds/${index}`,
					},
					message: 'Session references an unknown artifact ID.',
					received: id,
					recoveryHint: {
						message:
							'Remove stale artifact references or restore the artifact record.',
					},
					severity: 'warning',
					source: { kind: 'workspace_state', path: context.workspacePath },
					workspaceRecordId: record.sessionId,
				});
			}
		});
		record.relatedRunIds.forEach((id, index) => {
			if (!knownRuns.has(id)) {
				addFinding(context, {
					code: 'workspace_reference_unknown',
					expected: 'known run ID',
					location: {
						path: context.workspacePath,
						pointer: `/sessions/${i}/relatedRunIds/${index}`,
					},
					message: 'Session references an unknown run ID.',
					received: id,
					recoveryHint: {
						message: 'Remove stale run references or restore the run record.',
					},
					severity: 'warning',
					source: { kind: 'workspace_state', path: context.workspacePath },
					workspaceRecordId: record.sessionId,
				});
			}
		});
	});
}

async function validateArtifactScope(
	context: ValidationContext,
	input: ValidationRunInput,
): Promise<void> {
	const artifacts = normalizeArtifacts(context, input);
	const knownDocs = context.contract?.documentsByCanonicalId ?? new Map();
	const knownPhaseIds = new Set(
		context.contract?.phases.map((p) => p.id) ?? [],
	);
	const docsRoot = resolve(context.projectRoot, context.documentationRoot);
	const seenPaths = new Map<string, string>();

	for (let i = 0; i < artifacts.length; i++) {
		const artifact = artifacts[i];
		if (artifact === undefined) continue;
		const pointerPrefix = `/artifacts/${i}`;
		collectSecretFindings(
			context,
			artifact,
			context.workspacePath,
			'artifact_registry',
			pointerPrefix,
		);
		if (
			artifact.artifactType === CANONICAL_ARTIFACT_TYPE &&
			artifact.isCanonical !== true
		) {
			addFinding(context, {
				code: 'artifact_invalid_canonicality',
				expected: true,
				location: {
					path: context.workspacePath,
					pointer: `${pointerPrefix}/isCanonical`,
				},
				message:
					'Canonical Markdown artifact metadata must be marked canonical.',
				received: artifact.isCanonical,
				recoveryHint: {
					message: 'Mark canonical Markdown artifact records as canonical.',
				},
				severity: 'error',
				source: { kind: 'artifact_registry', path: context.workspacePath },
				workspaceRecordId: artifact.artifactId,
			});
		}
		if (
			DERIVED_CANONICAL_FORBIDDEN.has(artifact.artifactType) &&
			artifact.isCanonical
		) {
			addFinding(context, {
				code: 'artifact_invalid_canonicality',
				expected: false,
				location: {
					path: context.workspacePath,
					pointer: `${pointerPrefix}/isCanonical`,
				},
				message:
					'Derived HTML, agent-pack, and Executive artifacts must not be canonical.',
				received: artifact.isCanonical,
				recoveryHint: {
					message: 'Mark derived artifact records as non-canonical.',
				},
				severity: 'error',
				source: { kind: 'artifact_registry', path: context.workspacePath },
				workspaceRecordId: artifact.artifactId,
			});
		}
		artifact.sourceDocumentIds.forEach((id, index) => {
			if (!knownDocs.has(id)) {
				addFinding(context, {
					code: 'artifact_unknown_document',
					expected: 'known source document ID',
					location: {
						path: context.workspacePath,
						pointer: `${pointerPrefix}/sourceDocumentIds/${index}`,
					},
					message:
						'Artifact source document ID does not exist in the active contract.',
					received: id,
					recoveryHint: {
						message:
							'Update artifact metadata to reference a known canonical document ID.',
					},
					severity: 'error',
					source: { kind: 'artifact_registry', path: context.workspacePath },
					workspaceRecordId: artifact.artifactId,
				});
			}
		});
		const phaseId = getArtifactPhaseId(context, artifact);
		if (phaseId && !knownPhaseIds.has(phaseId)) {
			addFinding(context, {
				code: 'artifact_unknown_phase',
				expected: 'known phase ID',
				location: {
					path: context.workspacePath,
					pointer: `${pointerPrefix}/metadata/phaseId`,
				},
				message: 'Artifact phase ID does not exist in the active contract.',
				received: phaseId,
				recoveryHint: {
					message: 'Update artifact metadata to reference a known phase ID.',
				},
				severity: 'error',
				source: { kind: 'artifact_registry', path: context.workspacePath },
				workspaceRecordId: artifact.artifactId,
			});
		}
		const resolved = validateRelativeSafePath({
			allowAbsoluteInsideRoot: true,
			allowedRoot: artifact.path.startsWith(context.documentationRoot)
				? docsRoot
				: context.projectRoot,
			code: 'artifact_path_invalid',
			context,
			messagePrefix: 'Artifact path',
			path: artifact.path,
			pointer: `${pointerPrefix}/path`,
			source: 'artifact_registry',
		});
		if (resolved) {
			const pathKey = normalize(resolved);
			const previous = seenPaths.get(pathKey);
			if (previous && previous !== artifact.artifactId) {
				addFinding(context, {
					code: 'artifact_duplicate_path',
					expected: 'unique artifact path',
					location: {
						path: context.workspacePath,
						pointer: `${pointerPrefix}/path`,
					},
					message: 'Artifact registry contains duplicate path records.',
					received: artifact.path,
					recoveryHint: {
						message: 'Keep a single artifact record for each generated path.',
					},
					severity: 'error',
					source: { kind: 'artifact_registry', path: context.workspacePath },
					workspaceRecordId: artifact.artifactId,
				});
			} else {
				seenPaths.set(pathKey, artifact.artifactId);
			}
			if (!(await fileExists(resolved)) && artifact.status === 'generated') {
				addFinding(context, {
					code: 'artifact_file_missing',
					location: { path: artifact.path, pointer: `${pointerPrefix}/path` },
					message:
						'Generated artifact metadata points to a file that is not present.',
					recoveryHint: {
						message:
							'Regenerate the artifact or mark the registry entry missing/stale.',
					},
					severity: 'warning',
					source: { kind: 'artifact_registry', path: artifact.path },
					workspaceRecordId: artifact.artifactId,
				});
			}
		}
		if (artifact.checksum && !SHA256_RE.test(artifact.checksum)) {
			addFinding(context, {
				code: 'artifact_checksum_invalid',
				expected: 'sha256 hex checksum',
				location: {
					path: context.workspacePath,
					pointer: `${pointerPrefix}/checksum`,
				},
				message: 'Artifact checksum has an invalid format.',
				received: artifact.checksum,
				recoveryHint: {
					message:
						'Store a SHA-256 hex checksum when checksum metadata is present.',
				},
				severity: 'error',
				source: { kind: 'artifact_registry', path: context.workspacePath },
				workspaceRecordId: artifact.artifactId,
			});
		}
		if (
			artifact.generatedAt &&
			Number.isNaN(Date.parse(artifact.generatedAt))
		) {
			addFinding(context, {
				code: 'artifact_generated_at_invalid',
				expected: 'ISO-compatible timestamp',
				location: {
					path: context.workspacePath,
					pointer: `${pointerPrefix}/generatedAt`,
				},
				message: 'Artifact generatedAt timestamp is invalid.',
				received: artifact.generatedAt,
				recoveryHint: {
					message: 'Use an ISO timestamp for generatedAt metadata.',
				},
				severity: 'error',
				source: { kind: 'artifact_registry', path: context.workspacePath },
				workspaceRecordId: artifact.artifactId,
			});
		}
	}
}

function normalizeArtifacts(
	context: ValidationContext,
	input: ValidationRunInput,
): WorkspaceArtifact[] {
	const source = input.artifacts ?? context.state?.artifacts ?? [];
	const artifacts: WorkspaceArtifact[] = [];
	for (let i = 0; i < source.length; i++) {
		const candidate = source[i];
		const parsed = WorkspaceArtifactSchema.safeParse(candidate);
		if (parsed.success) {
			artifacts.push(parsed.data);
			continue;
		}
		for (const issue of parsed.error.issues) {
			addFinding(context, {
				code: 'artifact_invalid',
				location: {
					path: context.workspacePath,
					pointer: `/artifacts/${i}/${issue.path.join('/')}`,
				},
				message: issue.message,
				recoveryHint: {
					message:
						'Fix artifact metadata to match the workspace artifact schema.',
				},
				severity: 'error',
				source: { kind: 'artifact_registry', path: context.workspacePath },
			});
		}
	}
	return artifacts;
}

function getArtifactPhaseId(
	context: ValidationContext,
	artifact: WorkspaceArtifact,
): string | undefined {
	const fromMetadata = artifact.metadata?.phaseId;
	if (typeof fromMetadata === 'string') return fromMetadata;
	const firstDoc = artifact.sourceDocumentIds[0];
	if (!firstDoc) return undefined;
	return context.contract?.documentsByCanonicalId.get(firstDoc)?.phaseId;
}

async function validateOutputScope(
	context: ValidationContext,
	input: ValidationRunInput,
): Promise<void> {
	const artifacts = normalizeArtifacts(context, input).filter(
		(a) => a.artifactType === CANONICAL_ARTIFACT_TYPE,
	);
	const explicitOutputPaths = input.outputPaths ?? [];
	if (artifacts.length === 0 && explicitOutputPaths.length === 0) return;
	const docsRoot = resolve(context.projectRoot, context.documentationRoot);

	const outputTargets = artifacts.map((artifact, index) => ({
		artifact,
		index,
	}));
	for (const item of outputTargets) {
		const artifact = item.artifact;
		const resolved = validateRelativeSafePath({
			allowAbsoluteInsideRoot: true,
			allowedRoot: artifact.path.startsWith(context.documentationRoot)
				? docsRoot
				: context.projectRoot,
			code: 'artifact_path_invalid',
			context,
			messagePrefix: 'Generated output path',
			path: artifact.path,
			pointer: `/artifacts/${item.index}/path`,
			source: 'generated_output_metadata',
		});
		if (!resolved || !(await fileExists(resolved))) continue;
		await validateMarkdownMetadataFile(
			context,
			artifact,
			resolved,
			`/artifacts/${item.index}`,
		);
	}

	for (let i = 0; i < explicitOutputPaths.length; i++) {
		const outputPath = explicitOutputPaths[i];
		if (outputPath === undefined) continue;
		const resolved = validateRelativeSafePath({
			allowAbsoluteInsideRoot: true,
			allowedRoot: docsRoot,
			code: 'artifact_path_invalid',
			context,
			messagePrefix: 'Generated output path',
			path: outputPath,
			pointer: `/outputPaths/${i}`,
			source: 'generated_output_metadata',
		});
		if (!resolved || !(await fileExists(resolved))) continue;
		await validateMarkdownMetadataFile(
			context,
			undefined,
			resolved,
			`/outputPaths/${i}`,
		);
	}
}

async function validateMarkdownMetadataFile(
	context: ValidationContext,
	artifact: WorkspaceArtifact | undefined,
	resolvedPath: string,
	pointerPrefix: string,
): Promise<void> {
	let content: string;
	try {
		content = await readFile(resolvedPath, 'utf-8');
	} catch {
		addFinding(context, {
			code: 'output_metadata_invalid',
			location: { path: resolvedPath, pointer: pointerPrefix },
			message:
				'Generated Markdown file could not be read for metadata validation.',
			recoveryHint: { message: 'Check file permissions and rerun validation.' },
			severity: 'warning',
			source: { kind: 'generated_output_metadata', path: resolvedPath },
		});
		return;
	}
	const parsed = parseFrontmatter(content);
	if (!parsed.parsedSuccessfully) {
		const missing = parsed.parseErrors.includes('no_frontmatter_delimiter');
		addFinding(context, {
			code: missing ? 'output_metadata_missing' : 'output_metadata_invalid',
			location: { path: resolvedPath, pointer: '/frontmatter' },
			message: missing
				? 'Generated Markdown metadata header is missing.'
				: `Generated Markdown metadata header is invalid: ${parsed.parseErrors.join(', ')}`,
			recoveryHint: {
				message:
					'Regenerate the canonical Markdown file or restore its generated metadata header.',
			},
			severity: 'warning',
			source: { kind: 'generated_output_metadata', path: resolvedPath },
			workspaceRecordId: artifact?.artifactId,
		});
		return;
	}

	const metadata = parsed.metadata;
	collectSecretFindings(
		context,
		{ ...metadata, contentChecksum: parsed.checksum },
		resolvedPath,
		'generated_output_metadata',
	);
	const docId = artifact?.sourceDocumentIds[0] ?? metadata.documentId;
	const contractDoc = docId
		? context.contract?.documentsByCanonicalId.get(docId)
		: undefined;
	if (
		artifact?.sourceDocumentIds[0] &&
		metadata.documentId !== artifact.sourceDocumentIds[0]
	) {
		addFinding(context, {
			code: 'output_metadata_document_mismatch',
			documentCanonicalId: artifact.sourceDocumentIds[0],
			expected: artifact.sourceDocumentIds[0],
			location: { path: resolvedPath, pointer: '/documentId' },
			message:
				'Generated metadata documentId does not match the artifact source document ID.',
			received: metadata.documentId,
			recoveryHint: {
				message:
					'Regenerate the file for the artifact source document or fix stale registry metadata.',
			},
			severity: 'error',
			source: { kind: 'generated_output_metadata', path: resolvedPath },
			workspaceRecordId: artifact.artifactId,
		});
	}
	if (contractDoc && metadata.phaseId !== contractDoc.phaseId) {
		addFinding(context, {
			code: 'output_metadata_phase_mismatch',
			documentCanonicalId: contractDoc.canonicalId,
			expected: contractDoc.phaseId,
			location: { path: resolvedPath, pointer: '/phaseId' },
			message: 'Generated metadata phaseId does not match the contract phase.',
			phaseId: contractDoc.phaseId,
			received: metadata.phaseId,
			recoveryHint: {
				message: 'Regenerate the file from the active contract.',
			},
			severity: 'error',
			source: { kind: 'generated_output_metadata', path: resolvedPath },
			workspaceRecordId: artifact?.artifactId,
		});
	}
	if (metadata.profileId !== context.profileId) {
		addFinding(context, {
			code: 'output_metadata_profile_mismatch',
			expected: context.profileId,
			location: { path: resolvedPath, pointer: '/profileId' },
			message:
				'Generated metadata profileId does not match the active profile.',
			received: metadata.profileId,
			recoveryHint: {
				message: 'Regenerate canonical Markdown with the active profile.',
			},
			severity: 'error',
			source: { kind: 'generated_output_metadata', path: resolvedPath },
			workspaceRecordId: artifact?.artifactId,
		});
	}
	if (contractDoc) {
		const expectedPath = contractDoc.descriptor.outputs.canonical.path;
		if (
			metadata.canonicalOutput !== expectedPath &&
			metadata.canonicalOutput !== artifact?.path
		) {
			addFinding(context, {
				code: 'output_metadata_path_mismatch',
				documentCanonicalId: contractDoc.canonicalId,
				expected: expectedPath,
				location: { path: resolvedPath, pointer: '/canonicalOutput' },
				message:
					'Generated metadata canonical output path does not match the contract or artifact path.',
				phaseId: contractDoc.phaseId,
				received: metadata.canonicalOutput,
				recoveryHint: {
					message: 'Regenerate the file after resolving path metadata drift.',
				},
				severity: 'error',
				source: { kind: 'generated_output_metadata', path: resolvedPath },
				workspaceRecordId: artifact?.artifactId,
			});
		}
	}
	if (/validation\s*[:=]\s*(passed|true)/i.test(parsed.frontmatterRaw)) {
		addFinding(context, {
			code: 'output_metadata_validation_overclaim',
			location: { path: resolvedPath, pointer: '/frontmatter' },
			message:
				'Generated metadata claims validation passed without persisted validation evidence.',
			recoveryHint: {
				message:
					'Remove validation-passed claims until a later step persists validation evidence.',
			},
			severity: 'warning',
			source: { kind: 'generated_output_metadata', path: resolvedPath },
			workspaceRecordId: artifact?.artifactId,
		});
	}
	if (parsed.checksum && !SHA256_RE.test(parsed.checksum)) {
		addFinding(context, {
			code: 'artifact_checksum_invalid',
			expected: 'sha256 hex checksum',
			location: { path: resolvedPath, pointer: '/contentChecksum' },
			message: 'Generated metadata checksum has an invalid format.',
			received: parsed.checksum,
			recoveryHint: {
				message: 'Store a SHA-256 hex contentChecksum when present.',
			},
			severity: 'error',
			source: { kind: 'generated_output_metadata', path: resolvedPath },
			workspaceRecordId: artifact?.artifactId,
		});
	}
	if (
		metadata.generationStatus &&
		!VALID_METADATA_STATUSES.has(metadata.generationStatus)
	) {
		addFinding(context, {
			code: 'output_metadata_invalid',
			expected: Array.from(VALID_METADATA_STATUSES),
			location: { path: resolvedPath, pointer: '/generationStatus' },
			message: 'Generated metadata has an unknown generationStatus.',
			received: metadata.generationStatus,
			recoveryHint: {
				message: 'Use a known generation status emitted by the renderer.',
			},
			severity: 'warning',
			source: { kind: 'generated_output_metadata', path: resolvedPath },
			workspaceRecordId: artifact?.artifactId,
		});
	}
	if (
		artifact?.checksum &&
		parsed.checksum &&
		artifact.checksum !== parsed.checksum
	) {
		addFinding(context, {
			code: 'output_registry_mismatch',
			expected: artifact.checksum,
			location: { path: resolvedPath, pointer: '/contentChecksum' },
			message:
				'Generated metadata checksum does not match artifact registry metadata.',
			received: parsed.checksum,
			recoveryHint: {
				message:
					'Regenerate the file or update stale artifact metadata in a supported generation flow.',
			},
			severity: 'warning',
			source: { kind: 'generated_output_metadata', path: resolvedPath },
			workspaceRecordId: artifact.artifactId,
		});
		addFinding(context, {
			code: 'output_manual_edit_status',
			location: { path: resolvedPath, pointer: '/contentChecksum' },
			message:
				'Generated output appears modified or out of sync with registry checksum metadata.',
			recoveryHint: {
				message:
					'Review the file for manual edits before regenerating or updating metadata.',
			},
			severity: 'warning',
			source: { kind: 'generated_output_metadata', path: resolvedPath },
			workspaceRecordId: artifact.artifactId,
		});
	}
}

async function runValidation(
	input: ValidationRunInput,
	options: ValidationRunOptions = {},
): Promise<ValidationRunResult> {
	const scopes = normalizeScopes(options.scopes ?? input.scopes);
	const projectRoot = defaultProjectRoot(input);
	const workspacePath = defaultWorkspacePath(projectRoot, input);
	const context: ValidationContext = {
		diagnostics: [],
		documentationRoot: normalizeDocumentationRoot(input.documentationRoot),
		findings: [],
		order: 0,
		profileId: input.profileId ?? DEFAULT_PROFILE_ID,
		profileRoot: input.profileRoot,
		projectRoot,
		workspacePath,
	};

	if (context.documentationRoot === normalizeDocumentationRoot(undefined)) {
		// Explicitly document the default root decision in diagnostics, not findings.
		addDiagnostic(context, {
			code: 'documentation_root_defaulted',
			message: 'Documentation root defaulted to logos/.',
			path: projectRoot,
			scope: 'all',
			severity: 'info',
			source: 'root_path',
		});
	}

	if (scopes.includes('state')) await validateStateScope(context, input);
	if (scopes.includes('contracts')) await validateContractScope(context);
	if (
		!scopes.includes('contracts') &&
		(scopes.includes('artifacts') || scopes.includes('outputs'))
	) {
		await loadContractContextOnly(context);
	}
	if (
		!context.state &&
		(scopes.includes('artifacts') || scopes.includes('outputs'))
	) {
		const loaded = await readWorkspaceStateReadOnly(context, input);
		context.state = loaded.state;
		if (loaded.documentationRoot) {
			context.documentationRoot = normalizeDocumentationRoot(
				loaded.documentationRoot,
			);
		}
	}
	if (scopes.includes('artifacts')) await validateArtifactScope(context, input);
	if (scopes.includes('outputs')) await validateOutputScope(context, input);

	return createValidationRunResult({
		allowInfoFindingsToPass: options.allowInfoFindingsToPass ?? true,
		diagnostics: context.diagnostics,
		documentationRoot: context.documentationRoot,
		dryRun: options.dryRun ?? true,
		findings: context.findings,
		projectRoot: context.projectRoot,
		scopesChecked: scopes,
		validatedProfileId: context.profileId,
		workspacePath: context.workspacePath,
	});
}

export async function validateWorkspace(
	input: ValidationRunInput = {},
	options: ValidationRunOptions = {},
): Promise<ValidationRunResult> {
	return runValidation(input, {
		...options,
		scopes: options.scopes ?? input.scopes ?? ['all'],
	});
}

export async function validateContracts(
	input: ValidationRunInput = {},
	options: ValidationRunOptions = {},
): Promise<ValidationRunResult> {
	return runValidation(input, { ...options, scopes: ['contracts'] });
}

export async function validateWorkspaceState(
	input: ValidationRunInput = {},
	options: ValidationRunOptions = {},
): Promise<ValidationRunResult> {
	return runValidation(input, { ...options, scopes: ['state'] });
}

export async function validateArtifactRegistry(
	input: ValidationRunInput = {},
	options: ValidationRunOptions = {},
): Promise<ValidationRunResult> {
	return runValidation(input, { ...options, scopes: ['artifacts'] });
}

export async function validateGeneratedOutputMetadata(
	input: ValidationRunInput = {},
	options: ValidationRunOptions = {},
): Promise<ValidationRunResult> {
	return runValidation(input, { ...options, scopes: ['outputs'] });
}

export const validationSchemas = {
	artifact: WorkspaceArtifactSchema,
	stateSchemaVersion: z.literal(WORKSPACE_STATE_SCHEMA_VERSION),
};
