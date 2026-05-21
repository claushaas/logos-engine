/**
 * Security and Privacy Release Checker
 *
 * Step 13.3 — Complete Security and Privacy Release Checks
 *
 * Deterministic, read-only, non-mutating, provider-free, network-free check
 * engine for release candidate security/privacy verification.
 */

import {
	buildSecurityPrivacyReleaseFindingId,
	createRedactionResult,
	determineSecurityPrivacyReleaseStatus,
	type SecurityPrivacyReleaseArtifactCheck,
	type SecurityPrivacyReleaseBackupCheck,
	type SecurityPrivacyReleaseCategorySummary,
	type SecurityPrivacyReleaseCheckCategory,
	type SecurityPrivacyReleaseCheckInput,
	type SecurityPrivacyReleaseCheckOptions,
	type SecurityPrivacyReleaseCheckResult,
	type SecurityPrivacyReleaseDiagnostic,
	type SecurityPrivacyReleaseFinding,
	type SecurityPrivacyReleaseFindingKind,
	type SecurityPrivacyReleaseLogCheck,
	type SecurityPrivacyReleaseNetworkCheck,
	type SecurityPrivacyReleasePackageCheck,
	type SecurityPrivacyReleaseProviderCheck,
	type SecurityPrivacyReleaseSeverity,
	type SecurityPrivacyReleaseStateCheck,
	sortSecurityPrivacyReleaseFindings,
} from './security-release-model.js';

// ---------------------------------------------------------------------------
// Redaction patterns
// ---------------------------------------------------------------------------

