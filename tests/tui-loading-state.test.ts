/**
 * TUI Loading State Tests
 *
 * Phase 5: TUI Workbench Redesign — Outcome 6 (loading and pending states).
 */

import { describe, expect, it } from 'vitest';
import {
	createEmptyLoadingModel,
	createLoadingModel,
	isLoadingActive,
	LOADING_OPERATION_KINDS,
} from '../src/tui/workbench-model.js';
import { renderLoadingArea } from '../src/tui/workbench-renderer.js';

describe('loading state model', () => {
	it('all operation kinds are valid', () => {
		for (const kind of LOADING_OPERATION_KINDS) {
			const loading = createLoadingModel({
				operationKind: kind,
				title: `Test ${kind}`,
			});
			expect(loading.operationKind).toBe(kind);
		}
	});

	it('provider call loading state renders', () => {
		const loading = createLoadingModel({
			cancellable: false,
			operationKind: 'provider_call',
			phase: 'Sending request',
			readOnly: true,
			title: 'Calling AI provider',
		});
		expect(loading.operationKind).toBe('provider_call');
		expect(loading.readOnly).toBe(true);

		const lines = renderLoadingArea(loading);
		const text = lines.join('\n');
		expect(text).toContain('Calling AI provider');
		expect(text).toContain('Sending request');
		expect(text).toContain('[read-only]');
	});

	it('intake interpretation loading state renders', () => {
		const loading = createLoadingModel({
			operationKind: 'intake_interpretation',
			phase: 'Analyzing input',
			readOnly: true,
			title: 'Interpreting intake',
		});
		const lines = renderLoadingArea(loading);
		const text = lines.join('\n');
		expect(text).toContain('Interpreting intake');
		expect(text).toContain('[read-only]');
	});

	it('generation loading state renders', () => {
		const loading = createLoadingModel({
			operationKind: 'generation',
			phase: 'Writing documents',
			readOnly: false,
			title: 'Generating canonical documentation',
		});
		const lines = renderLoadingArea(loading);
		const text = lines.join('\n');
		expect(text).toContain('Generating canonical documentation');
		expect(text).toContain('Writing documents');
		expect(text).toContain('[mutating]');
	});

	it('validation loading state renders', () => {
		const loading = createLoadingModel({
			operationKind: 'validation',
			phase: 'Checking contracts',
			readOnly: true,
			title: 'Running validation',
		});
		const lines = renderLoadingArea(loading);
		const text = lines.join('\n');
		expect(text).toContain('Running validation');
		expect(text).toContain('[read-only]');
	});

	it('diagnostics loading state renders', () => {
		const loading = createLoadingModel({
			operationKind: 'diagnostics',
			phase: 'Analyzing state',
			readOnly: true,
			title: 'Running diagnostics',
		});
		const lines = renderLoadingArea(loading);
		const text = lines.join('\n');
		expect(text).toContain('Running diagnostics');
	});

	it('executive compile loading state renders', () => {
		const loading = createLoadingModel({
			operationKind: 'executive_compile',
			phase: 'Compiling outputs',
			readOnly: false,
			title: 'Compiling Executive Axis',
		});
		const lines = renderLoadingArea(loading);
		const text = lines.join('\n');
		expect(text).toContain('Compiling Executive Axis');
		expect(text).toContain('[mutating]');
	});

	it('read-only/mutating label is visible', () => {
		const readOnlyLoading = createLoadingModel({
			operationKind: 'diagnostics',
			readOnly: true,
			title: 'Test',
		});
		const roText = renderLoadingArea(readOnlyLoading).join('\n');
		expect(roText).toContain('[read-only]');

		const mutatingLoading = createLoadingModel({
			operationKind: 'generation',
			readOnly: false,
			title: 'Test',
		});
		const mutText = renderLoadingArea(mutatingLoading).join('\n');
		expect(mutText).toContain('[mutating]');
	});

	it('loading state does not imply background execution', () => {
		// The loading model is just state; it doesn't start operations
		const loading = createLoadingModel({
			operationKind: 'generation',
			title: 'Test',
		});
		expect(loading.diagnostics).toEqual([]);
		// statusText is human-readable, not a progress percentage
		expect(loading.statusText).toBe('Pending...');
	});

	it('isLoadingActive detects active operations', () => {
		const active = createLoadingModel({
			operationKind: 'generation',
			title: 'Test',
		});
		expect(isLoadingActive(active)).toBe(true);
	});

	it('empty loading model is not active', () => {
		const empty = createEmptyLoadingModel();
		expect(isLoadingActive(empty)).toBe(false);
		expect(empty.operationId).toBe('');
	});

	it('loading model text labels are visible', () => {
		const loading = createLoadingModel({
			cancellable: true,
			operationKind: 'provider_call',
			phase: 'In progress',
			title: 'Loading',
		});
		const lines = renderLoadingArea(loading);
		const text = lines.join('\n');

		expect(text).toContain('Loading: Loading');
		expect(text).toContain('Phase: In progress');
		expect(text).toContain('(cancellable)');
	});
});
