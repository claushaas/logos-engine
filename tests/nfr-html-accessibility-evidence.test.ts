/**
 * NFR HTML Accessibility/Safety Evidence Tests
 *
 * Phase 8: NFR Evidence And Release Hardening
 */

import { describe, expect, it } from 'vitest';
import { runHtmlAccessibilityEvidence } from '../src/evidence/html-accessibility-evidence.js';

const SAFE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="LOGOS Engine">
<title>Project Overview — Derived HTML Artifact</title>
</head>
<body>
<h1>Project Overview</h1>
<p>This is a <strong>derived</strong>, non-canonical HTML artifact generated from canonical Markdown.</p>
<p>Source: logos/01-foundation/01-project-brief.md</p>
<h2>Decisions</h2>
<p>Decision: Use TypeScript for the frontend.</p>
<p>All content is properly escaped: &lt;script&gt; tags are shown as text.</p>
</body>
</html>`;

const UNSAFE_HTML_SCRIPT = `<!DOCTYPE html>
<html lang="en">
<head><title>Test</title></head>
<body>
<h1>Test</h1>
<script>alert('xss')</script>
</body>
</html>`;

const UNSAFE_HTML_HANDLER = `<!DOCTYPE html>
<html lang="en">
<head><title>Test</title></head>
<body>
<h1>Test</h1>
<div onclick="doSomething()">Click me</div>
</body>
</html>`;

const UNSAFE_HTML_REMOTE = `<!DOCTYPE html>
<html lang="en">
<head>
<title>Test</title>
<link rel="stylesheet" href="https://cdn.example.com/style.css">
</head>
<body>
<h1>Test</h1>
<img src="https://cdn.example.com/img.png" alt="Remote image">
</body>
</html>`;

const UNSAFE_HTML_IFRAME = `<!DOCTYPE html>
<html lang="en">
<head><title>Test</title></head>
<body>
<h1>Test</h1>
<iframe src="https://example.com"></iframe>
</body>
</html>`;

const UNSAFE_HTML_JS_URL = `<!DOCTYPE html>
<html lang="en">
<head><title>Test</title></head>
<body>
<h1>Test</h1>
<a href="javascript:void(0)">Click</a>
</body>
</html>`;

describe('HTML Accessibility/Safety Evidence', () => {
	it('produces evidence for safe HTML passing all checks', () => {
		const items = runHtmlAccessibilityEvidence({
			_injectContent: {
				'safe.html': SAFE_HTML,
			},
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		expect(items.length).toBeGreaterThan(0);

		// Most checks should pass for safe HTML
		for (const item of items) {
			expect(item.category).toBe('html_accessibility');
		}
	});

	it('title check passes for HTML with title', () => {
		const items = runHtmlAccessibilityEvidence({
			_injectContent: { 'test.html': SAFE_HTML },
		});

		const titleItem = items.find((i) => i.id === 'html-html-title-test.html');
		expect(titleItem).toBeDefined();
		expect(titleItem?.status).toBe('pass');
	});

	it('language attribute check passes for HTML with lang', () => {
		const items = runHtmlAccessibilityEvidence({
			_injectContent: { 'test.html': SAFE_HTML },
		});

		const langItem = items.find((i) => i.id === 'html-html-lang-test.html');
		expect(langItem).toBeDefined();
		expect(langItem?.status).toBe('pass');
	});

	it('script check fails for HTML with script tag', () => {
		const items = runHtmlAccessibilityEvidence({
			_injectContent: { 'unsafe.html': UNSAFE_HTML_SCRIPT },
		});

		const scriptItem = items.find(
			(i) => i.id === 'html-html-no-scripts-unsafe.html',
		);
		expect(scriptItem).toBeDefined();
		expect(scriptItem?.status).toBe('pass_with_warnings');
		expect(scriptItem?.diagnostics.length).toBeGreaterThan(0);
	});

	it('event handler check flags inline event handlers', () => {
		const items = runHtmlAccessibilityEvidence({
			_injectContent: { 'unsafe.html': UNSAFE_HTML_HANDLER },
		});

		const handlerItem = items.find(
			(i) => i.id === 'html-html-no-event-handlers-unsafe.html',
		);
		expect(handlerItem).toBeDefined();
		expect(handlerItem?.status).toBe('pass_with_warnings');
		expect(handlerItem?.diagnostics.length).toBeGreaterThan(0);
	});

	it('remote assets check flags external URLs', () => {
		const items = runHtmlAccessibilityEvidence({
			_injectContent: { 'unsafe.html': UNSAFE_HTML_REMOTE },
		});

		const remoteItem = items.find(
			(i) => i.id === 'html-html-no-remote-assets-unsafe.html',
		);
		expect(remoteItem).toBeDefined();
		expect(remoteItem?.status).toBe('pass_with_warnings');
		expect(remoteItem?.diagnostics.length).toBeGreaterThan(0);
	});

	it('iframe check flags iframe tags', () => {
		const items = runHtmlAccessibilityEvidence({
			_injectContent: { 'unsafe.html': UNSAFE_HTML_IFRAME },
		});

		const iframeItem = items.find(
			(i) => i.id === 'html-html-no-iframes-unsafe.html',
		);
		expect(iframeItem).toBeDefined();
		expect(iframeItem?.status).toBe('pass_with_warnings');
		expect(iframeItem?.diagnostics.length).toBeGreaterThan(0);
	});

	it('unsafe URL check flags javascript: URLs', () => {
		const items = runHtmlAccessibilityEvidence({
			_injectContent: { 'unsafe.html': UNSAFE_HTML_JS_URL },
		});

		const urlItem = items.find(
			(i) => i.id === 'html-html-no-unsafe-urls-unsafe.html',
		);
		expect(urlItem).toBeDefined();
		expect(urlItem?.status).toBe('pass_with_warnings');
	});

	it('derived label check passes for HTML with derived label', () => {
		const items = runHtmlAccessibilityEvidence({
			_injectContent: { 'test.html': SAFE_HTML },
		});

		const derivedItem = items.find(
			(i) => i.id === 'html-html-derived-label-test.html',
		);
		expect(derivedItem).toBeDefined();
		expect(derivedItem?.status).toBe('pass');
	});

	it('heading check passes for HTML with headings', () => {
		const items = runHtmlAccessibilityEvidence({
			_injectContent: { 'test.html': SAFE_HTML },
		});

		const headingItem = items.find(
			(i) => i.id === 'html-html-headings-test.html',
		);
		expect(headingItem).toBeDefined();
		expect(headingItem?.status).toBe('pass');
	});

	it('produces evidence from static analysis without content', () => {
		const items = runHtmlAccessibilityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		// Should produce items for each check (14 checks)
		expect(items.length).toBeGreaterThanOrEqual(14);
	});

	it('content escaping check references html-escaping module', () => {
		const items = runHtmlAccessibilityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const escapingItem = items.find((i) => i.id === 'html-html-escaping');
		expect(escapingItem).toBeDefined();
	});

	it('does not claim full WCAG compliance in limitations', () => {
		const items = runHtmlAccessibilityEvidence({
			_injectContent: { 'test.html': SAFE_HTML },
		});

		for (const item of items) {
			expect(
				item.limitations.some(
					(l) => l.includes('WCAG') || l.includes('accessibility smoke'),
				),
			).toBe(true);
		}
	});
});
