import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { z } from 'zod';
import { validationSeverities } from '../foundation/status-contracts.js';

const idSchema = z.string().min(1);
const versionSchema = z.string().min(1);

const phaseSchema = z.object({
	id: idSchema,
	purpose: z.string().min(1),
	title: z.string().min(1),
});

const profileMetadataSchema = z.object({
	contracts: z.object({
		documents: z.string().min(1),
		questions: z.string().min(1),
		templatesDir: z.string().min(1).optional(),
		validations: z.string().min(1),
	}),
	description: z.string().min(1),
	id: idSchema,
	name: z.string().min(1),
	outcomes: z.array(z.string().min(1)).min(1),
	phases: z.array(phaseSchema).min(1),
	targetUser: z.string().min(1),
	version: versionSchema,
});

const promptContextRequirementSchema = z.object({
	includeAssumptions: z.boolean().default(false),
	includeConfirmedDecisions: z.boolean().default(false),
	includeOpenQuestions: z.boolean().default(false),
});

const requiredInputSchema = z.object({
	answers: z.array(idSchema),
	assumptions: z.array(idSchema),
	decisions: z.array(idSchema),
});

const sectionSchema = z.object({
	id: idSchema,
	required: z.boolean(),
	title: z.string().min(1),
});

const dependencyMappingSchema = z.object({
	decisions: z.array(idSchema),
	documents: z.array(idSchema),
});

const canonicalDocumentSchema = z.object({
	completionCriteria: z.array(z.string().min(1)).min(1),
	dependencies: dependencyMappingSchema,
	generatedOutputs: z.array(z.string().min(1)).min(1),
	id: idSchema,
	path: z.string().min(1),
	phaseId: idSchema,
	primaryQuestions: z.array(z.string().min(1)).min(1),
	promptContext: promptContextRequirementSchema,
	purpose: z.string().min(1),
	requiredInputs: requiredInputSchema,
	sections: z.array(sectionSchema).min(1),
	template: z.string().min(1).optional(),
	title: z.string().min(1),
	validationRules: z.array(idSchema),
});

const documentsFileSchema = z.object({
	defaults: z.record(z.string(), z.unknown()).optional(),
	documents: z.array(canonicalDocumentSchema).min(1),
	profileId: idSchema,
	version: versionSchema,
});

export const questionOptionSchema = z.object({
	description: z.string().min(1),
	label: z.string().min(1),
	value: idSchema,
});

export const questionSchema = z
	.object({
		allowAssumption: z.boolean().optional(),
		allowUnknown: z.boolean().optional(),
		answerType: z.enum(['boolean', 'choice', 'multi_choice', 'number', 'text']),
		examples: z.array(z.string().min(1)).optional(),
		helpText: z.string().min(1),
		id: idSchema,
		mapsToDecisionIds: z.array(idSchema).min(1),
		options: z.array(questionOptionSchema).optional(),
		text: z.string().min(1),
	})
	.superRefine((question, context) => {
		if (
			(question.answerType === 'choice' ||
				question.answerType === 'multi_choice') &&
			(!question.options || question.options.length === 0)
		) {
			context.addIssue({
				code: 'custom',
				message: `${question.answerType} questions must define options.`,
				path: ['options'],
			});
		}
	});

export const questionSetSchema = z.object({
	id: idSchema,
	phaseId: idSchema,
	purpose: z.string().min(1),
	questions: z.array(questionSchema).min(1),
	title: z.string().min(1),
});

export const questionSetFileSchema = z.object({
	defaults: z
		.object({
			allowAssumption: z.boolean(),
			allowUnknown: z.boolean(),
			maxQuestionsPerRound: z.number().int().positive(),
		})
		.optional(),
	profileId: idSchema,
	questionSets: z.array(questionSetSchema).min(1),
	version: versionSchema,
});

type ValidationCondition = {
	readonly all?: readonly ValidationCondition[] | undefined;
	readonly any?: readonly ValidationCondition[] | undefined;
	readonly decision?: string | undefined;
	readonly equals?: unknown | undefined;
	readonly in?: readonly unknown[] | undefined;
};

const validationConditionSchema: z.ZodType<ValidationCondition> = z.lazy(() =>
	z.object({
		all: z.array(validationConditionSchema).optional(),
		any: z.array(validationConditionSchema).optional(),
		decision: idSchema.optional(),
		equals: z.unknown().optional(),
		in: z.array(z.unknown()).optional(),
	}),
);

