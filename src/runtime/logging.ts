/** Minimal logging abstraction for CLI/TUI runtime — no persistence, redaction-first */

import type { JsonSerializableCommandResult } from './command-result.js';
import { redactString, redactValue } from './redaction.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
	debug: 0,
	error: 3,
	info: 1,
	warn: 2,
};

export interface LogSink {
	write(level: LogLevel, message: string): void;
}

export class ConsoleLogSink implements LogSink {
	write(level: LogLevel, message: string): void {
		switch (level) {
			case 'debug':
				// eslint-disable-next-line no-console
				console.debug(message);
				break;
			case 'info':
				// eslint-disable-next-line no-console
				console.info(message);
				break;
			case 'warn':
				// eslint-disable-next-line no-console
				console.warn(message);
				break;
			case 'error':
				// eslint-disable-next-line no-console
				console.error(message);
				break;
		}
	}
}

export class MemoryLogSink implements LogSink {
	readonly entries: Array<{ level: LogLevel; message: string }> = [];

	write(level: LogLevel, message: string): void {
		this.entries.push({ level, message });
	}

	clear(): void {
		this.entries.length = 0;
	}
}

export interface LoggerOptions {
	minLevel?: LogLevel;
	sinks?: LogSink[];
	/** Redact values before writing; default true */
	redact?: boolean;
}

export class Logger {
	private readonly minLevel: LogLevel;
	private readonly sinks: LogSink[];
	private readonly redact: boolean;

	constructor(options: LoggerOptions = {}) {
		this.minLevel = options.minLevel ?? 'info';
		this.sinks =
			options.sinks && options.sinks.length > 0
				? options.sinks
				: [new ConsoleLogSink()];
		this.redact = options.redact ?? true;
	}

	private shouldLog(level: LogLevel): boolean {
		return LEVEL_ORDER[level] >= LEVEL_ORDER[this.minLevel];
	}

	private formatMessage(level: LogLevel, message: string): string {
		const prefix = `[${level.toUpperCase()}]`;
		return `${prefix} ${message}`;
	}

	private emit(level: LogLevel, rawMessage: string): void {
		if (!this.shouldLog(level)) return;
		const message = this.redact ? redactString(rawMessage) : rawMessage;
		const formatted = this.formatMessage(level, message);
		for (const sink of this.sinks) {
			sink.write(level, formatted);
		}
	}

	debug(message: string): void {
		this.emit('debug', message);
	}

	info(message: string): void {
		this.emit('info', message);
	}

	warn(message: string): void {
		this.emit('warn', message);
	}

	error(message: string): void {
		this.emit('error', message);
	}

	/** Log a structured JSON result after redacting values */
	logJsonResult(result: JsonSerializableCommandResult): void {
		if (!this.shouldLog('info')) return;
		const redacted = this.redact ? redactValue(result) : result;
		const message = JSON.stringify(redacted, null, 2);
		for (const sink of this.sinks) {
			sink.write('info', message);
		}
	}
}

/** Default global logger instance — safe to import without side effects */
export const defaultLogger = new Logger();
