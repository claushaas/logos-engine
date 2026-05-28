/**
 * LLM Live Smoke Test — credential-gated proof that real provider
 * integration works end-to-end (LLM-11).
 *
 * ## How to run
 *
 * ```bash
 * pnpm smoke:llm
 * ```
 *
 * Or directly:
 *
 * ```bash
 * LOGOS_SMOKE_LLM=1 LOGOS_LLM_API_KEY=sk-... pnpm smoke:llm
 * ```
 *
 * ## Opt-in gate
 *
 * This smoke requires **two** explicit conditions before it runs:
 *
 * 1. `LOGOS_SMOKE_LLM=1` — the opt-in flag (prevents accidental network
 *    calls during normal `pnpm test`).
 * 2. A valid API key in `LOGOS_LLM_API_KEY` (or the env var named by
 *    `LOGOS_LLM_TOKEN_ENV`).
 *
 * Without both, the smoke skips with a descriptive message.
 *
 * ## What it tests
 *
 * - Constructs a minimal {@link LlmRequest} exercising structured output.
 * - Calls an OpenAI-compatible provider via {@link OpenAiCompatibleLlmProvider}.
 * - Validates the response with {@link validateAgentTurnOutput}.
 * - Prints sanitized diagnostics: provider, model, latency, token usage,
 *   validation status, repair attempts.
 *
 * ## Safety
 *
 * - **No API keys are printed** — only the token environment variable
 *   name is shown.
 * - **No raw provider payloads are printed** — only the validated
 *   `AgentTurnOutput.userFacingMessage`.
 * - **No full prompt content is printed** — only the sanitized
 *   diagnostics summary.
 *
 * @see {@link https://logos-engine/docs/15-real-llm-implementation-roadmap.md §LLM-11}
 * @see {@link https://logos-engine/docs/14-real-llm-integration-plan.md §Phase 7}
 */
import { describe, expect, it } from 'vitest';
import { resolveProviderConfig } from '../../src/llm/config.js';
import { OpenAiCompatibleLlmProvider } from '../../src/llm/openai-compatible-provider.js';
import type { LlmRequest } from '../../src/prompt-orchestration/prompt-assembler.js';
import { validateAgentTurnOutput } from '../../src/validation/agent-turn-validator.js';

// ═══════════════════════════════════════════════════════════════════════════
// Gate: determine whether the smoke should run
// ═══════════════════════════════════════════════════════════════════════════

/** The smoke opt-in flag. */
const SMOKE_ENABLED = process.env.LOGOS_SMOKE_LLM === '1';

/** The environment variable that holds the API key. */
const TOKEN_ENV = process.env.LOGOS_LLM_TOKEN_ENV ?? 'LOGOS_LLM_API_KEY';

/** The actual API key value, if available. */
const API_KEY = process.env[TOKEN_ENV];

/** Whether a valid API key was found. */
const HAS_CREDENTIALS = typeof API_KEY === 'string' && API_KEY.length > 0;

// ── Print skip reasons ─────────────────────────────────────────────────

if (!SMOKE_ENABLED) {
	console.log('\n[smoke:llm] Skipped — opt-in flag not set.');
	console.log(
		'[smoke:llm] To run the live smoke test, set LOGOS_SMOKE_LLM=1 and provide a valid API key:\n' +
			`[smoke:llm]   LOGOS_SMOKE_LLM=1 ${TOKEN_ENV}=<your-key> pnpm smoke:llm\n`,
	);
} else if (!HAS_CREDENTIALS) {
	console.log(`\n[smoke:llm] Skipped — no API key found in ${TOKEN_ENV}.`);
	console.log(
		`[smoke:llm] Set ${TOKEN_ENV} to a valid API key and re-run:\n` +
			`[smoke:llm]   LOGOS_SMOKE_LLM=1 ${TOKEN_ENV}=<your-key> pnpm smoke:llm\n`,
	);
}

