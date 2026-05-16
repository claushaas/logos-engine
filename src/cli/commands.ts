import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPackageMetadata } from '../index.js';
import { loadProfileRegistry } from '../profiles/profile-registry.js';
import { EXIT_STARTUP_FAILURE, EXIT_SUCCESS } from './exit-codes.js';

export async function doctorCommand(): Promise<number> {
	const meta = getPackageMetadata();
	console.log(`Node.js:   ${process.version}`);
	console.log(`Package:   ${meta.name} v${meta.version}`);
	console.log(`CWD:       ${process.cwd()}`);
	console.log(`Bootstrap: operational`);

	try {
		const modulePath = fileURLToPath(import.meta.url);
		const packageRoot = resolve(dirname(modulePath), '../..');
		await loadProfileRegistry({ profileId: 'standard', repoRoot: packageRoot });
		console.log(`Profile:   standard (loaded successfully)`);
		return EXIT_SUCCESS;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`Profile:   standard (failed: ${message})`);
		return EXIT_STARTUP_FAILURE;
	}
}
