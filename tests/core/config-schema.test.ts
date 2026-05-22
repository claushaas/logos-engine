import { describe, expect, it } from 'vitest';

import {
	DEFAULT_PROFILE_ID,
	normalizeLogosConfig,
	PROFILE_ID_MAX_LENGTH,
	validateProfileId,
} from '../../src/core/config/config-schema.js';

describe('DEFAULT_PROFILE_ID', () => {
	it('equals "standard"', () => {
		expect(DEFAULT_PROFILE_ID).toBe('standard');
	});
});

describe('validateProfileId', () => {
	// ---- valid IDs ----
	it('accepts "standard"', () => {
		expect(validateProfileId('standard')).toEqual({
			profileId: 'standard',
			valid: true,
		});
	});

	it('accepts "custom-profile"', () => {
		expect(validateProfileId('custom-profile')).toEqual({
			profileId: 'custom-profile',
			valid: true,
		});
	});

	it('accepts "profile2" (digits after start)', () => {
		expect(validateProfileId('profile2')).toEqual({
			profileId: 'profile2',
			valid: true,
		});
	});

	it('accepts a single lowercase letter', () => {
		expect(validateProfileId('a')).toEqual({ profileId: 'a', valid: true });
	});

	it('accepts a single digit', () => {
		expect(validateProfileId('0')).toEqual({ profileId: '0', valid: true });
	});

	it('accepts max-length hyphenated id', () => {
		const id = `a${'-'.repeat(PROFILE_ID_MAX_LENGTH - 1)}`;
		expect(id.length).toBe(PROFILE_ID_MAX_LENGTH);
		expect(validateProfileId(id)).toEqual({ profileId: id, valid: true });
	});

	// ---- invalid: empty ----
	it('rejects empty string', () => {
		const result = validateProfileId('');
		expect(result.valid).toBe(false);
		if (!result.valid) expect(result.reason).toBe('empty');
	});

	// ---- invalid: too long ----
	it('rejects overlong profile id', () => {
		const id = `a${'x'.repeat(PROFILE_ID_MAX_LENGTH)}`;
		expect(id.length).toBeGreaterThan(PROFILE_ID_MAX_LENGTH);
		const result = validateProfileId(id);
		expect(result.valid).toBe(false);
		if (!result.valid) expect(result.reason).toBe('too_long');
	});

	// ---- invalid: format ----
	it('rejects uppercase (lowercase-only pattern)', () => {
		const result = validateProfileId('Standard');
		expect(result.valid).toBe(false);
		if (!result.valid) expect(result.reason).toBe('invalid_format');
	});

	it('rejects underscore (hyphen-only pattern)', () => {
		const result = validateProfileId('custom_profile');
		expect(result.valid).toBe(false);
		if (!result.valid) expect(result.reason).toBe('invalid_format');
	});

	it('rejects leading digit that is fine, but rejects special chars', () => {
		const result = validateProfileId('profile@one');
		expect(result.valid).toBe(false);
		if (!result.valid) expect(result.reason).toBe('invalid_format');
	});

	it('rejects whitespace', () => {
		const result = validateProfileId(' my-profile ');
		expect(result.valid).toBe(false);
		if (!result.valid) expect(result.reason).toBe('invalid_format');
	});

	it('rejects tab inside', () => {
		const result = validateProfileId('my\tprofile');
		expect(result.valid).toBe(false);
		if (!result.valid) expect(result.reason).toBe('invalid_format');
	});

	// ---- invalid: path traversal ----
	it('rejects slash in profile id', () => {
		const result = validateProfileId('my/profile');
		expect(result.valid).toBe(false);
		if (!result.valid) expect(result.reason).toBe('path_traversal');
	});

	it('rejects backslash in profile id', () => {
		const result = validateProfileId('my\\profile');
		expect(result.valid).toBe(false);
		if (!result.valid) expect(result.reason).toBe('path_traversal');
	});

	it('rejects colon in profile id', () => {
		const result = validateProfileId('c:profile');
		expect(result.valid).toBe(false);
		if (!result.valid) expect(result.reason).toBe('path_traversal');
	});

	it('rejects null byte in profile id', () => {
		const result = validateProfileId('bad\0id');
		expect(result.valid).toBe(false);
		if (!result.valid) expect(result.reason).toBe('path_traversal');
	});

	it('rejects dot-prefixed (hidden file style)', () => {
		const result = validateProfileId('.hidden');
		expect(result.valid).toBe(false);
		if (!result.valid) expect(result.reason).toBe('path_traversal');
	});

	it('rejects path traversal pattern ../standard', () => {
		const result = validateProfileId('../standard');
		expect(result.valid).toBe(false);
		if (!result.valid) expect(result.reason).toBe('path_traversal');
	});

	it('rejects traversal pattern wrapped in longer id', () => {
		const result = validateProfileId('standard/../../x');
		expect(result.valid).toBe(false);
		if (!result.valid) expect(result.reason).toBe('path_traversal');
	});

	// ---- invalid: reserved ----
	it('rejects single dot', () => {
		const result = validateProfileId('.');
		expect(result.valid).toBe(false);
		if (!result.valid) expect(result.reason).toBe('path_traversal');
	});

	it('rejects double dot', () => {
		const result = validateProfileId('..');
		expect(result.valid).toBe(false);
		if (!result.valid) expect(result.reason).toBe('path_traversal');
	});
});

