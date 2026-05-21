#!/usr/bin/env node
/**
 * Security and Privacy Release Check Script
 *
 * Step 13.3 — Complete Security and Privacy Release Checks
 *
 * Runs the deterministic security/privacy release checker against
 * the package metadata. Non-mutating, provider-free, network-free.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));

const allDeps = [
	...(pkg.dependencies ? Object.keys(pkg.dependencies) : []),
	...(pkg.devDependencies ? Object.keys(pkg.devDependencies) : []),
];

const scripts = pkg.scripts ?? {};

const pkgFiles = pkg.files ?? [];

async function main() {
	const { runSecurityPrivacyReleaseCheck } = await import(
		'../dist/security/security-release-checks.js'
	);

	const result = runSecurityPrivacyReleaseCheck({
		_dependencyNames: allDeps,
		_packageFiles: pkgFiles,
		_packageJson: pkg,
		_scripts: scripts,
		checkedAt: new Date().toISOString(),
		packageName: pkg.name ?? 'logos-engine',
		packageVersion: pkg.version ?? '0.0.0',
		profileId: 'standard',
		strict: true,
	});

	console.log('');
	console.log('=== SECURITY/PRIVACY RELEASE CHECK ===');
	console.log(`Package:  ${result.packageName} v${result.packageVersion}`);
	console.log(`Status:   ${result.status}`);
	console.log(`Findings: ${result.totalFindings}`);
	console.log(
		`  errors: ${result.countsBySeverity.error}, warnings: ${result.countsBySeverity.warning}, info: ${result.countsBySeverity.info}`,
	);
	console.log('');

	if (result.totalFindings > 0) {
		for (const finding of result.findings) {
			const prefix = `[${finding.severity.toUpperCase()}]`;
			console.log(`${prefix} ${finding.message}`);
			if (finding.recoveryHint) {
				console.log(`  Recovery: ${finding.recoveryHint}`);
			}
		}
		console.log('');
	}

	console.log('Next actions:');
	for (const action of result.recommendedNextActions) {
		console.log(`  - ${action}`);
	}
	console.log('');

	if (result.status === 'blocked') {
		process.exit(1);
	}
}

main().catch((err) => {
	console.error('Security check failed:', err.message);
	process.exit(1);
});
