/** Step 12.2 — Repository Scan Policy: bounded scan limits and checks */

import { isAbsolute, normalize, relative, resolve, sep } from 'node:path';
import type {
	RepositoryScanDiagnostic,
	RepositoryScanPolicy,
} from './repository-scan-model.js';
import { DEFAULT_SCAN_POLICY } from './repository-scan-model.js';

// ---------------------------------------------------------------------------
// Policy resolution
// ---------------------------------------------------------------------------

export function resolveScanPolicy(
	overrides?: Partial<RepositoryScanPolicy>,
): RepositoryScanPolicy {
	if (!overrides || Object.keys(overrides).length === 0) {
		return { ...DEFAULT_SCAN_POLICY };
	}

	return {
		...DEFAULT_SCAN_POLICY,
		...overrides,
		// Enforce critical guardrails — these must never be overridden
		callNetwork: false,
		executeScripts: false,
		installDependencies: false,
		readSourceContent: false,
	};
}

// ---------------------------------------------------------------------------
// Path safety checks
// ---------------------------------------------------------------------------

export interface PathSafetyResult {
	safe: boolean;
	diagnostic?: RepositoryScanDiagnostic | undefined;
}

export function checkPathSafe(
	path: string,
	projectRoot: string,
): PathSafetyResult {
	const resolved = resolve(normalize(path));
	const root = resolve(normalize(projectRoot));

	// Check for path traversal
	if (resolved.includes('..') && !resolved.startsWith(root)) {
		return {
			diagnostic: {
				code: 'path_traversal',
				expected: `path within ${root}`,
				message: `Path traversal detected: "${path}" resolves outside project root`,
				received: resolved,
				severity: 'fatal',
				sourcePath: path,
			},
			safe: false,
		};
	}

	// Ensure resolved path is within project root
	const relativePath = relative(root, resolved);
	if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
		return {
			diagnostic: {
				code: 'path_outside_root',
				expected: `path within ${root}`,
				message: `Path "${path}" resolves outside project root boundary`,
				received: resolved,
				severity: 'fatal',
				sourcePath: path,
			},
			safe: false,
		};
	}

	return { safe: true };
}

// ---------------------------------------------------------------------------
// Ignored directory checks
// ---------------------------------------------------------------------------

export function isDirectoryIgnored(
	dirname: string,
	policy: RepositoryScanPolicy,
): boolean {
	return policy.ignoredDirectoryNames.some(
		(ignored) =>
			dirname === ignored ||
			dirname.startsWith(`${ignored}${sep}`) ||
			dirname.endsWith(`${sep}${ignored}`),
	);
}

// ---------------------------------------------------------------------------
// Allowed extension checks
// ---------------------------------------------------------------------------

export function isExtensionAllowed(
	filename: string,
	policy: RepositoryScanPolicy,
): boolean {
	if (policy.allowedExtensions.length === 0) return true;
	const lower = filename.toLowerCase();
	return policy.allowedExtensions.some((ext) => lower.endsWith(ext));
}

// ---------------------------------------------------------------------------
// File size checks
// ---------------------------------------------------------------------------

export interface SizeCheckResult {
	allowed: boolean;
	reason?: string | undefined;
}

export function checkFileSizeLimit(
	sizeBytes: number,
	policy: RepositoryScanPolicy,
): SizeCheckResult {
	if (sizeBytes > policy.maxFileSizeBytes) {
		return {
			allowed: false,
			reason: `File size ${sizeBytes} bytes exceeds limit of ${policy.maxFileSizeBytes} bytes`,
		};
	}
	return { allowed: true };
}

// ---------------------------------------------------------------------------
// File count check
// ---------------------------------------------------------------------------

export interface CountCheckResult {
	allowed: boolean;
	reason?: string | undefined;
}

export function checkFileCountLimit(
	currentCount: number,
	policy: RepositoryScanPolicy,
): CountCheckResult {
	if (currentCount >= policy.maxFilesInspected) {
		return {
			allowed: false,
			reason: `Maximum file inspection count (${policy.maxFilesInspected}) reached`,
		};
	}
	return { allowed: true };
}

