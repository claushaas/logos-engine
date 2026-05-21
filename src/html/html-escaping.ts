/** Step 9.2 — HTML escaping and sanitization helpers */

import type {
	HtmlEscapedString,
	HtmlTrustedTemplate,
	SanitizedHrefResult,
} from './html-render-types.js';

const TEXT_ESCAPE_MAP: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
};

const TEXT_ESCAPE_RE = /[&<>]/g;

const ATTR_ESCAPE_MAP: Record<string, string> = {
	"'": '&#39;',
	'"': '&quot;',
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
};

const ATTR_ESCAPE_RE = /[&"'<>]/g;

const UNSAFE_PROTOCOLS = new Set(['javascript', 'data', 'vbscript']);

const EVENT_HANDLER_PATTERNS = [/^on\w+/i];

function hasEventLikeAttribute(value: string): boolean {
	return EVENT_HANDLER_PATTERNS.some((p) => p.test(value.trim()));
}

function isPathTraversal(path: string): boolean {
	const normalized = path.trim();
	if (normalized === '') return false;
	const segments = normalized.split(/[/\\]/);
	for (const seg of segments) {
		if (seg === '..') return true;
	}
	return false;
}

function hasUnsafeProtocol(url: string): boolean {
	const trimmed = url.trim().toLowerCase();
	const colonIdx = trimmed.indexOf(':');
	if (colonIdx < 1) return false;
	const scheme = trimmed.slice(0, colonIdx).replace(/\s/g, '');
	return UNSAFE_PROTOCOLS.has(scheme);
}

function isRemoteUrl(url: string): boolean {
	const trimmed = url.trim().toLowerCase();
	return trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

function isProtocolRelative(url: string): boolean {
	const trimmed = url.trim();
	return trimmed.startsWith('//');
}

function isAbsolutePath(value: string): boolean {
	const trimmed = value.trim();
	return trimmed.startsWith('/') || /^[A-Za-z]:[/\\]/.test(trimmed);
}

function escapeReplacer(map: Record<string, string>) {
	return (char: string): string => {
		return map[char] ?? char;
	};
}

export function escapeHtmlText(value: string): HtmlEscapedString {
	return value.replace(
		TEXT_ESCAPE_RE,
		escapeReplacer(TEXT_ESCAPE_MAP),
	) as HtmlEscapedString;
}

export function escapeHtmlAttribute(value: string): HtmlEscapedString {
	return value.replace(
		ATTR_ESCAPE_RE,
		escapeReplacer(ATTR_ESCAPE_MAP),
	) as HtmlEscapedString;
}

export function sanitizeLocalHref(value: string): SanitizedHrefResult {
	const trimmed = value.trim();

	if (trimmed.length === 0) {
		return {
			href: '',
			isExternal: false,
			needsTextOnly: false,
			reason: 'empty href',
			safe: false,
		};
	}

	if (isProtocolRelative(trimmed)) {
		return {
			href: trimmed,
			isExternal: true,
			needsTextOnly: true,
			reason: 'protocol-relative URLs are not allowed as local links',
			safe: false,
		};
	}

	if (hasUnsafeProtocol(trimmed)) {
		const scheme = trimmed.slice(0, trimmed.indexOf(':')).toLowerCase();
		return {
			href: trimmed,
			isExternal: true,
			needsTextOnly: true,
			reason: `"${scheme}:" protocol is not allowed`,
			safe: false,
		};
	}

	if (isRemoteUrl(trimmed)) {
		return {
			href: trimmed,
			isExternal: true,
			needsTextOnly: true,
			reason: 'remote URLs are not allowed as local links by default',
			safe: false,
		};
	}

	if (isPathTraversal(trimmed)) {
		return {
			href: trimmed,
			isExternal: false,
			needsTextOnly: true,
			reason: 'path traversal is not allowed',
			safe: false,
		};
	}

	if (isAbsolutePath(trimmed)) {
		return {
			href: trimmed,
			isExternal: false,
			needsTextOnly: true,
			reason: 'absolute paths are not rendered as clickable links',
			safe: false,
		};
	}

	const escapedHref = escapeHtmlAttribute(trimmed);
	return {
		href: escapedHref,
		isExternal: false,
		needsTextOnly: false,
		reason: undefined,
		safe: true,
	};
}

export function isUnsafeHtmlAttribute(name: string): boolean {
	const trimmed = name.trim().toLowerCase();
	return hasEventLikeAttribute(trimmed);
}

export function sanitizeCssClassToken(value: string): string {
	const normalized = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, '-')
		.replace(/^-+|-+$/g, '');

	return normalized.length > 0 ? normalized.slice(0, 80) : 'unknown';
}

export function escapePathForDisplay(value: string): HtmlEscapedString {
	return escapeHtmlText(value);
}

export function normalizePathSeparators(value: string): string {
	return value.replace(/\\/g, '/');
}

export function looksLikeSecretValue(value: string): boolean {
	const trimmed = value.trim();
	if (trimmed.length < 8) return false;

	const embeddedSecretPatterns = [
		/\bsk-ant-[a-zA-Z0-9_-]{20,}\b/,
		/\bsk-[a-zA-Z0-9]{20,}\b/,
		/\bghp_[A-Za-z0-9]{30,}\b/,
		/\bgithub_pat_[A-Za-z0-9_]{30,}\b/,
	];

	for (const pattern of embeddedSecretPatterns) {
		if (pattern.test(trimmed)) return true;
	}

	const wholeStringPatterns = [
		/^sk-[a-zA-Z0-9]{20,}$/,
		/^sk-ant-[a-zA-Z0-9_-]{20,}$/,
		/^[A-Za-z0-9+/]{40,}={0,2}$/,
		/^ghp_[A-Za-z0-9]{30,}$/,
		/^github_pat_[A-Za-z0-9_]{30,}$/,
	];

	for (const pattern of wholeStringPatterns) {
		if (pattern.test(trimmed)) return true;
	}

	const bearerPattern = /\bBearer\s+[A-Za-z0-9\-._~+/=]{20,}\b/i;
	if (bearerPattern.test(trimmed)) return true;

	return false;
}

export function redactSecretString(value: string): string {
	if (looksLikeSecretValue(value)) {
		let result = value;

		const patterns: { pattern: RegExp; prefix: string; suffix: string }[] = [
			{
				pattern: /\bsk-ant-[a-zA-Z0-9_-]{20,}\b/g,
				prefix: 'sk-ant…',
				suffix: '',
			},
			{ pattern: /\bsk-[a-zA-Z0-9]{20,}\b/g, prefix: 'sk-…', suffix: '' },
			{ pattern: /\bghp_[A-Za-z0-9]{30,}\b/g, prefix: 'ghp_…', suffix: '' },
			{
				pattern: /\bgithub_pat_[A-Za-z0-9_]{30,}\b/g,
				prefix: 'github_pat_…',
				suffix: '',
			},
			{
				pattern: /\bBearer\s+[A-Za-z0-9\-._~+/=]{20,}\b/gi,
				prefix: 'Bearer …',
				suffix: '',
			},
		];

		for (const { pattern, prefix } of patterns) {
			result = result.replace(pattern, `[REDACTED ${prefix}]`);
		}

		if (result !== value && result !== '[REDACTED]') return result;

		if (value.length <= 12) return '[REDACTED]';
		const prefix = value.slice(0, 4);
		const suffix = value.slice(-4);
		return `${prefix}...${suffix} [REDACTED]`;
	}
	return value;
}

export function sanitizeTextContent(value: string): HtmlEscapedString {
	const redacted = redactSecretString(value);
	return escapeHtmlText(redacted);
}

export function markAsTrusted(value: string): HtmlTrustedTemplate {
	return value as HtmlTrustedTemplate;
}
