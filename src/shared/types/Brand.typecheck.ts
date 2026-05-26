/**
 * Compile-time brand identity assertions.
 *
 * This file is included by `tsconfig.json` and exercises TypeScript-level
 * brand incompatibility. It is not a runtime test — if these assertions
 * were violated, the project would not type-check.
 *
 * Uses the `Expect<T extends true>` pattern: if the expression evaluates
 * to `false`, the constraint `false extends true` fails at compile time.
 */
import type {
	DocumentId,
	NodeId,
	ProfileId,
	PromptId,
	SessionId,
} from './Brand.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

type IsAssignable<A, B> = [A] extends [B] ? true : false;
type Expect<T extends true> = T;
type ExpectFalse<T extends false> = T;

// ─── All branded IDs are assignable to `string` ─────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _node_is_string = Expect<IsAssignable<NodeId, string>>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _doc_is_string = Expect<IsAssignable<DocumentId, string>>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _session_is_string = Expect<IsAssignable<SessionId, string>>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _profile_is_string = Expect<IsAssignable<ProfileId, string>>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _prompt_is_string = Expect<IsAssignable<PromptId, string>>;

// ─── Branded IDs are NOT mutually assignable ────────────────────────────────

// NodeId ≠ DocumentId
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _node_not_doc = ExpectFalse<IsAssignable<NodeId, DocumentId>>;

// NodeId ≠ SessionId
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _node_not_session = ExpectFalse<IsAssignable<NodeId, SessionId>>;

// NodeId ≠ ProfileId
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _node_not_profile = ExpectFalse<IsAssignable<NodeId, ProfileId>>;

// NodeId ≠ PromptId
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _node_not_prompt = ExpectFalse<IsAssignable<NodeId, PromptId>>;

// DocumentId ≠ SessionId
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _doc_not_session = ExpectFalse<IsAssignable<DocumentId, SessionId>>;

// DocumentId ≠ ProfileId
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _doc_not_profile = ExpectFalse<IsAssignable<DocumentId, ProfileId>>;

// DocumentId ≠ PromptId
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _doc_not_prompt = ExpectFalse<IsAssignable<DocumentId, PromptId>>;

// SessionId ≠ ProfileId
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _session_not_profile = ExpectFalse<IsAssignable<SessionId, ProfileId>>;

// SessionId ≠ PromptId
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _session_not_prompt = ExpectFalse<IsAssignable<SessionId, PromptId>>;

// ProfileId ≠ PromptId
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _profile_not_prompt = ExpectFalse<IsAssignable<ProfileId, PromptId>>;

// Redundant: the file must export something to be a module.
export type __brand_typecheck = true;
