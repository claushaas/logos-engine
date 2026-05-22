/**
 * LOGOS Core — Profile gate helper (Step 2.4).
 *
 * Composes {@link resolveActiveProfile} and {@link loadProfileContracts}
 * into a single {@link ensureProfileReady} call that gates Core APIs.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import type { LogosError } from '../errors.js';
import type { LogosFilesystem } from '../ports/filesystem.js';
import type { LogosBlocker } from '../result.js';
import { createLogosBlocker, createLogosError } from '../result.js';
import { loadProfileContracts } from './load-profile-contracts.js';
import type { LoadedProfileContracts } from './profile-contracts.js';

// ---------------------------------------------------------------------------
// Input / output types
// ---------------------------------------------------------------------------

export type ProfileGateInput = {
	projectRoot: string;
	activeProfileId: string;
	filesystem: LogosFilesystem;
};

export type ProfileGateResult =
	| {
			ok: true;
			contracts: LoadedProfileContracts;
			warnings: string[];
	  }
	| {
			ok: false;
			errors: LogosError[];
			blockers: LogosBlocker[];
			warnings: string[];
	  };

// ---------------------------------------------------------------------------
// Profile gate
// ---------------------------------------------------------------------------

/**
 * Ensure the active profile is resolved and contracts are loaded.
 *
 * 1. Delegates to {@link loadProfileContracts} which internally calls
 *    {@link resolveActiveProfile}.
 * 2. Maps profile resolution/loading failures to existing Core result
 *    blocker/error types.
 * 3. Returns structured blockers/errors instead of throwing.
 */
export async function ensureProfileReady(
	input: ProfileGateInput,
): Promise<ProfileGateResult> {
	const { projectRoot, activeProfileId, filesystem } = input;

	const loadResult = await loadProfileContracts({
		activeProfileId,
		filesystem,
		projectRoot,
	});

	if (!loadResult.ok) {
		const errors: LogosError[] = [];
		const blockers: LogosBlocker[] = [];
		const warnings: string[] = [...loadResult.warnings];

		for (const err of loadResult.errors) {
			const code = err.code as LogosError['code'];

			blockers.push(
				createLogosBlocker({
					code,
					message: err.message,
					...(err.details !== undefined ? { details: err.details } : {}),
					...(err.path !== undefined ? { path: err.path } : {}),
				}),
			);

			errors.push(
				createLogosError({
					code,
					message: err.message,
					...(err.details !== undefined ? { details: err.details } : {}),
				}),
			);
		}

		return { blockers, errors, ok: false, warnings };
	}

	return {
		contracts: loadResult.contracts,
		ok: true,
		warnings: loadResult.warnings,
	};
}
