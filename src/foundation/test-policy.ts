export const defaultTestPolicy = {
	credentialSource: 'none',
	requiresLiveModel: false,
	requiresNetwork: false,
	summary:
		'Default tests use deterministic fixtures and mocked providers only.',
} as const;
