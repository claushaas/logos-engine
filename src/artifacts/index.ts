/**
 * Artifacts module — Phase 7: Derived Artifact Generation And Browsing
 *
 * Output browser service and model for listing, filtering, detailing,
 * and sourcing generated artifacts (canonical and derived).
 */

export type {
	ListOutputsResult,
	OutputBrowserOptions,
} from './output-browser.js';
export {
	getOutput,
	getOutputSources,
	listOutputs,
	listStaleOutputs,
	summarizeOutputs,
} from './output-browser.js';
export type {
	OutputBrowserDiagnostic,
	OutputBrowserFilter,
	OutputBrowserItem,
	OutputBrowserSummary,
	OutputDetailView,
	OutputDisplayKind,
	OutputSourcesView,
	StaleOutputsView,
} from './output-browser-model.js';
export {
	canonicalityLabel,
	matchesOutputFilter,
	normalizeDisplayKind,
	OUTPUT_DISPLAY_KIND_LABELS,
	toOutputBrowserItem,
	toOutputDetailView,
} from './output-browser-model.js';
