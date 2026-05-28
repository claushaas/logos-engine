/**
 * Tests for prompt-context redaction (LLM-09).
 *
 * All tests are deterministic and require no network access.
 * The redaction module only operates on text — no repository scanning.
 *
 * Covered:
 *  - API key patterns (OpenAI, Anthropic, OpenRouter)
 *  - Bearer token patterns
 *  - Private key blocks (RSA, EC, OpenSSH, encrypted)
 *  - .env assignments with sensitive key names
 *  - Password-like inline assignments
 *  - Cloud credential patterns (AWS access keys)
 *  - Non-secret content preserved
 *  - Empty / whitespace-only text
 *  - Overlapping patterns (Bearer + api_key)
 *  - Diagnostics accuracy (totalMatches, category counts)
 *  - `redactLlmRequest` — system prompt + message bodies
 *  - `redactLlmRequest` — aggregate diagnostics
 *  - `redactLlmRequest` — metadata fields passed through unchanged
 */
import { describe, expect, it } from 'vitest';

import {
	type RedactionResult,
	redactLlmRequest,
	redactText,
} from '../../src/llm/redaction.js';
import type { LlmRequest } from '../../src/prompt-orchestration/prompt-assembler.js';

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/** Convenience: redact and assert no secrets found. */
function assertClean(text: string): void {
	const result = redactText(text);
	expect(result.redacted).toBe(text);
	expect(result.diagnostics.totalMatches).toBe(0);
}

