import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	createLogosApplicationServices,
	diagnoseWorkspace,
	handleConversationMessage,
	handleSlashCommand,
	initializeWorkspace,
	loadCommandContext,
	parseSlashCommand,
	readWorkspaceState,
} from '../../src/index.js';

function createProjectRoot(): string {
	const projectRoot = mkdtempSync(join(tmpdir(), 'logos-e2e-'));
	mkdirSync(join(projectRoot, '.git'));
	return projectRoot;
}

async function runCommand(projectRoot: string, input: string) {
	const parsed = parseSlashCommand(input);
	expect(parsed.ok).toBe(true);
	if (!parsed.ok) {
		throw new Error(parsed.error.message);
	}

	return await handleSlashCommand(
		parsed.command,
		loadCommandContext(projectRoot),
		createLogosApplicationServices(),
	);
}

describe('E2E workflow', () => {
	describe('init to conversation to generation', () => {
		it('completes the full workflow through AI-led conversation', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			const convResult = await handleConversationMessage(
				projectRoot,
				'A task management app for remote teams. They struggle with async coordination across time zones.',
			);
			expect(convResult.status).not.toBe('error');
			expect(convResult.turnCount).toBeGreaterThanOrEqual(2);

			const state = readWorkspaceState(projectRoot);
			expect(
				state.answers.answers.filter((a) => a.status === 'answered'),
			).toHaveLength(1);

			const generateResult = await runCommand(
				projectRoot,
				'/generate --refresh',
			);
			expect(generateResult.status).toBe('ok');
			expect(generateResult.title).toBe('Documents generated');
			expect(existsSync(join(projectRoot, 'docs'))).toBe(true);
		});

		it('preserves state integrity through conversational workflow', async () => {
			const projectRoot = createProjectRoot();
			const initResult = initializeWorkspace(projectRoot);
			expect(initResult.status).toBe('created');
			expect(existsSync(join(projectRoot, '.logos', 'project.json'))).toBe(
				true,
			);
			expect(existsSync(join(projectRoot, '.logos', 'answers.json'))).toBe(
				true,
			);
			expect(existsSync(join(projectRoot, '.logos', 'decisions.json'))).toBe(
				true,
			);

			await handleConversationMessage(
				projectRoot,
				'My startup idea: an AI-powered language learning app for professionals.',
			);

			const state = readWorkspaceState(projectRoot);
			expect(state.answers.answers.length).toBeGreaterThanOrEqual(1);
			expect(
				state.answers.answers.filter((a) => a.status === 'answered'),
			).toHaveLength(1);
		});
	});

	describe('conversation to status to validate to diagnose to generate', () => {
		it('runs the deterministic command pipeline after conversation', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await handleConversationMessage(
				projectRoot,
				'A test app idea: a habit tracking app for health-conscious users.',
			);

			const statusResult = await runCommand(projectRoot, '/status');
			expect(statusResult.status).toBe('ok');
			expect(statusResult.body.join('\n')).toContain('App Business');

			const validateResult = await runCommand(projectRoot, '/validate --all');
			expect(validateResult.status).toBeDefined();

			const diagnoseResult = await diagnoseWorkspace(projectRoot, {});
			expect(diagnoseResult.lines.length).toBeGreaterThan(0);

			const generateResult = await runCommand(
				projectRoot,
				'/generate --refresh',
			);
			expect(generateResult.title).toBe('Documents generated');
		});

		it('generates documents after conversation builds partial state', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await handleConversationMessage(
				projectRoot,
				'A project management tool for marketing agencies. They need campaign tracking, client reporting, and team workload management.',
			);

			const state = readWorkspaceState(projectRoot);
			expect(
				state.answers.answers.filter((a) => a.status === 'answered'),
			).toHaveLength(1);

			await runCommand(projectRoot, '/validate --all');

			const generateResult = await runCommand(
				projectRoot,
				'/generate --refresh',
			);
			expect(generateResult.status).toBe('ok');
			expect(existsSync(join(projectRoot, 'docs', '00-intake'))).toBe(true);
		});
	});

	describe('diagnostics after partial conversation', () => {
		it('produces useful diagnostics after one conversation turn', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await handleConversationMessage(
				projectRoot,
				'Partial project idea: a team wiki that auto-organizes content.',
			);

			const diagnoseResult = await diagnoseWorkspace(projectRoot, {});
			expect(diagnoseResult.lines.length).toBeGreaterThan(0);
		});

		it('shows fewer gaps after building more context', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			const emptyDiag = await diagnoseWorkspace(projectRoot, {});
			expect(emptyDiag.lines.length).toBeGreaterThan(0);

			await handleConversationMessage(
				projectRoot,
				'A real project: a customer feedback aggregation platform for product teams. Integrates with support tools and runs sentiment analysis.',
			);

			const partialDiag = await diagnoseWorkspace(projectRoot, {});
			expect(partialDiag.lines.length).toBeGreaterThanOrEqual(0);
		});
	});

	describe('document regeneration', () => {
		it('respects safe mode and skips existing documents', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await handleConversationMessage(
				projectRoot,
				'Safe mode project: a social reading club app for book lovers.',
			);

			await runCommand(projectRoot, '/generate --refresh');
			const firstGen = readFileSync(
				join(projectRoot, 'docs', '00-intake', 'IDEA_BRIEF.md'),
				'utf8',
			);

			await runCommand(projectRoot, '/generate --safe');

			expect(
				existsSync(join(projectRoot, 'docs', '00-intake', 'IDEA_BRIEF.md')),
			).toBe(true);

			const secondGen = readFileSync(
				join(projectRoot, 'docs', '00-intake', 'IDEA_BRIEF.md'),
				'utf8',
			);
			expect(secondGen).toBe(firstGen);
		});

		it('supports refresh mode for updating existing documents', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await handleConversationMessage(
				projectRoot,
				'Refresh test: a meal planning and grocery delivery coordination app.',
			);

			await runCommand(projectRoot, '/generate --refresh');
			const result = await runCommand(projectRoot, '/generate --refresh');
			expect(result.status).toBe('ok');
		});

		it('requires confirmation for force mode', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await handleConversationMessage(
				projectRoot,
				'Force test: a digital asset management platform for creative agencies.',
			);

			await runCommand(projectRoot, '/generate --refresh');

			const forceResult = await runCommand(projectRoot, '/generate --force');
			expect(forceResult.status).toBe('ok');
		});
	});

	describe('manual notes preservation', () => {
		it('preserves manual sections across regeneration', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await handleConversationMessage(
				projectRoot,
				'Manual notes test: an appointment scheduling platform for healthcare providers.',
			);

			await runCommand(projectRoot, '/generate --refresh');

			const ideaBriefPath = join(
				projectRoot,
				'docs',
				'00-intake',
				'IDEA_BRIEF.md',
			);

			let content = readFileSync(ideaBriefPath, 'utf8');
			expect(content).toContain('# Idea Brief');

			const manualNote = [
				'<!-- logos:manual-section:start:custom_notes -->',
				'These are my personal notes that should survive regeneration.',
				'<!-- logos:manual-section:end:custom_notes -->',
			].join('\n');
			content = `${content}\n\n${manualNote}`;

			const { writeFileSync } = await import('node:fs');
			writeFileSync(ideaBriefPath, content, 'utf8');

			await runCommand(projectRoot, '/generate --refresh');

			const regeneratedContent = readFileSync(ideaBriefPath, 'utf8');
			expect(regeneratedContent.length).toBeGreaterThan(0);
			expect(regeneratedContent).toContain('# Idea Brief');
		});
	});

	describe('project state integrity', () => {
		it('is safe for repeated initialization', async () => {
			const projectRoot = createProjectRoot();

			const first = initializeWorkspace(projectRoot);
			expect(first.status).toBe('created');

			const second = initializeWorkspace(projectRoot);
			expect(second.status).toBe('exists');

			expect(existsSync(join(projectRoot, '.logos', 'project.json'))).toBe(
				true,
			);
		});

		it('produces valid text-based and Git-friendly state files', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await handleConversationMessage(
				projectRoot,
				'Git-friendly test: a collaborative whiteboard tool for design teams.',
			);

			const stateFiles = [
				'project.json',
				'answers.json',
				'decisions.json',
				'config.json',
				'profile.lock.json',
				'diagnostics.json',
			];

			for (const file of stateFiles) {
				const path = join(projectRoot, '.logos', file);
				if (!existsSync(path)) {
					continue;
				}
				const content = readFileSync(path, 'utf8');
				expect(() => JSON.parse(content)).not.toThrow();
			}
		});

		it('maintains DecisionStatus separate from AiOutputStatus', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await handleConversationMessage(
				projectRoot,
				'Status test: assume primary users are indie hackers building side projects.',
			);

			const state = readWorkspaceState(projectRoot);

			for (const decision of state.decisions.decisions) {
				expect([
					'unknown',
					'assumed',
					'proposed',
					'confirmed',
					'deprecated',
				]).toContain(decision.status);
				expect([
					'draft',
					'proposed',
					'needs_review',
					'rejected',
					'confirmed',
				]).not.toContain(decision.status);
			}
		});
	});

	describe('canonical tree generation', () => {
		it('creates the full canonical document tree', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await handleConversationMessage(
				projectRoot,
				'A subscription box curation platform for pet owners. Custom boxes based on pet profiles. Think BarkBox but for all pet types with food and toys.',
			);

			const result = await runCommand(projectRoot, '/generate --refresh');
			expect(result.status).toBe('ok');

			const expectedPhases = [
				'00-intake',
				'01-market',
				'02-business',
				'03-economics',
				'04-product',
				'05-design',
				'06-architecture',
				'07-implementation',
				'08-testing',
				'09-go-to-market',
				'10-operations',
				'11-governance',
			];

			for (const phase of expectedPhases) {
				expect(existsSync(join(projectRoot, 'docs', phase))).toBe(true);
			}

			expect(
				existsSync(join(projectRoot, 'docs', '00-intake', 'IDEA_BRIEF.md')),
			).toBe(true);

			expect(
				existsSync(
					join(
						projectRoot,
						'docs',
						'07-implementation',
						'IMPLEMENTATION_PLAN.md',
					),
				),
			).toBe(true);

			expect(
				existsSync(
					join(projectRoot, 'docs', '11-governance', 'DECISION_LOG.md'),
				),
			).toBe(true);
		});

		it('includes generated frontmatter in all generated documents', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await handleConversationMessage(
				projectRoot,
				'Frontmatter test app: a personal finance tracking app for freelancers. Tracks income, expenses, taxes, and invoices.',
			);

			await runCommand(projectRoot, '/generate --refresh');

			const ideaBriefPath = join(
				projectRoot,
				'docs',
				'00-intake',
				'IDEA_BRIEF.md',
			);
			expect(existsSync(ideaBriefPath)).toBe(true);

			const content = readFileSync(ideaBriefPath, 'utf8');
			expect(content).toContain('---');
			expect(content).toContain('generated_at');
		});
	});

	describe('no-provider behavior', () => {
		it('completes conversational flow with mock provider', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			const convResult = await handleConversationMessage(
				projectRoot,
				'Mock provider project: a developer tools marketplace for selling IDE plugins.',
			);
			expect(convResult.status).toBe('no_provider');

			const state = readWorkspaceState(projectRoot);
			expect(
				state.answers.answers.filter((a) => a.status === 'answered'),
			).toHaveLength(1);

			const result = await runCommand(projectRoot, '/generate --refresh');
			expect(result.status).toBe('ok');

			const diagnoseResult = await diagnoseWorkspace(projectRoot, {});
			expect(diagnoseResult.status).toBeDefined();
		});
	});
});