// ═══════════════════════════════════════════════════════════════════════════
// Minimal request fixture
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A minimal {@link LlmRequest} exercising structured `AgentTurnOutput`.
 *
 * The system prompt instructs the model to return a JSON object with
 * all the fields the validator expects. The user message is deliberately
 * simple — the smoke verifies the pipeline, not prompt quality.
 */
const SMOKE_REQUEST: LlmRequest = {
	messages: [
		{
			content:
				'In one sentence, what is the value of structured documentation for software projects?',
			role: 'user',
		},
	],
	schema: {},
	systemPrompt:
		'You are a structured documentation assistant. ' +
		'Respond ONLY with a JSON object containing exactly these fields:\n' +
		'- "userFacingMessage" (string, required): your answer as one sentence.\n' +
		'- "suggestedActions" (array of strings, optional): relevant actions from ' +
		'["answer", "defer", "continue_next"].\n' +
		'Return valid JSON only. No markdown, no explanation outside the JSON.',
};

// ═══════════════════════════════════════════════════════════════════════════
// Smoke test
// ═══════════════════════════════════════════════════════════════════════════

describe.skipIf(!SMOKE_ENABLED || !HAS_CREDENTIALS)(
	'LLM Live Smoke Test',
	() => {
		it('produces valid structured AgentTurnOutput from a real provider', async () => {
			// ── Resolve provider configuration ──────────────────────
			const config = resolveProviderConfig({
				disclosureAccepted: true,
				provider: 'openai-compatible',
			});

			// ── Provider identity (sanitized — no API key) ──────────
			const providerId = config.provider;
			const model = config.model;
			const tokenEnv = config.tokenEnv;

			console.log(`\n[smoke:llm] Provider : ${providerId}`);
			console.log(`[smoke:llm] Model    : ${model}`);
			console.log(`[smoke:llm] Token Env: ${tokenEnv}`);
			console.log(`[smoke:llm] Calling provider...\n`);

			// ── Construct the provider ─────────────────────────────
			const provider = new OpenAiCompatibleLlmProvider(config);

			// ── Call the provider ──────────────────────────────────
			const startMs = Date.now();
			const output = await provider.generateStructuredOutput(SMOKE_REQUEST);
			const latencyMs = Date.now() - startMs;

			// ── Validate the output ────────────────────────────────
			const validation = validateAgentTurnOutput(output, {
				currentLifecycle: 'active',
			});

			// ── Extract sanitized diagnostics ──────────────────────
			const diag = provider.lastDiagnostics;

			// ── Print sanitized results ────────────────────────────
			console.log('── Smoke Results ──');
			console.log(`Provider         : ${providerId}`);
			console.log(`Model            : ${model}`);
			console.log(`Latency          : ${latencyMs} ms`);
			console.log(
				`Token Usage      : ${
					diag?.tokenUsage
						? `${diag.tokenUsage.prompt}P + ${diag.tokenUsage.completion}C = ${diag.tokenUsage.total}T`
						: 'unavailable'
				}`,
			);
			console.log(`Finish Reason    : ${diag?.finishReason ?? 'unknown'}`);
			console.log(`Repair Attempts  : ${diag?.repairAttempt ?? 0}`);
			console.log(`Validation       : ${validation.ok ? 'PASS' : 'FAIL'}`);

			if (!validation.ok) {
				console.log('Validation Errors:');
				for (const err of validation.error) {
					console.log(`  [${err.code}] ${err.path.join('.')}: ${err.message}`);
				}
			}

			// ── Show the user-facing message (always sanitized) ────
			console.log(`\nAgent Response:\n  ${output.userFacingMessage}`);

			// ── Assertions ─────────────────────────────────────────
			expect(validation.ok).toBe(true);
			expect(output.userFacingMessage).toBeTruthy();
			expect(output.userFacingMessage.length).toBeGreaterThan(10);
			expect(latencyMs).toBeGreaterThan(0);

			console.log('\n[smoke:llm] Smoke test PASSED.\n');
		}, 30_000); // 30-second timeout for network calls
	},
);
