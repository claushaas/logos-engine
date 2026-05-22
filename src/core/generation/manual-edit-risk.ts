/**
 * LOGOS Core — Manual-edit risk detection (Step 6.3).
 *
 * Detects whether an existing output file was manually edited (lacks
 * a LOGOS generated-file marker).  Used during write planning to warn
 * before overwriting hand-maintained files.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Result of manual-edit risk detection.
 *
 * - `risk: false` when the file is missing or contains a known LOGOS
 *   generated marker.
 * - `risk: true` when the file exists without a recognised marker, or
 *   when a read failure prevents marker detection.
 */
export type ManualEditRisk =
	| {
			risk: false;
			reason: 'file_missing' | 'logos_generated_marker_found';
	  }
	| {
			risk: true;
			reason: 'existing_file_without_generated_marker' | 'read_failed';
			message: string;
	  };

// ---------------------------------------------------------------------------
// Generated markers
// ---------------------------------------------------------------------------

/**
 * Known LOGOS generated-file markers.
 *
 * When any of these are found in existing file content the file is
 * treated as LOGOS-managed and manual-edit risk is lowered.
 */
const LOGOS_GENERATED_MARKERS: readonly string[] = [
	'<!-- generated-by: logos-engine -->',
	'generated-by: logos-engine',
	'LOGOS-GENERATED',
];

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Detect whether a file at `path` carries manual-edit risk.
 *
 * Rules:
 * - File does not exist → no manual-edit risk.
 * - File exists and contains a LOGOS generated marker → no risk.
 * - File exists without a LOGOS generated marker → risk detected.
 * - Content is `undefined` (read failed) → risk detected with
 *   `reason: "read_failed"`.
 *
 * This function does **not** write or mutate files.
 */
export function detectManualEditRisk(input: {
	path: string;
	exists: boolean;
	content?: string;
}): ManualEditRisk {
	const { path: _path, exists, content } = input;

	// No file → no risk.
	if (!exists) {
		return { reason: 'file_missing', risk: false };
	}

	// Read failed → risk.
	if (content === undefined) {
		return {
			message: `Could not read existing file content for manual-edit detection.`,
			reason: 'read_failed',
			risk: true,
		};
	}

	// Check for generated markers.
	for (const marker of LOGOS_GENERATED_MARKERS) {
		if (content.includes(marker)) {
			return { reason: 'logos_generated_marker_found', risk: false };
		}
	}

	// File exists, no marker → risk.
	return {
		message: `Existing file does not contain a LOGOS generated marker and may have been manually edited.`,
		reason: 'existing_file_without_generated_marker',
		risk: true,
	};
}
