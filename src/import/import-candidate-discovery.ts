/** Step 12.1 — Import candidate discovery from explicit paths, roots, and fixtures */

import {
	existsSync,
	lstatSync,
	readdirSync,
	readFileSync,
	type Stats,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { extractCandidateMetadata } from './import-candidate-classification.js';
import type {
	DocumentationImportBlocker,
	DocumentationImportCandidate,
	DocumentationImportCandidateSource,
	DocumentationImportDiagnostic,
	DocumentationImportPathPolicy,
	DocumentationImportWarning,
} from './import-model.js';
import {
	computeCandidateId,
	computeStringChecksum,
	DEFAULT_IMPORT_PATH_POLICY,
} from './import-model.js';
import {
	checkImportPathSafety,
	getPathExtension,
	resolveImportPathPolicy,
	toRelativeImportPath,
} from './import-path-safety.js';
import {
	hasSecretLikeContent,
	safeContentSnippet,
} from './import-redaction.js';

// ---------------------------------------------------------------------------
// Discovery input
// ---------------------------------------------------------------------------

export interface ImportCandidateDiscoveryInput {
	candidatePaths?: string[] | undefined;
	documentationRoots?: string[] | undefined;
	fixtures?: Map<string, string> | undefined;
	projectRoot?: string | undefined;
	pathPolicy?: Partial<DocumentationImportPathPolicy> | undefined;
	idCounter?: number | undefined;
}

export interface ImportCandidateDiscoveryResult {
	candidates: DocumentationImportCandidate[];
	blockers: DocumentationImportBlocker[];
	warnings: DocumentationImportWarning[];
	diagnostics: DocumentationImportDiagnostic[];
}

// ---------------------------------------------------------------------------
// Main discovery function
// ---------------------------------------------------------------------------

/**
 * Discover import candidates from explicit paths, configured documentation roots,
 * and/or in-memory fixtures.
 *
 * This is a read-only operation that never creates or modifies files.
 */
export function discoverImportCandidates(
	input: ImportCandidateDiscoveryInput,
): ImportCandidateDiscoveryResult {
	const policy = resolveImportPathPolicy(input.pathPolicy);
	const candidates: DocumentationImportCandidate[] = [];
	const blockers: DocumentationImportBlocker[] = [];
	const warnings: DocumentationImportWarning[] = [];
	const diagnostics: DocumentationImportDiagnostic[] = [];
	let nextId = input.idCounter ?? 1;

	const addToResults = (
		cand: DocumentationImportCandidate,
		b: DocumentationImportBlocker[],
		w: DocumentationImportWarning[],
	): void => {
		candidates.push(cand);
		blockers.push(...b);
		warnings.push(...w);
	};

	// 1. Discover from explicit paths
	if (input.candidatePaths && input.candidatePaths.length > 0) {
		for (const rawPath of input.candidatePaths) {
			const discovered = discoverFromPath(
				rawPath,
				'explicit_path',
				input.projectRoot,
				policy,
				nextId,
				input.fixtures,
			);
			// Always collect blockers, warnings, and diagnostics even if no candidate
			diagnostics.push(...discovered.diagnostics);
			blockers.push(...discovered.blockers);
			warnings.push(...discovered.warnings);
			if (discovered.candidate) {
				candidates.push(discovered.candidate);
				nextId++;
			}
		}
	}

	// 2. Discover from documentation roots
	if (input.documentationRoots && input.documentationRoots.length > 0) {
		for (const root of input.documentationRoots) {
			const rootDiscovered = discoverFromRoot(
				root,
				'documentation_root',
				input.projectRoot,
				policy,
				nextId,
			);
			for (const d of rootDiscovered) {
				if (d.candidate) {
					addToResults(d.candidate, d.blockers, d.warnings);
					diagnostics.push(...d.diagnostics);
					nextId++;
				}
			}
		}
	}

	// 3. Discover from fixtures
	if (input.fixtures && input.fixtures.size > 0) {
		for (const [fakePath, content] of input.fixtures.entries()) {
			const fixtureDiscovered = discoverFromFixture(
				fakePath,
				content,
				'fixture',
				nextId,
			);
			if (fixtureDiscovered.candidate) {
				addToResults(
					fixtureDiscovered.candidate,
					fixtureDiscovered.blockers,
					fixtureDiscovered.warnings,
				);
				diagnostics.push(...fixtureDiscovered.diagnostics);
				nextId++;
			}
		}
	}

	// 4. If no candidates at all, add a diagnostic
	if (candidates.length === 0) {
		diagnostics.push({
			code: 'import_no_candidates',
			message: 'No import candidates were discovered',
			severity: 'info',
		});
	}

	return { blockers, candidates, diagnostics, warnings };
}

// ---------------------------------------------------------------------------
// Path-based discovery
// ---------------------------------------------------------------------------

interface SingleDiscoveryResult {
	candidate: DocumentationImportCandidate | null;
	blockers: DocumentationImportBlocker[];
	warnings: DocumentationImportWarning[];
	diagnostics: DocumentationImportDiagnostic[];
}

function discoverFromPath(
	rawPath: string,
	source: DocumentationImportCandidateSource,
	projectRoot: string | undefined,
	policy: DocumentationImportPathPolicy,
	idNumber: number,
	fixtures?: Map<string, string> | undefined,
): SingleDiscoveryResult {
	const blockers: DocumentationImportBlocker[] = [];
	const warnings: DocumentationImportWarning[] = [];
	const diagnostics: DocumentationImportDiagnostic[] = [];

	// Path safety check
	const safety = checkImportPathSafety(rawPath, projectRoot, policy);
	if (!safety.safe) {
		blockers.push(...safety.blockers);
		warnings.push(...safety.warnings);
		return { blockers, candidate: null, diagnostics, warnings };
	}

	const resolvedPath = projectRoot
		? resolve(projectRoot, rawPath)
		: resolve(rawPath);
	const relativePath = projectRoot
		? toRelativeImportPath(resolvedPath, projectRoot)
		: rawPath;

	// Check if file exists
	if (!existsSync(resolvedPath)) {
		diagnostics.push({
			code: 'import_path_not_found',
			message: `Import candidate path does not exist: "${relativePath}"`,
			severity: 'warning',
			sourcePath: relativePath,
		});
		return { blockers, candidate: null, diagnostics, warnings };
	}

	// Check if it's a file (not a directory)
	let stat: Stats;
	try {
		stat = lstatSync(resolvedPath);
	} catch {
		diagnostics.push({
			code: 'import_path_unreadable',
			message: `Cannot stat import candidate path: "${relativePath}"`,
			severity: 'warning',
			sourcePath: relativePath,
		});
		return { blockers, candidate: null, diagnostics, warnings };
	}

	if (stat.isDirectory()) {
		return discoverFromDirectory(
			resolvedPath,
			relativePath,
			source,
			projectRoot,
			policy,
			idNumber,
		);
	}

	if (stat.isSymbolicLink()) {
		// Reject symlinks outside project root
		if (projectRoot) {
			warnings.push({
				code: 'import_symlink_detected',
				message: `Import candidate is a symlink: "${relativePath}"`,
				recoveryHint: 'Symlinks to external content are not followed',
				sourcePath: relativePath,
			});
		}
		return { blockers, candidate: null, diagnostics, warnings };
	}

	// Check extension
	const ext = getPathExtension(relativePath);

	// Build the candidate
	return buildFileCandidate(
		resolvedPath,
		relativePath,
		ext,
		source,
		policy,
		idNumber,
		fixtures,
	);
}

function discoverFromDirectory(
	dirPath: string,
	relativeDir: string,
	source: DocumentationImportCandidateSource,
	projectRoot: string | undefined,
	policy: DocumentationImportPathPolicy,
	startId: number,
): SingleDiscoveryResult {
	// Directory discovery is NOT recursive by default — only direct children
	// are scanned. This prevents arbitrary repository scanning.
	const blockers: DocumentationImportBlocker[] = [];
	const warnings: DocumentationImportWarning[] = [];
	const diagnostics: DocumentationImportDiagnostic[] = [];
	let candidate: DocumentationImportCandidate | null = null;
	let nextId = startId;

	let entries: string[];
	try {
		entries = readdirSync(dirPath);
	} catch {
		diagnostics.push({
			code: 'import_dir_unreadable',
			message: `Cannot read import directory: "${relativeDir}"`,
			severity: 'warning',
			sourcePath: relativeDir,
		});
		return { blockers, candidate: null, diagnostics, warnings };
	}

	for (const entry of entries) {
		const entryPath = join(dirPath, entry);
		let stat: Stats;
		try {
			stat = lstatSync(entryPath);
		} catch {
			continue;
		}

		if (stat.isDirectory() || stat.isSymbolicLink()) {
			continue; // Only discover files, not subdirectories or symlinks
		}

		const relEntryPath = projectRoot
			? toRelativeImportPath(entryPath, projectRoot)
			: entry;
		const ext = getPathExtension(entry);

		// Return the first matching file candidate (non-recursive scan)
		const result = buildFileCandidate(
			entryPath,
			relEntryPath,
			ext,
			source,
			policy,
			nextId,
		);
		if (result.candidate) {
			// Returning SingleDiscoveryResult but we have multiple files...
			// For now, return the first one as a single result.
			// The caller handles multiple results via the array pattern.
			candidate = result.candidate;
			blockers.push(...result.blockers);
			warnings.push(...result.warnings);
			diagnostics.push(...result.diagnostics);
			nextId++;
		}
	}

	return { blockers, candidate, diagnostics, warnings };
}

/**
 * Discover candidates from a directory root — returns multiple candidates.
 */
export function discoverFromRoot(
	rootPath: string,
	source: DocumentationImportCandidateSource,
	projectRoot: string | undefined,
	policy: DocumentationImportPathPolicy,
	startId: number,
): SingleDiscoveryResult[] {
	const results: SingleDiscoveryResult[] = [];
	const safety = checkImportPathSafety(rootPath, projectRoot, policy);

	if (!safety.safe) {
		results.push({
			blockers: safety.blockers,
			candidate: null,
			diagnostics: [],
			warnings: safety.warnings,
		});
		return results;
	}

	const resolvedRoot = projectRoot
		? resolve(projectRoot, rootPath)
		: resolve(rootPath);

	if (!existsSync(resolvedRoot)) {
		results.push({
			blockers: [],
			candidate: null,
			diagnostics: [
				{
					code: 'import_root_not_found',
					message: `Import root does not exist: "${rootPath}"`,
					severity: 'warning',
					sourcePath: rootPath,
				},
			],
			warnings: [],
		});
		return results;
	}

	let stat: Stats;
	try {
		stat = lstatSync(resolvedRoot);
	} catch {
		return results;
	}

	if (!stat.isDirectory()) {
		// Single file as root
		const relPath = projectRoot
			? toRelativeImportPath(resolvedRoot, projectRoot)
			: rootPath;
		const ext = getPathExtension(rootPath);
		const result = buildFileCandidate(
			resolvedRoot,
			relPath,
			ext,
			source,
			policy,
			startId,
		);
		results.push(result);
		return results;
	}

	// Directory: discover all files (non-recursive, direct children only)
	let entries: string[];
	try {
		entries = readdirSync(resolvedRoot);
	} catch {
		return results;
	}

	let nextId = startId;
	for (const entry of entries) {
		const entryPath = join(resolvedRoot, entry);
		let entryStat: Stats;
		try {
			entryStat = lstatSync(entryPath);
		} catch {
			continue;
		}

		if (entryStat.isDirectory()) continue;
		if (entryStat.isSymbolicLink()) continue;

		const relEntryPath = projectRoot
			? toRelativeImportPath(entryPath, projectRoot)
			: join(rootPath, entry);
		const ext = getPathExtension(entry);
		const result = buildFileCandidate(
			entryPath,
			relEntryPath,
			ext,
			source,
			policy,
			nextId,
		);
		results.push(result);
		nextId++;
	}

	return results;
}

// ---------------------------------------------------------------------------
// Fixture-based discovery
// ---------------------------------------------------------------------------

function discoverFromFixture(
	fakePath: string,
	content: string,
	source: DocumentationImportCandidateSource,
	idNumber: number,
): SingleDiscoveryResult {
	const blockers: DocumentationImportBlocker[] = [];
	const warnings: DocumentationImportWarning[] = [];
	const diagnostics: DocumentationImportDiagnostic[] = [];

	const ext = getPathExtension(fakePath);

	// Check extension for unsupported types
	if (
		ext &&
		!DEFAULT_IMPORT_PATH_POLICY.allowedExtensions.includes(ext.toLowerCase())
	) {
		const candidateId = computeCandidateId(idNumber);
		const candidate: DocumentationImportCandidate = {
			blockers: [],
			contentSnippet: undefined,
			extension: ext,
			id: candidateId,
			kind: 'unsupported',
			metadata: { sizeBytes: Buffer.byteLength(content, 'utf-8') },
			relativePath: fakePath,
			root: '',
			sizeBytes: Buffer.byteLength(content, 'utf-8'),
			source,
			status: 'unsupported',
			warnings: [],
		};
		diagnostics.push({
			candidateId,
			candidateKind: 'unsupported',
			code: 'import_unsupported_extension',
			message: `Unsupported extension "${ext}" for import candidate: "${fakePath}"`,
			severity: 'info',
			sourcePath: fakePath,
		});
		return { blockers, candidate, diagnostics, warnings };
	}

	const candidate = buildCandidateFromContent(
		fakePath,
		fakePath,
		ext,
		content,
		source,
		idNumber,
	);

	return { blockers, candidate, diagnostics, warnings };
}

// ---------------------------------------------------------------------------
// File candidate builder (from disk)
// ---------------------------------------------------------------------------

function buildFileCandidate(
	absolutePath: string,
	relativePath: string,
	ext: string,
	source: DocumentationImportCandidateSource,
	policy: DocumentationImportPathPolicy,
	idNumber: number,
	_fixtures?: Map<string, string> | undefined,
): SingleDiscoveryResult {
	const blockers: DocumentationImportBlocker[] = [];
	const warnings: DocumentationImportWarning[] = [];
	const diagnostics: DocumentationImportDiagnostic[] = [];
	const candidateId = computeCandidateId(idNumber);

	// Check extension
	if (ext && !policy.allowedExtensions.includes(ext.toLowerCase())) {
		const candidate: DocumentationImportCandidate = {
			blockers: [],
			contentSnippet: undefined,
			extension: ext,
			id: candidateId,
			kind: 'unsupported',
			metadata: { sizeBytes: 0 },
			relativePath,
			root: source === 'documentation_root' ? relativePath : '',
			sizeBytes: 0,
			source,
			status: 'unsupported',
			warnings: [],
		};
		diagnostics.push({
			candidateId,
			candidateKind: 'unsupported',
			code: 'import_unsupported_extension',
			message: `Unsupported extension "${ext}" for import candidate: "${relativePath}"`,
			severity: 'info',
			sourcePath: relativePath,
		});
		return { blockers, candidate, diagnostics, warnings };
	}

	// Read file
	let content: string;
	let stat: Stats;
	try {
		stat = lstatSync(absolutePath);
	} catch {
		diagnostics.push({
			code: 'import_stat_failed',
			message: `Cannot stat file: "${relativePath}"`,
			severity: 'warning',
			sourcePath: relativePath,
		});
		return { blockers, candidate: null, diagnostics, warnings };
	}

	// Check file size
	if (stat.size > policy.maxFileSizeBytes) {
		blockers.push({
			candidateId,
			code: 'import_file_too_large',
			message: `Import candidate exceeds maximum size (${stat.size} > ${policy.maxFileSizeBytes}): "${relativePath}"`,
			recoveryHint: 'Reduce the file size or exclude it from import',
			severity: 'error',
			sourcePath: relativePath,
		});
		const candidate: DocumentationImportCandidate = {
			blockers,
			contentSnippet: undefined,
			extension: ext,
			id: candidateId,
			kind: 'unknown',
			metadata: { sizeBytes: stat.size },
			relativePath,
			root: source === 'documentation_root' ? relativePath : '',
			sizeBytes: stat.size,
			source,
			status: 'blocked',
			warnings,
		};
		return { blockers, candidate, diagnostics, warnings };
	}

	try {
		content = readFileSync(absolutePath, 'utf-8');
	} catch {
		diagnostics.push({
			code: 'import_read_failed',
			message: `Cannot read file: "${relativePath}"`,
			severity: 'warning',
			sourcePath: relativePath,
		});
		return { blockers, candidate: null, diagnostics, warnings };
	}

	const candidate = buildCandidateFromContent(
		absolutePath,
		relativePath,
		ext,
		content,
		source,
		idNumber,
		stat.size,
		stat.mtime.toISOString(),
	);

	return {
		blockers: candidate.blockers,
		candidate,
		diagnostics: [],
		warnings: candidate.warnings,
	};
}

// ---------------------------------------------------------------------------
// Candidate builder from content
// ---------------------------------------------------------------------------

function buildCandidateFromContent(
	_pathOrId: string,
	relativePath: string,
	ext: string,
	content: string,
	source: DocumentationImportCandidateSource,
	idNumber: number,
	sizeBytes?: number,
	modifiedTimestamp?: string,
): DocumentationImportCandidate {
	const candidateId = computeCandidateId(idNumber);
	const actualSize = sizeBytes ?? Buffer.byteLength(content, 'utf-8');

	// Detect secrets before redaction
	const hasSecrets = hasSecretLikeContent(content);

	// Create redacted snippet for safe output
	const snippet = safeContentSnippet(content);
	const checksum = computeStringChecksum(content);

	// Build base candidate with minimal metadata
	const blockers: DocumentationImportBlocker[] = [];
	const warnings: DocumentationImportWarning[] = [];

	if (hasSecrets) {
		blockers.push({
			candidateId,
			code: 'import_secret_content',
			message: `Potential secret or credential content detected in: "${relativePath}"`,
			recoveryHint: 'Redact secrets before importing',
			severity: 'error',
			sourcePath: relativePath,
		});
	}

	const candidate: DocumentationImportCandidate = {
		blockers,
		contentSnippet: snippet,
		extension: ext,
		id: candidateId,
		kind: 'unknown',
		metadata: {
			checksum,
			kind: undefined,
			sizeBytes: actualSize,
			...(modifiedTimestamp ? { modifiedTimestamp } : {}),
		},
		relativePath,
		root: source === 'documentation_root' ? relativePath : '',
		sizeBytes: actualSize,
		source,
		status: hasSecrets ? 'unsafe' : 'unknown',
		warnings,
	};

	// Extract metadata from full content before truncation
	return extractCandidateMetadata(candidate, content);
}
