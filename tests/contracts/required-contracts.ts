/**
 * Step 11.3 — Required Contract Manifest.
 *
 * Test-only manifest. Maps every MVP-critical behavioral contract to
 * existing or required test files.
 *
 * This manifest is consumed by:
 * - `required-contract-matrix.test.ts` (structural validation)
 * - `contract-matrix-coverage.test.ts` (coverage completeness)
 *
 * Boundary: must not import from production code. This is a
 * declarative manifest used by Vitest tests at build/run time.
 *
 * Status: every entry is "required" — the matrix test fails when a
 * referenced test file is missing.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Contract area label. */
export type RequiredContractArea =
	| 'core'
	| 'profile'
	| 'intake'
	| 'generation'
	| 'pi-extension'
	| 'rendering'
	| 'legacy-containment'
	| 'package-gates'
	| 'e2e';

/**
 * A single required contract entry.
 *
 * - `id`: stable, dot-delimited identifier (`<area>.<name>`).
 * - `area`: anchor category.
 * - `description`: human-readable one-liner.
 * - `requiredTestFiles`: at least one test file that proves this contract.
 * - `requiredSourceFiles`: optional — public contract source files.
 * - `requiredScriptNames`: optional — package.json script names that
 *   gate this contract.
 * - `status`: always `"required"` for MVP contracts.
 */
