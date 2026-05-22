/**
 * Tests for startIntake profile gating (Step 3.4).
 *
 * Covers:
 * - Missing active profile blocks startIntake.
 * - Invalid active profile blocks startIntake.
 * - On profile failure, intake state does not enter intake_active.
 * - On profile failure, no active question is persisted.
 */

import { describe, expect, it } from 'vitest';

import { createLogosCore } from '../../src/core/api.js';
import { getLogosConfigPath } from '../../src/core/config/config-paths.js';
import { loadIntakeState } from '../../src/core/state/intake-state-persistence.js';
import { createFakeFilesystem } from './helpers/fake-filesystem.js';

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const NOW = '2026-05-22T00:00:00Z';
const PROJECT_ROOT = '/project';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('startIntake profile gate', () => {
	it('blocks startIntake when active profile is missing', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		// Initialize with standard profile.
		await core.initProject({ projectRoot: PROJECT_ROOT });

		// Overwrite config with a missing profile id.
		await fs.writeTextFile({
			content: 'version: 1\nactiveProfileId: missing-profile\n',
			overwrite: true,
			path: getLogosConfigPath(PROJECT_ROOT),
		});

		const result = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('blocked');
		expect(result.blockers.some((b) => b.code === 'profile_not_found')).toBe(
			true,
		);
	});

	it('blocks startIntake when active profile id is invalid', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		// Overwrite config with an invalid profile id (contains path traversal).
		await fs.writeTextFile({
			content: 'version: 1\nactiveProfileId: "../etc"\n',
			overwrite: true,
			path: getLogosConfigPath(PROJECT_ROOT),
		});

		const result = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('blocked');
	});

	it('does not enter intake_active mode on profile failure', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		await fs.writeTextFile({
			content: 'version: 1\nactiveProfileId: missing-profile\n',
			overwrite: true,
			path: getLogosConfigPath(PROJECT_ROOT),
		});

		const result = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.data?.mode).not.toBe('intake_active');
		expect(result.data?.mode).toBe('idle');
	});

	it('does not persist active question id on profile failure', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		await fs.writeTextFile({
			content: 'version: 1\nactiveProfileId: missing-profile\n',
			overwrite: true,
			path: getLogosConfigPath(PROJECT_ROOT),
		});

		const result = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.data?.activeQuestionId).toBeUndefined();

		// Also verify persisted state does not have active question.
		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		// Even if state loaded, it should be in idle mode with no active question.
		if (loadResult.ok) {
			expect(loadResult.state.mode).toBe('idle');
			expect(loadResult.state.activeQuestionId).toBeUndefined();
		}
	});

	it('does not persist active prompt on profile failure', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		await fs.writeTextFile({
			content: 'version: 1\nactiveProfileId: missing-profile\n',
			overwrite: true,
			path: getLogosConfigPath(PROJECT_ROOT),
		});

		const result = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.data?.activePrompt).toBeUndefined();
	});

	it('blocks startIntake when profile directory exists but contracts are missing', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		// Create a profile directory but without `docs.yml`.
		const profilesDir = '/project/profiles/incomplete';
		fs.addDirectory(profilesDir);

		await fs.writeTextFile({
			content: 'version: 1\nactiveProfileId: incomplete\n',
			overwrite: true,
			path: getLogosConfigPath(PROJECT_ROOT),
		});

		const result = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('blocked');
		expect(result.blockers.some((b) => b.code === 'profile_invalid')).toBe(
			true,
		);
	});

	it('succeeds when profile is valid', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		const result = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('ok');
		expect(result.data?.mode).toBe('intake_active');
		expect(result.blockers.some((b) => b.code === 'profile_not_found')).toBe(
			false,
		);
	});
});
