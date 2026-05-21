import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	DocumentDescriptorValidationErrorClass,
	loadAndValidateDocumentDescriptor,
	loadDocumentSchema,
	loadProfileRegistry,
	setDocumentSchemaForValidation,
	validateDocumentDescriptor,
} from '../src/index.js';

const FIXTURES_ROOT = resolve(
	process.cwd(),
	'tests',
	'fixtures',
	'document-descriptors',
);
const STANDARD_PROFILE_ROOT = resolve(process.cwd(), 'profiles', 'standard');

async function discoverBundledDocumentDescriptors(): Promise<string[]> {
	const registry = await loadProfileRegistry({
		profileId: 'standard',
		repoRoot: process.cwd(),
	});

	const documentPaths: string[] = [];

	for (const phaseEntry of registry.phaseRegistry.files) {
		const phasePath = resolve(registry.paths.profileRoot, phaseEntry.path);
		// Phase files may be either phase definitions (e.g. 01-foundation.yml)
		// or not exist if they are directories. We only care about phase files
		// that define document registries.
		try {
			const { readFileSync } = await import('node:fs');
			const raw = readFileSync(phasePath, 'utf-8');
			const { default: YAML } = await import('yaml');
			const parsed = YAML.parse(raw) as Record<string, unknown>;
			const phase = parsed.phase as Record<string, unknown> | undefined;
			const documents = phase?.documents as
				| Array<{ file?: string }>
				| undefined;
			if (Array.isArray(documents)) {
				for (const doc of documents) {
					if (typeof doc.file === 'string') {
						documentPaths.push(resolve(registry.paths.profileRoot, doc.file));
					}
				}
			}
		} catch {
			// Phase file may not exist or may not have a documents list;
			// skip silently for this discovery helper.
		}
	}

	return documentPaths;
}

describe('loadDocumentSchema', () => {
	it('loads and parses the Standard document schema successfully', async () => {
		const schema = await loadDocumentSchema({
			profileRoot: STANDARD_PROFILE_ROOT,
		});

		expect(schema.requiredFields).toContain('id');
		expect(schema.requiredFields).toContain('title');
		expect(schema.requiredFields).toContain('phase');
		expect(schema.requiredFields).toContain('type');
		expect(schema.requiredFields).toContain('status');
		expect(schema.requiredFields).toContain('purpose');
		expect(schema.requiredFields).toContain('centralQuestion');
		expect(schema.requiredFields).toContain('outputs');
		expect(schema.requiredFields).toContain('sections');
	});

	it('fails with a path-aware diagnostic when schema file is missing', async () => {
		try {
			await loadDocumentSchema({ schemaPath: '/nonexistent/path.yml' });
			expect.fail('Expected loadDocumentSchema to throw');
		} catch (err) {
			expect(err).toBeInstanceOf(DocumentDescriptorValidationErrorClass);
			const error = err as DocumentDescriptorValidationErrorClass;
			expect(error.errors).toHaveLength(1);
			expect(error.errors[0].code).toBe('E_SCHEMA_MISSING_FILE');
			expect(error.errors[0].path).toContain('/nonexistent/path.yml');
		}
	});
});