export interface RequiredContract {
	readonly id: string;
	readonly area: RequiredContractArea;
	readonly description: string;
	readonly requiredTestFiles: readonly string[];
	readonly requiredSourceFiles?: readonly string[];
	readonly requiredScriptNames?: readonly string[];
	readonly status: 'required';
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

export const REQUIRED_CONTRACTS: readonly RequiredContract[] = [
	// ===================================================================
	// Core public API contracts
	// ===================================================================
	{
		area: 'core',
		description:
			'Core exposes all public lifecycle APIs (init, start, handle message, handle command, stop, status, generate).',
		id: 'core.public-api',
		requiredSourceFiles: ['src/core/api.ts'],
		requiredTestFiles: ['tests/core/public-api.test.ts'],
		status: 'required',
	},
	{
		area: 'core',
		description:
			'Core result envelopes are serializable, structured, and renderer-agnostic.',
		id: 'core.result-contracts',
		requiredSourceFiles: ['src/core/result.ts'],
		requiredTestFiles: ['tests/core/result-contracts.test.ts'],
		status: 'required',
	},
	{
		area: 'core',
		description:
			'Core imports zero Pi, CLI, TUI, Ink, React, or Commander dependencies.',
		id: 'core.boundary-no-pi-cli-tui',
		requiredTestFiles: ['tests/core/core-boundary.test.ts'],
		status: 'required',
	},
	{
		area: 'core',
		description:
			'Core state ports (filesystem, state repository) are defined and testable with fakes.',
		id: 'core.state-ports',
		requiredSourceFiles: [
			'src/core/ports/filesystem.ts',
			'src/core/ports/state-repository.ts',
		],
		requiredTestFiles: ['tests/core/state-ports.test.ts'],
		status: 'required',
	},
	{
		area: 'core',
		description:
			'Path-containment validation rejects writes outside the project root.',
		id: 'core.path-safety',
		requiredSourceFiles: ['src/core/fs/path-safety.ts'],
		requiredTestFiles: ['tests/core/path-safety.test.ts'],
		status: 'required',
	},

	// ===================================================================
	// Profile contracts
	// ===================================================================
	{
		area: 'profile',
		description:
			'Active profile id is persisted in .logos/config.yml and defaults to standard.',
		id: 'profile.config-active-profile',
		requiredSourceFiles: ['src/core/config/config-schema.ts'],
		requiredTestFiles: [
			'tests/core/config-schema.test.ts',
			'tests/core/init-project-profile.test.ts',
		],
		status: 'required',
	},
	{
		area: 'profile',
		description:
			'Profile resolution maps activeProfileId to profiles/<profile-id>/ generically.',
		id: 'profile.generic-resolution',
		requiredSourceFiles: ['src/core/profiles/profile-resolver.ts'],
		requiredTestFiles: ['tests/core/profile-resolution.test.ts'],
		status: 'required',
	},
	{
		area: 'profile',
		description:
			'Profile contracts (questions, docs, executive) load through the resolver.',
		id: 'profile.contract-loading',
		requiredSourceFiles: ['src/core/profiles/load-profile-contracts.ts'],
		requiredTestFiles: [
			'tests/core/profile-contract-loading.test.ts',
			'tests/core/profile-driven-questions.test.ts',
		],
		status: 'required',
	},
	{
		area: 'profile',
		description:
			'Missing / invalid profile blocks init, start, generate, and status reports the blocker.',
		id: 'profile.missing-profile-blockers',
		requiredTestFiles: [
			'tests/core/missing-profile-blocks-init.test.ts',
			'tests/core/missing-profile-blocks-intake.test.ts',
			'tests/core/missing-profile-blocks-generation.test.ts',
		],
		status: 'required',
	},

	// ===================================================================
	// Intake contracts
	// ===================================================================
	{
		area: 'intake',
		description: 'Intake state persists after every state-changing operation.',
		id: 'intake.state-persistence',
		requiredSourceFiles: ['src/core/state/intake-state-persistence.ts'],
		requiredTestFiles: ['tests/core/intake-state-persistence.test.ts'],
		status: 'required',
	},
	{
		area: 'intake',
		description:
			'/logos-start immediately emits the next unresolved question or unresolved follow-up.',
		id: 'intake.start-asks-first',
		requiredTestFiles: ['tests/core/start-intake.test.ts'],
		status: 'required',
	},
	{
		area: 'intake',
		description:
			'/logos-stop preserves active question; resume restores it without advancing.',
		id: 'intake.stop-resume',
		requiredTestFiles: ['tests/core/stop-resume-intake.test.ts'],
		status: 'required',
	},
	{
		area: 'intake',
		description:
			'A sufficient natural-language answer advances to the next question without any command.',
		id: 'intake.sufficient-answer-advances',
		requiredTestFiles: [
			'tests/core/sufficient-answer-advances.test.ts',
			'tests/core/no-command-needed-to-advance.test.ts',
		],
		status: 'required',
	},
	{
		area: 'intake',
		description:
			'A partial answer triggers a targeted follow-up without advancing the question.',
		id: 'intake.partial-answer-follow-up',
		requiredTestFiles: ['tests/core/partial-answer-follow-up.test.ts'],
		status: 'required',
	},
	{
		area: 'intake',
		description:
			'A contradictory answer asks for user resolution rather than choosing silently.',
		id: 'intake.contradiction-resolution',
		requiredTestFiles: ['tests/core/contradictory-answer-resolution.test.ts'],
		status: 'required',
	},
	{
		area: 'intake',
		description:
			'Clarification and out-of-scope intents are routed without advancing the question.',
		id: 'intake.clarification-out-of-scope',
		requiredTestFiles: [
			'tests/core/intake-clarification-intent.test.ts',
			'tests/core/intake-out-of-scope-intent.test.ts',
		],
		status: 'required',
	},
	{
		area: 'intake',
		description:
			'Slash-command text is never passed to answer evaluation during active intake.',
		id: 'intake.command-text-not-answer',
		requiredTestFiles: [
			'tests/core/command-text-not-answer.test.ts',
			'tests/core/lifecycle-command-not-evaluated.test.ts',
		],
		status: 'required',
	},
	{
		area: 'intake',
		description:
			'Lifecycle commands during active intake call Core interruption policy with safe pause/block/confirm.',
		id: 'intake.lifecycle-command-interruption',
		requiredTestFiles: [
			'tests/core/handle-intake-command.test.ts',
			'tests/core/status-during-active-intake.test.ts',
			'tests/core/start-during-active-intake.test.ts',
			'tests/core/init-during-active-intake.test.ts',
			'tests/core/generate-during-active-intake.test.ts',
		],
		status: 'required',
	},
	{
		area: 'intake',
		description:
			'Forbidden command-first commands are not recognised as lifecycle commands.',
		id: 'intake.forbidden-commands',
		requiredSourceFiles: ['src/core/intake/lifecycle-command.ts'],
		requiredTestFiles: ['tests/core/forbidden-lifecycle-commands.test.ts'],
		status: 'required',
	},

	// ===================================================================
	// Generation contracts
	// ===================================================================
	{
		area: 'generation',
		description:
			'Completeness is calculated by phase and is available to preflight.',
		id: 'generation.completeness',
		requiredSourceFiles: ['src/core/generation/completeness.ts'],
		requiredTestFiles: ['tests/core/completeness-calculation.test.ts'],
		status: 'required',
	},
	{
		area: 'generation',
		description:
			'Generation preflight checks completeness, missing critical questions, and profile validity.',
		id: 'generation.preflight',
		requiredSourceFiles: ['src/core/generation/preflight.ts'],
		requiredTestFiles: ['tests/core/generation-preflight.test.ts'],
		status: 'required',
	},
	{
		area: 'generation',
		description:
			'Generation produces a write-plan with path-containment checks before writing files.',
		id: 'generation.safe-write-plan',
		requiredSourceFiles: ['src/core/generation/write-plan.ts'],
		requiredTestFiles: ['tests/core/generation-write-plan.test.ts'],
		status: 'required',
	},
	{
		area: 'generation',
		description:
			'Generated output paths are validated for containment within the project root.',
		id: 'generation.path-safety',
		requiredTestFiles: ['tests/core/generated-output-path-safety.test.ts'],
		status: 'required',
	},
	{
		area: 'generation',
		description:
			'Partial generation requires explicit confirmation and marks output as incomplete.',
		id: 'generation.partial-confirmation-boundary',
		requiredTestFiles: ['tests/core/partial-generation-confirmation.test.ts'],
		status: 'required',
	},
	{
		area: 'generation',
		description:
			'Final generation is blocked when critical intake is incomplete or contradictions remain.',
		id: 'generation.no-final-bypass',
		requiredTestFiles: ['tests/core/final-generation-blockers.test.ts'],
		status: 'required',
	},
	{
		area: 'generation',
		description:
			'Derived artifacts are marked as non-canonical; generated output is reproducible.',
		id: 'generation.output-authority',
		requiredTestFiles: [
			'tests/pi-extension/render-derived-artifacts-non-canonical.test.ts',
		],
		status: 'required',
	},

	// ===================================================================
	// Pi extension contracts
	// ===================================================================
	{
		area: 'pi-extension',
		description:
			'The Pi extension factory exports a callable default that registers commands and input handlers.',
		id: 'pi.entrypoint',
		requiredSourceFiles: ['src/pi-extension/index.ts'],
		requiredTestFiles: ['tests/pi-extension/extension-entrypoint.test.ts'],
		status: 'required',
	},
	{
		area: 'pi-extension',
		description:
			'Exactly the five allowed LOGOS lifecycle commands are registered with Pi.',
		id: 'pi.allowed-command-registration',
		requiredTestFiles: ['tests/pi-extension/command-registration.test.ts'],
		status: 'required',
	},
	{
		area: 'pi-extension',
		description: 'Forbidden command-first commands are not registered with Pi.',
		id: 'pi.forbidden-command-absence',
		requiredTestFiles: [
			'tests/pi-extension/forbidden-commands-not-registered.test.ts',
		],
		status: 'required',
	},
	{
		area: 'pi-extension',
		description:
			'Pi command adapters call Core APIs and do not implement product logic inline.',
		id: 'pi.command-adapter-core-first',
		requiredSourceFiles: [
			'src/pi-extension/commands/lifecycle-command-adapter.ts',
		],
		requiredTestFiles: [
			'tests/pi-extension/command-adapters-call-core.test.ts',
			'tests/pi-extension/command-handler-thinness.test.ts',
		],
		status: 'required',
	},
	{
		area: 'pi-extension',
		description:
			'When intake is active, user input is routed to Core.handleIntakeMessage.',
		id: 'pi.input-routing-active',
		requiredTestFiles: ['tests/pi-extension/input-routing-active.test.ts'],
		status: 'required',
	},
	{
		area: 'pi-extension',
		description:
			'When intake is not active, user input is ignored by the LOGOS input handler.',
		id: 'pi.input-routing-inactive',
		requiredTestFiles: ['tests/pi-extension/input-routing-inactive.test.ts'],
		status: 'required',
	},
	{
		area: 'pi-extension',
		description:
			'Slash commands are routed as control intents, never as conversation answers.',
		id: 'pi.input-routing-slash-safety',
		requiredTestFiles: [
			'tests/pi-extension/input-routing-slash-command.test.ts',
		],
		status: 'required',
	},
	{
		area: 'pi-extension',
		description:
			'/logos-start immediately emits an assistant message through Core.startIntake.',
		id: 'pi.logos-start-asks-first',
		requiredTestFiles: ['tests/pi-extension/logos-start-asks-first.test.ts'],
		status: 'required',
	},
	{
		area: 'pi-extension',
		description:
			'When Core requests partial generation confirmation, the Pi extension renders blockers and waits for user confirmation.',
		id: 'pi.partial-generation-confirmation-ui',
		requiredTestFiles: [
			'tests/pi-extension/partial-generation-confirmation-ui.test.ts',
			'tests/pi-extension/partial-generation-confirmed-calls-core.test.ts',
		],
		status: 'required',
	},

	// ===================================================================
	// Rendering contracts
	// ===================================================================
	{
		area: 'rendering',
		description:
			'Core message kinds (question, follow-up, contradiction, clarification) are rendered distinctly.',
		id: 'rendering.core-message-kinds',
		requiredTestFiles: [
			'tests/pi-extension/render-question.test.ts',
			'tests/pi-extension/render-follow-up.test.ts',
			'tests/pi-extension/render-contradiction.test.ts',
			'tests/pi-extension/render-clarification.test.ts',
		],
		status: 'required',
	},
	{
		area: 'rendering',
		description:
			'Status blockers (missing profile, incomplete intake) are rendered clearly.',
		id: 'rendering.status-blockers',
		requiredTestFiles: ['tests/pi-extension/render-status.test.ts'],
		status: 'required',
	},
	{
		area: 'rendering',
		description:
			'Generation blockers (completeness, contradictions, missing critical) are rendered as distinct warnings.',
		id: 'rendering.generation-blockers',
		requiredTestFiles: [
			'tests/pi-extension/render-generation-blockers.test.ts',
		],
		status: 'required',
	},
	{
		area: 'rendering',
		description:
			'Generated output paths and provenance are included in the generation result rendering.',
		id: 'rendering.generated-paths-provenance',
		requiredTestFiles: [
			'tests/pi-extension/render-generated-output-paths.test.ts',
			'tests/pi-extension/render-generation-provenance.test.ts',
		],
		status: 'required',
	},
	{
		area: 'rendering',
		description:
			'Pi extension renderers (thinness tests) contain no product logic, algorithm, or state mutation.',
		id: 'rendering.no-product-logic',
		requiredTestFiles: ['tests/pi-extension/pi-adapter-thinness.test.ts'],
		status: 'required',
	},

	// ===================================================================
	// Legacy containment contracts
	// ===================================================================
	{
		area: 'legacy-containment',
		description:
			'The logos binary is absent; src/cli/ directory does not exist; package description is Pi-extension-first.',
		id: 'legacy.cli-binary-deferred-or-safe',
		requiredTestFiles: ['tests/package/cli-binary-strategy.test.ts'],
		status: 'required',
	},
	{
		area: 'legacy-containment',
		description:
			'src/tui/ does not exist; Core and Pi extension do not import Ink, React, or TUI.',
		id: 'legacy.tui-isolated',
		requiredTestFiles: [
			'tests/tui/tui-isolation.test.ts',
			'tests/package/tui-dependency-strategy.test.ts',
		],
		status: 'required',
	},
	{
		area: 'legacy-containment',
		description:
			'No CLI source registers forbidden command-first intake commands.',
		id: 'legacy.forbidden-cli-commands',
		requiredTestFiles: ['tests/cli/forbidden-cli-commands.test.ts'],
		status: 'required',
	},
	{
		area: 'legacy-containment',
		description:
			'No TUI source registers forbidden command-first intake commands.',
		id: 'legacy.forbidden-tui-commands',
		requiredTestFiles: ['tests/tui/forbidden-tui-commands.test.ts'],
		status: 'required',
	},
	{
		area: 'legacy-containment',
		description:
			'package.json scripts, bin, and metadata do not expose forbidden command-first workflows.',
		id: 'legacy.package-forbidden-command-surface',
		requiredTestFiles: ['tests/package/forbidden-command-surface.test.ts'],
		status: 'required',
	},

	// ===================================================================
	// Package gates contracts
	// ===================================================================
	{
		area: 'package-gates',
		description:
			'Every package script that references a script file or test file points to an existing file.',
		id: 'package.script-gates-exist',
		requiredScriptNames: ['test', 'check:validation', 'smoke:package'],
		requiredTestFiles: ['tests/package/script-gates-exist.test.ts'],
		status: 'required',
	},
	{
		area: 'package-gates',
		description:
			'Script files (smoke, security, nfr) do not import forbidden packages, network, or credentials.',
		id: 'package.script-gates-contract',
		requiredTestFiles: ['tests/package/script-gates-contract.test.ts'],
		status: 'required',
	},
	{
		area: 'package-gates',
		description:
			'No package script references stale CLI smoke scripts or missing validation gates.',
		id: 'package.no-stale-script-references',
		requiredTestFiles: ['tests/package/no-stale-script-references.test.ts'],
		status: 'required',
	},
	{
		area: 'package-gates',
		description:
			'validation-gate.test.ts checks entrypoints, boundary tests, CLI/TUI strategy, forbidden commands, and required docs.',
		id: 'package.validation-gate',
		requiredScriptNames: ['check:validation'],
		requiredTestFiles: ['tests/validation-gate.test.ts'],
		status: 'required',
	},

	// ===================================================================
	// E2E contracts
	// ===================================================================
	{
		area: 'e2e',
		description:
			'Core E2E scenario runs init, start, answer advancement, status, dry-run generation, stop/resume — all without Pi.',
		id: 'e2e.core-lifecycle',
		requiredTestFiles: ['tests/core/core-e2e-scenario.test.ts'],
		status: 'required',
	},
	{
		area: 'e2e',
		description:
			'Pi extension loads via fake Pi host, registers commands, input handlers, and renderers without calling Core product APIs.',
		id: 'e2e.pi-extension-harness',
		requiredTestFiles: ['tests/pi-extension/pi-extension-e2e-harness.test.ts'],
		status: 'required',
	},
	{
		area: 'e2e',
		description:
			'Pi extension E2E conversation scenario proves init, start, natural intake advancement, follow-up, slash safety, and status.',
		id: 'e2e.pi-conversation',
		requiredTestFiles: [
			'tests/pi-extension/pi-extension-e2e-conversation.test.ts',
		],
		status: 'required',
	},
	{
		area: 'e2e',
		description:
			'Pi extension E2E generation scenario proves preflight, partial confirmation (accept/decline), and final generation flows.',
		id: 'e2e.pi-generation',
		requiredTestFiles: [
			'tests/pi-extension/pi-extension-e2e-generation.test.ts',
		],
		status: 'required',
	},
];

// ---------------------------------------------------------------------------
// Contract area coverage verification
// ---------------------------------------------------------------------------

/** Every area MUST have at least one contract. */
export const REQUIRED_AREAS: readonly RequiredContractArea[] = [
	'core',
	'profile',
	'intake',
	'generation',
	'pi-extension',
	'rendering',
	'legacy-containment',
	'package-gates',
	'e2e',
];

/**
 * Critical MVP contract ids that MUST be present in the manifest.
 *
 * If any of these go missing, the coverage test must fail because an
 * MVP-critical behavioral guarantee is unrepresented.
 */
export const CRITICAL_MVP_CONTRACT_IDS: readonly string[] = [
	'pi.logos-start-asks-first',
	'intake.sufficient-answer-advances',
	'pi.input-routing-slash-safety',
	'generation.preflight',
	'generation.partial-confirmation-boundary',
	'legacy.forbidden-cli-commands',
	'legacy.forbidden-tui-commands',
	'e2e.core-lifecycle',
	'e2e.pi-extension-harness',
];

/** Expected minimum number of required contracts. */
export const MIN_REQUIRED_CONTRACT_COUNT = 40;