const validationRuleSchema = z.object({
	affectedDocuments: z.array(idSchema).min(1),
	condition: validationConditionSchema.optional(),
	description: z.string().min(1),
	id: idSchema,
	phaseId: idSchema,
	requiredDecisionIds: z.array(idSchema).optional().default([]),
	severity: z.enum(validationSeverities),
	suggestedNextAction: z.string().min(1).optional(),
	title: z.string().min(1),
});

const riskPatternSchema = z.object({
	affectedDocuments: z.array(idSchema).default([]),
	condition: validationConditionSchema.optional(),
	description: z.string().min(1),
	id: idSchema,
	phaseId: idSchema,
	severity: z.enum(validationSeverities),
	suggestedNextAction: z.string().min(1).optional(),
	title: z.string().min(1),
});

const validationsFileSchema = z.object({
	profileId: idSchema,
	riskPatterns: z.array(riskPatternSchema).optional().default([]),
	rules: z.array(validationRuleSchema).min(1),
	version: versionSchema,
});

export type ProfilePhase = z.infer<typeof phaseSchema>;
export type CanonicalDocument = z.infer<typeof canonicalDocumentSchema>;
export type Question = z.infer<typeof questionSchema>;
export type QuestionOption = z.infer<typeof questionOptionSchema>;
export type QuestionSet = z.infer<typeof questionSetSchema>;
export type QuestionSetFile = z.infer<typeof questionSetFileSchema>;
export type ValidationRule = z.infer<typeof validationRuleSchema>;
export type RiskPattern = z.infer<typeof riskPatternSchema>;
export type PromptContextRequirement = z.infer<
	typeof promptContextRequirementSchema
>;
export type DependencyMapping = z.infer<typeof dependencyMappingSchema>;

export type ProfileVersionLock = {
	readonly profileId: string;
	readonly profileName: string;
	readonly profileVersion: string;
};

export type ProfileContract = {
	readonly description: string;
	readonly documentPaths: readonly string[];
	readonly documents: readonly CanonicalDocument[];
	readonly documentsVersion: string;
	readonly id: string;
	readonly name: string;
	readonly phases: readonly ProfilePhase[];
	readonly questionDefaults: QuestionSetFile['defaults'];
	readonly questionSets: readonly QuestionSet[];
	readonly questionsVersion: string;
	readonly riskPatterns: readonly RiskPattern[];
	readonly targetUser: string;
	readonly validationRules: readonly ValidationRule[];
	readonly validationsVersion: string;
	readonly version: string;
};

export class ProfileValidationError extends Error {
	public constructor(
		message: string,
		public readonly issues: readonly string[] = [message],
	) {
		super(message);
		this.name = 'ProfileValidationError';
	}
}

export function loadProfileById(
	profileId: string,
	profilesDirectory = getDefaultProfilesDirectory(),
): ProfileContract {
	return loadProfileContract(resolve(profilesDirectory, profileId));
}

export function loadProfileContract(profileDirectory: string): ProfileContract {
	const profileMetadata = readYamlContract(
		resolve(profileDirectory, 'profile.yml'),
		profileMetadataSchema,
	);
	const profileDocuments = readYamlContract(
		resolve(profileDirectory, profileMetadata.contracts.documents),
		documentsFileSchema,
	);
	const profileQuestions = readYamlContract(
		resolve(profileDirectory, profileMetadata.contracts.questions),
		questionSetFileSchema,
	);
	const profileValidations = readYamlContract(
		resolve(profileDirectory, profileMetadata.contracts.validations),
		validationsFileSchema,
	);

	const profile = {
		description: profileMetadata.description,
		documentPaths: profileDocuments.documents
			.map((document) => document.path)
			.sort(),
		documents: profileDocuments.documents,
		documentsVersion: profileDocuments.version,
		id: profileMetadata.id,
		name: profileMetadata.name,
		phases: profileMetadata.phases,
		questionDefaults: profileQuestions.defaults,
		questionSets: profileQuestions.questionSets,
		questionsVersion: profileQuestions.version,
		riskPatterns: profileValidations.riskPatterns,
		targetUser: profileMetadata.targetUser,
		validationRules: profileValidations.rules,
		validationsVersion: profileValidations.version,
		version: profileMetadata.version,
	} satisfies ProfileContract;

	validateProfileContract(profile, {
		profileDirectory,
		templatesDir: profileMetadata.contracts.templatesDir,
		yamlProfileIds: [
			profileDocuments.profileId,
			profileQuestions.profileId,
			profileValidations.profileId,
		],
	});

	return profile;
}

export function loadAvailableProfileContracts(
	profilesDirectory = getDefaultProfilesDirectory(),
): readonly ProfileContract[] {
	const profileDirectories = readdirSync(profilesDirectory)
		.map((entryName) => resolve(profilesDirectory, entryName))
		.filter((entryPath) => statSync(entryPath).isDirectory())
		.filter((entryPath) => existsSync(resolve(entryPath, 'profile.yml')));

	return loadProfileContracts(profileDirectories);
}

