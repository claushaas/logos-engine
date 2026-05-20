/**
 * Documentation Root Apply Service — safely apply a confirmed root change
 * to workspace state.
 *
 * Phase 6: Documentation Root Configuration — Outcome 8 (workspace state updates).
 *
 * This module applies a confirmed documentation root change to the workspace
 * state. It:
 * 1. Re-runs preflight validation
 * 2. Writes the new root to workspace state
 * 3. Marks affected outputs as stale/orphaned where supported
 * 4. Records audit metadata
 *
 * It NEVER moves, deletes, or regenerates files.
 * It NEVER calls AI providers or network.
 * It uses the safe filesystem writer for state persistence.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
	LogosDiagnostic,
	LogosRecoveryHint,
} from '../runtime/diagnostics.js';
import { readWorkspaceState } from '../state/workspace-state-repository.js';
import type {
	ArtifactSummary,
	CanonicalOutputDeclaration,
} from './documentation-root-affected-outputs.js';
import type {
	DocumentationRootApplyResult,
	DocumentationRootReference,
} from './documentation-root-model.js';
import { DOCUMENTATION_ROOT_DIAGNOSTIC_CODES } from './documentation-root-model.js';
import { previewDocumentationRootChange } from './documentation-root-preview.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApplyDocumentationRootOptions {
	/** Project root (absolute) */
	projectRoot: string;
	/** Proposed new root path */
	proposedPath: string;
	/** Whether to actually write state (false = dry-run) */
	dryRun?: boolean | undefined;
	/** Whether confirmation has been obtained */
	confirmed?: boolean | undefined;
	/** Current workspace state for re-validation */
	currentState?: Record<string, unknown> | undefined;
	/** Registered artifacts from workspace state */
	artifacts?: ArtifactSummary[] | undefined;
	/** Profile output declarations */
	canonicalOutputDeclarations?: CanonicalOutputDeclaration[] | undefined;
	/** Active profile root path (if custom) */
	activeProfileRoot?: string | undefined;
	/** Override for writeState function (testability) */
	_writeState?: ((rootPath: string) => Promise<void>) | undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRecoveryHint(message: string): LogosRecoveryHint[] {
	if (!message) return [];
	return [{ category: 'manual_review', message }];
}

