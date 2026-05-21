/** Step 9.2 — HTML escaping and sanitization tests */

import { describe, expect, it } from 'vitest';
import {
	escapeHtmlAttribute,
	escapeHtmlText,
	escapePathForDisplay,
	isUnsafeHtmlAttribute,
	looksLikeSecretValue,
	markAsTrusted,
	normalizePathSeparators,
	redactSecretString,
	sanitizeCssClassToken,
	sanitizeLocalHref,
	sanitizeTextContent,
} from '../src/html/index.js';

// ---------------------------------------------------------------------------
// escapeHtmlText
// ---------------------------------------------------------------------------

describe('escapeHtmlText', () => {
	it('escapes & as &amp;', () => {
		expect(escapeHtmlText('a & b')).toBe('a &amp; b');
	});

	it('escapes < as &lt;', () => {
		expect(escapeHtmlText('a < b')).toBe('a &lt; b');
	});

	it('escapes > as &gt;', () => {
		expect(escapeHtmlText('a > b')).toBe('a &gt; b');
	});

	it('escapes combo characters', () => {
		expect(escapeHtmlText('<script>alert("x&y")</script>')).toBe(
			'&lt;script&gt;alert("x&amp;y")&lt;/script&gt;',
		);
	});

	it('avoids double-escaping trusted renderer template', () => {
		const trusted = markAsTrusted('<h1>Safe</h1>');
		expect(escapeHtmlText(trusted)).toBe('&lt;h1&gt;Safe&lt;/h1&gt;');
	});

	it('does not allow inline event handler injection', () => {
		const malicious = '<img src=x onerror=alert(1)>';
		const escaped = escapeHtmlText(malicious);
		expect(escaped).toContain('&lt;');
		expect(escaped).not.toContain('<img ');
	});

	it('does not pass raw Markdown HTML through', () => {
		const mdHtml = '<a href="https://evil.com">click</a>';
		const escaped = escapeHtmlText(mdHtml);
		expect(escaped).toContain('&lt;a');
		expect(escaped).not.toContain('<a');
	});

	it('handles empty string', () => {
		expect(escapeHtmlText('')).toBe('');
	});

	it('handles text with no special chars', () => {
		expect(escapeHtmlText('hello world')).toBe('hello world');
	});
});

// ---------------------------------------------------------------------------
// escapeHtmlAttribute
// ---------------------------------------------------------------------------

describe('escapeHtmlAttribute', () => {
	it('escapes & as &amp;', () => {
		expect(escapeHtmlAttribute('a & b')).toBe('a &amp; b');
	});

	it('escapes < as &lt;', () => {
		expect(escapeHtmlAttribute('a < b')).toBe('a &lt; b');
	});

	it('escapes > as &gt;', () => {
		expect(escapeHtmlAttribute('a > b')).toBe('a &gt; b');
	});

	it('escapes " as &quot;', () => {
		expect(escapeHtmlAttribute('foo"bar')).toBe('foo&quot;bar');
	});

	it("escapes ' as &#39;", () => {
		expect(escapeHtmlAttribute("foo'bar")).toBe('foo&#39;bar');
	});

	it('escapes all attribute special chars', () => {
		expect(escapeHtmlAttribute('<">&')).toBe('&lt;&quot;&gt;&amp;');
	});

	it('handles empty string', () => {
		expect(escapeHtmlAttribute('')).toBe('');
	});
});

// ---------------------------------------------------------------------------
// sanitizeLocalHref
// ---------------------------------------------------------------------------

