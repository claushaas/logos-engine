/** Logo Engine — package metadata and scaffold types */

export const PACKAGE_NAME = 'logos-engine';
export const PACKAGE_VERSION = '0.1.0';
export const LOGOS_BINARY_NAME = 'logos';

export type LogosRuntimeMode = 'cli' | 'tui' | 'api';

export interface LogosPackageMetadata {
	name: string;
	version: string;
	binaryName: string;
}

export function getPackageMetadata(): LogosPackageMetadata {
	return {
		binaryName: LOGOS_BINARY_NAME,
		name: PACKAGE_NAME,
		version: PACKAGE_VERSION,
	};
}
