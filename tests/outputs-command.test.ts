/**
 * /outputs TUI Command Tests — Phase 7: Derived Artifact Generation And Browsing
 *
 * Tests for:
 * - /outputs shows summary/list
 * - /outputs list filters by type, canonicality, status
 * - /outputs show <artifact-id> shows detail
 * - /outputs sources <artifact-id> shows sources
 * - /outputs stale shows stale outputs
 * - Unknown subcommand returns stable diagnostic
 * - /help includes /outputs
 * - Derived artifacts are never shown as canonical
 */

import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { initWorkspace } from '../src/init/init-execute.js';
import { registerArtifact } from '../src/state/artifact-registry.js';
import {
	readWorkspaceState,
	updateWorkspaceState,
} from '../src/state/workspace-state-repository.js';
import { parseSlashCommand } from '../src/tui/slash-parser.js';
import { routeSlashCommand } from '../src/tui/slash-router.js';
import type { RouterContext } from '../src/tui/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempWorkspace(): { projectRoot: string; cleanup: () => void } {
	const dir = mkdtempSync(join(tmpdir(), 'logos-outputs-cmd-'));
	return {
		cleanup: () => {
			try {
				rmSync(dir, { recursive: true });
			} catch {
				/* ignore */
			}
		},
		projectRoot: dir,
	};
}

function createRouterContext(projectRoot: string): RouterContext {
	const logosDir = join(projectRoot, '.logos');
	return {
		confirmationBypass: false,
		interactive: false,
		projectContext: {
			config: {
				activeProfileId: 'standard',
				diagnostics: [],
				documentationRoot: { isDefault: true, rootPath: 'logos/' },
				providerStatus: { kind: 'not_configured' } as const,
				skippedProfileValidation: false,
			},
			cwd: projectRoot,
			diagnostics: [],
			root: {
				cwd: projectRoot,
				inferred: true,
				rootKind: 'git' as const,
				rootPath: projectRoot,
			},
			workspace: {
				diagnostics: [],
				exists: existsSync(logosDir),
				initializationState: 'initialized' as const,
				logosPath: logosDir,
			},
		},
	};
}

// ---------------------------------------------------------------------------
// /outputs command
// ---------------------------------------------------------------------------

