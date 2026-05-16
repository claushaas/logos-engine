/** Startup Briefing Renderer — converts briefing to terminal-friendly lines */

import type {
	StartupBriefing,
	StartupBriefingRenderOptions,
} from './startup-briefing-types.js';
import { DEFAULT_RENDER_OPTIONS } from './startup-briefing-types.js';

export function renderStartupBriefing(
	briefing: StartupBriefing,
	options: StartupBriefingRenderOptions = DEFAULT_RENDER_OPTIONS,
): string[] {
	const lines: string[] = [];
	const opts = { ...DEFAULT_RENDER_OPTIONS, ...options };

	// Source marker
	const sourceLabel =
		briefing.source === 'ai_provider'
			? '[AI-assisted briefing]'
			: briefing.fallbackReason
				? `[Deterministic briefing — ${formatFallbackReason(briefing.fallbackReason)}]`
				: '[Deterministic briefing]';

	lines.push('');
	lines.push(`LOGOS Engine ${sourceLabel}`);
	lines.push('');
	lines.push(briefing.summary);

	// Sections
	for (const section of briefing.sections) {
		lines.push('');
		if (opts.showLabels) {
			const label = section.isSuggestion
				? `${section.label} [suggestions]`
				: section.label;
			lines.push(`${label}:`);
		}
		for (const line of section.lines) {
			lines.push(`  ${line}`);
		}
	}

	// Actions
	if (opts.showActions && briefing.actions.length > 0) {
		lines.push('');
		lines.push('Suggested next commands:');
		for (const action of briefing.actions) {
			const marker = !action.isImplemented ? ' [not yet implemented]' : '';
			const suggestionMarker = action.isSuggestion ? ' (suggestion)' : '';
			lines.push(
				`  ${action.command} — ${action.description}${marker}${suggestionMarker}`,
			);
		}
	}

	// Diagnostics (only if requested)
	if (opts.showDiagnostics && briefing.diagnostics.length > 0) {
		lines.push('');
		lines.push('Diagnostics:');
		for (const d of briefing.diagnostics) {
			lines.push(`  [${d.severity.toUpperCase()}] ${d.message}`);
			if (d.recoveryHint) {
				lines.push(`    Recovery: ${d.recoveryHint}`);
			}
		}
	}

	lines.push('');
	return lines;
}

function formatFallbackReason(reason: string): string {
	switch (reason) {
		case 'provider_unavailable':
			return 'AI provider unavailable';
		case 'provider_not_configured':
			return 'AI provider not configured';
		case 'disclosure_absent':
			return 'disclosure consent absent';
		case 'disclosure_declined':
			return 'disclosure consent declined';
		case 'provider_response_invalid':
			return 'AI response was invalid';
		case 'provider_execution_failed':
			return 'AI provider execution failed';
		case 'provider_kind_unsupported':
			return 'AI provider kind unsupported';
		default:
			return reason;
	}
}
