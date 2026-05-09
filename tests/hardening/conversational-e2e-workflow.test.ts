import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	createLogosApplicationServices,
	diagnoseWorkspace,
	endConversation,
	handleConversationMessage,
	handleSlashCommand,
	initializeWorkspace,
	loadCommandContext,
	parseSlashCommand,
	readWorkspaceState,
	resumeConversation,
} from '../../src/index.js';

function createProjectRoot(): string {
	const projectRoot = mkdtempSync(join(tmpdir(), 'logos-conv-e2e-'));
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

describe('conversational E2E workflow', () => {
	describe('init to conversation to generation', () => {
		it('completes the full workflow through AI-led conversation', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			const result1 = await handleConversationMessage(
				projectRoot,
				"I'm building a scheduling app for personal trainers to manage clients and sessions.",
			);
			expect(result1.status).not.toBe('error');
			expect(result1.turnCount).toBeGreaterThanOrEqual(2);
			expect(result1.aiMessages.length).toBeGreaterThan(0);

			const result2 = await handleConversationMessage(
				projectRoot,
				"Trainers currently use a mix of Google Calendar, WhatsApp, and spreadsheets. It's messy and they waste hours on admin.",
			);
			expect(result2.status).not.toBe('error');

			const state = readWorkspaceState(projectRoot);
			expect(state.answers.answers.length).toBeGreaterThanOrEqual(1);

			const generateResult = await runCommand(
				projectRoot,
				'/generate --refresh',
			);
			expect(generateResult.status).toBe('ok');
			expect(existsSync(join(projectRoot, 'docs'))).toBe(true);
		});

		it('generates documents from conversation-derived state', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await handleConversationMessage(
				projectRoot,
				'A task management app for remote teams. They struggle with async coordination across time zones.',
			);

			const state = readWorkspaceState(projectRoot);
			expect(
				state.answers.answers.filter((a) => a.status === 'answered'),
			).toHaveLength(1);

			const result = await runCommand(projectRoot, '/generate --refresh');
			expect(result.status).toBe('ok');
			expect(existsSync(join(projectRoot, 'docs', '00-intake'))).toBe(true);
		});

		it('AI-decisions enter as proposed, not confirmed', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await handleConversationMessage(
				projectRoot,
				'A mobile app that helps users track daily habits and build routines.',
			);

			const state = readWorkspaceState(projectRoot);

			for (const decision of state.decisions.decisions) {
				if (decision.status === 'proposed') {
					expect(decision.status).not.toBe('confirmed');
				}
			}

			const noAutoConfirmed = state.decisions.decisions.every(
				(d) => d.status !== 'confirmed',
			);
			expect(noAutoConfirmed).toBe(true);
		});
	});

	describe('conversation session management', () => {
		it('saves and resumes conversation sessions', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await handleConversationMessage(
				projectRoot,
				'An online marketplace for vintage clothing sellers.',
			);

			const endResult = endConversation(projectRoot);
			expect(endResult.status).toBe('ok');

			const resumeResult = resumeConversation(projectRoot);
			expect(resumeResult.turnCount).toBeGreaterThan(0);
		});

		it('starts a new session when no history exists', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			const resumeResult = resumeConversation(projectRoot);
			expect(resumeResult.status).toBe('no_provider');
			expect(resumeResult.turnCount).toBe(0);
			expect(resumeResult.aiMessage.length).toBeGreaterThan(0);
		});

		it('preserves conversation turns through session save', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await handleConversationMessage(
				projectRoot,
				'A platform connecting freelance designers with startups.',
			);

			const firstResult = endConversation(projectRoot);
			expect(firstResult.turnCount).toBeGreaterThanOrEqual(2);

			const resumeResult = resumeConversation(projectRoot);
			expect(resumeResult.turnCount).toBeGreaterThanOrEqual(2);
		});
	});

	describe('diagnostics with conversational recommendations', () => {
		it('recommends conversational next steps after partial intake', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await handleConversationMessage(
				projectRoot,
				'A SaaS analytics dashboard for e-commerce stores. Helps them track inventory and sales in one place.',
			);

			const diagnoseResult = await diagnoseWorkspace(projectRoot, {});
			expect(diagnoseResult.lines.length).toBeGreaterThan(0);
		});

		it('shows conversational guidance when no provider is active', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			const diagnoseResult = await diagnoseWorkspace(projectRoot, {});
			expect(diagnoseResult.lines.length).toBeGreaterThan(0);

			const msgResult = await handleConversationMessage(
				projectRoot,
				'An AI code review tool for development teams.',
			);

			expect(msgResult.providerStatus).toBe('no_provider');
			expect(msgResult.status).toBe('no_provider');
		});
	});

	describe('project state integrity', () => {
		it('preserves DecisionStatus separate from AiOutputStatus after conversation', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await handleConversationMessage(
				projectRoot,
				'A project management tool for marketing agencies.',
			);

			const state = readWorkspaceState(projectRoot);

			const validDecisionStatuses = [
				'unknown',
				'assumed',
				'proposed',
				'confirmed',
				'deprecated',
			];
			const aiStatuses = ['draft', 'proposed', 'needs_review', 'rejected'];

			for (const decision of state.decisions.decisions) {
				expect(validDecisionStatuses).toContain(decision.status);
				expect(aiStatuses).not.toContain(decision.status);
			}
		});

		it('maintains state files in valid, Git-friendly format after conversation', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await handleConversationMessage(
				projectRoot,
				'An employee onboarding platform for remote-first companies.',
			);

			const stateFiles = [
				'project.json',
				'answers.json',
				'decisions.json',
				'config.json',
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

		it('no raw tokens leak into config after conversation', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await handleConversationMessage(
				projectRoot,
				'A food delivery logistics platform for independent restaurants.',
			);

			const configPath = join(projectRoot, '.logos', 'config.json');
			if (existsSync(configPath)) {
				const content = readFileSync(configPath, 'utf8').toLowerCase();
				expect(content).not.toContain('sk-');
				expect(content).not.toContain('api_key');
			}
		});
	});

	describe('document generation from conversation', () => {
		it('creates canonical document tree from conversation-derived state', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await handleConversationMessage(
				projectRoot,
				'A subscription management platform for SaaS companies. Helps manage billing, invoices, and plan upgrades.',
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
		});

		it('includes frontmatter in generated documents', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await handleConversationMessage(
				projectRoot,
				'A community events platform for neighborhoods to organize local gatherings.',
			);

			await runCommand(projectRoot, '/generate --refresh');

			const ideaBriefPath = join(
				projectRoot,
				'docs',
				'00-intake',
				'IDEA_BRIEF.md',
			);
			if (existsSync(ideaBriefPath)) {
				const content = readFileSync(ideaBriefPath, 'utf8');
				expect(content).toContain('---');
				expect(content).toContain('generated_at');
			}
		});

		it('marks assumption-based and open-question content clearly', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await handleConversationMessage(
				projectRoot,
				'A peer-to-peer rental marketplace. Not sure if B2C or C2C. Assume mobile-first with potential web later.',
			);

			await runCommand(projectRoot, '/generate --refresh');

			const assumptionsPath = join(
				projectRoot,
				'docs',
				'00-intake',
				'ASSUMPTIONS.md',
			);
			if (existsSync(assumptionsPath)) {
				const content = readFileSync(assumptionsPath, 'utf8');
				expect(content.length).toBeGreaterThan(0);
			}
		});
	});

	describe('no live provider required', () => {
		it('full conversational workflow runs without live AI credentials', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			const convResult = await handleConversationMessage(
				projectRoot,
				'A team collaboration hub with real-time document editing.',
			);
			expect(convResult.status).not.toBe('error');

			const statusResult = await runCommand(projectRoot, '/status');
			expect(statusResult.status).toBe('ok');

			const validateResult = await runCommand(projectRoot, '/validate --all');
			expect(validateResult.status).toBeDefined();

			const diagnoseResult = await diagnoseWorkspace(projectRoot, {});
			expect(diagnoseResult.lines.length).toBeGreaterThan(0);

			const generateResult = await runCommand(
				projectRoot,
				'/generate --refresh',
			);
			expect(generateResult.status).toBe('ok');
		});

		it('repeated init is safe after conversation', async () => {
			const projectRoot = createProjectRoot();

			const first = initializeWorkspace(projectRoot);
			expect(first.status).toBe('created');

			await handleConversationMessage(
				projectRoot,
				'An API documentation generation tool for backend teams.',
			);

			const second = initializeWorkspace(projectRoot);
			expect(second.status).toBe('exists');

			expect(existsSync(join(projectRoot, '.logos', 'project.json'))).toBe(
				true,
			);
		});

		it('document regeneration is safe after conversation', async () => {
			const projectRoot = createProjectRoot();
			initializeWorkspace(projectRoot);

			await handleConversationMessage(
				projectRoot,
				'A no-code landing page builder for startups.',
			);

			await runCommand(projectRoot, '/generate --refresh');
			const firstResult = await runCommand(projectRoot, '/generate --refresh');
			expect(firstResult.status).toBe('ok');
		});
	});
});