describe('normalizeLogosConfig', () => {
	const now = '2026-05-22T00:00:00Z';

	function norm(raw: unknown): ReturnType<typeof normalizeLogosConfig> {
		return normalizeLogosConfig({ now, raw });
	}

	it('defaults missing activeProfileId to "standard"', () => {
		const result = norm({ version: 1 });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.config.activeProfileId).toBe('standard');
			expect(result.warnings).toContain(
				'activeProfileId missing, defaulting to "standard".',
			);
		}
	});

	it('defaults missing version to 1', () => {
		const result = norm({ activeProfileId: 'custom' });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.config.version).toBe(1);
		}
	});

	it('defaults missing createdAt and updatedAt to now', () => {
		const result = norm({ activeProfileId: 'my-profile', version: 1 });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.config.createdAt).toBe(now);
			expect(result.config.updatedAt).toBe(now);
		}
	});

	it('preserves explicit createdAt and updatedAt', () => {
		const result = norm({
			activeProfileId: 'staging',
			createdAt: '2025-01-01T00:00:00Z',
			updatedAt: '2025-06-01T00:00:00Z',
			version: 1,
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.config.createdAt).toBe('2025-01-01T00:00:00Z');
			expect(result.config.updatedAt).toBe('2025-06-01T00:00:00Z');
		}
	});

	it('preserves metadata when valid', () => {
		const result = norm({
			activeProfileId: 'standard',
			metadata: { key: 'value' },
			version: 1,
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.config.metadata).toEqual({ key: 'value' });
		}
	});

	it('allows metadata to be omitted', () => {
		const result = norm({ activeProfileId: 'standard', version: 1 });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.config.metadata).toBeUndefined();
		}
	});

	it('rejects non-object metadata', () => {
		const result = norm({
			activeProfileId: 'standard',
			metadata: 'not-an-object',
			version: 1,
		});
		expect(result.ok).toBe(false);
	});

	it('rejects array metadata', () => {
		const result = norm({
			activeProfileId: 'standard',
			metadata: ['a', 'b'],
			version: 1,
		});
		expect(result.ok).toBe(false);
	});

	it('rejects null / undefined raw', () => {
		expect(norm(null).ok).toBe(false);
		expect(norm(undefined).ok).toBe(false);
	});

	it('rejects array raw', () => {
		expect(norm(['a']).ok).toBe(false);
	});

	it('rejects non-object raw (string)', () => {
		expect(norm('hello').ok).toBe(false);
	});

	it('rejects unsupported version', () => {
		const result = norm({ activeProfileId: 'standard', version: 2 });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.includes('Unsupported'))).toBe(true);
		}
	});

	it('rejects non-string activeProfileId', () => {
		const result = norm({ activeProfileId: 123, version: 1 });
		expect(result.ok).toBe(false);
	});

	it('rejects invalid activeProfileId syntax', () => {
		const result = norm({ activeProfileId: 'BAD', version: 1 });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(
				result.errors.some((e) => e.includes('Invalid activeProfileId')),
			).toBe(true);
		}
	});

	it('produces no warnings for a fully valid config', () => {
		const result = norm({
			activeProfileId: 'custom-profile',
			createdAt: '2026-01-01T00:00:00Z',
			updatedAt: '2026-01-01T00:00:00Z',
			version: 1,
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.warnings).toEqual([]);
		}
	});
});
