/** Step 12.1 — Import path safety: containment, traversal, and policy checks */

import { isAbsolute, normalize, relative, resolve, sep } from 'node:path';
import type {
	DocumentationImportBlocker,
	DocumentationImportPathPolicy,
	DocumentationImportWarning,
} from './import-model.js';
import { DEFAULT_IMPORT_PATH_POLICY } from './import-model.js';

// ---------------------------------------------------------------------------
// Path normalization
// ---------------------------------------------------------------------------

export function normalizeImportPath(raw: string): string {
	return normalize(raw).split(sep).join('/');
}

export function toRelativeImportPath(
	absolutePath: string,
	projectRoot: string,
): string {
	const rel = relative(resolve(projectRoot), resolve(absolutePath));
	return normalizeImportPath(rel);
}

// ---------------------------------------------------------------------------
// Policy builder
// ---------------------------------------------------------------------------

export function resolveImportPathPolicy(
	overrides?: Partial<DocumentationImportPathPolicy>,
): DocumentationImportPathPolicy {
	if (!overrides) return { ...DEFAULT_IMPORT_PATH_POLICY };
	return {
		...DEFAULT_IMPORT_PATH_POLICY,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Path traversal detection
// ---------------------------------------------------------------------------

export function isPathTraversal(normalizedPath: string): boolean {
	// Check for `..` segments after normalization
	const segments = normalizedPath.split('/');
	return segments.some((s) => s === '..' || s === '...');
}

export function isPathTraversalRaw(rawPath: string): boolean {
	const segments = rawPath.replace(/\\/g, '/').split('/');
	return segments.some((s) => s === '..' || s === '...');
}

// ---------------------------------------------------------------------------
// Path containment
// ---------------------------------------------------------------------------

export interface PathSafetyResult {
	safe: boolean;
	normalizedPath?: string | undefined;
	relativePath?: string | undefined;
	blockers: DocumentationImportBlocker[];
	warnings: DocumentationImportWarning[];
}

/**
 * Check if a candidate path is safe for import planning.
 * Returns blockers for unsafe paths and warnings for concerning patterns.
 */
export function checkImportPathSafety(
	candidatePath: string,
	projectRoot: string | undefined,
	policy: DocumentationImportPathPolicy,
): PathSafetyResult {
	const blockers: DocumentationImportBlocker[] = [];
	const warnings: DocumentationImportWarning[] = [];

	// Reject path traversal
	if (policy.disallowPathTraversal && isPathTraversalRaw(candidatePath)) {
		blockers.push({
			code: 'import_path_traversal',
			message: `Path traversal detected in import candidate: "${candidatePath}"`,
			recoveryHint: 'Provide a safe relative path within the project root',
			severity: 'fatal',
			sourcePath: candidatePath,
		});
		return { blockers, safe: false, warnings };
	}

	// Handle absolute paths
	if (isAbsolute(candidatePath)) {
		if (!policy.allowAbsolutePaths) {
			blockers.push({
				code: 'import_absolute_path_not_allowed',
				message: `Absolute paths are not allowed for import candidates: "${candidatePath}"`,
				recoveryHint: 'Provide a relative path within the project root',
				severity: 'error',
				sourcePath: candidatePath,
			});
			return { blockers, safe: false, warnings };
		}
	}

	// Resolve to absolute and check containment
	if (projectRoot) {
		const resolvedRoot = resolve(projectRoot);
		let resolvedPath: string;

		try {
			resolvedPath = resolve(projectRoot, candidatePath);
		} catch {
			blockers.push({
				code: 'import_path_resolution_error',
				message: `Could not resolve import candidate path: "${candidatePath}"`,
				recoveryHint: 'Verify the path is well-formed',
				severity: 'error',
				sourcePath: candidatePath,
			});
			return { blockers, safe: false, warnings };
		}

		// Check containment in project root
		const normalizedPath = normalizeImportPath(resolvedPath);
		const normalizedRoot = normalizeImportPath(resolvedRoot);

		if (
			!normalizedPath.startsWith(`${normalizedRoot}/`) &&
			normalizedPath !== normalizedRoot
		) {
			blockers.push({
				code: 'import_path_outside_project_root',
				message: `Import candidate path is outside project root: "${candidatePath}"`,
				recoveryHint: 'Provide a path within the project root',
				severity: 'error',
				sourcePath: candidatePath,
			});
			return { blockers, safe: false, warnings };
		}

		// Check path traversal after resolution
		if (isPathTraversal(normalizedPath)) {
			blockers.push({
				code: 'import_path_traversal_resolved',
				message: `Resolved import candidate path contains traversal: "${candidatePath}"`,
				recoveryHint: 'Provide a safe path without ".." segments',
				severity: 'fatal',
				sourcePath: candidatePath,
			});
			return { blockers, safe: false, warnings };
		}

		const relativePath = toRelativeImportPath(resolvedPath, projectRoot);

		// Check for hidden directory markers
		if (
			relativePath.startsWith('.') ||
			relativePath.split('/').some((s) => s.startsWith('.'))
		) {
			warnings.push({
				code: 'import_hidden_path',
				message: `Import candidate is in a hidden directory: "${relativePath}"`,
				recoveryHint: 'Review whether this path should be importable',
				sourcePath: relativePath,
			});
		}

		return {
			blockers: [],
			normalizedPath: normalizedPath,
			relativePath,
			safe: true,
			warnings,
		};
	}

	// No project root: basic checks only
	const normalized = normalizeImportPath(candidatePath);
	if (policy.disallowPathTraversal && isPathTraversal(normalized)) {
		blockers.push({
			code: 'import_path_traversal',
			message: `Path traversal detected in import candidate: "${candidatePath}"`,
			recoveryHint: 'Provide a safe relative path',
			severity: 'fatal',
			sourcePath: candidatePath,
		});
		return { blockers, safe: false, warnings };
	}

	return {
		blockers: [],
		normalizedPath: normalized,
		relativePath: normalized,
		safe: true,
		warnings,
	};
}

/**
 * Check if an extension is in the allowed list.
 */
export function isExtensionAllowed(
	ext: string,
	policy: DocumentationImportPathPolicy,
): boolean {
	const lowerExt = ext.toLowerCase();
	return policy.allowedExtensions.includes(lowerExt);
}

/**
 * Get the extension from a path, lowercased.
 */
export function getPathExtension(path: string): string {
	const lastDot = path.lastIndexOf('.');
	if (lastDot === -1) return '';
	return path.slice(lastDot).toLowerCase();
}
