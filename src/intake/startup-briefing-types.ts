/** Startup Briefing Types — typed contracts for startup briefing service */

import type { AiProviderDiagnostic } from '../ai/provider-port.js';
import type { QuestionCluster } from './question-planner-types.js';

// ---------------------------------------------------------------------------
// Briefing mode and source
// ---------------------------------------------------------------------------

export type StartupBriefingMode = 'ai_assisted' | 'deterministic_fallback';

export type StartupBriefingSource = 'ai_provider' | 'deterministic_fallback';

// ---------------------------------------------------------------------------
// Fallback reason
// ---------------------------------------------------------------------------

export type StartupBriefingFallbackReason =
	| 'provider_unavailable'
	| 'provider_not_configured'
	| 'disclosure_absent'
	| 'disclosure_declined'
	| 'provider_response_invalid'
	| 'provider_execution_failed'
	| 'provider_kind_unsupported';

// ---------------------------------------------------------------------------
// Briefing status
// ---------------------------------------------------------------------------

export type StartupBriefingStatus = 'success' | 'partial' | 'degraded';

// ---------------------------------------------------------------------------
// Briefing section
// ---------------------------------------------------------------------------

export interface StartupBriefingSection {
	sectionId: string;
	label: string;
	lines: string[];
	/** Whether this section contents are suggestions (not confirmed facts) */
	isSuggestion: boolean;
}

// ---------------------------------------------------------------------------
// Suggested action
// ---------------------------------------------------------------------------

export interface StartupBriefingAction {
	actionId: string;
	command: string;
	description: string;
	/** Whether this command is fully implemented */
	isImplemented: boolean;
	/** Whether this is a suggestion only */
	isSuggestion: boolean;
	priority: 'high' | 'medium' | 'low';
}

// ---------------------------------------------------------------------------
// Briefing diagnostic
// ---------------------------------------------------------------------------

export interface StartupBriefingDiagnostic {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	recoveryHint: string | undefined;
}

// ---------------------------------------------------------------------------
// Briefing input
// ---------------------------------------------------------------------------

export interface StartupBriefingInput {
	workspaceInitialized: boolean;
	projectRoot: string;
	documentationRoot: string;
	activeProfileId: string | null;
	sessionCount: number;
	runCount: number;
	artifactCount: number;
	openQuestionCount: number;
	proposalCount: number;
	pendingProposalCount: number;
	acceptedProposalCount: number;
	riskCount: number;
	activeRiskCount: number;
	questionCluster: QuestionCluster | undefined;
	questionClusterSummary: string | undefined;
	validationGapCount: number;
	providerConfigured: boolean;
	providerKind: string | undefined;
	providerConsent: 'accepted' | 'declined' | 'absent';
	/** Any existing diagnostics from context detection */
	workspaceDiagnostics: StartupBriefingDiagnostic[];
}

// ---------------------------------------------------------------------------
// Briefing result
// ---------------------------------------------------------------------------

export interface StartupBriefing {
	mode: StartupBriefingMode;
	source: StartupBriefingSource;
	status: StartupBriefingStatus;
	/** Top-level summary line */
	summary: string;
	/** Structured sections */
	sections: StartupBriefingSection[];
	/** Suggested next actions */
	actions: StartupBriefingAction[];
	/** Next question cluster summary if available */
	nextQuestionHint: string | undefined;
	/** Fallback reason if not AI-assisted */
	fallbackReason: StartupBriefingFallbackReason | undefined;
	/** Diagnostics */
	diagnostics: StartupBriefingDiagnostic[];
}

// ---------------------------------------------------------------------------
// AI briefing result (from provider)
// ---------------------------------------------------------------------------

export interface StartupBriefingResult {
	briefing: StartupBriefing;
	providerDiagnostics: AiProviderDiagnostic[];
	fallbackReason: StartupBriefingFallbackReason | undefined;
}

// ---------------------------------------------------------------------------
// Render options
// ---------------------------------------------------------------------------

export interface StartupBriefingRenderOptions {
	/** Truncate long lines to terminal width */
	maxWidth: number | undefined;
	/** Show section labels */
	showLabels: boolean;
	/** Show action suggestions */
	showActions: boolean;
	/** Show diagnostics */
	showDiagnostics: boolean;
}

export const DEFAULT_RENDER_OPTIONS: StartupBriefingRenderOptions = {
	maxWidth: undefined,
	showActions: true,
	showDiagnostics: false,
	showLabels: true,
};
