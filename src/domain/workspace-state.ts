import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { aiProviderConfigSchema } from '../ai/provider-config.js';
import { validationSeverities } from '../foundation/status-contracts.js';
import { decisionSchema } from './decision-registry.js';
import { answerRecordSchema } from './question-engine.js';

export const workspaceSchemaVersion = '0.1.0';

const schemaVersionSchema = z.object({
	schemaVersion: z.literal(workspaceSchemaVersion),
});

export const projectStateSchema = schemaVersionSchema.extend({
	createdAt: z.string().datetime(),
	profileId: z.string().min(1),
	projectName: z.string().min(1),
	projectRoot: z.literal('.'),
	updatedAt: z.string().datetime(),
});

export const profileLockStateSchema = schemaVersionSchema.extend({
	documentCount: z.number().int().nonnegative(),
	lockedAt: z.string().datetime(),
	profileId: z.string().min(1),
	profileName: z.string().min(1),
	profileVersion: z.string().min(1),
});

export const answersStateSchema = schemaVersionSchema.extend({
	answers: z.array(answerRecordSchema),
});

export const decisionsStateSchema = schemaVersionSchema.extend({
	decisions: z.array(decisionSchema),
});

export const diagnosticsStateSchema = schemaVersionSchema.extend({
	diagnostics: z.array(
		z.object({
			id: z.string().min(1),
			message: z.string().min(1),
			severity: z.enum(validationSeverities),
		}),
	),
	generatedAt: z.string().datetime(),
});

export const configStateSchema = schemaVersionSchema.extend({
	ai: aiProviderConfigSchema,
});

export type ProjectState = z.infer<typeof projectStateSchema>;
export type ProfileLockState = z.infer<typeof profileLockStateSchema>;
export type AnswersState = z.infer<typeof answersStateSchema>;
export type DecisionsState = z.infer<typeof decisionsStateSchema>;
export type DiagnosticsState = z.infer<typeof diagnosticsStateSchema>;
export type ConfigState = z.infer<typeof configStateSchema>;

export type WorkspaceState = {
	readonly answers: AnswersState;
	readonly config: ConfigState;
	readonly decisions: DecisionsState;
	readonly diagnostics: DiagnosticsState;
	readonly profileLock: ProfileLockState;
	readonly project: ProjectState;
};

export class WorkspaceStateReadError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'WorkspaceStateReadError';
	}
}

export function readWorkspaceState(projectRoot: string): WorkspaceState {
	const workspaceRoot = join(projectRoot, '.logos');

	return {
		answers: readStateFile(
			join(workspaceRoot, 'answers.json'),
			answersStateSchema,
		),
		config: readStateFile(
			join(workspaceRoot, 'config.json'),
			configStateSchema,
		),
		decisions: readStateFile(
			join(workspaceRoot, 'decisions.json'),
			decisionsStateSchema,
		),
		diagnostics: readStateFile(
			join(workspaceRoot, 'diagnostics.json'),
			diagnosticsStateSchema,
		),
		profileLock: readStateFile(
			join(workspaceRoot, 'profile.lock.json'),
			profileLockStateSchema,
		),
		project: readStateFile(
			join(workspaceRoot, 'project.json'),
			projectStateSchema,
		),
	};
}

function readStateFile<TSchema extends z.ZodType>(
	path: string,
	schema: TSchema,
): z.infer<TSchema> {
	let parsedJson: unknown;

	try {
		parsedJson = JSON.parse(readFileSync(path, 'utf8'));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new WorkspaceStateReadError(
			`Unable to read workspace state file ${path}: ${message}`,
		);
	}

	const result = schema.safeParse(parsedJson);

	if (!result.success) {
		throw new WorkspaceStateReadError(
			`Workspace state file ${path} failed schema validation: ${z.prettifyError(result.error)}`,
		);
	}

	return result.data;
}
