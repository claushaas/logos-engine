import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			'@logos/application': path.resolve('src/application'),
			'@logos/contracts': path.resolve('src/contracts'),
			'@logos/conversation-runtime': path.resolve('src/conversation-runtime'),
			'@logos/diagnostics': path.resolve('src/diagnostics'),
			'@logos/llm': path.resolve('src/llm'),
			'@logos/materialization': path.resolve('src/materialization'),
			'@logos/outputs': path.resolve('src/outputs'),
			'@logos/persistence': path.resolve('src/persistence'),
			'@logos/profiles': path.resolve('src/profiles'),
			'@logos/prompt-orchestration': path.resolve('src/prompt-orchestration'),
			'@logos/shared': path.resolve('src/shared'),
			'@logos/state-engine': path.resolve('src/state-engine'),
			'@logos/tui': path.resolve('src/tui'),
			'@logos/validation': path.resolve('src/validation'),
		},
	},
	test: {
		coverage: {
			exclude: ['src/llm/**', 'src/index.ts'],
			include: ['src/**/*.ts', 'src/**/*.tsx'],
			provider: 'v8',
			reporter: ['text', 'html'],
			reportsDirectory: 'coverage',
			thresholds: {
				branches: 60,
				functions: 60,
				lines: 60,
				statements: 60,
			},
		},
		environment: 'node',
		include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
	},
});