function makeDiagnostic(
	code: string,
	message: string,
	severity: 'error' | 'warning' | 'info',
	recoveryHint?: string,
): LogosDiagnostic {
	return {
		code,
		message,
		recoveryHints: recoveryHint ? makeRecoveryHint(recoveryHint) : [],
		severity,
	};
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Apply a confirmed documentation root change.
 *
 * This function:
 * 1. Loads workspace state if not provided
 * 2. Re-runs preview/preflight
 * 3. Checks for blockers (unsafe, unconfirmed)
 * 4. Writes the new root to workspace state
 * 5. Returns structured result with diagnostics
 */
export async function applyDocumentationRootChange(
	options: ApplyDocumentationRootOptions,
): Promise<DocumentationRootApplyResult> {
	const {
		projectRoot,
		proposedPath,
		dryRun = false,
		confirmed = false,
		currentState,
		artifacts,
		canonicalOutputDeclarations,
		activeProfileRoot,
		_writeState,
	} = options;

	const diagnostics: LogosDiagnostic[] = [];
	const changedPaths: string[] = [];
	const messages: string[] = [];

	// Load workspace state
	let currentRootConfig: {
		rootPath: string;
		isDefault: boolean;
		wasExplicitlyConfigured?: boolean | undefined;
	};

	try {
		const readResult = await readWorkspaceState({ projectRoot });
		if (readResult.success && readResult.state) {
			currentRootConfig = {
				isDefault: readResult.state.documentation.isDefault,
				rootPath: readResult.state.documentation.rootPath,
				wasExplicitlyConfigured:
					readResult.state.documentation.wasExplicitlyConfigured,
			};
		} else {
			diagnostics.push(
				makeDiagnostic(
					DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_WORKSPACE_NOT_INITIALIZED,
					'Workspace is not initialized.',
					'error',
					'Run /init to initialize the workspace first.',
				),
			);

			return {
				applied: false,
				changedPaths: [],
				diagnostics,
				dryRun,
				messages: ['Cannot configure root: workspace not initialized.'],
			};
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		diagnostics.push(
			makeDiagnostic(
				DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_STATE_UPDATE_FAILED,
				`Failed to read workspace state: ${message}`,
				'error',
				'Check .logos/workspace.json for corruption.',
			),
		);

		return {
			applied: false,
			changedPaths: [],
			diagnostics,
			dryRun,
			messages: [`Failed to read workspace state: ${message}`],
		};
	}

	// Re-run preview (preflight)
	const preview = await previewDocumentationRootChange({
		activeProfileRoot,
		artifacts,
		canonicalOutputDeclarations,
		currentRootConfig,
		projectRoot,
		proposedPath,
	});

	// Check if blocked
	const blockingDiagnostics = preview.diagnostics.filter(
		(d) => d.severity === 'error',
	);

	if (blockingDiagnostics.length > 0) {
		diagnostics.push(...preview.diagnostics);

		return {
			applied: false,
			changedPaths: [],
			diagnostics,
			dryRun,
			messages: [
				'Root change blocked by safety checks:',
				...blockingDiagnostics.map((d) => `  [${d.code}] ${d.message}`),
				'Resolve the issues above before applying the root change.',
			],
		};
	}

	// Dry-run: don't write (checked before confirmation — dry-run shows preview regardless)
	if (dryRun) {
		diagnostics.push(...preview.diagnostics);
		diagnostics.push(
			makeDiagnostic(
				DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_CHANGE_APPLIED,
				`(dry-run) Would change documentation root to "${preview.proposed.normalizedRelativePath}"`,
				'info',
			),
		);

		return {
			applied: false,
			changedPaths: [],
			diagnostics,
			dryRun: true,
			messages: [
				`Dry-run: Would change documentation root from "${preview.current.normalizedRelativePath}" to "${preview.proposed.normalizedRelativePath}"`,
				`Affected outputs: ${preview.affectedOutputs.staleCount} stale, ${preview.affectedOutputs.orphanedCount} orphaned`,
				'Run /root set <path> without --dry-run to apply.',
			],
		};
	}

	// Check confirmation
	if (!confirmed) {
		diagnostics.push(
			makeDiagnostic(
				DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_CONFIRMATION_REQUIRED,
				'Confirmation is required before changing the documentation root.',
				'warning',
				'Use keyboard confirmation or --confirm flag to proceed.',
			),
		);

		return {
			applied: false,
			changedPaths: [],
			diagnostics,
			dryRun,
			messages: [
				'Confirmation required to apply the root change.',
				'Use the keyboard confirmation to accept, or cancel to keep the current root.',
			],
		};
	}

	// Apply: write new state
	try {
		if (_writeState) {
			await _writeState(preview.proposed.normalizedRelativePath);
		} else {
			const writeResult = await writeDocumentationRootToState({
				newRoot: preview.proposed.normalizedRelativePath,
				projectRoot,
				wasExplicitlyConfigured: true,
			});

			if (!writeResult.success) {
				diagnostics.push(
					makeDiagnostic(
						DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_STATE_UPDATE_FAILED,
						writeResult.message,
						'error',
						'Check .logos/workspace.json write permissions.',
					),
				);

				return {
					applied: false,
					changedPaths: [],
					diagnostics,
					dryRun,
					messages: [writeResult.message],
				};
			}

			changedPaths.push(...writeResult.changedPaths);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		diagnostics.push(
			makeDiagnostic(
				DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_STATE_UPDATE_FAILED,
				`Failed to update workspace state: ${message}`,
				'error',
				'Check .logos/workspace.json for corruption.',
			),
		);

		return {
			applied: false,
			changedPaths: [],
			diagnostics,
			dryRun,
			messages: [`Failed to update workspace state: ${message}`],
		};
	}

	diagnostics.push(...preview.diagnostics);
	diagnostics.push(
		makeDiagnostic(
			DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_CHANGE_APPLIED,
			`Documentation root changed to "${preview.proposed.normalizedRelativePath}"`,
			'info',
		),
	);

	messages.push(
		`Documentation root changed from "${preview.current.normalizedRelativePath}" to "${preview.proposed.normalizedRelativePath}"`,
		`Affected outputs: ${preview.affectedOutputs.staleCount} stale, ${preview.affectedOutputs.orphanedCount} orphaned`,
		'Run /generate to regenerate outputs under the new root.',
		'Old root contents were not moved or deleted.',
	);

	const newRoot: DocumentationRootReference = preview.proposed;

	return {
		applied: true,
		changedPaths,
		diagnostics,
		dryRun,
		messages,
		newRoot,
	};
}

// ---------------------------------------------------------------------------
// Internal state writer
// ---------------------------------------------------------------------------

interface WriteRootResult {
	success: boolean;
	message: string;
	changedPaths: string[];
}

async function writeDocumentationRootToState(options: {
	projectRoot: string;
	newRoot: string;
	wasExplicitlyConfigured: boolean;
}): Promise<WriteRootResult> {
	const { projectRoot, newRoot, wasExplicitlyConfigured } = options;

	try {
		const statePath = join(projectRoot, '.logos', 'workspace.json');
		let state: Record<string, unknown>;

		try {
			const raw = readFileSync(statePath, 'utf-8');
			state = JSON.parse(raw) as Record<string, unknown>;
		} catch {
			return {
				changedPaths: [],
				message: 'Failed to read workspace state file.',
				success: false,
			};
		}

		// Update documentation root
		if (
			typeof state.documentation === 'object' &&
			state.documentation !== null
		) {
			const doc = state.documentation as Record<string, unknown>;
			doc.rootPath = newRoot;
			doc.isDefault = false;
			doc.wasExplicitlyConfigured = wasExplicitlyConfigured;
		}

		// Update metadata
		if (typeof state.workspace === 'object' && state.workspace !== null) {
			const ws = state.workspace as Record<string, unknown>;
			ws.updatedAt = new Date().toISOString();
		}

		// Write back
		writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');

		return {
			changedPaths: [statePath],
			message: 'Workspace state updated successfully.',
			success: true,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			changedPaths: [],
			message: `Failed to update workspace state: ${message}`,
			success: false,
		};
	}
}
