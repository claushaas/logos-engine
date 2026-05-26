/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
	forbidden: [
		{
			name: 'tui-no-llm',
			comment: 'TUI must not import LLM adapter directly',
			severity: 'error',
			from: { path: '^src/tui' },
			to: { path: '^src/llm' },
		},
		{
			name: 'state-engine-no-tui-llm-persistence',
			comment: 'State engine must not import TUI, LLM, or persistence',
			severity: 'error',
			from: { path: '^src/state-engine' },
			to: { path: '^src/(tui|llm|persistence)' },
		},
		{
			name: 'llm-no-state-engine-tui',
			comment: 'LLM must not import state engine or TUI',
			severity: 'error',
			from: { path: '^src/llm' },
			to: { path: '^src/(state-engine|tui)' },
		},
		{
			name: 'persistence-no-prompt',
			comment: 'Persistence must not import prompt orchestration',
			severity: 'error',
			from: { path: '^src/persistence' },
			to: { path: '^src/prompt-orchestration' },
		},
		{
			name: 'materialization-no-conversation-runtime',
			comment: 'Materialization must not import raw conversation runtime',
			severity: 'error',
			from: { path: '^src/materialization' },
			to: { path: '^src/conversation-runtime' },
		},
	],
	options: {
		doNotFollow: {
			path: ['node_modules'],
		},
		includeOnly: '^src',
		tsConfig: {
			fileName: 'tsconfig.json',
		},
		tsPreCompilationDeps: true,
		exoticRequireStrings: ['import'],
	},
};
