import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPackageMetadata } from '../index.js';
import { loadProfileRegistry } from '../profiles/profile-registry.js';
import {
	detectProjectContext,
	formatProjectContextLines,
} from '../runtime/project-context.js';
import { EXIT_STARTUP_FAILURE, EXIT_SUCCESS } from './exit-codes.js';

export async function doctorCommand(): Promise<number> {
	const meta = getPackageMetadata();
	console.log(`Node.js:   ${process.version}`);
	console.log(`Package:   ${meta.name} v${meta.version}`);

	const ctx = detectProjectContext();
	for (const line of formatProjectContextLines(ctx)) {
		console.log(line);
	}

	// Keep existing profile load check as a separate diagnostic
	try {
		const modulePath = fileURLToPath(import.meta.url);
		const packageRoot = resolve(dirname(modulePath), '../..');
		await loadProfileRegistry({ profileId: 'standard', repoRoot: packageRoot });
		console.log(`Bundled profile:           standard (loaded successfully)`);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`Bundled profile:           standard (failed: ${message})`);
		return EXIT_STARTUP_FAILURE;
	}

	return EXIT_SUCCESS;
}
