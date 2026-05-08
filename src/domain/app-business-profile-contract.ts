import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { z } from 'zod';

const profileMetadataSchema = z.object({
	id: z.literal('app-business'),
	name: z.string().min(1),
	version: z.string().min(1),
});

const profileDocumentsSchema = z.object({
	documents: z.array(
		z.object({
			path: z.string().min(1),
		}),
	),
	profileId: z.literal('app-business'),
	version: z.string().min(1),
});

export type AppBusinessProfileContract = {
	readonly documentPaths: readonly string[];
	readonly documentsVersion: string;
	readonly id: 'app-business';
	readonly name: string;
	readonly version: string;
};

export function loadAppBusinessProfileContract(
	profileDirectory = getDefaultAppBusinessProfileDirectory(),
): AppBusinessProfileContract {
	const profileMetadata = readYamlContract(
		resolve(profileDirectory, 'profile.yml'),
		profileMetadataSchema,
	);
	const profileDocuments = readYamlContract(
		resolve(profileDirectory, 'documents.yml'),
		profileDocumentsSchema,
	);

	const documentPaths = [
		...new Set(profileDocuments.documents.map((doc) => doc.path)),
	]
		.filter((path) => path.startsWith('docs/'))
		.sort();

	if (documentPaths.length !== profileDocuments.documents.length) {
		throw new Error(
			'App Business documents.yml must define unique document paths under docs/.',
		);
	}

	return {
		documentPaths,
		documentsVersion: profileDocuments.version,
		id: profileMetadata.id,
		name: profileMetadata.name,
		version: profileMetadata.version,
	};
}

function readYamlContract<TSchema extends z.ZodType>(
	path: string,
	schema: TSchema,
): z.infer<TSchema> {
	const result = schema.safeParse(parse(readFileSync(path, 'utf8')));

	if (!result.success) {
		throw new Error(
			`Profile contract ${path} failed schema validation: ${z.prettifyError(result.error)}`,
		);
	}

	return result.data;
}

function getDefaultAppBusinessProfileDirectory(): string {
	const moduleDirectory = dirname(fileURLToPath(import.meta.url));
	const candidates = [
		resolve(moduleDirectory, '../../docs/05-profiles/app-business'),
		resolve(process.cwd(), 'docs/05-profiles/app-business'),
	];

	const profileDirectory = candidates.find((candidate) =>
		existsSync(resolve(candidate, 'profile.yml')),
	);

	if (!profileDirectory) {
		throw new Error(
			'Unable to locate docs/05-profiles/app-business/profile.yml for workspace initialization.',
		);
	}

	return profileDirectory;
}
