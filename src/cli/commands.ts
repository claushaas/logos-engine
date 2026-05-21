import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPackageMetadata } from '../index.js';
import { loadProfileRegistry } from '../profiles/profile-registry.js';
import type { CommandResult } from '../runtime/command-result.js';
import {
	createCommandResult,
	formatCommandResultForHuman,
	toJsonSerializable,
} from '../runtime/command-result.js';
import type { ProjectContext } from '../runtime/project-context.js';
import {
	detectProjectContext,
	formatProjectContextLines,
} from '../runtime/project-context.js';
import { redactAndRelativize } from '../runtime/redaction.js';
import { getWorkspaceStatusSummary } from '../state/workspace-status.js';
import { EXIT_STARTUP_FAILURE, EXIT_SUCCESS } from './exit-codes.js';

export interface DoctorOptions {
	json?: boolean;
	dryRun?: boolean;
}

export interface DoctorData {
	nodeVersion: string;
	packageName: string;
	packageVersion: string;
	cwd: string;
	projectRoot: string | null;
	rootKind: string;
	logosPath: string;
	initializationState: string;
	documentationRoot: string;
	activeProfile: string | null;
	providerStatus: string;
	diagnostics: Array<{
		code: string;
		severity: string;
		message: string;
		path: string | null;
		recoveryHint: string | null;
	}>;
	sessionSummary?: {
		totalSessions: number;
		activeSessions: number;
	};
	runSummary?: {
		totalRuns: number;
		totalValidationRuns: number;
		totalDiagnosticRuns: number;
		totalGenerationRuns: number;
		totalExecutiveRuns: number;
	};
	artifactSummary?: {
		totalArtifacts: number;
		canonicalCount: number;
		nonCanonicalCount: number;
	};
}

export async function doctorCommand(
	options: DoctorOptions = {},
): Promise<number> {
	const meta = getPackageMetadata();
	const dryRun = options.dryRun ?? false;

	const ctx = detectProjectContext();

	// Try to load workspace status summary for enhanced reporting
	let statusSummary:
		| Awaited<ReturnType<typeof getWorkspaceStatusSummary>>
		| undefined;
	try {
		statusSummary = await getWorkspaceStatusSummary({
			projectRoot: ctx.root.rootPath ?? ctx.cwd,
		});
	} catch {
		// Non-mutating: ignore state read failures in doctor
	}

	const data: DoctorData = {
		activeProfile: ctx.config.activeProfileId,
		cwd: ctx.cwd,
		diagnostics: ctx.diagnostics.map((d) => ({
			code: d.code,
			message: d.message,
			path: d.path,
			recoveryHint: d.recoveryHint,
			severity: d.severity,
		})),
		documentationRoot: ctx.config.documentationRoot.rootPath,
		initializationState: ctx.workspace.initializationState,
		logosPath: ctx.workspace.logosPath,
		nodeVersion: process.version,
		packageName: meta.name,
		packageVersion: meta.version,
		projectRoot: ctx.root.rootPath,
		providerStatus: formatProviderStatusForJson(ctx.config.providerStatus),
		rootKind: ctx.root.rootKind,
	};

	if (statusSummary && statusSummary.initializationState === 'initialized') {
		data.sessionSummary = {
			activeSessions: statusSummary.sessionSummary.activeSessions,
			totalSessions: statusSummary.sessionSummary.totalSessions,
		};
		data.runSummary = {
			totalDiagnosticRuns: statusSummary.runSummary.totalDiagnosticRuns,
			totalExecutiveRuns: statusSummary.runSummary.totalExecutiveRuns,
			totalGenerationRuns: statusSummary.runSummary.totalGenerationRuns,
			totalRuns: statusSummary.runSummary.totalRuns,
			totalValidationRuns: statusSummary.runSummary.totalValidationRuns,
		};
		data.artifactSummary = {
			canonicalCount: statusSummary.artifactSummary.canonicalCount,
			nonCanonicalCount: statusSummary.artifactSummary.nonCanonicalCount,
			totalArtifacts: statusSummary.artifactSummary.totalArtifacts,
		};
	}

	const warnings: CommandResult['warnings'] = [];
	const errors: CommandResult['errors'] = [];
	const messages: CommandResult['messages'] = [];

	messages.push({ level: 'info', text: `Node.js:   ${process.version}` });
	messages.push({
		level: 'info',
		text: `Package:   ${meta.name} v${meta.version}`,
	});

	// Include project context lines as messages
	for (const line of formatProjectContextLines(ctx)) {
		messages.push({ level: 'info', text: line });
	}

	// Profile load check
	try {
		const modulePath = fileURLToPath(import.meta.url);
		const packageRoot = resolve(dirname(modulePath), '../..');
		await loadProfileRegistry({ profileId: 'standard', repoRoot: packageRoot });
		messages.push({
			level: 'success',
			text: 'Bundled profile:           standard (loaded successfully)',
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		errors.push({
			code: 'profile_load_failed',
			message: `Bundled profile load failed: ${message}`,
			recoveryHint: 'Ensure the package installation is complete.',
			severity: 'error',
		});
	}

	// Enhanced status summary (non-mutating)
	if (statusSummary && statusSummary.initializationState === 'initialized') {
		messages.push({ level: 'info', text: '' });
		messages.push({
			level: 'info',
			text: `Sessions:                ${statusSummary.sessionSummary.totalSessions} total, ${statusSummary.sessionSummary.activeSessions} active`,
		});
		messages.push({
			level: 'info',
			text: `Runs:                    ${statusSummary.runSummary.totalRuns} total (${statusSummary.runSummary.totalValidationRuns} validation, ${statusSummary.runSummary.totalDiagnosticRuns} diagnostic, ${statusSummary.runSummary.totalGenerationRuns} generation, ${statusSummary.runSummary.totalExecutiveRuns} executive)`,
		});
		messages.push({
			level: 'info',
			text: `Artifacts:               ${statusSummary.artifactSummary.totalArtifacts} total (${statusSummary.artifactSummary.canonicalCount} canonical, ${statusSummary.artifactSummary.nonCanonicalCount} non-canonical)`,
		});
	}

	// Build result envelope
	const result = createCommandResult<DoctorData>({
		changedPaths: [],
		command: 'doctor',
		data,
		dryRun,
		errors,
		messages,
		status: errors.length > 0 ? 'error' : dryRun ? 'dry_run' : 'success',
		version: meta.version,
		warnings,
	});

	if (options.json) {
		const serializable = toJsonSerializable(result, (v) =>
			redactAndRelativize(v, { projectRoot: ctx.root.rootPath ?? ctx.cwd }),
		);
		// eslint-disable-next-line no-console
		console.log(JSON.stringify(serializable, null, 2));
	} else {
		for (const line of formatCommandResultForHuman(result)) {
			const safeLine = String(
				redactAndRelativize(line, {
					projectRoot: ctx.root.rootPath ?? ctx.cwd,
				}),
			);
			// eslint-disable-next-line no-console
			console.log(safeLine);
		}
	}

	if (errors.length > 0) {
		return EXIT_STARTUP_FAILURE;
	}
	return EXIT_SUCCESS;
}

function formatProviderStatusForJson(
	status: ProjectContext['config']['providerStatus'],
): string {
	switch (status.kind) {
		case 'configured':
			return `configured (${status.providerId})`;
		case 'not_configured':
			return 'not configured';
		case 'not_supported_yet':
			return 'not supported yet';
	}
}
