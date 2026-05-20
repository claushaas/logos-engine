/** AI Provider Connectivity Test — synthetic context only, no repo content sent */

import type {
	AiProviderConfig,
	AiProviderTestSummary,
} from './provider-config-model.js';
import { endpointOrigin } from './provider-config-model.js';
import {
	evaluateAiProviderExecutionPolicy,
	executeWithTimeout,
} from './provider-execution-policy.js';
import type { AiProviderDiagnostic, AiProviderPort } from './provider-port.js';

// ---------------------------------------------------------------------------
// Synthetic test context
// ---------------------------------------------------------------------------

const SYNTHETIC_TEST_PROMPT =
	'This is a LOGOS provider connectivity test. Do not include repository content.';

const SYNTHETIC_TEST_MESSAGE = {
	content: SYNTHETIC_TEST_PROMPT,
	role: 'user' as const,
};

// ---------------------------------------------------------------------------
// Test options
// ---------------------------------------------------------------------------

export interface ProviderTestOptions {
	config: AiProviderConfig;
	provider: AiProviderPort;
}

// ---------------------------------------------------------------------------
// Test execution
// ---------------------------------------------------------------------------

export async function runProviderTest(options: ProviderTestOptions): Promise<{
	summary: AiProviderTestSummary;
	diagnostics: AiProviderDiagnostic[];
}> {
	const { config, provider } = options;

	// 1. Check execution policy
	const policyResult = evaluateAiProviderExecutionPolicy(config);
	if (!policyResult.allowed) {
		return {
			diagnostics: policyResult.diagnostics,
			summary: {
				diagnosticCodes: policyResult.diagnostics.map((d) => d.code),
				endpointOrigin: endpointOrigin(config.endpoint),
				modelId: config.modelId,
				providerId: config.providerId,
				status: 'blocked',
				testedAt: new Date().toISOString(),
			},
		};
	}

	// 2. Run synthetic test with timeout
	const startTime = Date.now();
	const timeoutResult = await executeWithTimeout({
		fn: async (signal) => {
			// Check abort signal before calling provider
			if (signal.aborted) {
				throw new Error('Aborted before call');
			}

			const response = await provider.conversation({
				contextCategorySummary: {
					provider_test: 1,
				},
				executionMode: 'inline',
				messages: [SYNTHETIC_TEST_MESSAGE],
				operation: 'conversation',
				providerId: config.providerId ?? provider.providerId,
				providerKind: provider.providerKind,
			});

			if (response.status !== 'success') {
				throw new Error(
					response.diagnostics[0]?.message ??
						'Provider returned failure status',
				);
			}

			return response;
		},
		timeoutMs: config.timeoutMs,
	});

	const durationMs = Date.now() - startTime;

	// 3. Build redacted summary
	const diagnosticCodes: string[] = [];
	if (!timeoutResult.success) {
		diagnosticCodes.push(
			...(timeoutResult.diagnostics.map((d) => d.code) as string[]),
		);
	}

	const summary: AiProviderTestSummary = {
		diagnosticCodes,
		durationMs,
		endpointOrigin: endpointOrigin(config.endpoint),
		modelId: config.modelId,
		providerId: config.providerId,
		status: timeoutResult.success ? 'passed' : 'failed',
		testedAt: new Date().toISOString(),
	};

	return {
		diagnostics: timeoutResult.diagnostics,
		summary,
	};
}

// ---------------------------------------------------------------------------
// Redacted test summary display
// ---------------------------------------------------------------------------

export function formatTestSummary(summary: AiProviderTestSummary): string[] {
	const lines: string[] = ['Provider test summary:'];

	lines.push(`  Status:          ${summary.status}`);
	if (summary.providerId) {
		lines.push(`  Provider:        ${summary.providerId}`);
	}
	if (summary.modelId) {
		lines.push(`  Model:           ${summary.modelId}`);
	}
	if (summary.endpointOrigin) {
		lines.push(`  Endpoint origin: ${summary.endpointOrigin}`);
	}
	if (summary.testedAt) {
		lines.push(`  Tested at:       ${summary.testedAt}`);
	}
	if (summary.durationMs !== undefined) {
		lines.push(`  Duration:        ${summary.durationMs}ms`);
	}
	if (summary.diagnosticCodes.length > 0) {
		lines.push(`  Diagnostics:     ${summary.diagnosticCodes.join(', ')}`);
	}

	if (summary.status === 'never_run') {
		lines.push('');
		lines.push(
			'  No test has been run yet. Use /config ai test to test connectivity.',
		);
	}

	return lines;
}
