/**
 * Security and Privacy Release Model Tests
 *
 * Step 13.3 — Complete Security and Privacy Release Checks
 */

import { describe, expect, it } from 'vitest';
import {
	determineSecurityPrivacyReleaseStatus,
	SECURITY_PRIVACY_CHECK_CATEGORY_ORDER,
	SECURITY_PRIVACY_RELEASE_FINDING_KIND_ORDER,
	SECURITY_PRIVACY_RELEASE_SEVERITY_ORDER,
	SECURITY_PRIVACY_RELEASE_STATUS_ORDER,
	type SecurityPrivacyReleaseFinding,
	type SecurityPrivacyReleaseFindingKind,
	type SecurityPrivacyReleaseSeverity,
	sortSecurityPrivacyReleaseFindings,
} from '../src/security/security-release-model.js';

function makeFinding(
	kind: SecurityPrivacyReleaseFindingKind,
	severity: SecurityPrivacyReleaseSeverity,
	category: string = 'redaction',
	path?: string,
): SecurityPrivacyReleaseFinding {
	return {
		category: category as SecurityPrivacyReleaseFinding['category'],
		id: `${kind}|${path ?? ''}|${Math.random()}`,
		kind,
		message: `Test finding: ${kind}`,
		path,
		severity,
	};
}

