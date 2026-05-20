import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

/**
 * Documentation consistency tests for Step 13.5.
 * Non-mutating, deterministic, no network, no credentials, no workspace dependency.
 */
describe('documentation consistency', () => {
	function loadDoc(path: string): string {
		const abs = join(root, path);
		if (!existsSync(abs)) {
			throw new Error(`Missing doc file: ${path}`);
		}
		return readFileSync(abs, 'utf-8');
	}

	function loadPackageJson(): Record<string, unknown> {
		return JSON.parse(loadDoc('package.json')) as Record<string, unknown>;
	}

	describe('package.json scripts', () => {
		it('documented scripts exist in package.json', () => {
			const pkg = loadPackageJson();
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;
			const required = [
				'build',
				'test',
				'typecheck',
				'lint',
				'lint:biome',
				'lint:md',
				'smoke:cli',
				'smoke:package',
				'security:check',
				'check',
				'format',
				'check:validation',
			];
			for (const name of required) {
				expect(scripts[name], `missing script: ${name}`).toBeDefined();
				expect(typeof scripts[name], `script ${name} must be a string`).toBe(
					'string',
				);
			}
		});

		it('pnpm check is non-mutating', () => {
			const pkg = loadPackageJson();
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;
			const checkScript = scripts.check;
			expect(checkScript).toBeDefined();
			expect(checkScript).toContain('lint');
			expect(checkScript).toContain('typecheck');
			expect(checkScript).toContain('test');
			expect(checkScript).toContain('build');
			expect(checkScript).toContain('smoke:cli');
		});
	});

	describe('default profile and root', () => {
		it('READMEM references standard as the default profile', () => {
			const content = loadDoc('README.md');
			expect(content).toMatch(/standard/);
			expect(content).not.toMatch(
				/\bapp-business\b.*profile|profile.*\bapp-business\b/i,
			);
		});

		it('READM references logos/ as the default generated root', () => {
			const content = loadDoc('README.md');
			expect(content).toMatch(/logos\//);
			const docsRootClaims = [
				/default.*generated.*root.*docs\//i,
				/docs\/.*default.*root/i,
			];
			for (const pattern of docsRootClaims) {
				expect(content).not.toMatch(pattern);
			}
		});
	});

	describe('no false claims', () => {
		it('does NOT claim npm package is published', () => {
			const content = loadDoc('README.md');
			// Should not positively claim publication
			const publishedClaims = [
				/npm\s+install\s+-g\s+logos-engine/i,
				/is\s+published\s+on\s+npm/i,
				/available\s+on\s+npm/i,
				/install\s+from\s+npm/i,
			];
			for (const pattern of publishedClaims) {
				expect(content).not.toMatch(pattern);
			}
		});

		it('does NOT claim live Linear/Notion/GitHub sync', () => {
			const content = loadDoc('README.md');
			const syncClaims = [
				/live\s+linear\s+sync/i,
				/live\s+notion\s+sync/i,
				/live\s+github\s+sync/i,
				/bidirectional.*linear/i,
				/bidirectional.*notion/i,
			];
			for (const pattern of syncClaims) {
				expect(content).not.toMatch(pattern);
			}
		});

		it('does NOT claim formal security audit', () => {
			const content = loadDoc('README.md');
			// Should not positively claim an audit was performed
			expect(content).not.toMatch(
				/security\s+audit\s+(has\s+been|was)\s+(performed|completed|done)/i,
			);
			expect(content).not.toMatch(
				/penetration\s+test\s+(has\s+been|was)\s+(performed|completed|done)/i,
			);
			expect(content).not.toMatch(
				/third.party.*security.*audit.*(performed|completed|done|passed)/i,
			);
		});
	});

	describe('security/privacy documentation', () => {
		it('states no telemetry', () => {
			const readme = loadDoc('README.md');
			const security = loadDoc('SECURITY.md');
			expect(readme).toMatch(/no\s+telemetry/i);
			expect(security).toMatch(/no\s+telemetry|does not.*collect.*telemetry/i);
		});

		it('states no remote logging', () => {
			const content = loadDoc('README.md');
			expect(content).toMatch(/no.*remote\s+logging/i);
		});

		it('states no crash reporting', () => {
			const content = loadDoc('README.md');
			expect(content).toMatch(/no.*crash\s+(report|upload)/i);
		});

		it('states no external sync by default', () => {
			const content = loadDoc('README.md');
			expect(content).toMatch(/no\s+external\s+sync/i);
		});

		it('states provider credentials are opt-in', () => {
			const content = loadDoc('README.md');
			expect(content).toMatch(/opt.?in/i);
		});

		it('has no raw secret-like values in security doc', () => {
			const content = loadDoc('SECURITY.md');
			expect(content).not.toMatch(/sk-[a-zA-Z0-9]{32,}/);
			expect(content).not.toMatch(/-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/);
		});
	});

	describe('contributing documentation', () => {
		it('references non-mutating pnpm check', () => {
			const content = loadDoc('CONTRIBUTING.md');
			expect(content).toMatch(/pnpm\s+check/);
			expect(content).toMatch(/non.?mutating/i);
		});

		it('references pnpm security:check', () => {
			const content = loadDoc('CONTRIBUTING.md');
			expect(content).toMatch(/security:check/);
		});

		it('references pnpm smoke:package', () => {
			const content = loadDoc('CONTRIBUTING.md');
			expect(content).toMatch(/smoke:package/);
		});

		it('states no network or credentials required for default tests', () => {
			const content = loadDoc('CONTRIBUTING.md');
			expect(content).toMatch(/no.*network|network.*not.*required/i);
			expect(content).toMatch(/no.*credential|credential.*not.*required/i);
		});
	});

	describe('command references', () => {
		it('documents /graph command', () => {
			const content = loadDoc('README.md');
			expect(content).toMatch(/\/graph/);
		});

		it('documents /executive compile command', () => {
			const content = loadDoc('README.md');
			expect(content).toMatch(/\/executive\s+compile/);
		});

		it('documents doctor CLI command', () => {
			const content = loadDoc('README.md');
			expect(content).toMatch(/logos\s+doctor/);
		});
	});
});
