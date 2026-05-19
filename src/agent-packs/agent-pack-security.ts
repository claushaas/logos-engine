/** Step 10.3 — Agent Pack security checks before writing */

import { isLikelyRawSecret } from '../state/workspace-state-validation.js';
import type {
	AgentPackRenderDiagnostic,
	AgentPackSecuritySummary,
} from './agent-pack-render-types.js';

// ---------------------------------------------------------------------------
// Path traversal check
// ---------------------------------------------------------------------------

export function isPathTraversalSuspected(path: string): boolean {
	const normalized = path.replace(/\\/g, '/');
	const segments = normalized.split('/');
	return segments.some((s) => s === '..' || s === '...');
}

// ---------------------------------------------------------------------------
// Security check over rendered Markdown
// ---------------------------------------------------------------------------

export interface AgentPackSecurityCheckInput {
	markdown: string;
	outputPath: string;
	sourcePaths: string[];
	metadata: {
		artifactType: string;
		canonical: boolean;
	};
}

export interface AgentPackSecurityCheckResult {
	passed: boolean;
	diagnostics: AgentPackRenderDiagnostic[];
	securitySummary: AgentPackSecuritySummary;
}

export function checkAgentPackSecurity(
	input: AgentPackSecurityCheckInput,
): AgentPackSecurityCheckResult {
	const diagnostics: AgentPackRenderDiagnostic[] = [];
	const blockReasons: string[] = [];
	const redactionCount = 0;
	let tokenLikeValueCount = 0;
	let forbiddenRawPromptCount = 0;
	const forbiddenModelResponseCount = 0;

	// Check for raw token-like values
	const tokenPatterns = [
		/\b(sk-[a-zA-Z0-9]{20,})\b/g,
		/\b(gsk_[a-zA-Z0-9]{20,})\b/g,
		/\b(hf_[a-zA-Z0-9]{20,})\b/g,
		/Authorization\s*[:=]\s*[^\s,;"'\n\r]+/gi,
		/Bearer\s+[^\s,;"'\n\r]{20,}/gi,
		/-----BEGIN\s+(RSA|EC|DSA|OPENSSH)\s+PRIVATE KEY-----/g,
		/\b(AKIA|AGPA|AIDA|AIPA|ANPA|ANVA|APKA|ASIA)[A-Z0-9]{16}\b/g,
	];

	for (const pattern of tokenPatterns) {
		pattern.lastIndex = 0;
		const matches = input.markdown.match(pattern);
		if (matches && matches.length > 0) {
			tokenLikeValueCount += matches.length;
		}
	}

	if (tokenLikeValueCount > 0) {
		blockReasons.push(`${tokenLikeValueCount} token-like value(s) found`);
		diagnostics.push({
			code: 'E_AP_SEC_TOKEN',
			expected: undefined,
			fieldPath: undefined,
			message: `${tokenLikeValueCount} token-like value(s) detected in rendered Agent Pack. Write blocked.`,
			outputPath: input.outputPath,
			received: undefined,
			recoveryHint:
				'Redact all tokens, keys, and secrets from source data before rendering.',
			relatedBundleId: undefined,
			relatedPackId: undefined,
			relatedPackKind: undefined,
			relatedPhaseId: undefined,
			relatedRegisterItemId: undefined,
			relatedSourceDocumentId: undefined,
			relatedTemplateKind: undefined,
			severity: 'error',
			sourcePath: undefined,
		});
	}

	// Check for raw prompt markers
	const promptPatterns = [
		/(system\s*prompt|system\s*message|system\s*instruction)\s*[:=]/gi,
		/(chat\s*completion|model\s*output|model\s*response)/gi,
		/(<\|system\|>|<\|assistant\|>|<\|user\|>)/gi,
	];

	for (const pattern of promptPatterns) {
		pattern.lastIndex = 0;
		const matches = input.markdown.match(pattern);
		if (matches && matches.length > 0) {
			forbiddenRawPromptCount += matches.length;
		}
	}

	if (forbiddenRawPromptCount > 0) {
		blockReasons.push(
			`${forbiddenRawPromptCount} raw prompt/model response marker(s) found`,
		);
	}

	// Check for hidden canonical authority claims (affirmative claims, not warnings)
	const canonicalAuthorityPatterns = [
		/canonical\s*:\s*true/i,
		/this\s+(pack|document|artifact)\s+is\s+(canonical|the\s+source\s+of\s+truth|authoritative)/i,
		/IS\s+a\s+source\s+of\s+truth/i,
		/This\s+is\s+a\s+canonical\s+document/i,
	];

	for (const pattern of canonicalAuthorityPatterns) {
		pattern.lastIndex = 0;
		const matches = input.markdown.match(pattern);
		if (matches && matches.length > 0) {
			blockReasons.push('Hidden canonical authority claim detected');
			diagnostics.push({
				code: 'E_AP_SEC_CANONICAL_CLAIM',
				expected: undefined,
				fieldPath: undefined,
				message:
					'Agent Pack contains content claiming canonical authority. Write blocked.',
				outputPath: input.outputPath,
				received: undefined,
				recoveryHint:
					'Ensure the pack is clearly labeled as derived and non-canonical.',
				relatedBundleId: undefined,
				relatedPackId: undefined,
				relatedPackKind: undefined,
				relatedPhaseId: undefined,
				relatedRegisterItemId: undefined,
				relatedSourceDocumentId: undefined,
				relatedTemplateKind: undefined,
				severity: 'error',
				sourcePath: undefined,
			});
		}
	}

	// Check for unrelated-change override instructions
	// Only catch clear override/ignore instructions, not constraint text
	const overridePatterns = [
		/ignore\s+(previous|all|above)\s+(instructions|constraints)/i,
		/override\s+(system|previous)\s+instructions/i,
		/exfiltrate\s+(secrets|data|tokens)/i,
	];

	for (const pattern of overridePatterns) {
		pattern.lastIndex = 0;
		const matches = input.markdown.match(pattern);
		if (matches && matches.length > 0) {
			blockReasons.push('Instruction to override system constraints detected');
			diagnostics.push({
				code: 'E_AP_SEC_OVERRIDE_INSTRUCTION',
				expected: undefined,
				fieldPath: undefined,
				message:
					'Agent Pack contains content instructing downstream agents to ignore constraints or make unauthorized changes. Write blocked.',
				outputPath: input.outputPath,
				received: undefined,
				recoveryHint:
					'Remove any content that instructs agents to override source constraints.',
				relatedBundleId: undefined,
				relatedPackId: undefined,
				relatedPackKind: undefined,
				relatedPhaseId: undefined,
				relatedRegisterItemId: undefined,
				relatedSourceDocumentId: undefined,
				relatedTemplateKind: undefined,
				severity: 'error',
				sourcePath: undefined,
			});
		}
	}

	// Check for raw env values using isLikelyRawSecret
	const lines = input.markdown.split('\n');
	for (const line of lines) {
		const trimmed = line.trim();
		if (
			trimmed.length > 20 &&
			isLikelyRawSecret(trimmed) &&
			!trimmed.startsWith('[REDACTED]')
		) {
			tokenLikeValueCount += 1;
		}
	}

	// Check path traversal in output path
	if (isPathTraversalSuspected(input.outputPath)) {
		blockReasons.push('Path traversal suspected in output path');
		diagnostics.push({
			code: 'E_AP_SEC_PATH_TRAVERSAL',
			expected: undefined,
			fieldPath: undefined,
			message: `Path traversal detected in output path: ${input.outputPath}`,
			outputPath: input.outputPath,
			received: undefined,
			recoveryHint: 'Ensure output path does not contain .. segments.',
			relatedBundleId: undefined,
			relatedPackId: undefined,
			relatedPackKind: undefined,
			relatedPhaseId: undefined,
			relatedRegisterItemId: undefined,
			relatedSourceDocumentId: undefined,
			relatedTemplateKind: undefined,
			severity: 'error',
			sourcePath: undefined,
		});
	}

	// Check source paths for traversal
	for (const sourcePath of input.sourcePaths) {
		if (isPathTraversalSuspected(sourcePath)) {
			blockReasons.push('Path traversal suspected in source path');
			diagnostics.push({
				code: 'E_AP_SEC_SOURCE_PATH_TRAVERSAL',
				expected: undefined,
				fieldPath: undefined,
				message: `Path traversal detected in source path: ${sourcePath}`,
				outputPath: input.outputPath,
				received: undefined,
				recoveryHint: 'Ensure source paths do not contain .. segments.',
				relatedBundleId: undefined,
				relatedPackId: undefined,
				relatedPackKind: undefined,
				relatedPhaseId: undefined,
				relatedRegisterItemId: undefined,
				relatedSourceDocumentId: undefined,
				relatedTemplateKind: undefined,
				severity: 'error',
				sourcePath: undefined,
			});
		}
	}

	const passed = blockReasons.length === 0 && tokenLikeValueCount === 0;

	const securitySummary: AgentPackSecuritySummary = {
		blockReasons,
		forbiddenModelResponseCount,
		forbiddenRawPromptCount,
		passed,
		redactionCount,
		tokenLikeValueCount,
	};

	return { diagnostics, passed, securitySummary };
}