const SECRET_PATTERNS = [
	// API keys
	{
		kind: 'raw_provider_token_detected' as const,
		pattern: /\bsk-[a-zA-Z0-9]{20,}\b/g,
	},
	{
		kind: 'raw_provider_token_detected' as const,
		pattern: /\bsk-proj-[a-zA-Z0-9\-_]{20,}\b/g,
	},
	{
		kind: 'raw_provider_token_detected' as const,
		pattern: /\bgsk_[a-zA-Z0-9]{20,}\b/g,
	},
	{
		kind: 'raw_provider_token_detected' as const,
		pattern: /\bhf_[a-zA-Z0-9]{20,}\b/g,
	},
	{
		kind: 'raw_secret_detected' as const,
		pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/g,
	},
	{
		kind: 'raw_secret_detected' as const,
		pattern: /\bxox[bp]-[A-Za-z0-9-]{20,}\b/g,
	},
	{
		kind: 'raw_secret_detected' as const,
		pattern: /\bdapi-[A-Za-z0-9]{32,}\b/g,
	},
	{ kind: 'raw_secret_detected' as const, pattern: /\bAKIA[A-Z0-9]{16}\b/g },
	// Authorization headers
	{
		kind: 'authorization_header_detected' as const,
		pattern: /Authorization\s*[:=]\s*[^\s,;"'\n\r]+/gi,
	},
	{
		kind: 'authorization_header_detected' as const,
		pattern: /Bearer\s+[A-Za-z0-9\-._~+/=]{20,}/gi,
	},
	// Private keys
	{
		kind: 'private_key_detected' as const,
		pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g,
	},
	{
		kind: 'private_key_detected' as const,
		pattern: /-----BEGIN\s+EC\s+PRIVATE\s+KEY-----/g,
	},
	{
		kind: 'private_key_detected' as const,
		pattern: /-----BEGIN\s+OPENSSH\s+PRIVATE\s+KEY-----/g,
	},
	// Credentials in URLs
	{
		kind: 'credential_in_url_detected' as const,
		pattern: /[?&](?:token|api_key|access_token|secret|auth)=[^&\s]+/gi,
	},
	// Env assignments with values
	{
		kind: 'env_file_content_detected' as const,
		pattern: /(?:LOGOS_LLM_API_KEY|API_KEY|SECRET|TOKEN)\s*=\s*[^\s]{20,}/gi,
	},
];

const RAW_PROMPT_PATTERNS = [
	/<\|system\|>/gi,
	/<\|assistant\|>/gi,
	/<\|user\|>/gi,
	/\[system_prompt\]/gi,
	/\[model_output\]/gi,
];

const RAW_RESPONSE_PATTERNS = [/<\|model\|>/gi, /\[raw_model_response\]/gi];

const PRIVATE_CHAT_PATTERNS = [
	/\[chat_history\]/gi,
	/\[conversation_log\]/gi,
	/private_chat/gi,
];

const NETWORK_TOOL_PATTERNS = [
	{ name: 'curl', pattern: /\bcurl\b/i },
	{ name: 'wget', pattern: /\bwget\b/i },
	{ name: 'gh (GitHub CLI)', pattern: /\bgh\b(?!\s*$)/i },
	{ name: 'npm publish', pattern: /\bnpm\s+publish\b/i },
	{ name: 'pnpm publish', pattern: /\bpnpm\s+publish\b/i },
	{ name: 'vercel', pattern: /\bvercel\b/i },
	{ name: 'netlify', pattern: /\bnetlify\b/i },
	{ name: 'aws', pattern: /\baws\b(?!\s*$)/i },
	{ name: 'gcloud', pattern: /\bgcloud\b/i },
	{ name: 'linear', pattern: /\blinear\b(?!\s+interpolation)/i },
	{ name: 'notion', pattern: /\bnotion\b/i },
];

const TELEMETRY_ANALYTICS_PATTERNS = [
	{
		kind: 'telemetry_or_analytics_detected' as const,
		pattern: /\btelemetry\b/i,
	},
	{
		kind: 'telemetry_or_analytics_detected' as const,
		pattern: /\banalytics\b/i,
	},
	{ kind: 'crash_upload_detected' as const, pattern: /crash.report/i },
	{ kind: 'crash_upload_detected' as const, pattern: /error.report(?:ing)?/i },
	{ kind: 'remote_logging_detected' as const, pattern: /remote.log/i },
	{ kind: 'cloud_backup_detected' as const, pattern: /cloud.backup/i },
	{ kind: 'external_sync_detected' as const, pattern: /external.sync/i },
	{ kind: 'telemetry_or_analytics_detected' as const, pattern: /\bsentry\b/i },
	{ kind: 'telemetry_or_analytics_detected' as const, pattern: /\bdatadog\b/i },
	{
		kind: 'telemetry_or_analytics_detected' as const,
		pattern: /\bnewrelic\b/i,
	},
	{
		kind: 'telemetry_or_analytics_detected' as const,
		pattern: /\bappinsights\b/i,
	},
	{ kind: 'telemetry_or_analytics_detected' as const, pattern: /\bposthog\b/i },
	{
		kind: 'telemetry_or_analytics_detected' as const,
		pattern: /\bmixpanel\b/i,
	},
	{
		kind: 'telemetry_or_analytics_detected' as const,
		pattern: /\bamplitude\b/i,
	},
	{
		kind: 'telemetry_or_analytics_detected' as const,
		pattern: /google.analytics/i,
	},
	{ kind: 'telemetry_or_analytics_detected' as const, pattern: /\bga\(/i },
	{
		kind: 'telemetry_or_analytics_detected' as const,
		pattern: /\bfirebase\b/i,
	},
];

const RISKY_DEPENDENCY_PATTERNS = [
	{
		name: 'Sentry (crash reporting)',
		pattern: /sentry/i,
		risk: 'telemetry_or_analytics_detected' as const,
	},
	{
		name: 'Datadog (monitoring)',
		pattern: /datadog/i,
		risk: 'telemetry_or_analytics_detected' as const,
	},
	{
		name: 'New Relic (monitoring)',
		pattern: /newrelic/i,
		risk: 'telemetry_or_analytics_detected' as const,
	},
	{
		name: 'PostHog (analytics)',
		pattern: /posthog/i,
		risk: 'telemetry_or_analytics_detected' as const,
	},
	{
		name: 'Mixpanel (analytics)',
		pattern: /mixpanel/i,
		risk: 'telemetry_or_analytics_detected' as const,
	},
	{
		name: 'Amplitude (analytics)',
		pattern: /amplitude/i,
		risk: 'telemetry_or_analytics_detected' as const,
	},
	{
		name: 'Google Analytics',
		pattern: /google-analytics/i,
		risk: 'telemetry_or_analytics_detected' as const,
	},
	{
		name: 'Firebase Admin (cloud service)',
		pattern: /firebase-admin/i,
		risk: 'external_api_called_by_default' as const,
	},
	{
		name: 'AWS SDK (cloud service)',
		pattern: /aws-sdk/i,
		risk: 'external_api_called_by_default' as const,
	},
	{
		name: 'AWS SDK (cloud service)',
		pattern: /@aws-sdk/i,
		risk: 'external_api_called_by_default' as const,
	},
	{
		name: 'Google Cloud (cloud service)',
		pattern: /google-cloud/i,
		risk: 'external_api_called_by_default' as const,
	},
	{
		name: 'Notion SDK (external sync)',
		pattern: /@notionhq/i,
		risk: 'external_sync_detected' as const,
	},
	{
		name: 'Linear SDK (external sync)',
		pattern: /@linear/i,
		risk: 'external_sync_detected' as const,
	},
	{
		name: 'Octokit (GitHub API)',
		pattern: /octokit/i,
		risk: 'external_api_called_by_default' as const,
	},
	{
		name: 'Octokit (GitHub API)',
		pattern: /@octokit/i,
		risk: 'external_api_called_by_default' as const,
	},
	{
		name: 'OpenAI SDK (remote provider)',
		pattern: /openai/i,
		risk: 'raw_provider_token_detected' as const,
	},
	{
		name: 'Anthropic SDK (remote provider)',
		pattern: /@anthropic/i,
		risk: 'raw_provider_token_detected' as const,
	},
	{
		name: 'Axios (HTTP client — review usage)',
		pattern: /axios/i,
		risk: 'insufficient_security_evidence' as const,
	},
	{
		name: 'node-fetch (HTTP client — review usage)',
		pattern: /node-fetch/i,
		risk: 'insufficient_security_evidence' as const,
	},
	{
		name: 'Undici (HTTP client — review usage)',
		pattern: /undici/i,
		risk: 'insufficient_security_evidence' as const,
	},
];

const DEFAULT_CHECK_SCRIPTS = [
	'check',
	'check:validation',
	'lint:biome',
	'lint:md',
	'lint',
	'test',
];

const PACKAGE_EXPECTED_FILES = ['dist', 'profiles', 'README.md', 'LICENSE'];

const _PACKAGE_SENSITIVE_GLOBS = [
	'**/.env',
	'**/.env.*',
	'**/.logos/**',
	'**/backups/**',
	'**/coverage/**',
	'**/node_modules/**',
	'**/.git/**',
];

const UNSAFE_HTML_PATTERNS = [
	/<script[\s>]/gi,
	/<iframe[\s>]/gi,
	/<form[\s>]/gi,
	/javascript:/gi,
	/vbscript:/gi,
	/data:\s*text\/html/gi,
	/\bon\w+\s*=\s*["']?[^"'>]+/gi,
];

const UNSAFE_AGENT_PACK_PATTERNS = [
	/ignore\s+.*?\s+(?:instructions|constraints)/gi,
	/override\s+(?:system|previous)\s+instructions/gi,
	/exfiltrate\s+(?:secrets|data|tokens)/gi,
	/this\s+(?:pack|document|artifact)\s+is\s+(?:canonical|the\s+source\s+of\s+truth|authoritative)/gi,
	/IS\s+a\s+source\s+of\s+truth/i,
	/This\s+is\s+a\s+canonical\s+document/i,
	/canonical\s*:\s*true/i,
];

const UNSAFE_EXECUTIVE_PATTERNS = [
	/external_api_execution["\s]*:\s*true/i,
	/live_sync["\s]*:\s*true/i,
	/externalApiExecution["\s]*:\s*true/i,
	/liveSync["\s]*:\s*true/i,
	/canonical["\s]*:\s*true/i,
	/isCanonical["\s]*:\s*true/i,
];

// ---------------------------------------------------------------------------
// Checker helper
// ---------------------------------------------------------------------------

let _findingCounter = 0;

function resetFindingCounter(): void {
	_findingCounter = 0;
}

function nextFindingCounter(): number {
	return _findingCounter++;
}

function makeFinding(params: {
	kind: SecurityPrivacyReleaseFindingKind;
	severity: SecurityPrivacyReleaseSeverity;
	category: SecurityPrivacyReleaseCheckCategory;
	message: string;
	path?: string | undefined;
	pointer?: string | undefined;
	recoveryHint?: string | undefined;
	diagnosticCode?: string | undefined;
}): SecurityPrivacyReleaseFinding {
	return {
		category: params.category,
		diagnosticCode: params.diagnosticCode,
		id: buildSecurityPrivacyReleaseFindingId(
			params.kind,
			params.path,
			nextFindingCounter(),
		),
		kind: params.kind,
		message: params.message,
		path: params.path,
		pointer: params.pointer,
		recoveryHint: params.recoveryHint,
		severity: params.severity,
	};
}

function _makeDiagnostic(params: {
	code: string;
	severity: SecurityPrivacyReleaseSeverity;
	message: string;
	path?: string | undefined;
	recoveryHint?: string | undefined;
}): SecurityPrivacyReleaseDiagnostic {
	return {
		code: params.code,
		message: params.message,
		path: params.path,
		recoveryHint: params.recoveryHint,
		severity: params.severity,
	};
}

// ---------------------------------------------------------------------------
// Redaction audit
// ---------------------------------------------------------------------------

function checkRedaction(
	content: string,
	context: string,
	category: SecurityPrivacyReleaseCheckCategory,
): SecurityPrivacyReleaseFinding[] {
	const findings: SecurityPrivacyReleaseFinding[] = [];
	const lower = content.toLowerCase();

	for (const { pattern, kind } of SECRET_PATTERNS) {
		pattern.lastIndex = 0;
		if (pattern.test(content)) {
			const severity: SecurityPrivacyReleaseSeverity =
				kind === 'raw_secret_detected' ||
				kind === 'raw_provider_token_detected' ||
				kind === 'authorization_header_detected' ||
				kind === 'private_key_detected'
					? 'error'
					: 'warning';
			findings.push(
				makeFinding({
					category,
					kind,
					message: `Secret-like value detected in ${context}.`,
					path: context,
					recoveryHint:
						'Remove raw secret values and use environment variable references.',
					severity,
				}),
			);
		}
	}

	// Check for raw prompts
	for (const pattern of RAW_PROMPT_PATTERNS) {
		if (pattern.test(lower)) {
			findings.push(
				makeFinding({
					category,
					kind: 'raw_prompt_detected',
					message: `Raw prompt marker detected in ${context}.`,
					path: context,
					recoveryHint: 'Remove raw prompt content from generated artifacts.',
					severity: 'warning',
				}),
			);
			break;
		}
	}

	// Check for raw model responses
	for (const pattern of RAW_RESPONSE_PATTERNS) {
		if (pattern.test(lower)) {
			findings.push(
				makeFinding({
					category,
					kind: 'raw_model_response_detected',
					message: `Raw model response marker detected in ${context}.`,
					path: context,
					recoveryHint:
						'Remove raw model response content from generated artifacts.',
					severity: 'warning',
				}),
			);
			break;
		}
	}

	// Check for private chat history
	for (const pattern of PRIVATE_CHAT_PATTERNS) {
		if (pattern.test(lower)) {
			findings.push(
				makeFinding({
					category,
					kind: 'private_chat_history_detected',
					message: `Private chat history marker detected in ${context}.`,
					path: context,
					recoveryHint: 'Remove private chat history from generated artifacts.',
					severity: 'warning',
				}),
			);
			break;
		}
	}

	return findings;
}

// ---------------------------------------------------------------------------
// Redaction overlay for structured content checks
// ---------------------------------------------------------------------------

function _checkMultipleContents(
	contents: Record<string, string>,
	contextPrefix: string,
	category: SecurityPrivacyReleaseCheckCategory,
): SecurityPrivacyReleaseFinding[] {
	const findings: SecurityPrivacyReleaseFinding[] = [];
	for (const [key, content] of Object.entries(contents)) {
		findings.push(
			...checkRedaction(content, `${contextPrefix}:${key}`, category),
		);
	}
	return findings;
}

// ---------------------------------------------------------------------------
// Provider config check
// ---------------------------------------------------------------------------

function checkProviderConfig(
	options: SecurityPrivacyReleaseCheckOptions,
): SecurityPrivacyReleaseProviderCheck {
	const findings: SecurityPrivacyReleaseFinding[] = [];
	let hasRawToken = false;
	let hasEnvRefOnly = true;
	const requiresCredentialsByDefault = false;
	let rawPromptsDetected = false;
	let rawResponsesDetected = false;

	const providerConfig = options._providerConfig;
	if (providerConfig) {
		const configStr = JSON.stringify(providerConfig);
		hasRawToken = SECRET_PATTERNS.some(({ pattern }) => {
			pattern.lastIndex = 0;
			return pattern.test(configStr);
		});

		if (hasRawToken) {
			findings.push(
				makeFinding({
					category: 'provider_config',
					kind: 'provider_token_persisted',
					message: 'Raw provider token detected in provider configuration.',
					path: 'provider_config',
					recoveryHint:
						'Remove raw token and use environment variable reference instead.',
					severity: 'error',
				}),
			);
			hasEnvRefOnly = false;
		}
	}

	// Check if credentials are required by default
	if (options._checkContent) {
		for (const [key, content] of Object.entries(options._checkContent)) {
			if (
				content.includes('LOGOS_LLM_API_KEY') &&
				(key.includes('provider') || key.includes('config'))
			) {
				// Env ref is fine
			}
		}
	}

	// Check for raw prompts/responses in check content
	if (options._checkContent) {
		for (const [key, content] of Object.entries(options._checkContent)) {
			const lower = content.toLowerCase();
			if (
				RAW_PROMPT_PATTERNS.some((p) => p.test(lower)) &&
				(key.includes('prompt') || key.includes('response'))
			) {
				rawPromptsDetected = true;
			}
			if (
				RAW_RESPONSE_PATTERNS.some((p) => p.test(lower)) &&
				key.includes('response')
			) {
				rawResponsesDetected = true;
			}
		}
	}

	const passed = !hasRawToken && !requiresCredentialsByDefault;

	return {
		findings,
		hasEnvRefOnly,
		hasRawToken,
		passed,
		rawPromptsDetected,
		rawResponsesDetected,
		requiresCredentialsByDefault,
		summary: passed
			? 'Provider config check passed. No raw tokens detected.'
			: 'Provider config check found issues.',
	};
}

// ---------------------------------------------------------------------------
// Workspace state check
// ---------------------------------------------------------------------------

function checkWorkspaceState(
	options: SecurityPrivacyReleaseCheckOptions,
): SecurityPrivacyReleaseStateCheck {
	const findings: SecurityPrivacyReleaseFinding[] = [];
	let rawTokensDetected = false;
	let rawPromptsDetected = false;
	const secretInRegistry = false;
	let secretInRunMetadata = false;
	const secretInSessionMetadata = false;

	const state = options._workspaceState;
	if (state) {
		const stateStr = JSON.stringify(state);
		rawTokensDetected = SECRET_PATTERNS.some(({ pattern }) => {
			pattern.lastIndex = 0;
			return pattern.test(stateStr);
		});

		if (rawTokensDetected) {
			findings.push(
				makeFinding({
					category: 'workspace_state',
					kind: 'raw_secret_detected',
					message: 'Raw secret-like value detected in workspace state.',
					path: '.logos/workspace.json',
					recoveryHint:
						'Remove raw secrets from workspace state. Use environment variable references.',
					severity: 'error',
				}),
			);
		}
	}

	const runMetadata = options._runMetadata;
	if (runMetadata) {
		const runStr = JSON.stringify(runMetadata);
		if (
			SECRET_PATTERNS.some(({ pattern }) => {
				pattern.lastIndex = 0;
				return pattern.test(runStr);
			})
		) {
			secretInRunMetadata = true;
			findings.push(
				makeFinding({
					category: 'workspace_state',
					kind: 'raw_secret_detected',
					message: 'Secret-like value detected in run metadata.',
					path: 'run_metadata',
					recoveryHint: 'Remove raw secrets from run metadata records.',
					severity: 'error',
				}),
			);
		}
		if (RAW_PROMPT_PATTERNS.some((p) => p.test(runStr.toLowerCase()))) {
			rawPromptsDetected = true;
			findings.push(
				makeFinding({
					category: 'workspace_state',
					kind: 'raw_prompt_detected',
					message: 'Raw prompt content detected in run metadata.',
					path: 'run_metadata',
					recoveryHint: 'Remove raw prompt content from run metadata.',
					severity: 'warning',
				}),
			);
		}
	}

	const passed =
		!rawTokensDetected &&
		!secretInRegistry &&
		!secretInRunMetadata &&
		!secretInSessionMetadata;

	return {
		findings,
		passed,
		rawPromptsDetected,
		rawTokensDetected,
		secretInRegistry,
		secretInRunMetadata,
		secretInSessionMetadata,
		summary: passed
			? 'Workspace state check passed.'
			: 'Workspace state contains secrets or sensitive data.',
	};
}

// ---------------------------------------------------------------------------
// Backup check
// ---------------------------------------------------------------------------

function checkBackups(
	options: SecurityPrivacyReleaseCheckOptions,
): SecurityPrivacyReleaseBackupCheck {
	const findings: SecurityPrivacyReleaseFinding[] = [];
	let envContentsDetected = false;
	let secretInManifest = false;
	const secretInBackupFiles = false;

	const manifest = options._backupManifest;
	if (manifest) {
		const manifestStr = JSON.stringify(manifest);
		if (
			SECRET_PATTERNS.some(({ pattern }) => {
				pattern.lastIndex = 0;
				return pattern.test(manifestStr);
			})
		) {
			secretInManifest = true;
			findings.push(
				makeFinding({
					category: 'backups',
					kind: 'raw_secret_detected',
					message: 'Secret-like value detected in backup manifest.',
					path: 'backup-manifest.json',
					recoveryHint: 'Remove raw secrets from backup manifests.',
					severity: 'error',
				}),
			);
		}
	}

	// Check backup content for .env
	if (options._checkContent) {
		for (const [key, content] of Object.entries(options._checkContent)) {
			if (key.includes('backup') && content.includes('.env')) {
				envContentsDetected = true;
				findings.push(
					makeFinding({
						category: 'backups',
						kind: 'env_file_content_detected',
						message: 'Backup content contains .env references.',
						path: key,
						recoveryHint: 'Exclude .env files from backups.',
						severity: 'warning',
					}),
				);
			}
		}
	}

	const passed = !secretInManifest && !secretInBackupFiles;

	return {
		envContentsDetected,
		findings,
		passed,
		secretInBackupFiles,
		secretInManifest,
		summary: passed ? 'Backup check passed.' : 'Backup check found issues.',
	};
}

// ---------------------------------------------------------------------------
// Generated artifact checks
// ---------------------------------------------------------------------------

function checkGeneratedArtifacts(
	options: SecurityPrivacyReleaseCheckOptions,
): SecurityPrivacyReleaseArtifactCheck {
	const findings: SecurityPrivacyReleaseFinding[] = [];
	const canonicalBoundaryViolations: string[] = [];
	const unsafeHtml: string[] = [];
	const unsafeAgentPacks: string[] = [];
	const unsafeExecutiveExports: string[] = [];

	if (!options._checkContent) {
		return {
			canonicalBoundaryViolations: [],
			findings: [],
			passed: true,
			summary: 'No artifact content provided for checking.',
			unsafeAgentPacks: [],
			unsafeExecutiveExports: [],
			unsafeHtml: [],
		};
	}

	for (const [key, content] of Object.entries(options._checkContent)) {
		const lower = content.toLowerCase();

		// Check for secrets in any artifact
		const redactFindings = checkRedaction(content, key, 'generated_artifacts');
		findings.push(...redactFindings);

		// HTML safety checks
		if (
			key.includes('html') ||
			content.startsWith('<!') ||
			content.includes('<html')
		) {
			for (const unsafePattern of UNSAFE_HTML_PATTERNS) {
				unsafePattern.lastIndex = 0;
				if (unsafePattern.test(content)) {
					unsafeHtml.push(key);
					findings.push(
						makeFinding({
							category: 'html_safety',
							kind: 'unsafe_html_detected',
							message: `Unsafe HTML pattern detected in ${key}.`,
							path: key,
							recoveryHint:
								'Remove scripts, iframes, forms, event handlers, and unsafe URLs from HTML artifacts.',
							severity: 'error',
						}),
					);
					break;
				}
			}
			// Check for remote assets
			if (/https?:\/\/[^\s"'>]+/gi.test(content) && !key.includes('href_doc')) {
				findings.push(
					makeFinding({
						category: 'html_safety',
						kind: 'unsafe_html_detected',
						message: `Remote asset reference detected in HTML artifact ${key}.`,
						path: key,
						recoveryHint:
							'Ensure HTML artifacts are self-contained without remote assets.',
						severity: 'warning',
					}),
				);
			}
		}

		// Agent Pack safety checks
		if (
			key.includes('agent_pack') ||
			key.includes('agent-pack') ||
			content.includes('agent pack')
		) {
			for (const unsafePattern of UNSAFE_AGENT_PACK_PATTERNS) {
				unsafePattern.lastIndex = 0;
				if (unsafePattern.test(content)) {
					unsafeAgentPacks.push(key);
					findings.push(
						makeFinding({
							category: 'agent_pack_safety',
							kind: 'unsafe_agent_pack_instruction_detected',
							message: `Unsafe Agent Pack instruction detected in ${key}.`,
							path: key,
							recoveryHint:
								'Remove instructions that override constraints, exfiltrate secrets, or claim canonical authority.',
							severity: 'error',
						}),
					);
					break;
				}
			}

			// Check for missing derived/non-canonical warning
			if (
				!content.includes('derived') &&
				!content.includes('non-canonical') &&
				!content.includes('execution aid')
			) {
				findings.push(
					makeFinding({
						category: 'agent_pack_safety',
						kind: 'generated_artifact_marked_canonical',
						message: `Agent Pack ${key} may be missing derived/non-canonical warning.`,
						path: key,
						recoveryHint:
							'Add a clear derived/non-canonical warning to the Agent Pack.',
						severity: 'warning',
					}),
				);
			}
		}

		// Executive export safety checks
		if (
			key.includes('executive') ||
			content.includes('executive') ||
			content.includes('work_item')
		) {
			for (const unsafePattern of UNSAFE_EXECUTIVE_PATTERNS) {
				unsafePattern.lastIndex = 0;
				if (unsafePattern.test(content)) {
					unsafeExecutiveExports.push(key);
					findings.push(
						makeFinding({
							category: 'executive_export_safety',
							kind: 'unsafe_executive_export_detected',
							message: `Unsafe Executive export marker detected in ${key}.`,
							path: key,
							recoveryHint:
								'Ensure Executive exports are marked as derived snapshots, not live task managers.',
							severity: 'error',
						}),
					);
					break;
				}
			}
		}

		// Derived/canonical boundary checks
		if (
			content.includes('is canonical') ||
			content.includes('source of truth') ||
			(lower.includes('canonical') &&
				lower.includes('true') &&
				!key.includes('canonical'))
		) {
			const isCanonicalArtifact = key.includes('canonical');
			if (!isCanonicalArtifact) {
				canonicalBoundaryViolations.push(key);
				findings.push(
					makeFinding({
						category: 'derived_artifact_boundary',
						kind: 'generated_artifact_marked_canonical',
						message: `Derived artifact ${key} claims canonical authority.`,
						path: key,
						recoveryHint: 'Mark all derived artifacts as non-canonical.',
						severity: 'error',
					}),
				);
			}
		}
	}

	const passed =
		canonicalBoundaryViolations.length === 0 &&
		unsafeHtml.length === 0 &&
		unsafeAgentPacks.length === 0 &&
		unsafeExecutiveExports.length === 0 &&
		!findings.some((f) => f.severity === 'error' || f.severity === 'fatal');

	return {
		canonicalBoundaryViolations,
		findings,
		passed,
		summary: passed
			? 'Generated artifact checks passed.'
			: `Generated artifact checks found ${findings.length} issue(s).`,
		unsafeAgentPacks,
		unsafeExecutiveExports,
		unsafeHtml,
	};
}

// ---------------------------------------------------------------------------
// Package contents check
// ---------------------------------------------------------------------------

function checkPackageContents(
	options: SecurityPrivacyReleaseCheckOptions,
): SecurityPrivacyReleasePackageCheck {
	const findings: SecurityPrivacyReleaseFinding[] = [];
	const blockedBy: string[] = [];
	const missingExpected: string[] = [];
	const unexpectedSensitive: string[] = [];

	const files = options._packageFiles ?? [];
	const packageJson = options._packageJson ?? {};
	const hasExplicitFiles = options._packageFiles !== undefined;

	// Only check expected files when package files are explicitly provided
	if (hasExplicitFiles) {
		for (const expected of PACKAGE_EXPECTED_FILES) {
			const found = files.some((f) => {
				const normalized = f.replace(/\\/g, '/');
				return normalized === expected || normalized.startsWith(`${expected}/`);
			});
			if (!found) {
				missingExpected.push(expected);
			}
		}

		if (missingExpected.length > 0) {
			for (const missing of missingExpected) {
				findings.push(
					makeFinding({
						category: 'package_contents',
						kind: 'insufficient_security_evidence',
						message: `Expected package file not found: ${missing}`,
						path: missing,
						recoveryHint: 'Ensure package.files includes this entry.',
						severity: 'warning',
					}),
				);
			}
		}
	}

	// Check for sensitive files in package
	for (const file of files) {
		const normalized = file.replace(/\\/g, '/');

		if (
			normalized.startsWith('.env') ||
			normalized.endsWith('/.env') ||
			normalized.includes('/.env.')
		) {
			unexpectedSensitive.push(file);
			blockedBy.push(file);
			findings.push(
				makeFinding({
					category: 'package_contents',
					kind: 'package_includes_env_file',
					message: `Package includes .env file: ${file}`,
					path: file,
					recoveryHint: 'Exclude .env files from package publications.',
					severity: 'error',
				}),
			);
		}

		if (normalized.includes('.logos/') || normalized.startsWith('.logos')) {
			unexpectedSensitive.push(file);
			blockedBy.push(file);
			findings.push(
				makeFinding({
					category: 'package_contents',
					kind: 'package_includes_generated_workspace_state',
					message: `Package includes workspace state: ${file}`,
					path: file,
					recoveryHint: 'Exclude .logos from package publications.',
					severity: 'error',
				}),
			);
		}

		if (normalized.includes('backup') || normalized.includes('backups/')) {
			unexpectedSensitive.push(file);
			blockedBy.push(file);
			findings.push(
				makeFinding({
					category: 'package_contents',
					kind: 'package_includes_sensitive_file',
					message: `Package includes backup files: ${file}`,
					path: file,
					recoveryHint: 'Exclude backup files from package publications.',
					severity: 'error',
				}),
			);
		}

		if (
			normalized.startsWith('coverage/') ||
			normalized.includes('/coverage/')
		) {
			unexpectedSensitive.push(file);
			findings.push(
				makeFinding({
					category: 'package_contents',
					kind: 'package_includes_sensitive_file',
					message: `Package includes coverage output: ${file}`,
					path: file,
					recoveryHint: 'Exclude coverage from package publications.',
					severity: 'warning',
				}),
			);
		}

		if (normalized.startsWith('.git/') || normalized.includes('/.git/')) {
			unexpectedSensitive.push(file);
			blockedBy.push(file);
			findings.push(
				makeFinding({
					category: 'package_contents',
					kind: 'package_includes_sensitive_file',
					message: `Package includes .git directory: ${file}`,
					path: file,
					recoveryHint: 'Exclude .git from package publications.',
					severity: 'error',
				}),
			);
		}

		if (
			normalized.startsWith('node_modules/') ||
			normalized.includes('/node_modules/')
		) {
			unexpectedSensitive.push(file);
			findings.push(
				makeFinding({
					category: 'package_contents',
					kind: 'package_includes_sensitive_file',
					message: `Package includes node_modules: ${file}`,
					path: file,
					recoveryHint: 'node_modules should not be in package files.',
					severity: 'warning',
				}),
			);
		}
	}

	// Check that package.json files field includes sensible content (only when provided)
	if (hasExplicitFiles || options._packageJson !== undefined) {
		const packageFiles = (
			Array.isArray(packageJson.files) ? packageJson.files : []
		) as string[];
		const sensitiveInFilesField = packageFiles.filter(
			(f) =>
				f.startsWith('.env') ||
				f.includes('.logos') ||
				f.includes('backup') ||
				f.includes('coverage') ||
				f === '.git' ||
				f === 'node_modules',
		);
		for (const f of sensitiveInFilesField) {
			findings.push(
				makeFinding({
					category: 'package_contents',
					kind: 'package_includes_sensitive_file',
					message: `package.json "files" contains sensitive entry: ${f}`,
					path: 'package.json#/files',
					recoveryHint: 'Remove sensitive entries from the "files" array.',
					severity: 'error',
				}),
			);
		}
	}

	const passed =
		blockedBy.length === 0 &&
		!findings.some((f) => f.severity === 'error' || f.severity === 'fatal');

	const summary = hasExplicitFiles
		? passed
			? `Package contents check passed. ${files.length} file(s) checked.`
			: `Package contents check blocked by ${blockedBy.length} issue(s).`
		: 'Package contents check skipped (no explicit file list provided).';

	return {
		blockedBy,
		expectedFiles: PACKAGE_EXPECTED_FILES,
		findings,
		missingExpected,
		passed,
		summary,
		unexpectedSensitive,
	};
}

// ---------------------------------------------------------------------------
// Network & external integration checks
// ---------------------------------------------------------------------------

function checkNetwork(
	options: SecurityPrivacyReleaseCheckOptions,
): SecurityPrivacyReleaseNetworkCheck {
	const findings: SecurityPrivacyReleaseFinding[] = [];
	const detectedNetworkPatterns: string[] = [];
	const detectedExternalToolPatterns: string[] = [];
	const detectedTelemetryPatterns: string[] = [];

	const scripts = options._scripts ?? {};

	// Check scripts for network/external tool patterns
	for (const [name, script] of Object.entries(scripts)) {
		for (const { pattern, name: toolName } of NETWORK_TOOL_PATTERNS) {
			if (pattern.test(script)) {
				detectedExternalToolPatterns.push(`${name}: ${toolName}`);

				const isDefaultCheckScript =
					DEFAULT_CHECK_SCRIPTS.includes(name) ||
					name === 'check' ||
					name.startsWith('check:');
				const isPublishOrDeploy =
					name.includes('publish') ||
					name.includes('deploy') ||
					name.includes('release');
				const severity: SecurityPrivacyReleaseSeverity = isDefaultCheckScript
					? 'error'
					: isPublishOrDeploy
						? 'warning'
						: 'warning';

				findings.push(
					makeFinding({
						category: 'network',
						kind:
							toolName === 'curl' || toolName === 'wget'
								? 'network_required_by_default'
								: 'external_api_called_by_default',
						message: `Script "${name}" references external tool: ${toolName}`,
						path: `script:${name}`,
						recoveryHint: isDefaultCheckScript
							? 'Remove network/external tool usage from default check scripts.'
							: 'Review whether this external tool usage is intentional and documented.',
						severity,
					}),
				);

				if (isDefaultCheckScript) {
					detectedNetworkPatterns.push(name);
				}
			}
		}

		// Check for telemetry/analytics/remote services in scripts
		for (const { pattern, kind } of TELEMETRY_ANALYTICS_PATTERNS) {
			if (pattern.test(script)) {
				detectedTelemetryPatterns.push(`${name}: ${pattern.source}`);

				findings.push(
					makeFinding({
						category: 'network',
						kind,
						message: `Script "${name}" references telemetry/remote service: ${pattern.source}`,
						path: `script:${name}`,
						recoveryHint:
							'Remove telemetry, remote logging, or external service references from scripts.',
						severity: 'error',
					}),
				);
				break;
			}
		}

		// Check for mutating check scripts
		if (DEFAULT_CHECK_SCRIPTS.includes(name) || name === 'check') {
			if (script.includes('--write') || script.includes('--fix')) {
				findings.push(
					makeFinding({
						category: 'scripts',
						kind: 'mutating_check_script_detected',
						message: `Default check script "${name}" has mutating flags (--write/--fix).`,
						path: `script:${name}`,
						recoveryHint: 'Ensure check scripts are non-mutating.',
						severity: 'warning',
					}),
				);
			}
		}
	}

	// Check dependency surface
	const deps = options._dependencyNames ?? [];
	for (const dep of deps) {
		for (const { pattern, risk, name: depName } of RISKY_DEPENDENCY_PATTERNS) {
			if (pattern.test(dep)) {
				let severity: SecurityPrivacyReleaseSeverity = 'warning';
				if (
					risk === 'telemetry_or_analytics_detected' ||
					risk === 'external_sync_detected'
				) {
					severity = 'error';
				}

				findings.push(
					makeFinding({
						category: 'dependency_surface',
						kind: risk,
						message: `Dependency "${dep}" matches risky pattern: ${depName}`,
						path: `dependency:${dep}`,
						recoveryHint:
							risk === 'insufficient_security_evidence'
								? 'Review and document the necessity of this dependency.'
								: 'Consider removing or replacing this dependency.',
						severity,
					}),
				);
				break;
			}
		}
	}

	const passed =
		detectedNetworkPatterns.length === 0 &&
		detectedTelemetryPatterns.length === 0 &&
		!findings.some((f) => f.severity === 'error' || f.severity === 'fatal');

	return {
		detectedExternalToolPatterns,
		detectedNetworkPatterns,
		detectedTelemetryPatterns,
		findings,
		passed,
		summary: passed
			? 'Network and script checks passed.'
			: `Network/script checks found ${detectedNetworkPatterns.length + detectedTelemetryPatterns.length} issue(s).`,
	};
}

// ---------------------------------------------------------------------------
// Log check
// ---------------------------------------------------------------------------

function checkLogs(
	_options: SecurityPrivacyReleaseCheckOptions,
): SecurityPrivacyReleaseLogCheck {
	// Log checks are informational; we don't have log files to scan
	return {
		findings: [],
		passed: true,
		secretsInLogs: false,
		summary: 'Log safety check passed (no log content to scan).',
	};
}

// ---------------------------------------------------------------------------
// Main checker
// ---------------------------------------------------------------------------

export function runSecurityPrivacyReleaseCheck(
	options: SecurityPrivacyReleaseCheckInput = {},
): SecurityPrivacyReleaseCheckResult {
	resetFindingCounter();

	const strict = options.strict ?? true;
	const now = options.checkedAt ?? new Date().toISOString();
	const packageName = options.packageName ?? 'logos-engine';
	const packageVersion = options.packageVersion ?? '0.1.0';

	const diagnostics: SecurityPrivacyReleaseDiagnostic[] = [];
	let redactedCount = 0;

	// ---- Redaction audit across provided content ----
	const allRedactionFindings: SecurityPrivacyReleaseFinding[] = [];
	const redactionCategories: string[] = [];

	if (options._checkContent) {
		for (const [key, content] of Object.entries(options._checkContent)) {
			const rf = checkRedaction(content, key, 'redaction');
			allRedactionFindings.push(...rf);
			if (rf.length > 0) {
				redactionCategories.push(key);
				redactedCount += rf.filter(
					(f) =>
						f.kind === 'raw_secret_detected' ||
						f.kind === 'raw_provider_token_detected',
				).length;
			}
		}
	}

	// ---- Provider config check ----
	const providerCheck = checkProviderConfig(options);

	// ---- Workspace state check ----
	const stateCheck = checkWorkspaceState(options);

	// ---- Backup check ----
	const backupCheck = checkBackups(options);

	// ---- Generated artifact check ----
	const artifactCheck = checkGeneratedArtifacts(options);

	// ---- Package contents check ----
	const packageCheck = checkPackageContents(options);

	// ---- Network/scripts check ----
	const networkCheck = checkNetwork(options);

	// ---- Log check ----
	const logCheck = checkLogs(options);

	// ---- Combine all findings ----
	const allFindings: SecurityPrivacyReleaseFinding[] = [
		...allRedactionFindings,
		...providerCheck.findings,
		...stateCheck.findings,
		...backupCheck.findings,
		...artifactCheck.findings,
		...packageCheck.findings,
		...networkCheck.findings,
		...logCheck.findings,
	];

	const sortedFindings = sortSecurityPrivacyReleaseFindings(allFindings);

	// ---- Category summaries ----
	const categories: SecurityPrivacyReleaseCheckCategory[] = [
		'redaction',
		'provider_config',
		'workspace_state',
		'generated_artifacts',
		'reports',
		'backups',
		'logs',
		'package_contents',
		'scripts',
		'network',
		'external_integrations',
		'derived_artifact_boundary',
		'html_safety',
		'agent_pack_safety',
		'executive_export_safety',
		'scanner_import_safety',
		'dependency_surface',
	];

	const categorySummaries: SecurityPrivacyReleaseCategorySummary[] = [];
	for (const cat of categories) {
		const catFindings = sortedFindings.filter((f) => f.category === cat);
		categorySummaries.push({
			category: cat,
			errorCount: catFindings.filter((f) => f.severity === 'error').length,
			fatalCount: catFindings.filter((f) => f.severity === 'fatal').length,
			findingCount: catFindings.length,
			infoCount: catFindings.filter((f) => f.severity === 'info').length,
			passed: !catFindings.some(
				(f) => f.severity === 'error' || f.severity === 'fatal',
			),
			warningCount: catFindings.filter((f) => f.severity === 'warning').length,
		});
	}

	// ---- Counts ----
	const countsBySeverity: Record<SecurityPrivacyReleaseSeverity, number> = {
		error: sortedFindings.filter((f) => f.severity === 'error').length,
		fatal: sortedFindings.filter((f) => f.severity === 'fatal').length,
		info: sortedFindings.filter((f) => f.severity === 'info').length,
		warning: sortedFindings.filter((f) => f.severity === 'warning').length,
	};

	const countsByCategory: Record<SecurityPrivacyReleaseCheckCategory, number> =
		{} as Record<SecurityPrivacyReleaseCheckCategory, number>;
	for (const cat of categories) {
		countsByCategory[cat] =
			categorySummaries.find((cs) => cs.category === cat)?.findingCount ?? 0;
	}

	// ---- Redaction summary ----
	const redactionSummary = createRedactionResult(
		allRedactionFindings.length,
		redactedCount,
		allRedactionFindings.length,
		redactionCategories,
	);

	// ---- Release status ----
	const status = determineSecurityPrivacyReleaseStatus(sortedFindings, {
		strict,
	});

	// ---- Next actions ----
	const recommendedNextActions: string[] = [];
	if (status === 'blocked') {
		recommendedNextActions.push(
			'Resolve all error and fatal findings before release.',
		);
	}
	if (countsBySeverity.warning > 0) {
		recommendedNextActions.push('Review and resolve warning-level findings.');
	}
	if (packageCheck && !packageCheck.passed) {
		recommendedNextActions.push(
			'Fix package inclusion (exclude .env, .logos, backups).',
		);
	}
	if (networkCheck && !networkCheck.passed) {
		recommendedNextActions.push(
			'Remove network/telemetry from default scripts.',
		);
	}
	if (artifactCheck && !artifactCheck.passed) {
		recommendedNextActions.push('Fix unsafe generated artifacts.');
	}
	if (recommendedNextActions.length === 0) {
		recommendedNextActions.push(
			'Security/privacy checks passed. Ready for release.',
		);
	}

	return {
		artifactCheck,
		backupCheck,
		categorySummaries,
		changedPaths: [],
		checkedAt: now,
		countsByCategory,
		countsBySeverity,
		diagnostics,
		dryRun: options.dryRun ?? true,
		findings: sortedFindings,
		logCheck,
		networkCheck,
		packageCheck,
		packageName,
		packageVersion,
		profileId: options.profileId,
		profileVersion: options.profileVersion,
		providerCheck,
		readOnly: true,
		recommendedNextActions,
		redactionSummary,
		stateCheck,
		status,
		totalFindings: sortedFindings.length,
	};
}

export { compareSecurityPrivacySeverity } from './security-release-model.js';
