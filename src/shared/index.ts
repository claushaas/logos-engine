// ─── Shared primitives and utility types ────────────────────────────────────
//
// This module is the "standard library" of the LOGOS Engine.
// Every other module may depend on it; it must not depend on any other
// `@logos/*` module.

export { type ErrorCategory, invariant, LogosError } from './errors/index.js';
export {
	type Brand,
	type BrandOf,
	type DocumentId,
	err,
	isErr,
	isOk,
	type NodeId,
	ok,
	type ProfileId,
	type PromptId,
	type Result,
	type SessionId,
	type Unbrand,
} from './types/index.js';
export {
	generateId,
	nowIso,
	parseIsoDate,
	toIsoString,
} from './utils/index.js';
