import { describe, expect, it } from 'vitest';
import { Logger, MemoryLogSink } from '../src/runtime/logging.js';

describe('Logger', () => {
	it('logs to a memory sink', () => {
		const sink = new MemoryLogSink();
		const logger = new Logger({ minLevel: 'debug', sinks: [sink] });
		logger.info('hello');
		expect(sink.entries).toHaveLength(1);
		expect(sink.entries[0].level).toBe('info');
		expect(sink.entries[0].message).toContain('hello');
	});

	it('respects minLevel', () => {
		const sink = new MemoryLogSink();
		const logger = new Logger({ minLevel: 'warn', sinks: [sink] });
		logger.debug('hidden');
		logger.info('hidden');
		logger.warn('visible');
		expect(sink.entries).toHaveLength(1);
		expect(sink.entries[0].level).toBe('warn');
	});

	it('redacts secrets by default', () => {
		const sink = new MemoryLogSink();
		const logger = new Logger({ minLevel: 'debug', sinks: [sink] });
		logger.info('token is sk-verylongsecrettoken1234567890');
		expect(sink.entries[0].message).not.toContain('sk-verylong');
		expect(sink.entries[0].message).toContain('[REDACTED]');
	});

	it('can disable redaction', () => {
		const sink = new MemoryLogSink();
		const logger = new Logger({
			minLevel: 'debug',
			redact: false,
			sinks: [sink],
		});
		logger.info('token is sk-abc');
		expect(sink.entries[0].message).toContain('sk-abc');
	});

	it('clears memory sink', () => {
		const sink = new MemoryLogSink();
		const logger = new Logger({ minLevel: 'debug', sinks: [sink] });
		logger.info('one');
		sink.clear();
		expect(sink.entries).toHaveLength(0);
	});
});