describe('sanitizeLocalHref', () => {
	it('rejects javascript: href', () => {
		const result = sanitizeLocalHref('javascript:alert(1)');
		expect(result.safe).toBe(false);
		expect(result.needsTextOnly).toBe(true);
		expect(result.reason).toContain('not allowed');
	});

	it('rejects data: href', () => {
		const result = sanitizeLocalHref(
			'data:text/html,<script>alert(1)</script>',
		);
		expect(result.safe).toBe(false);
		expect(result.needsTextOnly).toBe(true);
	});

	it('rejects vbscript: href', () => {
		const result = sanitizeLocalHref('vbscript:msgbox(1)');
		expect(result.safe).toBe(false);
		expect(result.needsTextOnly).toBe(true);
	});

	it('rejects protocol-relative URL', () => {
		const result = sanitizeLocalHref('//example.com/malicious');
		expect(result.safe).toBe(false);
		expect(result.needsTextOnly).toBe(true);
	});

	it('rejects remote http:// link', () => {
		const result = sanitizeLocalHref('http://example.com');
		expect(result.safe).toBe(false);
		expect(result.needsTextOnly).toBe(true);
	});

	it('rejects remote https:// link', () => {
		const result = sanitizeLocalHref('https://example.com');
		expect(result.safe).toBe(false);
		expect(result.needsTextOnly).toBe(true);
	});

	it('accepts safe relative path', () => {
		const result = sanitizeLocalHref('logos/security/index.md');
		expect(result.safe).toBe(true);
		expect(result.needsTextOnly).toBe(false);
	});

	it('accepts safe relative path with dot prefix', () => {
		const result = sanitizeLocalHref('./logos/doc.md');
		expect(result.safe).toBe(true);
	});

	it('rejects path traversal with ..', () => {
		const result = sanitizeLocalHref('../../etc/passwd');
		expect(result.safe).toBe(false);
		expect(result.needsTextOnly).toBe(true);
	});

	it('rejects path traversal in middle', () => {
		const result = sanitizeLocalHref('logos/../../../etc/passwd');
		expect(result.safe).toBe(false);
		expect(result.needsTextOnly).toBe(true);
	});

	it('does not render absolute local paths by default', () => {
		const result = sanitizeLocalHref('/etc/passwd');
		expect(result.safe).toBe(false);
		expect(result.needsTextOnly).toBe(true);
	});

	it('normalizes path separators', () => {
		expect(normalizePathSeparators('logos\\doc\\file.md')).toBe(
			'logos/doc/file.md',
		);
	});

	it('handles empty href', () => {
		const result = sanitizeLocalHref('');
		expect(result.safe).toBe(false);
	});

	it('accepts safe subdirectory path', () => {
		const result = sanitizeLocalHref('subdir/file.html');
		expect(result.safe).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// isUnsafeHtmlAttribute
// ---------------------------------------------------------------------------

describe('isUnsafeHtmlAttribute', () => {
	it('flags onclick as unsafe', () => {
		expect(isUnsafeHtmlAttribute('onclick')).toBe(true);
	});

	it('flags onerror as unsafe', () => {
		expect(isUnsafeHtmlAttribute('onerror')).toBe(true);
	});

	it('flags onload as unsafe', () => {
		expect(isUnsafeHtmlAttribute('onload')).toBe(true);
	});

	it('flags ONCLICK case-insensitively', () => {
		expect(isUnsafeHtmlAttribute('ONCLICK')).toBe(true);
	});

	it('does not flag regular attribute names', () => {
		expect(isUnsafeHtmlAttribute('href')).toBe(false);
		expect(isUnsafeHtmlAttribute('class')).toBe(false);
		expect(isUnsafeHtmlAttribute('id')).toBe(false);
	});
});

describe('sanitizeCssClassToken', () => {
	it('keeps safe status tokens stable', () => {
		expect(sanitizeCssClassToken('missing_source')).toBe('missing_source');
	});

	it('removes attribute-breaking characters from class tokens', () => {
		expect(sanitizeCssClassToken('ready" onclick="alert(1)')).toBe(
			'ready-onclick-alert-1',
		);
	});
});

// ---------------------------------------------------------------------------
// escapePathForDisplay
// ---------------------------------------------------------------------------

describe('escapePathForDisplay', () => {
	it('escapes HTML chars in paths', () => {
		expect(escapePathForDisplay('file<>.md')).toBe('file&lt;&gt;.md');
	});
});

// ---------------------------------------------------------------------------
// looksLikeSecretValue / redactSecretString
// ---------------------------------------------------------------------------

describe('looksLikeSecretValue', () => {
	it('detects fake OpenAI API key', () => {
		expect(looksLikeSecretValue('sk-abcdefghijklmnop1234567890')).toBe(true);
	});

	it('detects fake Bearer token', () => {
		expect(
			looksLikeSecretValue('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9dummy'),
		).toBe(true);
	});

	it('detects fake GitHub PAT', () => {
		expect(looksLikeSecretValue('ghp_abcdefghijklmnopqrstuvwxyz123456')).toBe(
			true,
		);
	});

	it('does not flag short values', () => {
		expect(looksLikeSecretValue('short')).toBe(false);
	});

	it('does not flag normal text', () => {
		expect(looksLikeSecretValue('hello world this is normal text')).toBe(false);
	});
});

describe('redactSecretString', () => {
	it('redacts fake API key', () => {
		const result = redactSecretString('sk-abcdefghijklmnop1234567890');
		expect(result).toContain('REDACTED');
		expect(result).not.toContain('sk-abcdefghijklmnop1234567890');
	});

	it('redacts fake Bearer token', () => {
		const result = redactSecretString(
			'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9dummy',
		);
		expect(result).toContain('REDACTED');
	});

	it('does not redact normal text', () => {
		expect(redactSecretString('hello world')).toBe('hello world');
	});
});

// ---------------------------------------------------------------------------
// sanitizeTextContent
// ---------------------------------------------------------------------------

describe('sanitizeTextContent', () => {
	it('redacts and escapes combined', () => {
		const result = sanitizeTextContent(
			'sk-abcdefghijklmnop1234567890 <script>alert(1)</script>',
		);
		expect(result).toContain('REDACTED');
		expect(result).toContain('&lt;script&gt;');
		expect(result).not.toContain('<script>');
	});
});

// ---------------------------------------------------------------------------
// markAsTrusted
// ---------------------------------------------------------------------------

describe('markAsTrusted', () => {
	it('returns the same string', () => {
		expect(markAsTrusted('<h1>Trusted</h1>')).toBe('<h1>Trusted</h1>');
	});
});
