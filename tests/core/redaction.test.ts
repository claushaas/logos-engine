import { describe, expect, it } from 'vitest';
import { redactSecrets } from '../../src/core/fs/redaction.js';

describe('redactSecrets', () => {
	it('redacts a top-level token key', () => {
		const input = { token: 'abc123' };
		const result = redactSecrets(input);

		expect(result).toEqual({ token: '[REDACTED]' });
	});

	it('redacts a top-level apiKey key', () => {
		const input = { apiKey: 'secret-key' };
		const result = redactSecrets(input);

		expect(result).toEqual({ apiKey: '[REDACTED]' });
	});

	it('redacts nested secret keys', () => {
		const input = {
			name: 'ok',
			nested: {
				publicField: 'visible',
				token: 'xyz',
			},
		};
		const result = redactSecrets(input);

		expect(result).toEqual({
			name: 'ok',
			nested: {
				publicField: 'visible',
				token: '[REDACTED]',
			},
		});
	});

	it('redacts keys inside arrays', () => {
		const input = [
			{ apiKey: 'first', name: 'a' },
			{ apiKey: 'second', name: 'b' },
		];
		const result = redactSecrets(input);

		expect(result).toEqual([
			{ apiKey: '[REDACTED]', name: 'a' },
			{ apiKey: '[REDACTED]', name: 'b' },
		]);
	});

	it('leaves non-secret fields unchanged', () => {
		const input = {
			active: true,
			author: 'Ada',
			count: 42,
			description: 'A test object',
		};
		const result = redactSecrets(input);

		expect(result).toEqual(input);
	});

	it('does not mutate the input object', () => {
		const input = {
			apiKey: 'abc',
			nested: { name: 'ok', token: 'xyz' },
		};
		const original = JSON.parse(JSON.stringify(input));
		redactSecrets(input);

		expect(input).toEqual(original);
	});

	it('redacts api_key (snake_case) and private_key', () => {
		const input = {
			api_key: 'sk-123',
			private_key: 'pk-456',
			publicKey: 'pub-789',
		};
		const result = redactSecrets(input);

		expect(result).toEqual({
			api_key: '[REDACTED]',
			private_key: '[REDACTED]',
			publicKey: 'pub-789',
		});
	});

	it('redacts authorization, auth, bearer, credential, password, secret', () => {
		const input = {
			auth: 'token',
			authorization: 'Basic abc',
			bearer: 'btoken',
			credential: 'creds',
			password: 'hunter2',
			secret: 'shh',
		};
		const result = redactSecrets(input);

		expect(result).toEqual({
			auth: '[REDACTED]',
			authorization: '[REDACTED]',
			bearer: '[REDACTED]',
			credential: '[REDACTED]',
			password: '[REDACTED]',
			secret: '[REDACTED]',
		});
	});
});
