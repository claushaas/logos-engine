#!/usr/bin/env node
/**
 * NFR Evidence Script
 *
 * Phase 8: NFR Evidence And Release Hardening
 *
 * Runs the deterministic NFR evidence runner and prints a concise summary.
 * Non-mutating, provider-free, network-free.
 *
 * Usage:
 *   node scripts/nfr-evidence.js
 *   node scripts/nfr-evidence.js --json
 *   node scripts/nfr-evidence.js --category performance
 *
 * Exit codes:
 *   0 — pass or pass_with_warnings
 *   1 — fail or blocked
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

// Parse args
const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const categoryIndex = args.indexOf('--category');
const _categoryFilter =
	categoryIndex >= 0 ? args[categoryIndex + 1] : undefined;

async function main() {
	const { runNfrEvidence } = await import('../dist/evidence/index.js');

	// Read package.json for metadata
	let pkgName = 'logos-engine';
	let pkgVersion = '0.1.0';
	/** @type {Record<string, string>} */
	let pkgScripts = {};
	try {
		const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
		pkgName = pkg.name ?? pkgName;
		pkgVersion = pkg.version ?? pkgVersion;
		pkgScripts = pkg.scripts ?? {};
	} catch {
		// Use defaults
	}

	const result = runNfrEvidence({
		_injectPackageJson: {
			name: pkgName,
			scripts: pkgScripts,
			version: pkgVersion,
		},
		_injectScripts: pkgScripts,
		json: jsonMode,
		packageName: pkgName,
		packageVersion: pkgVersion,
	});

	if (jsonMode) {
		console.log(JSON.stringify(result, null, 2));
	} else {
		console.log('');
		console.log('=== NFR EVIDENCE REPORT ===');
		console.log(`Package:  ${result.packageName} v${result.packageVersion}`);
		console.log(`Status:   ${result.status.toUpperCase()}`);
		console.log(`Items:    ${result.items.length}`);
		console.log('');

		for (const line of result.summaryLines) {
			console.log(line);
		}

		console.log('');
		console.log('--- By Category ---');
		for (const [cat, count] of Object.entries(result.countsByCategory)) {
			if (count > 0) {
				console.log(`  ${cat}: ${count} item(s)`);
			}
		}

		console.log('');
		console.log('--- Items ---');
		for (const item of result.items) {
			const statusMarker =
				item.status === 'pass'
					? 'PASS'
					: item.status === 'pass_with_warnings'
						? 'WARN'
						: item.status === 'fail'
							? 'FAIL'
							: item.status === 'blocked'
								? 'BLOCK'
								: item.status === 'manual'
									? 'MANL'
									: item.status === 'skipped'
										? 'SKIP'
										: 'UNKN';
			console.log(`  [${statusMarker}] ${item.id}: ${item.title}`);
			if (item.diagnostics.length > 0) {
				for (const d of item.diagnostics) {
					console.log(
						`    [${d.severity.toUpperCase()}] ${d.code}: ${d.message}`,
					);
				}
			}
		}

		console.log('');
		console.log('--- Next Actions ---');
		for (const action of result.nextActions) {
			console.log(`  - ${action}`);
		}

		console.log('');
		console.log('--- Limitations ---');
		for (const limitation of result.limitations) {
			console.log(`  - ${limitation}`);
		}
	}

	// Exit non-zero on fail/blocked
	if (result.status === 'fail' || result.status === 'blocked') {
		process.exitCode = 1;
	}
}

main().catch((err) => {
	console.error('NFR evidence script failed:', err);
	process.exit(2);
});