export function loadProfileContracts(
	profileDirectories: readonly string[],
): readonly ProfileContract[] {
	const profiles = profileDirectories.map((profileDirectory) =>
		loadProfileContract(profileDirectory),
	);

	assertUnique(
		profiles,
		(profile) => profile.id,
		(profileId) => `Duplicate profile id: ${profileId}`,
	);

	return profiles;
}

export function createProfileVersionLock(
	profile: ProfileContract,
): ProfileVersionLock {
	return {
		profileId: profile.id,
		profileName: profile.name,
		profileVersion: profile.version,
	};
}

function validateProfileContract(
	profile: ProfileContract,
	context: {
		readonly profileDirectory: string;
		readonly templatesDir: string | undefined;
		readonly yamlProfileIds: readonly string[];
	},
): void {
	const issues = [
		...validateVersionAlignment(profile),
		...validateProfileIdAlignment(profile, context.yamlProfileIds),
		...validateDuplicateIds(profile),
		...validateReferences(profile),
		...validateCanonicalDocuments(profile, context),
	];

	if (issues.length > 0) {
		throw new ProfileValidationError(
			`Profile ${profile.id} failed validation:\n${issues
				.map((issue) => `- ${issue}`)
				.join('\n')}`,
			issues,
		);
	}
}

function validateVersionAlignment(profile: ProfileContract): readonly string[] {
	return [
		['documents.yml', profile.documentsVersion],
		['questions.yml', profile.questionsVersion],
		['validations.yml', profile.validationsVersion],
	]
		.filter(([, version]) => version !== profile.version)
		.map(
			([contractName, version]) =>
				`${contractName} version ${version} must match profile version ${profile.version}.`,
		);
}

function validateProfileIdAlignment(
	profile: ProfileContract,
	yamlProfileIds: readonly string[],
): readonly string[] {
	return yamlProfileIds
		.filter((profileId) => profileId !== profile.id)
		.map(
			(profileId) =>
				`Contract profileId ${profileId} must match profile id ${profile.id}.`,
		);
}

function validateDuplicateIds(profile: ProfileContract): readonly string[] {
	return [
		...findDuplicateMessages(
			profile.phases,
			(phase) => phase.id,
			(phaseId) => `Duplicate phase id: ${phaseId}`,
		),
		...findDuplicateMessages(
			profile.documents,
			(document) => document.id,
			(documentId) => `Duplicate document id: ${documentId}`,
		),
		...findDuplicateMessages(
			profile.documents,
			(document) => document.path,
			(path) => `Duplicate document output path: ${path}`,
		),
		...findDuplicateMessages(
			profile.questionSets,
			(questionSet) => questionSet.id,
			(questionSetId) => `Duplicate question set id: ${questionSetId}`,
		),
		...findDuplicateMessages(
			profile.questionSets.flatMap((questionSet) => questionSet.questions),
			(question) => question.id,
			(questionId) => `Duplicate question id: ${questionId}`,
		),
		...findDuplicateMessages(
			profile.validationRules,
			(rule) => rule.id,
			(ruleId) => `Duplicate validation rule id: ${ruleId}`,
		),
		...findDuplicateMessages(
			profile.riskPatterns,
			(pattern) => pattern.id,
			(patternId) => `Duplicate risk pattern id: ${patternId}`,
		),
	];
}

function validateReferences(profile: ProfileContract): readonly string[] {
	const issues: string[] = [];
	const phaseIds = new Set(profile.phases.map((phase) => phase.id));
	const documentIds = new Set(profile.documents.map((document) => document.id));
	const validationRuleIds = new Set(
		profile.validationRules.map((rule) => rule.id),
	);

	for (const document of profile.documents) {
		if (!phaseIds.has(document.phaseId)) {
			issues.push(
				`Document ${document.id} references unknown phase ${document.phaseId}.`,
			);
		}

		for (const dependencyId of document.dependencies.documents) {
			if (!documentIds.has(dependencyId)) {
				issues.push(
					`Document ${document.id} references unknown dependency document ${dependencyId}.`,
				);
			}
		}

		for (const ruleId of document.validationRules) {
			if (!validationRuleIds.has(ruleId)) {
				issues.push(
					`Document ${document.id} references unknown validation rule ${ruleId}.`,
				);
			}
		}
	}

	for (const questionSet of profile.questionSets) {
		if (!phaseIds.has(questionSet.phaseId)) {
			issues.push(
				`Question set ${questionSet.id} references unknown phase ${questionSet.phaseId}.`,
			);
		}
	}

	for (const rule of profile.validationRules) {
		if (!phaseIds.has(rule.phaseId)) {
			issues.push(
				`Validation rule ${rule.id} references unknown phase ${rule.phaseId}.`,
			);
		}

		for (const documentId of rule.affectedDocuments) {
			if (!documentIds.has(documentId)) {
				issues.push(
					`Validation rule ${rule.id} references unknown document ${documentId}.`,
				);
			}
		}
	}

	for (const pattern of profile.riskPatterns) {
		if (!phaseIds.has(pattern.phaseId)) {
			issues.push(
				`Risk pattern ${pattern.id} references unknown phase ${pattern.phaseId}.`,
			);
		}

		for (const documentId of pattern.affectedDocuments) {
			if (!documentIds.has(documentId)) {
				issues.push(
					`Risk pattern ${pattern.id} references unknown document ${documentId}.`,
				);
			}
		}
	}

	return issues;
}