// ---------------------------------------------------------------------------
// Recursion depth check
// ---------------------------------------------------------------------------

export interface DepthCheckResult {
	allowed: boolean;
	reason?: string | undefined;
}

export function checkRecursionDepth(
	depth: number,
	policy: RepositoryScanPolicy,
): DepthCheckResult {
	if (depth > policy.maxRecursionDepth) {
		return {
			allowed: false,
			reason: `Recursion depth ${depth} exceeds limit of ${policy.maxRecursionDepth}`,
		};
	}
	return { allowed: true };
}

// ---------------------------------------------------------------------------
// Filesystem-safe path relative computation
// ---------------------------------------------------------------------------

export function safeRelativePath(
	absolutePath: string,
	projectRoot: string,
): string {
	const rel = relative(resolve(projectRoot), resolve(absolutePath));
	if (rel.startsWith('..')) return absolutePath;
	return rel || '.';
}

// ---------------------------------------------------------------------------
// Known metadata filenames (always safe to read)
// ---------------------------------------------------------------------------

export const KNOWN_METADATA_FILENAMES = new Set([
	'package.json',
	'pnpm-lock.yaml',
	'tsconfig.json',
	'vitest.config.ts',
	'biome.json',
	'.markdownlint.json',
	'README.md',
	'SECURITY.md',
	'CONTRIBUTING.md',
	'LICENSE',
	'AGENTS.md',
]);

// ---------------------------------------------------------------------------
// Secret detection (bounded, pattern-based)
// ---------------------------------------------------------------------------

const SECRET_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
	{ label: 'openai_api_key', pattern: /sk-[a-zA-Z0-9_-]{32,}/ },
	{ label: 'anthropic_api_key', pattern: /sk-ant-[a-zA-Z0-9]{32,}/ },
	{ label: 'bearer_token', pattern: /bearer\s+[a-zA-Z0-9._\-+/=]{20,}/i },
	{ label: 'basic_auth', pattern: /basic\s+[a-zA-Z0-9._\-+/=]{20,}/i },
	{
		label: 'generic_api_key',
		pattern:
			/(?:api[_-]?key|apikey|api[_-]?secret)\s*[:=]\s*["']?[a-zA-Z0-9._\-+/=]{20,}["']?/i,
	},
	{
		label: 'github_token',
		pattern: /(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,}/,
	},
	{
		label: 'slack_token',
		pattern: /xox[bp]-[a-zA-Z0-9-]{10,}/,
	},
	{
		label: 'aws_key',
		pattern: /AKIA[0-9A-Z]{16}/,
	},
	{
		label: 'private_key_header',
		pattern: /-----BEGIN\s+(?:RSA|EC|OPENSSH|DSA)\s+PRIVATE KEY-----/,
	},
	{
		label: 'jwt_token',
		pattern: /eyJ[a-zA-Z0-9._-]{20,}\.[a-zA-Z0-9._-]{20,}\.[a-zA-Z0-9._-]{10,}/,
	},
];

export interface SecretScanResult {
	hasSecret: boolean;
	label?: string | undefined;
	matchLength?: number | undefined;
}

export function scanForSecrets(content: string): SecretScanResult {
	for (const { pattern, label } of SECRET_PATTERNS) {
		const match = pattern.exec(content);
		if (match) {
			return {
				hasSecret: true,
				label,
				matchLength: match[0].length,
			};
		}
	}
	return { hasSecret: false };
}

export function redactSecretContent(content: string): string {
	let redacted = content;
	for (const { pattern } of SECRET_PATTERNS) {
		redacted = redacted.replace(pattern, '[redacted-secret-like-value]');
	}
	return redacted;
}

// ---------------------------------------------------------------------------
// Policy limit diagnostics
// ---------------------------------------------------------------------------

export function createPolicyLimitDiagnostic(
	reason: string,
	path?: string,
): RepositoryScanDiagnostic {
	return {
		code: 'scan_policy_limit_reached',
		message: reason,
		recoveryHint:
			'Increase scan policy limits if more exhaustive scanning is required.',
		severity: 'warning',
		sourcePath: path,
	};
}
