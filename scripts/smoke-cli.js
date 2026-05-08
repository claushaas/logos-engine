import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packageJsonPath = join(root, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

const requiredScripts = ['build', 'lint:biome', 'lint:md', 'test', 'smoke:cli'];
const missingScripts = requiredScripts.filter(
	(scriptName) => !packageJson.scripts?.[scriptName],
);

if (missingScripts.length > 0) {
	throw new Error(`Missing required scripts: ${missingScripts.join(', ')}`);
}

if (!existsSync(join(root, 'src', 'index.ts'))) {
	throw new Error('Missing src/index.ts foundation entrypoint.');
}

if (!packageJson.bin?.logos) {
	throw new Error('Missing logos executable bin entry.');
}

if (!existsSync(join(root, 'src', 'cli.ts'))) {
	throw new Error('Missing src/cli.ts executable entrypoint.');
}

console.log('CLI smoke check passed. The logos executable is wired.');
