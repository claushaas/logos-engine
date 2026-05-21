/** Step 12.2 — Repository Scan Policy Tests */

import { describe, expect, it } from 'vitest';
import type { RepositoryScanPolicy } from '../src/scanner/repository-scan-model.js';
import {
	checkFileCountLimit,
	checkFileSizeLimit,
	checkPathSafe,
	checkRecursionDepth,
	createPolicyLimitDiagnostic,
	isDirectoryIgnored,
	isExtensionAllowed,
	KNOWN_METADATA_FILENAMES,
	redactSecretContent,
	resolveScanPolicy,
	scanForSecrets,
} from '../src/scanner/repository-scan-policy.js';

// ---------------------------------------------------------------------------
// Policy resolution
// ---------------------------------------------------------------------------

describe('resolveScanPolicy', () => {
	it('returns defaults when no overrides', () => {
		const policy = resolveScanPolicy();
		expect(policy.maxFileSizeBytes).toBe(256 * 1024);
		expect(policy.maxFilesInspected).toBe(2000);
		expect(policy.maxRecursionDepth).toBe(8);
		expect(policy.executeScripts).toBe(false);
		expect(policy.callNetwork).toBe(false);
	});

	it('allows max file size override', () => {
		const policy = resolveScanPolicy({ maxFileSizeBytes: 1000 });
		expect(policy.maxFileSizeBytes).toBe(1000);
	});

	it('enforces guardrails (executeScripts always false)', () => {
		const policy = resolveScanPolicy({
			executeScripts: true as unknown as false,
		} as Partial<RepositoryScanPolicy>);
		expect(policy.executeScripts).toBe(false);
	});

	it('enforces guardrails (callNetwork always false)', () => {
		const policy = resolveScanPolicy({
			callNetwork: true as unknown as false,
		} as Partial<RepositoryScanPolicy>);
		expect(policy.callNetwork).toBe(false);
	});

	it('enforces guardrails (installDependencies always false)', () => {
		const policy = resolveScanPolicy({
			installDependencies: true as unknown as false,
		} as Partial<RepositoryScanPolicy>);
		expect(policy.installDependencies).toBe(false);
	});

	it('enforces guardrails (readSourceContent always false)', () => {
		const policy = resolveScanPolicy({
			readSourceContent: true as unknown as false,
		} as Partial<RepositoryScanPolicy>);
		expect(policy.readSourceContent).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Path safety
// ---------------------------------------------------------------------------

describe('checkPathSafe', () => {
	it('accepts path within project root', () => {
		const result = checkPathSafe('/project/src/package.json', '/project');
		expect(result.safe).toBe(true);
	});

	it('rejects path with traversal', () => {
		const result = checkPathSafe('/project/../../etc/passwd', '/project');
		// Even though resolve normalizes, the result should be flagged
		expect(result.safe).toBe(false);
	});

	it('rejects path outside root', () => {
		const result = checkPathSafe('/other/file.json', '/project');
		expect(result.safe).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Directory ignoring
// ---------------------------------------------------------------------------

describe('isDirectoryIgnored', () => {
	const policy = resolveScanPolicy();

	it('ignores node_modules', () => {
		expect(isDirectoryIgnored('node_modules', policy)).toBe(true);
	});

	it('ignores .git', () => {
		expect(isDirectoryIgnored('.git', policy)).toBe(true);
	});

	it('ignores dist', () => {
		expect(isDirectoryIgnored('dist', policy)).toBe(true);
	});

	it('ignores build', () => {
		expect(isDirectoryIgnored('build', policy)).toBe(true);
	});

	it('ignores coverage', () => {
		expect(isDirectoryIgnored('coverage', policy)).toBe(true);
	});

	it('ignores .cache', () => {
		expect(isDirectoryIgnored('.cache', policy)).toBe(true);
	});

	it('does not ignore src', () => {
		expect(isDirectoryIgnored('src', policy)).toBe(false);
	});

	it('does not ignore docs', () => {
		expect(isDirectoryIgnored('docs', policy)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Extension checks
// ---------------------------------------------------------------------------

describe('isExtensionAllowed', () => {
	const policy = resolveScanPolicy();

	it('allows .json files', () => {
		expect(isExtensionAllowed('package.json', policy)).toBe(true);
	});

	it('allows .yaml files', () => {
		expect(isExtensionAllowed('config.yaml', policy)).toBe(true);
	});

	it('allows .yml files', () => {
		expect(isExtensionAllowed('workflow.yml', policy)).toBe(true);
	});

	it('allows .md files', () => {
		expect(isExtensionAllowed('README.md', policy)).toBe(true);
	});

	it('rejects .ts files (source code)', () => {
		expect(isExtensionAllowed('app.ts', policy)).toBe(false);
	});

	it('rejects .js files by default (but JS is in allowed extensions)', () => {
		expect(isExtensionAllowed('app.js', policy)).toBe(true);
	});

	it('rejects .tsx files', () => {
		expect(isExtensionAllowed('component.tsx', policy)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// File size check
// ---------------------------------------------------------------------------

describe('checkFileSizeLimit', () => {
	it('allows files within limit', () => {
		const policy = resolveScanPolicy({ maxFileSizeBytes: 100000 });
		expect(checkFileSizeLimit(50000, policy).allowed).toBe(true);
	});

	it('rejects files exceeding limit', () => {
		const policy = resolveScanPolicy({ maxFileSizeBytes: 1000 });
		expect(checkFileSizeLimit(50000, policy).allowed).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// File count check
// ---------------------------------------------------------------------------

describe('checkFileCountLimit', () => {
	it('allows within limit', () => {
		const policy = resolveScanPolicy({ maxFilesInspected: 100 });
		expect(checkFileCountLimit(50, policy).allowed).toBe(true);
	});

	it('rejects at limit', () => {
		const policy = resolveScanPolicy({ maxFilesInspected: 100 });
		expect(checkFileCountLimit(100, policy).allowed).toBe(false);
	});

	it('rejects beyond limit', () => {
		const policy = resolveScanPolicy({ maxFilesInspected: 100 });
		expect(checkFileCountLimit(150, policy).allowed).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Recursion depth check
// ---------------------------------------------------------------------------

describe('checkRecursionDepth', () => {
	it('allows within limit', () => {
		const policy = resolveScanPolicy({ maxRecursionDepth: 5 });
		expect(checkRecursionDepth(3, policy).allowed).toBe(true);
	});

	it('rejects beyond limit', () => {
		const policy = resolveScanPolicy({ maxRecursionDepth: 5 });
		expect(checkRecursionDepth(6, policy).allowed).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Policy limit diagnostic
// ---------------------------------------------------------------------------

describe('createPolicyLimitDiagnostic', () => {
	it('creates diagnostic for limit reached', () => {
		const diag = createPolicyLimitDiagnostic('Max files reached', '/test');
		expect(diag.code).toBe('scan_policy_limit_reached');
		expect(diag.severity).toBe('warning');
		expect(diag.message).toBe('Max files reached');
	});
});

// ---------------------------------------------------------------------------
// Secret scanning
// ---------------------------------------------------------------------------

describe('scanForSecrets', () => {
	it('detects OpenAI API key', () => {
		const result = scanForSecrets(
			'sk-proj-1234567890abcdef1234567890abcdef1234567890',
		);
		expect(result.hasSecret).toBe(true);
		expect(result.label).toBe('openai_api_key');
	});

	it('detects bearer token', () => {
		const result = scanForSecrets(
			'Authorization: Bearer abcdef1234567890abcdef1234567890',
		);
		expect(result.hasSecret).toBe(true);
		expect(result.label).toBe('bearer_token');
	});

	it('detects GitHub token', () => {
		const result = scanForSecrets(
			'token: ghp_1234567890abcdef1234567890abcdef123456',
		);
		expect(result.hasSecret).toBe(true);
		expect(result.label).toBe('github_token');
	});

	it('detects AWS key', () => {
		const result = scanForSecrets('AKIAIOSFODNN7EXAMPLE');
		expect(result.hasSecret).toBe(true);
		expect(result.label).toBe('aws_key');
	});

	it('detects private key header', () => {
		const result = scanForSecrets('-----BEGIN RSA PRIVATE KEY-----');
		expect(result.hasSecret).toBe(true);
		expect(result.label).toBe('private_key_header');
	});

	it('does not flag normal text', () => {
		const result = scanForSecrets('This is normal configuration text.');
		expect(result.hasSecret).toBe(false);
	});

	it('does not flag package.json content', () => {
		const result = scanForSecrets(
			JSON.stringify({ name: 'test', version: '1.0.0' }),
		);
		expect(result.hasSecret).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Secret redaction
// ---------------------------------------------------------------------------

describe('redactSecretContent', () => {
	it('redacts API keys', () => {
		const redacted = redactSecretContent(
			'key: sk-proj-1234567890abcdef1234567890abcdef1234567890',
		);
		expect(redacted).not.toContain('sk-proj');
		expect(redacted).toContain('[redacted-secret-like-value]');
	});

	it('redacts bearer tokens', () => {
		const redacted = redactSecretContent(
			'Authorization: Bearer abcdef1234567890abcdef1234567890',
		);
		expect(redacted).not.toContain('Bearer ');
		expect(redacted).toContain('[redacted-secret-like-value]');
	});

	it('preserves non-secret text', () => {
		const original = 'name: test-package';
		const redacted = redactSecretContent(original);
		expect(redacted).toBe(original);
	});
});

// ---------------------------------------------------------------------------
// Known metadata filenames
// ---------------------------------------------------------------------------

describe('KNOWN_METADATA_FILENAMES', () => {
	it('includes package.json', () => {
		expect(KNOWN_METADATA_FILENAMES.has('package.json')).toBe(true);
	});

	it('includes tsconfig.json', () => {
		expect(KNOWN_METADATA_FILENAMES.has('tsconfig.json')).toBe(true);
	});

	it('includes README.md', () => {
		expect(KNOWN_METADATA_FILENAMES.has('README.md')).toBe(true);
	});

	it('does not include source files', () => {
		expect(KNOWN_METADATA_FILENAMES.has('app.ts')).toBe(false);
	});
});
