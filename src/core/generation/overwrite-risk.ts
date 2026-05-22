/**
 * LOGOS Core — Overwrite risk detection (Step 6.3).
 *
 * Checks whether a planned output path already exists and reports
 * overwrite risk.  Does **not** write or overwrite files.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import type { LogosFilesystem } from '../ports/filesystem.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OverwriteRiskResult = {
	exists: boolean;
	path: string;
	content?: string;
	warning?: string;
};

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Detect whether an output path already exists.
 *
 * - Uses {@link LogosFilesystem.fileExists} to check.
 * - If the file exists, reads its content for downstream manual-edit risk
 *   detection. A read failure is recorded as a warning but does not throw.
 * - If the file does not exist, returns `exists: false`.
 *
 * This function does **not** write or mutate files.
 */
export async function detectOverwriteRisk(input: {
	filesystem: LogosFilesystem;
	path: string;
}): Promise<OverwriteRiskResult> {
	const { filesystem, path } = input;

	try {
		const exists = await filesystem.fileExists({ path });
		if (!exists) {
			return { exists: false, path };
		}

		// File exists — try to read content.
		try {
			const readResult = await filesystem.readTextFile(path);
			return { content: readResult.content, exists: true, path };
		} catch (readErr) {
			const msg = readErr instanceof Error ? readErr.message : String(readErr);
			return {
				exists: true,
				path,
				warning: `File exists but could not be read: ${msg}`,
			};
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return {
			exists: false,
			path,
			warning: `Could not check file existence: ${msg}`,
		};
	}
}
