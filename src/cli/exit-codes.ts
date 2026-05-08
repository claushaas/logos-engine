export const exitCodes = {
	success: 0,
	unexpectedError: 1,
	usageError: 2,
} as const;

export type ExitCode = (typeof exitCodes)[keyof typeof exitCodes];