/** Convenience: redact and assert at least one secret was found. */
function assertDirty(text: string, expectedContent?: string): RedactionResult {
	const result = redactText(text);
	expect(result.diagnostics.totalMatches).toBeGreaterThan(0);
	if (expectedContent !== undefined) {
		expect(result.redacted).toBe(expectedContent);
	}
	return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// redactText — unit tests per category
// ═══════════════════════════════════════════════════════════════════════════

describe('redactText', () => {
	// ── api_key ────────────────────────────────────────────────────────

	describe('api_key', () => {
		it('redacts OpenAI-style project key', () => {
			const key = 'sk-proj-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0';
			const result = assertDirty(key);
			expect(result.redacted).toBe('[REDACTED: api_key]');
			expect(result.diagnostics.categories.api_key).toBe(1);
		});

		it('redacts Anthropic-style key', () => {
			const key = 'sk-ant-api03-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0';
			const result = assertDirty(key);
			expect(result.redacted).toBe('[REDACTED: api_key]');
		});

		it('redacts OpenRouter-style key', () => {
			const key = 'sk-or-v1-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0uvwxyz123';
			const result = assertDirty(key);
			expect(result.redacted).toBe('[REDACTED: api_key]');
		});

		it('redacts a key embedded in prose', () => {
			const text =
				'My API key is sk-proj-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0 — please use it.';
			const result = assertDirty(text);
			expect(result.redacted).toBe(
				'My API key is [REDACTED: api_key] — please use it.',
			);
		});

		it('redacts multiple api keys in one text', () => {
			const text =
				'key1: sk-proj-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0\nkey2: sk-ant-api03-x1y2z3w4v5u6t7s8r9q0p1o2n3m4l5k6j7i8h9g0';
			const result = assertDirty(text);
			expect(result.diagnostics.categories.api_key).toBe(2);
			expect(result.diagnostics.totalMatches).toBe(2);
			expect(result.redacted).not.toContain('sk-');
		});

		it('does NOT redact short sk- strings (< 20 chars after prefix)', () => {
			assertClean('sk-proj-short');
			assertClean('sk-ant-tiny');
		});

		it('does NOT redact sk- inside non-word-boundary context', () => {
			// "mask-" or other prefixes break the \b match
			assertClean('mask-proj-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0');
		});
	});

	// ── bearer_token ───────────────────────────────────────────────────

	describe('bearer_token', () => {
		it('redacts bearer token in prose', () => {
			const text =
				'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0';
			const result = assertDirty(text);
			expect(result.redacted).toContain('Bearer [REDACTED: bearer_token]');
			expect(result.diagnostics.categories.bearer_token).toBe(1);
		});

		it('redacts "bearer" (lowercase)', () => {
			const text = 'Use bearer abcdefghijklmnopqrstuvwxyz1234567890';
			const result = assertDirty(text);
			expect(result.redacted).toContain('Bearer [REDACTED: bearer_token]');
		});

		it('redacts "BEARER" (uppercase)', () => {
			const text = 'Use BEARER abcdefghijklmnopqrstuvwxyz1234567890';
			const result = assertDirty(text);
			expect(result.redacted).toBe('Use Bearer [REDACTED: bearer_token]');
		});

		it('does NOT redact short bearer tokens (< 20 chars)', () => {
			assertClean('Bearer shorttoken');
			assertClean('bearer abc123');
		});
	});

	// ── private_key ────────────────────────────────────────────────────

	describe('private_key', () => {
		it('redacts RSA private key block', () => {
			const text = `Here is my key:
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0Z3VS4pR6cJ...
-----END RSA PRIVATE KEY-----
End of key.`;
			const result = assertDirty(text);
			expect(result.redacted).not.toContain('BEGIN');
			expect(result.redacted).toContain('[REDACTED: private_key]');
			expect(result.diagnostics.categories.private_key).toBe(1);
		});

		it('redacts EC private key block', () => {
			const text =
				'-----BEGIN EC PRIVATE KEY-----\nMHQCAQEEIABCDEF...\n-----END EC PRIVATE KEY-----';
			const result = assertDirty(text);
			expect(result.redacted).toBe('[REDACTED: private_key]');
		});

		it('redacts OpenSSH private key block', () => {
			const text =
				'-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAA...\n-----END OPENSSH PRIVATE KEY-----';
			const result = assertDirty(text);
			expect(result.redacted).toBe('[REDACTED: private_key]');
		});

		it('redacts encrypted private key block', () => {
			const text =
				'-----BEGIN ENCRYPTED PRIVATE KEY-----\nMIIFDjBABgkqhki...\n-----END ENCRYPTED PRIVATE KEY-----';
			const result = assertDirty(text);
			expect(result.redacted).toBe('[REDACTED: private_key]');
		});

		it('redacts generic PRIVATE KEY block', () => {
			const text =
				'-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhki...\n-----END PRIVATE KEY-----';
			const result = assertDirty(text);
			expect(result.redacted).toBe('[REDACTED: private_key]');
		});

		it('redacts multiple key blocks', () => {
			const text =
				'-----BEGIN RSA PRIVATE KEY-----\nAAA\n-----END RSA PRIVATE KEY-----\n\n-----BEGIN EC PRIVATE KEY-----\nBBB\n-----END EC PRIVATE KEY-----';
			const result = assertDirty(text);
			expect(result.diagnostics.categories.private_key).toBe(2);
		});

		it('does NOT redact public key blocks', () => {
			assertClean(
				'-----BEGIN PUBLIC KEY-----\nMIIBIjAN...\n-----END PUBLIC KEY-----',
			);
		});

		it('does NOT redact certificate blocks', () => {
			assertClean(
				'-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAw...\n-----END CERTIFICATE-----',
			);
		});
	});

	// ── env_assignment ─────────────────────────────────────────────────

	describe('env_assignment', () => {
		it('redacts API_KEY assignment with =', () => {
			const result = assertDirty(
				'API_KEY=sk-proj-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0',
			);
			expect(result.redacted).toBe('API_KEY=[REDACTED: env]');
			// env_assignment takes priority over api_key — single match.
			expect(result.diagnostics.categories.env_assignment).toBe(1);
			expect(result.diagnostics.categories.api_key).toBeUndefined();
		});

		it('redacts SECRET assignment with :', () => {
			const result = assertDirty('SECRET: my-super-secret-value-here!!');
			// Trailing space after ':' is part of the captured separator.
			expect(result.redacted).toBe('SECRET: [REDACTED: env]');
		});

		it('redacts ACCESS_TOKEN assignment', () => {
			const result = assertDirty(
				'ACCESS_TOKEN=ghp_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
			);
			expect(result.redacted).toBe('ACCESS_TOKEN=[REDACTED: env]');
		});

		it('redacts AUTH_TOKEN assignment', () => {
			const result = assertDirty('AUTH_TOKEN=abcdefghijklmnopqrstuvwxyz123456');
			expect(result.redacted).toBe('AUTH_TOKEN=[REDACTED: env]');
		});

		it('redacts quoted values', () => {
			const result = assertDirty(
				'API_KEY="sk-proj-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0"',
			);
			expect(result.redacted).toBe('API_KEY=[REDACTED: env]');
			expect(result.diagnostics.categories.env_assignment).toBe(1);
		});

		it('does NOT redact short values (< 8 chars)', () => {
			assertClean('API_KEY=short');
			assertClean('SECRET=abc');
		});

		it('does NOT redact non-sensitive key names', () => {
			assertClean('MY_VAR=some-value-that-is-long-enough-123456');
			assertClean('MODEL_NAME=gpt-4.1-mini');
		});

		it('redacts env_assignment even when not at line start', () => {
			const result = assertDirty(
				'I set API_KEY=sk-proj-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0 in my config.',
			);
			expect(result.redacted).toContain('[REDACTED: env]');
		});
	});

	// ── password_like ──────────────────────────────────────────────────

	describe('password_like', () => {
		it('redacts password= assignment', () => {
			const result = assertDirty('password=hunter2');
			expect(result.redacted).toBe('password=[REDACTED: password]');
			expect(result.diagnostics.categories.password_like).toBe(1);
		});

		it('redacts passwd= assignment', () => {
			const result = assertDirty('passwd=supersecret');
			expect(result.redacted).toBe('passwd=[REDACTED: password]');
		});

		it('redacts pwd= assignment', () => {
			const result = assertDirty('pwd=12345');
			expect(result.redacted).toBe('pwd=[REDACTED: password]');
		});

		it('redacts password: assignment', () => {
			const result = assertDirty('password: mySecret123!');
			// Trailing space after ':' is part of the captured separator.
			expect(result.redacted).toBe('password: [REDACTED: password]');
		});

		it('does NOT redact password without a value', () => {
			assertClean('What is your password?');
			assertClean('password=');
			assertClean('password: ');
		});

		it('does NOT redact password in normal prose', () => {
			assertClean('The password policy requires 8 characters.');
		});
	});

	// ── cloud_credential ───────────────────────────────────────────────

	describe('cloud_credential', () => {
		it('redacts AWS access key ID', () => {
			const result = assertDirty('AKIAIOSFODNN7EXAMPLE');
			expect(result.redacted).toBe('[REDACTED: cloud_credential]');
			expect(result.diagnostics.categories.cloud_credential).toBe(1);
		});

		it('redacts AWS access key in prose', () => {
			const result = assertDirty('My AWS key is AKIA1234567890ABCDEF.');
			expect(result.redacted).toBe(
				'My AWS key is [REDACTED: cloud_credential].',
			);
		});

		it('does NOT redact non-AWS AKIA strings', () => {
			// Must be exactly AKIA + 16 uppercase alphanumeric chars
			assertClean('AKIA1234567890ABC'); // too short (only 15 chars after AKIA)
			assertClean('AKIA1234567890ABCDE'); // too short (15 chars after AKIA)
		});
	});

	// ── Non-secret content ─────────────────────────────────────────────

	describe('non-secret content preserved', () => {
		it('preserves normal prose', () => {
			const text = 'What is the core motivation behind this project?';
			assertClean(text);
		});

		it('preserves code snippets without secrets', () => {
			const code = `
function hello() {
  const x = "world";
  return \`Hello \${x}\`;
}`;
			assertClean(code);
		});

		it('preserves Markdown formatting', () => {
			const md = `## Architecture

- Component A
- Component B

> Blockquote here.`;
			assertClean(md);
		});

		it('preserves URLs', () => {
			const text = 'See https://example.com/docs for details.';
			assertClean(text);
		});

		it('preserves JSON without secrets', () => {
			const json = JSON.stringify({ name: 'test', version: '1.0.0' });
			assertClean(json);
		});
	});

	// ── Edge cases ─────────────────────────────────────────────────────

	describe('edge cases', () => {
		it('handles empty string', () => {
			const result = redactText('');
			expect(result.redacted).toBe('');
			expect(result.diagnostics.totalMatches).toBe(0);
		});

		it('handles whitespace-only string', () => {
			const text = '   \n\t  ';
			const result = redactText(text);
			expect(result.redacted).toBe(text);
			expect(result.diagnostics.totalMatches).toBe(0);
		});

		it('aggregates multiple categories correctly', () => {
			const text = [
				'API_KEY=sk-proj-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0',
				'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0',
				'password=supersecret',
				'AKIA1234567890ABCDEF',
			].join('\n');

			const result = redactText(text);
			// env_assignment consumes the API_KEY=sk-... line (1 match, no separate api_key).
			expect(result.diagnostics.categories.env_assignment).toBe(1);
			expect(result.diagnostics.categories.bearer_token).toBe(1);
			expect(result.diagnostics.categories.password_like).toBe(1);
			expect(result.diagnostics.categories.cloud_credential).toBe(1);
			expect(result.diagnostics.totalMatches).toBe(4);
		});

		it('is deterministic — same input produces same output', () => {
			const text =
				'sk-proj-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0 password=hunter2';

			const r1 = redactText(text);
			const r2 = redactText(text);

			expect(r1.redacted).toBe(r2.redacted);
			expect(r1.diagnostics).toEqual(r2.diagnostics);
		});

		it('replacement markers are not matched by subsequent patterns', () => {
			// After redacting, '[REDACTED: ...]' should not match any pattern.
			const text = 'sk-proj-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0';
			const result = redactText(text);

			// Second pass on already-redacted text should find zero matches.
			const pass2 = redactText(result.redacted);
			expect(pass2.diagnostics.totalMatches).toBe(0);
		});
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// redactLlmRequest — integration tests
// ═══════════════════════════════════════════════════════════════════════════

describe('redactLlmRequest', () => {
	/** Create a minimal LlmRequest. */
	function makeRequest(overrides: Partial<LlmRequest> = {}): LlmRequest {
		return {
			messages: [
				{
					content:
						'Hello, my API key is sk-proj-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0.',
					role: 'user',
				},
			],
			schema: {},
			systemPrompt:
				'You are an assistant. Do not share secrets like password=test123.',
			...overrides,
		};
	}

	it('redacts system prompt and message bodies', () => {
		const request = makeRequest();
		const { redacted, diagnostics } = redactLlmRequest(request);

		// System prompt should have the password redacted.
		expect(redacted.systemPrompt).not.toContain('password=test123');
		expect(redacted.systemPrompt).toContain('[REDACTED: password]');

		// Message body should have the API key redacted.
		expect(redacted.messages[0]?.content).not.toContain('sk-proj-');
		expect(redacted.messages[0]?.content).toContain('[REDACTED: api_key]');

		// Diagnostics should show 2 matches across categories.
		expect(diagnostics.totalMatches).toBe(2);
		expect(diagnostics.categories.api_key).toBe(1);
		expect(diagnostics.categories.password_like).toBe(1);
	});

	it('returns zero diagnostics when no secrets present', () => {
		const request = makeRequest({
			messages: [{ content: 'What is the core thesis?', role: 'user' }],
			systemPrompt: 'You are an expert interviewer.',
		});

		const { redacted, diagnostics } = redactLlmRequest(request);

		expect(redacted).toEqual(request);
		expect(diagnostics.totalMatches).toBe(0);
	});

	it('preserves non-content fields (schema, model, temperature, metadata)', () => {
		const request = makeRequest({
			metadata: { nodeId: 'node-1' },
			model: 'gpt-4.1-mini',
			schema: { type: 'object' },
			temperature: 0.7,
		});

		const { redacted } = redactLlmRequest(request);

		expect(redacted.model).toBe('gpt-4.1-mini');
		expect(redacted.temperature).toBe(0.7);
		expect(redacted.schema).toEqual({ type: 'object' });
		expect(redacted.metadata).toEqual({ nodeId: 'node-1' });
	});

	it('does not mutate the original request', () => {
		const request = makeRequest();
		const originalSystemPrompt = request.systemPrompt;
		const originalMessageContent = request.messages[0]?.content;

		redactLlmRequest(request);

		// Original request should be unchanged.
		expect(request.systemPrompt).toBe(originalSystemPrompt);
		expect(request.messages[0]?.content).toBe(originalMessageContent);
	});

	it('aggregates diagnostics across system prompt and messages', () => {
		const request = makeRequest({
			messages: [
				{
					content: 'Key: sk-proj-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0',
					role: 'user',
				},
				{
					content: 'Bearer abcdefghijklmnopqrstuvwxyz1234567890',
					role: 'assistant',
				},
			],
			systemPrompt:
				'API_KEY=sk-ant-api03-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0',
		});

		const { diagnostics } = redactLlmRequest(request);

		// System prompt: env_assignment (consumes the API_KEY=sk-... line)
		// Message 1: api_key
		// Message 2: bearer_token
		expect(diagnostics.totalMatches).toBe(3);
		expect(diagnostics.categories.env_assignment).toBe(1);
		expect(diagnostics.categories.api_key).toBe(1);
		expect(diagnostics.categories.bearer_token).toBe(1);
	});

	it('handles empty messages array', () => {
		const request = makeRequest({
			messages: [],
			systemPrompt: 'Clean prompt.',
		});

		const { redacted, diagnostics } = redactLlmRequest(request);

		expect(redacted.messages).toHaveLength(0);
		expect(diagnostics.totalMatches).toBe(0);
	});

	it('redacts multiple messages correctly', () => {
		const request = makeRequest({
			messages: [
				{
					content: 'sk-proj-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0',
					role: 'user',
				},
				{
					content: 'sk-ant-api03-x1y2z3w4v5u6t7s8r9q0p1o2n3m4l5k6j7i8h9g0',
					role: 'user',
				},
			],
			systemPrompt: '',
		});

		const { redacted, diagnostics } = redactLlmRequest(request);

		expect(redacted.messages[0]?.content).toBe('[REDACTED: api_key]');
		expect(redacted.messages[1]?.content).toBe('[REDACTED: api_key]');
		expect(diagnostics.categories.api_key).toBe(2);
	});
});
