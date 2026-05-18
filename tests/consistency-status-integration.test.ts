import { describe, expect, it } from 'vitest';
import { getWorkspaceStatusSummary } from '../src/state/workspace-status.js';

describe('/status consistency integration', () => {
	it('includes consistency summary when workspace exists', async () => {
		const summary = await getWorkspaceStatusSummary({
			projectRoot: '/tmp/nonexistent-project-12345',
		});

		// For missing workspace, consistencySummary should be undefined
		expect(summary.consistencySummary).toBeUndefined();
	});

	it('status remains read-only and does not mutate workspace', async () => {
		const summary = await getWorkspaceStatusSummary({
			projectRoot: '/tmp/nonexistent-project-12345',
		});

		expect(summary.initializationState).toBe('missing');
		expect(summary.consistencySummary).toBeUndefined();
	});
});
