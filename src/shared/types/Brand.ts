/**
 * Brand type — nominal typing for primitive values.
 *
 * Branded types prevent accidental assignment between structurally
 * identical types (e.g., `NodeId` vs `DocumentId` both being `string`).
 */
declare const brand: unique symbol;

export type Brand<T, B extends string> = T & { readonly [brand]: B };

/** Extract the brand tag from a branded type. */
export type BrandOf<T> = T extends Brand<unknown, infer B> ? B : never;

/** Strip the brand to recover the underlying type. */
export type Unbrand<T> = T extends Brand<infer U, string> ? U : T;

// ─── Domain ID types ───────────────────────────────────────────────────────

/** A unique identifier for a node within a profile. */
export type NodeId = Brand<string, 'NodeId'>;

/** A unique identifier for a document within a profile. */
export type DocumentId = Brand<string, 'DocumentId'>;

/** A unique identifier for a session. */
export type SessionId = Brand<string, 'SessionId'>;

/** A unique identifier for a profile. */
export type ProfileId = Brand<string, 'ProfileId'>;

/** A unique identifier for a prompt template in the registry. */
export type PromptId = Brand<string, 'PromptId'>;