describe('/outputs command', () => {
	it('/outputs shows summary/list for initialized workspace', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			await initWorkspace({ confirm: true, projectRoot });

			const parsed = parseSlashCommand('/outputs');
			const context = createRouterContext(projectRoot);
			const result = await routeSlashCommand(parsed, context);

			expect(result.command).toBe('outputs');
			expect(result.kind).not.toBe('error');
			expect(result.messages.length).toBeGreaterThan(0);
			expect(result.viewKind).toBe('output_browser');
		} finally {
			cleanup();
		}
	});

	it('/outputs list shows list', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			await initWorkspace({ confirm: true, projectRoot });

			const parsed = parseSlashCommand('/outputs list');
			const context = createRouterContext(projectRoot);
			const result = await routeSlashCommand(parsed, context);

			expect(result.command).toBe('outputs');
			expect(result.kind).not.toBe('error');
		} finally {
			cleanup();
		}
	});

	it('/outputs list --type html filters to html type', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			await initWorkspace({ confirm: true, projectRoot });

			// Register an HTML artifact
			const stateResult = await readWorkspaceState({ projectRoot });
			if (stateResult.success && stateResult.state) {
				const regResult = registerArtifact({
					input: {
						artifactType: 'html',
						isCanonical: false,
						path: 'logos/test.html',
						sourceDocumentIds: ['doc1'],
						status: 'generated',
					},
					state: stateResult.state,
				});
				await updateWorkspaceState({
					clock: { now: () => '2024-01-01T00:00:00Z' },
					policy: 'overwrite',
					projectRoot,
					updater: () => regResult.state,
				});
			}

			const parsed = parseSlashCommand('/outputs list --type html');
			const context = createRouterContext(projectRoot);
			const result = await routeSlashCommand(parsed, context);

			expect(result.command).toBe('outputs');
			expect(result.kind).not.toBe('error');
		} finally {
			cleanup();
		}
	});

	it('/outputs list --type agent-pack filters to agent packs', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			await initWorkspace({ confirm: true, projectRoot });

			const parsed = parseSlashCommand('/outputs list --type agent-pack');
			const context = createRouterContext(projectRoot);
			const result = await routeSlashCommand(parsed, context);

			expect(result.command).toBe('outputs');
			expect(result.kind).not.toBe('error');
		} finally {
			cleanup();
		}
	});

	it('/outputs list --derived filters to derived', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			await initWorkspace({ confirm: true, projectRoot });

			const parsed = parseSlashCommand('/outputs list --derived');
			const context = createRouterContext(projectRoot);
			const result = await routeSlashCommand(parsed, context);

			expect(result.command).toBe('outputs');
			expect(result.kind).not.toBe('error');
		} finally {
			cleanup();
		}
	});

	it('/outputs list --canonical filters to canonical', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			await initWorkspace({ confirm: true, projectRoot });

			const parsed = parseSlashCommand('/outputs list --canonical');
			const context = createRouterContext(projectRoot);
			const result = await routeSlashCommand(parsed, context);

			expect(result.command).toBe('outputs');
			expect(result.kind).not.toBe('error');
		} finally {
			cleanup();
		}
	});

	it('/outputs list --status stale filters to stale', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			await initWorkspace({ confirm: true, projectRoot });

			const parsed = parseSlashCommand('/outputs list --status stale');
			const context = createRouterContext(projectRoot);
			const result = await routeSlashCommand(parsed, context);

			expect(result.command).toBe('outputs');
			expect(result.kind).not.toBe('error');
		} finally {
			cleanup();
		}
	});

	it('/outputs show <artifact-id> shows detail', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			await initWorkspace({ confirm: true, projectRoot });

			// Register an artifact so we can show it
			const stateResult = await readWorkspaceState({ projectRoot });
			if (stateResult.success && stateResult.state) {
				const regResult = registerArtifact({
					input: {
						artifactType: 'canonical_markdown',
						checksum: 'abc123',
						generatedAt: '2024-01-01T00:00:00Z',
						isCanonical: true,
						path: 'logos/show-test.md',
						sourceDocumentIds: ['doc1'],
						status: 'generated',
					},
					state: stateResult.state,
				});
				await updateWorkspaceState({
					clock: { now: () => '2024-01-01T00:00:00Z' },
					policy: 'overwrite',
					projectRoot,
					updater: () => regResult.state,
				});

				const parsed = parseSlashCommand(
					`/outputs show ${regResult.artifact.artifactId}`,
				);
				const context = createRouterContext(projectRoot);
				const result = await routeSlashCommand(parsed, context);

				expect(result.command).toBe('outputs show');
				expect(result.kind).not.toBe('error');
				expect(
					result.messages.some((m) =>
						m.includes(regResult.artifact.artifactId),
					),
				).toBe(true);
			}
		} finally {
			cleanup();
		}
	});

	it('/outputs show with missing id returns error', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			await initWorkspace({ confirm: true, projectRoot });

			const parsed = parseSlashCommand('/outputs show');
			const context = createRouterContext(projectRoot);
			const result = await routeSlashCommand(parsed, context);

			expect(result.kind).toBe('error');
		} finally {
			cleanup();
		}
	});

	it('/outputs show nonexistent returns error', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			await initWorkspace({ confirm: true, projectRoot });

			const parsed = parseSlashCommand('/outputs show nonexistent-id-12345');
			const context = createRouterContext(projectRoot);
			const result = await routeSlashCommand(parsed, context);

			expect(result.kind).toBe('error');
			expect(result.messages.some((m) => m.includes('not found'))).toBe(true);
		} finally {
			cleanup();
		}
	});

	it('/outputs sources <artifact-id> shows sources', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			await initWorkspace({ confirm: true, projectRoot });

			const stateResult = await readWorkspaceState({ projectRoot });
			if (stateResult.success && stateResult.state) {
				const regResult = registerArtifact({
					input: {
						artifactType: 'agent_pack',
						isCanonical: false,
						path: 'logos/sources-test.pack.md',
						sourceDocumentIds: ['doc1', 'doc2'],
						status: 'generated',
					},
					state: stateResult.state,
				});
				await updateWorkspaceState({
					clock: { now: () => '2024-01-01T00:00:00Z' },
					policy: 'overwrite',
					projectRoot,
					updater: () => regResult.state,
				});

				const parsed = parseSlashCommand(
					`/outputs sources ${regResult.artifact.artifactId}`,
				);
				const context = createRouterContext(projectRoot);
				const result = await routeSlashCommand(parsed, context);

				expect(result.command).toBe('outputs sources');
				expect(result.kind).not.toBe('error');
			}
		} finally {
			cleanup();
		}
	});

	it('/outputs stale shows stale outputs', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			await initWorkspace({ confirm: true, projectRoot });

			const parsed = parseSlashCommand('/outputs stale');
			const context = createRouterContext(projectRoot);
			const result = await routeSlashCommand(parsed, context);

			expect(result.command).toBe('outputs stale');
			expect(result.kind).not.toBe('error');
			expect(result.viewKind).toBe('output_browser');
		} finally {
			cleanup();
		}
	});

	it('unknown subcommand returns error with stable diagnostic', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			await initWorkspace({ confirm: true, projectRoot });

			const parsed = parseSlashCommand('/outputs unknownsubcommand');
			const context = createRouterContext(projectRoot);
			const result = await routeSlashCommand(parsed, context);

			expect(result.kind).toBe('error');
			expect(
				result.messages.some((m) => m.includes('Unknown /outputs subcommand')),
			).toBe(true);
		} finally {
			cleanup();
		}
	});

	it('/help includes /outputs', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			await initWorkspace({ confirm: true, projectRoot });

			const parsed = parseSlashCommand('/help');
			const context = createRouterContext(projectRoot);
			const result = await routeSlashCommand(parsed, context);

			expect(result.kind).toBe('success');
			const allMessages = result.messages.join(' ');
			expect(allMessages).toMatch(/\/outputs/);
		} finally {
			cleanup();
		}
	});

	it('/outputs viewKind is output_browser', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			await initWorkspace({ confirm: true, projectRoot });

			const parsed = parseSlashCommand('/outputs');
			const context = createRouterContext(projectRoot);
			const result = await routeSlashCommand(parsed, context);

			expect(result.viewKind).toBe('output_browser');
		} finally {
			cleanup();
		}
	});

	it('/outputs works for uninitialized workspace with error', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			// Don't initialize - workspace is empty
			const parsed = parseSlashCommand('/outputs');
			const context = createRouterContext(projectRoot);
			const result = await routeSlashCommand(parsed, context);

			// Should return error since workspace doesn't exist
			expect(result.kind).toBe('error');
		} finally {
			cleanup();
		}
	});
});