function validateCanonicalDocuments(
	profile: ProfileContract,
	context: {
		readonly profileDirectory: string;
		readonly templatesDir: string | undefined;
	},
): readonly string[] {
	const issues: string[] = [];
	const templateRoot = context.templatesDir
		? resolve(context.profileDirectory, context.templatesDir)
		: undefined;
	const shouldValidateTemplates = templateRoot
		? existsSync(templateRoot)
		: false;

	for (const document of profile.documents) {
		if (!document.path.startsWith('docs/')) {
			issues.push(`Document ${document.id} output path must be under docs/.`);
		}

		if (document.completionCriteria.length === 0) {
			issues.push(`Document ${document.id} must define completion criteria.`);
		}

		if (document.sections.length === 0) {
			issues.push(`Document ${document.id} must define section metadata.`);
		}

		if (shouldValidateTemplates) {
			if (!document.template) {
				issues.push(`Document ${document.id} must define a template path.`);
			} else if (
				!existsSync(resolve(context.profileDirectory, document.template))
			) {
				issues.push(
					`Document ${document.id} references missing template ${document.template}.`,
				);
			}
		}
	}

	return issues;
}

function readYamlContract<TSchema extends z.ZodType>(
	path: string,
	schema: TSchema,
): z.infer<TSchema> {
	const result = schema.safeParse(parse(readFileSync(path, 'utf8')));

	if (!result.success) {
		throw new ProfileValidationError(
			`Profile contract ${path} failed schema validation: ${z.prettifyError(result.error)}`,
		);
	}

	return result.data;
}

function assertUnique<TItem>(
	items: readonly TItem[],
	getId: (item: TItem) => string,
	createMessage: (id: string) => string,
): void {
	const duplicates = findDuplicateMessages(items, getId, createMessage);

	if (duplicates.length > 0) {
		throw new ProfileValidationError(
			`Profile collection failed validation:\n${duplicates
				.map((duplicate) => `- ${duplicate}`)
				.join('\n')}`,
			duplicates,
		);
	}
}

function findDuplicateMessages<TItem>(
	items: readonly TItem[],
	getId: (item: TItem) => string,
	createMessage: (id: string) => string,
): readonly string[] {
	const seenIds = new Set<string>();
	const duplicateIds = new Set<string>();

	for (const item of items) {
		const id = getId(item);

		if (seenIds.has(id)) {
			duplicateIds.add(id);
		}

		seenIds.add(id);
	}

	return [...duplicateIds].sort().map(createMessage);
}

export function getDefaultProfilesDirectory(): string {
	const moduleDirectory = dirname(fileURLToPath(import.meta.url));
	const candidates = [
		resolve(moduleDirectory, '../../profiles'),
		resolve(process.cwd(), 'profiles'),
	];

	const profilesDirectory = candidates.find((candidate) =>
		existsSync(candidate),
	);

	if (!profilesDirectory) {
		throw new ProfileValidationError(
			'Unable to locate a profiles directory for profile loading.',
		);
	}

	return profilesDirectory;
}

export function getDefaultProfileDirectory(profileId: string): string {
	const moduleDirectory = dirname(fileURLToPath(import.meta.url));
	const candidates = [
		resolve(moduleDirectory, '../../profiles', profileId),
		resolve(process.cwd(), 'profiles', profileId),
		resolve(process.cwd(), 'docs/05-profiles', profileId),
	];

	const profileDirectory = candidates.find((candidate) =>
		existsSync(resolve(candidate, 'profile.yml')),
	);

	if (profileDirectory) {
		return profileDirectory;
	}

	throw new ProfileValidationError(
		`Unable to locate profile ${profileId}. Expected profiles/${profileId}/profile.yml.`,
	);
}