describe('security/privacy release model', () => {
	describe('severity ordering', () => {
		it('has all required severities', () => {
			expect(SECURITY_PRIVACY_RELEASE_SEVERITY_ORDER).toHaveProperty('fatal');
			expect(SECURITY_PRIVACY_RELEASE_SEVERITY_ORDER).toHaveProperty('error');
			expect(SECURITY_PRIVACY_RELEASE_SEVERITY_ORDER).toHaveProperty('warning');
			expect(SECURITY_PRIVACY_RELEASE_SEVERITY_ORDER).toHaveProperty('info');
		});

		it('orders fatal < error < warning < info', () => {
			const order = SECURITY_PRIVACY_RELEASE_SEVERITY_ORDER;
			expect(order.fatal).toBeLessThan(order.error);
			expect(order.error).toBeLessThan(order.warning);
			expect(order.warning).toBeLessThan(order.info);
		});
	});

	describe('finding kind ordering', () => {
		it('covers all required finding kinds', () => {
			const requiredKinds: SecurityPrivacyReleaseFindingKind[] = [
				'raw_secret_detected',
				'raw_provider_token_detected',
				'authorization_header_detected',
				'private_key_detected',
				'env_file_content_detected',
				'raw_prompt_detected',
				'raw_model_response_detected',
				'private_chat_history_detected',
				'credential_in_url_detected',
				'provider_token_persisted',
				'provider_credentials_required_by_default',
				'network_required_by_default',
				'telemetry_or_analytics_detected',
				'remote_logging_detected',
				'crash_upload_detected',
				'cloud_backup_detected',
				'external_sync_detected',
				'generated_artifact_marked_canonical',
				'unsafe_html_detected',
				'unsafe_agent_pack_instruction_detected',
				'unsafe_executive_export_detected',
				'package_includes_sensitive_file',
				'package_includes_env_file',
				'package_includes_generated_workspace_state',
				'dependency_surface_risk',
				'insufficient_security_evidence',
				'unknown_security_risk',
				'mutating_check_script_detected',
			];
			for (const kind of requiredKinds) {
				expect(SECURITY_PRIVACY_RELEASE_FINDING_KIND_ORDER).toHaveProperty(
					kind,
				);
			}
		});
	});

	describe('category ordering', () => {
		it('has all required categories in order', () => {
			const requiredCategories = [
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
			for (const cat of requiredCategories) {
				expect(SECURITY_PRIVACY_CHECK_CATEGORY_ORDER).toHaveProperty(cat);
			}
		});
	});

	describe('release status ordering', () => {
		it('orders blocked < pass < pass_with_warnings < unknown', () => {
			const order = SECURITY_PRIVACY_RELEASE_STATUS_ORDER;
			expect(order.blocked).toBeLessThan(order.pass);
			expect(order.pass).toBeLessThan(order.pass_with_warnings);
			expect(order.pass_with_warnings).toBeLessThan(order.unknown);
		});
	});
});

describe('sortSecurityPrivacyReleaseFindings', () => {
	it('sorts by severity first (fatal before error before warning before info)', () => {
		const findings = [
			makeFinding('raw_secret_detected', 'info'),
			makeFinding('raw_secret_detected', 'fatal'),
			makeFinding('raw_secret_detected', 'warning'),
			makeFinding('raw_secret_detected', 'error'),
		];
		const sorted = sortSecurityPrivacyReleaseFindings(findings);
		expect(sorted[0]?.severity).toBe('fatal');
		expect(sorted[1]?.severity).toBe('error');
		expect(sorted[2]?.severity).toBe('warning');
		expect(sorted[3]?.severity).toBe('info');
	});

	it('sorts by category when severities equal', () => {
		const findings = [
			makeFinding('raw_secret_detected', 'error', 'package_contents'),
			makeFinding('raw_secret_detected', 'error', 'redaction'),
		];
		const sorted = sortSecurityPrivacyReleaseFindings(findings);
		expect(sorted[0]?.category).toBe('redaction');
		expect(sorted[1]?.category).toBe('package_contents');
	});

	it('sorts by finding kind when severity and category equal', () => {
		const order = SECURITY_PRIVACY_RELEASE_FINDING_KIND_ORDER;
		expect(order.raw_secret_detected).toBeLessThan(
			order.raw_provider_token_detected,
		);
	});

	it('sorts by path when kind equal', () => {
		const findings = [
			makeFinding('raw_secret_detected', 'error', 'redaction', 'b'),
			makeFinding('raw_secret_detected', 'error', 'redaction', 'a'),
		];
		const sorted = sortSecurityPrivacyReleaseFindings(findings);
		expect(sorted[0]?.path).toBe('a');
		expect(sorted[1]?.path).toBe('b');
	});

	it('preserves expected stable order', () => {
		const findings = [
			makeFinding('raw_secret_detected', 'error', 'redaction'),
			makeFinding('package_includes_env_file', 'info', 'package_contents'),
			makeFinding('unsafe_html_detected', 'error', 'html_safety'),
		];
		const sorted = sortSecurityPrivacyReleaseFindings(findings);
		expect(sorted[0]?.severity).toBe('error');
		expect(sorted[sorted.length - 1]?.severity).toBe('info');
	});
});

describe('determineSecurityPrivacyReleaseStatus', () => {
	it('returns pass when no findings', () => {
		const status = determineSecurityPrivacyReleaseStatus([]);
		expect(status).toBe('pass');
	});

	it('returns blocked when fatal finding present', () => {
		const findings = [makeFinding('raw_secret_detected', 'fatal')];
		const status = determineSecurityPrivacyReleaseStatus(findings);
		expect(status).toBe('blocked');
	});

	it('returns blocked when error finding present', () => {
		const findings = [makeFinding('raw_secret_detected', 'error')];
		const status = determineSecurityPrivacyReleaseStatus(findings);
		expect(status).toBe('blocked');
	});

	it('returns pass_with_warnings when only warnings present', () => {
		const findings = [makeFinding('insufficient_security_evidence', 'warning')];
		const status = determineSecurityPrivacyReleaseStatus(findings);
		expect(status).toBe('pass_with_warnings');
	});

	it('returns pass_with_warnings with only info findings (non-strict)', () => {
		const findings = [makeFinding('unknown_security_risk', 'info')];
		const status = determineSecurityPrivacyReleaseStatus(findings, {
			strict: false,
		});
		expect(status).toBe('pass');
	});

	it('returns unknown in strict mode with insufficient evidence', () => {
		const findings = [makeFinding('insufficient_security_evidence', 'warning')];
		const status = determineSecurityPrivacyReleaseStatus(findings, {
			strict: true,
		});
		expect(status).toBe('pass_with_warnings'); // warning, not blocked
	});

	it('returns blocked with mix of error and warning', () => {
		const findings = [
			makeFinding('unsafe_html_detected', 'error'),
			makeFinding('insufficient_security_evidence', 'warning'),
		];
		const status = determineSecurityPrivacyReleaseStatus(findings);
		expect(status).toBe('blocked');
	});
});