describe('validateDocumentDescriptor', () => {
	it('validates a well-formed descriptor with schema-driven checks', async () => {
		const schema = await loadDocumentSchema({
			profileRoot: STANDARD_PROFILE_ROOT,
		});
		setDocumentSchemaForValidation(schema);

		const descriptor = {
			centralQuestion: 'Test question?',
			id: '01-test',
			outputs: {
				canonical: {
					format: 'markdown',
					path: 'docs/test.md',
				},
			},
			phase: '01-foundation',
			purpose: 'Test purpose.',
			sections: [
				{
					id: 'sec-1',
					questions: ['What?'],
					title: 'Section 1',
				},
			],
			status: 'not_started',
			title: 'Test',
			type: 'thesis',
		};

		const result = validateDocumentDescriptor(descriptor);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it('fails when id is missing', async () => {
		const schema = await loadDocumentSchema({
			profileRoot: STANDARD_PROFILE_ROOT,
		});
		setDocumentSchemaForValidation(schema);

		const descriptor = {
			centralQuestion: 'Test question?',
			outputs: {
				canonical: {
					format: 'markdown',
					path: 'docs/test.md',
				},
			},
			phase: '01-foundation',
			purpose: 'Test purpose.',
			sections: [],
			status: 'not_started',
			title: 'Test',
			type: 'thesis',
		};

		const result = validateDocumentDescriptor(descriptor);
		expect(result.valid).toBe(false);
		const missingId = result.errors.find((e) => e.fieldPath === 'id');
		expect(missingId).toBeDefined();
		expect(missingId?.code).toBe('E_FIELD_MISSING');
	});

	it('fails when canonical output path is missing', async () => {
		const schema = await loadDocumentSchema({
			profileRoot: STANDARD_PROFILE_ROOT,
		});
		setDocumentSchemaForValidation(schema);

		const descriptor = {
			centralQuestion: 'Test question?',
			id: '01-test',
			outputs: {
				canonical: {
					format: 'markdown',
				},
			},
			phase: '01-foundation',
			purpose: 'Test purpose.',
			sections: [],
			status: 'not_started',
			title: 'Test',
			type: 'thesis',
		};

		const result = validateDocumentDescriptor(descriptor);
		expect(result.valid).toBe(false);
		const missingPath = result.errors.find(
			(e) => e.fieldPath === 'outputs.canonical.path',
		);
		expect(missingPath).toBeDefined();
		expect(missingPath?.code).toBe('E_FIELD_MISSING');
	});

	it('fails when output artifact format is invalid', async () => {
		const schema = await loadDocumentSchema({
			profileRoot: STANDARD_PROFILE_ROOT,
		});
		setDocumentSchemaForValidation(schema);

		const descriptor = {
			centralQuestion: 'Test question?',
			id: '01-test',
			outputs: {
				artifacts: [
					{
						format: 'docx',
						id: 'art-1',
						path: 'out/test.docx',
						purpose: 'Invalid format.',
					},
				],
				canonical: {
					format: 'markdown',
					path: 'docs/test.md',
				},
			},
			phase: '01-foundation',
			purpose: 'Test purpose.',
			sections: [],
			status: 'not_started',
			title: 'Test',
			type: 'thesis',
		};

		const result = validateDocumentDescriptor(descriptor);
		expect(result.valid).toBe(false);
		const invalidFormat = result.errors.find(
			(e) =>
				e.fieldPath === 'outputs.artifacts[0].format' &&
				e.code === 'E_FIELD_DISALLOWED_VALUE',
		);
		expect(invalidFormat).toBeDefined();
	});

	it('fails when dependency shape is invalid', async () => {
		const schema = await loadDocumentSchema({
			profileRoot: STANDARD_PROFILE_ROOT,
		});
		setDocumentSchemaForValidation(schema);

		const descriptor = {
			centralQuestion: 'Test question?',
			id: '01-test',
			inputs: [
				{
					type: 'manual_note',
				},
			],
			outputs: {
				canonical: {
					format: 'markdown',
					path: 'docs/test.md',
				},
			},
			phase: '01-foundation',
			purpose: 'Test purpose.',
			sections: [],
			status: 'not_started',
			title: 'Test',
			type: 'thesis',
		};

		const result = validateDocumentDescriptor(descriptor);
		expect(result.valid).toBe(false);
		const missingInputId = result.errors.find(
			(e) => e.fieldPath === 'inputs[0].id' && e.code === 'E_FIELD_MISSING',
		);
		expect(missingInputId).toBeDefined();
	});

	it('fails when section shape is invalid', async () => {
		const schema = await loadDocumentSchema({
			profileRoot: STANDARD_PROFILE_ROOT,
		});
		setDocumentSchemaForValidation(schema);

		const descriptor = {
			centralQuestion: 'Test question?',
			id: '01-test',
			outputs: {
				canonical: {
					format: 'markdown',
					path: 'docs/test.md',
				},
			},
			phase: '01-foundation',
			purpose: 'Test purpose.',
			sections: [
				{
					id: 'sec-1',
					title: 'Section 1',
				},
			],
			status: 'not_started',
			title: 'Test',
			type: 'thesis',
		};

		const result = validateDocumentDescriptor(descriptor);
		expect(result.valid).toBe(false);
		const missingQuestions = result.errors.find(
			(e) =>
				e.fieldPath === 'sections[0].questions' && e.code === 'E_FIELD_MISSING',
		);
		expect(missingQuestions).toBeDefined();
	});

	it('fails when completionCriteria is not an array of strings', async () => {
		const schema = await loadDocumentSchema({
			profileRoot: STANDARD_PROFILE_ROOT,
		});
		setDocumentSchemaForValidation(schema);

		const descriptor = {
			centralQuestion: 'Test question?',
			completionCriteria: 'not an array',
			id: '01-test',
			outputs: {
				canonical: {
					format: 'markdown',
					path: 'docs/test.md',
				},
			},
			phase: '01-foundation',
			purpose: 'Test purpose.',
			sections: [],
			status: 'not_started',
			title: 'Test',
			type: 'thesis',
		};

		const result = validateDocumentDescriptor(descriptor);
		expect(result.valid).toBe(false);
		const badType = result.errors.find(
			(e) => e.fieldPath === 'completionCriteria' && e.code === 'E_FIELD_TYPE',
		);
		expect(badType).toBeDefined();
	});

	it('fails when qualityChecks is not an array of strings', async () => {
		const schema = await loadDocumentSchema({
			profileRoot: STANDARD_PROFILE_ROOT,
		});
		setDocumentSchemaForValidation(schema);

		const descriptor = {
			centralQuestion: 'Test question?',
			id: '01-test',
			outputs: {
				canonical: {
					format: 'markdown',
					path: 'docs/test.md',
				},
			},
			phase: '01-foundation',
			purpose: 'Test purpose.',
			qualityChecks: { invalid: true },
			sections: [],
			status: 'not_started',
			title: 'Test',
			type: 'thesis',
		};

		const result = validateDocumentDescriptor(descriptor);
		expect(result.valid).toBe(false);
		const badType = result.errors.find(
			(e) => e.fieldPath === 'qualityChecks' && e.code === 'E_FIELD_TYPE',
		);
		expect(badType).toBeDefined();
	});

	it('fails when antiPatterns is not an array of strings', async () => {
		const schema = await loadDocumentSchema({
			profileRoot: STANDARD_PROFILE_ROOT,
		});
		setDocumentSchemaForValidation(schema);

		const descriptor = {
			antiPatterns: 42,
			centralQuestion: 'Test question?',
			id: '01-test',
			outputs: {
				canonical: {
					format: 'markdown',
					path: 'docs/test.md',
				},
			},
			phase: '01-foundation',
			purpose: 'Test purpose.',
			sections: [],
			status: 'not_started',
			title: 'Test',
			type: 'thesis',
		};

		const result = validateDocumentDescriptor(descriptor);
		expect(result.valid).toBe(false);
		const badType = result.errors.find(
			(e) => e.fieldPath === 'antiPatterns' && e.code === 'E_FIELD_TYPE',
		);
		expect(badType).toBeDefined();
	});

	it('fails when generationRules and reviewRules are not arrays of strings', async () => {
		const schema = await loadDocumentSchema({
			profileRoot: STANDARD_PROFILE_ROOT,
		});
		setDocumentSchemaForValidation(schema);

		const descriptor = {
			centralQuestion: 'Test question?',
			generationRules: 'not an array',
			id: '01-test',
			outputs: {
				canonical: {
					format: 'markdown',
					path: 'docs/test.md',
				},
			},
			phase: '01-foundation',
			purpose: 'Test purpose.',
			reviewRules: true,
			sections: [],
			status: 'not_started',
			title: 'Test',
			type: 'thesis',
		};

		const result = validateDocumentDescriptor(descriptor);
		expect(result.valid).toBe(false);
		const badGen = result.errors.find(
			(e) => e.fieldPath === 'generationRules' && e.code === 'E_FIELD_TYPE',
		);
		const badRev = result.errors.find(
			(e) => e.fieldPath === 'reviewRules' && e.code === 'E_FIELD_TYPE',
		);
		expect(badGen).toBeDefined();
		expect(badRev).toBeDefined();
	});
});

describe('loadAndValidateDocumentDescriptor', () => {
	it('loads and validates a valid fixture descriptor file', async () => {
		const descriptor = await loadAndValidateDocumentDescriptor(
			join(FIXTURES_ROOT, 'valid-minimal.yml'),
			{ profileRoot: STANDARD_PROFILE_ROOT },
		);

		expect(descriptor.id).toBe('test-doc');
		expect(descriptor.title).toBe('Test Document');
	});

	it('fails with path-aware diagnostic when file is missing', async () => {
		try {
			await loadAndValidateDocumentDescriptor('/nonexistent/descriptor.yml');
			expect.fail('Expected loadAndValidateDocumentDescriptor to throw');
		} catch (err) {
			expect(err).toBeInstanceOf(DocumentDescriptorValidationErrorClass);
			const error = err as DocumentDescriptorValidationErrorClass;
			expect(error.errors).toHaveLength(1);
			expect(error.errors[0].code).toBe('E_DESCRIPTOR_MISSING_FILE');
			expect(error.errors[0].path).toBe('/nonexistent/descriptor.yml');
		}
	});

	it('fails instead of falling back when the descriptor schema is missing', async () => {
		try {
			await loadAndValidateDocumentDescriptor(
				join(FIXTURES_ROOT, 'valid-minimal.yml'),
				{ schemaPath: '/nonexistent/document.schema.yml' },
			);
			expect.fail('Expected loadAndValidateDocumentDescriptor to throw');
		} catch (err) {
			expect(err).toBeInstanceOf(DocumentDescriptorValidationErrorClass);
			const error = err as DocumentDescriptorValidationErrorClass;
			expect(error.errors).toHaveLength(1);
			expect(error.errors[0].code).toBe('E_SCHEMA_MISSING_FILE');
			expect(error.errors[0].path).toBe('/nonexistent/document.schema.yml');
		}
	});

	it('fails with path-aware diagnostic for missing id fixture', async () => {
		try {
			await loadAndValidateDocumentDescriptor(
				join(FIXTURES_ROOT, 'missing-id.yml'),
				{ profileRoot: STANDARD_PROFILE_ROOT },
			);
			expect.fail('Expected loadAndValidateDocumentDescriptor to throw');
		} catch (err) {
			expect(err).toBeInstanceOf(DocumentDescriptorValidationErrorClass);
			const error = err as DocumentDescriptorValidationErrorClass;
			const missingId = error.errors.find((e) => e.fieldPath === 'id');
			expect(missingId).toBeDefined();
			expect(missingId?.code).toBe('E_FIELD_MISSING');
			expect(missingId?.path).toContain('missing-id.yml');
		}
	});

	it('fails with path-aware diagnostic for missing canonical path fixture', async () => {
		try {
			await loadAndValidateDocumentDescriptor(
				join(FIXTURES_ROOT, 'missing-canonical-path.yml'),
				{ profileRoot: STANDARD_PROFILE_ROOT },
			);
			expect.fail('Expected loadAndValidateDocumentDescriptor to throw');
		} catch (err) {
			expect(err).toBeInstanceOf(DocumentDescriptorValidationErrorClass);
			const error = err as DocumentDescriptorValidationErrorClass;
			const missingPath = error.errors.find(
				(e) => e.fieldPath === 'outputs.canonical.path',
			);
			expect(missingPath).toBeDefined();
			expect(missingPath?.code).toBe('E_FIELD_MISSING');
		}
	});

	it('fails with path-aware diagnostic for invalid output type fixture', async () => {
		try {
			await loadAndValidateDocumentDescriptor(
				join(FIXTURES_ROOT, 'invalid-output-type.yml'),
				{ profileRoot: STANDARD_PROFILE_ROOT },
			);
			expect.fail('Expected loadAndValidateDocumentDescriptor to throw');
		} catch (err) {
			expect(err).toBeInstanceOf(DocumentDescriptorValidationErrorClass);
			const error = err as DocumentDescriptorValidationErrorClass;
			const invalidFormat = error.errors.find(
				(e) =>
					e.fieldPath === 'outputs.artifacts[0].format' &&
					e.code === 'E_FIELD_DISALLOWED_VALUE',
			);
			expect(invalidFormat).toBeDefined();
		}
	});

	it('fails with path-aware diagnostic for invalid dependency shape fixture', async () => {
		try {
			await loadAndValidateDocumentDescriptor(
				join(FIXTURES_ROOT, 'invalid-dependency-shape.yml'),
				{ profileRoot: STANDARD_PROFILE_ROOT },
			);
			expect.fail('Expected loadAndValidateDocumentDescriptor to throw');
		} catch (err) {
			expect(err).toBeInstanceOf(DocumentDescriptorValidationErrorClass);
			const error = err as DocumentDescriptorValidationErrorClass;
			const badShape = error.errors.find(
				(e) => e.fieldPath === 'inputs[0].id' && e.code === 'E_FIELD_MISSING',
			);
			expect(badShape).toBeDefined();
		}
	});

	it('fails with path-aware diagnostic for invalid sections shape fixture', async () => {
		try {
			await loadAndValidateDocumentDescriptor(
				join(FIXTURES_ROOT, 'invalid-sections-shape.yml'),
				{ profileRoot: STANDARD_PROFILE_ROOT },
			);
			expect.fail('Expected loadAndValidateDocumentDescriptor to throw');
		} catch (err) {
			expect(err).toBeInstanceOf(DocumentDescriptorValidationErrorClass);
			const error = err as DocumentDescriptorValidationErrorClass;
			const missingQuestions = error.errors.find(
				(e) =>
					e.fieldPath === 'sections[0].questions' &&
					e.code === 'E_FIELD_MISSING',
			);
			expect(missingQuestions).toBeDefined();
		}
	});

	it('fails with path-aware diagnostic for invalid completion criteria fixture', async () => {
		try {
			await loadAndValidateDocumentDescriptor(
				join(FIXTURES_ROOT, 'invalid-completion-criteria.yml'),
				{ profileRoot: STANDARD_PROFILE_ROOT },
			);
			expect.fail('Expected loadAndValidateDocumentDescriptor to throw');
		} catch (err) {
			expect(err).toBeInstanceOf(DocumentDescriptorValidationErrorClass);
			const error = err as DocumentDescriptorValidationErrorClass;
			const badType = error.errors.find(
				(e) =>
					e.fieldPath === 'completionCriteria' && e.code === 'E_FIELD_TYPE',
			);
			expect(badType).toBeDefined();
		}
	});

	it('fails with path-aware diagnostic for invalid quality checks fixture', async () => {
		try {
			await loadAndValidateDocumentDescriptor(
				join(FIXTURES_ROOT, 'invalid-quality-checks.yml'),
				{ profileRoot: STANDARD_PROFILE_ROOT },
			);
			expect.fail('Expected loadAndValidateDocumentDescriptor to throw');
		} catch (err) {
			expect(err).toBeInstanceOf(DocumentDescriptorValidationErrorClass);
			const error = err as DocumentDescriptorValidationErrorClass;
			const badType = error.errors.find(
				(e) => e.fieldPath === 'qualityChecks' && e.code === 'E_FIELD_TYPE',
			);
			expect(badType).toBeDefined();
		}
	});

	it('fails with path-aware diagnostic for invalid anti-patterns fixture', async () => {
		try {
			await loadAndValidateDocumentDescriptor(
				join(FIXTURES_ROOT, 'invalid-anti-patterns.yml'),
				{ profileRoot: STANDARD_PROFILE_ROOT },
			);
			expect.fail('Expected loadAndValidateDocumentDescriptor to throw');
		} catch (err) {
			expect(err).toBeInstanceOf(DocumentDescriptorValidationErrorClass);
			const error = err as DocumentDescriptorValidationErrorClass;
			const badType = error.errors.find(
				(e) => e.fieldPath === 'antiPatterns' && e.code === 'E_FIELD_TYPE',
			);
			expect(badType).toBeDefined();
		}
	});

	it('fails with path-aware diagnostic for invalid generation/review rules fixture', async () => {
		try {
			await loadAndValidateDocumentDescriptor(
				join(FIXTURES_ROOT, 'invalid-generation-review-rules.yml'),
				{ profileRoot: STANDARD_PROFILE_ROOT },
			);
			expect.fail('Expected loadAndValidateDocumentDescriptor to throw');
		} catch (err) {
			expect(err).toBeInstanceOf(DocumentDescriptorValidationErrorClass);
			const error = err as DocumentDescriptorValidationErrorClass;
			const badGen = error.errors.find(
				(e) => e.fieldPath === 'generationRules' && e.code === 'E_FIELD_TYPE',
			);
			const badRev = error.errors.find(
				(e) => e.fieldPath === 'reviewRules' && e.code === 'E_FIELD_TYPE',
			);
			expect(badGen).toBeDefined();
			expect(badRev).toBeDefined();
		}
	});
});

describe('Bundled Standard profile document descriptors', () => {
	it('validates all bundled Standard document descriptors', async () => {
		const documentPaths = await discoverBundledDocumentDescriptors();
		expect(documentPaths.length).toBeGreaterThan(0);

		for (const docPath of documentPaths) {
			// We validate each descriptor individually and collect failures
			// so the test reports all failing files rather than stopping at
			// the first one.
			await expect(
				loadAndValidateDocumentDescriptor(docPath, {
					profileRoot: STANDARD_PROFILE_ROOT,
				}),
			).resolves.toBeDefined();
		}
	});
});
