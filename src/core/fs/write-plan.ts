/**
 * LOGOS Core — Write plan types.
 *
 * Defines safe write planning contracts for future generation behavior.
 */

import {
	checkPathInsideProject,
	type PathSafetyResult,
} from './path-safety.js';

export type WriteOperationKind = 'create' | 'update' | 'skip' | 'delete';

export type WriteOperation = {
	kind: WriteOperationKind;
	path: string;
	content?: string;
	reason?: string;
};

export type WritePlan = {
	projectRoot: string;
	operations: WriteOperation[];
	dryRun: boolean;
};

export function validateWritePlanPaths(plan: WritePlan): PathSafetyResult[] {
	return plan.operations.map((operation) =>
		checkPathInsideProject({
			projectRoot: plan.projectRoot,
			targetPath: operation.path,
		}),
	);
}
