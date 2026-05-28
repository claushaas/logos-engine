#!/usr/bin/env node
import { Command } from 'commander';
import { render } from 'ink';
import type { ReactNode } from 'react';
/**
 * CLI entry point for the LOGOS Engine.
 *
 * Parses command-line arguments, resolves environment variables,
 * creates the application runtime, and mounts the TUI.
 *
 * Usage:
 *   logos                          # Start in idle mode
 *   logos --mock                   # Use mock LLM provider
 *   logos --profile startup        # Pre-select a profile
 *   logos --session <id>           # Resume a previous session
 *   logos --data-dir <path>        # Set persistence directory
 *   logos --help                   # Print usage
 *
 * Environment variables:
 *   LOGOS_USE_MOCK_LLM=true        # Use mock provider
 *   LOGOS_DATA_DIR=<path>          # Set persistence directory
 *   LOGOS_PROFILE_DIR=<path>        # Set profile directory
 *
 * @see {@link https://logos-engine/docs/architecture/10-local-development-and-deployment.md}
 */
import { createElement } from 'react';
import {
	createApplicationRuntime,
	type RuntimeEvent,
} from '../application/runtime.js';
import type { ProfileId, SessionId } from '../shared/index.js';
import {
	AppShell,
	TuiApplicationProvider,
	type TuiDispatchEvent,
} from '../tui/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// CLI definition
// ═══════════════════════════════════════════════════════════════════════════

const program = new Command();

program
	.name('logos')
	.description('LOGOS Engine — conversation-first documentation engine')
	.version('0.1.0')
	.option('--profile <id>', 'Pre-select a profile on startup')
	.option('--session <id>', 'Resume a previous session')
	.option('--mock', 'Use mock LLM provider (no API key needed)')
	.option('--data-dir <path>', 'Set persistence directory (default: sessions)')
	.option('--help-profile', 'Show profile-related options and exit');

program.parse(process.argv);

const opts = program.opts<{
	profile?: string;
	session?: string;
	mock?: boolean;
	dataDir?: string;
	helpProfile?: boolean;
}>();

// ── Early-exit commands ─────────────────────────────────────────────

if (opts.helpProfile) {
	console.log('Profile options:');
	console.log('  logos --profile startup    Pre-select the startup profile');
	console.log('  logos --profile app        Pre-select the app profile');
	console.log('');
	console.log('Environment variables:');
	console.log('  LOGOS_PROFILE_DIR          Directory to scan for profiles');
	console.log('                             (default: profiles/)');
	process.exit(0);
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
	// Commander prints help automatically; just exit.
	process.exit(0);
}

// ═══════════════════════════════════════════════════════════════════════
// Environment variable resolution
// ═══════════════════════════════════════════════════════════════════════

const useMockLlm =
	opts.mock === true || process.env.LOGOS_USE_MOCK_LLM === 'true';

const dataDir = opts.dataDir ?? process.env.LOGOS_DATA_DIR ?? 'sessions';

const profileDir = process.env.LOGOS_PROFILE_DIR ?? undefined;

// ═══════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
	// ── Create the application runtime ────────────────────────────────
	// Only include optional fields that are actually defined
	// (exactOptionalPropertyTypes compatibility).
	const runtimeOpts: {
		dataDir: string;
		profileDir?: string;
		profileId?: ProfileId;
		sessionId?: SessionId;
		useMockLlm: boolean;
	} = {
		dataDir,
		useMockLlm,
	};
	if (profileDir !== undefined) runtimeOpts.profileDir = profileDir;
	if (opts.profile !== undefined)
		runtimeOpts.profileId = opts.profile as ProfileId;
	if (opts.session !== undefined)
		runtimeOpts.sessionId = opts.session as SessionId;

	const runtime = await createApplicationRuntime(runtimeOpts);

	// ── Build TUI element tree ────────────────────────────────────────

	function buildElement(
		snapshot: ReturnType<typeof runtime.getSnapshot>,
		dispatch: typeof handleTuiDispatch,
	): ReactNode {
		return createElement(TuiApplicationProvider, {
			// biome-ignore lint/correctness/noChildrenProp: TuiApplicationProviderProps requires children in props
			children: createElement(AppShell),
			dispatch,
			snapshot,
		});
	}

	// ── Mount the TUI ─────────────────────────────────────────────────

	const { rerender, waitUntilExit } = render(
		buildElement(runtime.getSnapshot(), handleTuiDispatch),
		{
			exitOnCtrlC: false, // We handle signals via the runtime.
			patchConsole: true,
		},
	);

	// ── Subscribe to runtime changes → re-render TUI ──────────────────

	const unsubscribe = runtime.subscribe((snapshot) => {
		rerender(buildElement(snapshot, handleTuiDispatch));
	});

	// ── Translate TUI events → runtime events ─────────────────────────

	/**
	 * Handles TUI dispatch events by translating them to runtime events.
	 *
	 * The TUI emits `TuiDispatchEvent`; the runtime accepts `RuntimeEvent`.
	 * This adapter performs a structural mapping — the two types are
	 * intentionally compatible.
	 */
	function handleTuiDispatch(event: TuiDispatchEvent): void {
		// Map the event to a RuntimeEvent — no field translation needed
		// since the two types are structurally identical.
		const runtimeEvent: RuntimeEvent = event as unknown as RuntimeEvent;
		runtime.dispatch(runtimeEvent).catch((err: unknown) => {
			console.error('[logos] Runtime dispatch failed:', err);
		});
	}

	// ── Wait for Ink to exit ──────────────────────────────────────────
	try {
		await waitUntilExit();
	} catch {
		// Ink may reject on unexpected exit — ignore.
	}

	// ── Cleanup ───────────────────────────────────────────────────────
	unsubscribe();
	await runtime.save();
	runtime.dispose();
}

main().catch((err) => {
	console.error('[logos] Fatal error:', err);
	process.exit(1);
});
