import { describe, expect, it } from 'vitest';

import { createLogosCore, initProject } from '../../src/core/api.js';
import { DEFAULT_PROFILE_ID } from '../../src/core/config/config-schema.js';

describe('initProject — profile config (Step 2.1)', () => {
	it('uses "standard" as active profile id when no profile is selected', async () => {
		const core = createLogosCore();
		const result = await core.initProject({ projectRoot: '/test/project' });

		expect(result.status).toBe('ok');
		expect(result.data?.initialized).toBe(true);
		expect(result.data?.activeProfileId).toBe(DEFAULT_PROFILE_ID);
		expect(result.data?.activeProfileId).toBe('standard');
	});

	it('uses the provided selectedProfileId', async () => {
		const core = createLogosCore();
		const result = await core.initProject({
			projectRoot: '/test/project',
			selectedProfileId: 'custom-profile',
		});

		expect(result.status).toBe('ok');
		expect(result.data?.initialized).toBe(true);
		expect(result.data?.activeProfileId).toBe('custom-profile');
	});

	it('returns a blocker for an invalid selectedProfileId', async () => {
		const core = createLogosCore();
		const result = await core.initProject({
			projectRoot: '/test/project',
			selectedProfileId: 'INVALID',
		});

		expect(result.status).toBe('blocked');
		expect(result.data?.initialized).toBe(false);
		expect(result.blockers.length).toBeGreaterThan(0);
		expect(result.blockers[0]?.severity).toBe('blocker');
	});

	it('returns a blocker for empty selectedProfileId', async () => {
		const core = createLogosCore();
		const result = await core.initProject({
			projectRoot: '/test/project',
			selectedProfileId: '',
		});

		expect(result.status).toBe('blocked');
		expect(result.blockers.length).toBeGreaterThan(0);
	});

	it('returns a blocker for selectedProfileId with slash', async () => {
		const core = createLogosCore();
		const result = await core.initProject({
			projectRoot: '/test/project',
			selectedProfileId: '../escape',
		});

		expect(result.status).toBe('blocked');
	});

	it('does not require Pi, Ink, React, or TUI dependencies', () => {
		// This test verifies by construction that the initProject function
		// and its dependencies can be imported without forbidden packages.
		// The boundary test in core-boundary.test.ts checks imports at the
		// file level.
		expect(typeof initProject).toBe('function');
	});

	it('preserves dryRun flag', async () => {
		const core = createLogosCore();
		const result = await core.initProject({
			dryRun: true,
			projectRoot: '/test/project',
		});

		expect(result.dryRun).toBe(true);
		expect(result.data?.activeProfileId).toBe(DEFAULT_PROFILE_ID);
	});

	it('produces plain serializable result (JSON-safe)', async () => {
		const core = createLogosCore();
		const result = await core.initProject({ projectRoot: '/test/project' });

		const serialized = JSON.parse(JSON.stringify(result));
		expect(serialized.status).toBe('ok');
		expect(serialized.data.activeProfileId).toBe('standard');
	});
});
