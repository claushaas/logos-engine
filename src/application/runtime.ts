/**
 * Runtime coordinator — wires the state engine, persistence, LLM provider,
 * and TUI rendering into a single application lifecycle.
 *
 * The runtime is the "glue" between modules. It:
 * - Creates or resumes sessions.
 * - Holds the current `LogosRuntimeState`.
 * - Translates TUI intent events into state-engine operations.
 * - Builds `TuiRenderSnapshot` for the TUI.
 * - Auto-saves after each successful state change.
 * - Subscribes listeners for reactive rendering.
 *
 * The runtime does NOT import TUI types or Ink/React. It exposes a
 * TUI-neutral `RuntimeEvent` type.
 *
 * @see {@link https://logos-engine/docs/architecture/02-runtime-architecture.md}
 */
import type {
	LogosProfile,
	LogosRuntimeState,
	TuiRenderSnapshot,
} from '../contracts/index.js';
import type { LlmProvider } from '../llm/index.js';
import { MockLlmProvider } from '../llm/index.js';
import { exportMarkdown } from '../outputs/index.js';
import { resumeSessionWithDiagnostics } from '../persistence/session-resume.js';
import type { SnapshotStore } from '../persistence/snapshot-store.js';
import {
	createSnapshotStore,
	registerSignalHandlers,
} from '../persistence/snapshot-store.js';
import { getProfile } from '../profiles/index.js';
import type { PromptRegistry } from '../prompt-orchestration/prompt-registry.js';
import { PromptRegistry as PromptRegistryClass } from '../prompt-orchestration/prompt-registry.js';
import type { NodeId, ProfileId, SessionId } from '../shared/index.js';
import { nowIso } from '../shared/index.js';
import { buildSnapshot } from '../state-engine/snapshot-builder.js';
import {
	createSession,
	deselectNode,
	selectProfile,
} from '../state-engine/state-engine.js';
import { buildRenderSnapshot } from './render-model-builder.js';
import { acceptCanonicalAnswerUseCase } from './use-cases/accept-canonical-answer.js';
import { editCanonicalAnswerUseCase } from './use-cases/edit-canonical-answer.js';
import {
	closeDocumentPreviewUseCase,
	openDocumentPreviewUseCase,
} from './use-cases/open-document-preview.js';
import { regenerateCanonicalAnswerUseCase } from './use-cases/regenerate-canonical-answer.js';
import { reopenNodeUseCase } from './use-cases/reopen-node.js';
import { selectNodeUseCase } from './use-cases/select-node.js';
import { skipNodeUseCase } from './use-cases/skip-node.js';
import { submitUserMessageUseCase } from './use-cases/submit-user-message.js';

// ═══════════════════════════════════════════════════════════════════════════
// Public types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Events dispatched from the TUI to the runtime.
 *
 * Structurally compatible with the TUI's `TuiDispatchEvent` but
 * defined here so the runtime does not depend on TUI types.
 */
export type RuntimeEvent =
	| { readonly type: 'NODE_SELECTED'; readonly nodeId: NodeId }
	| {
			readonly type: 'ACTION_SELECTED';
			readonly actionId: string;
			readonly nodeAction?: string;
	  }
	| {
			readonly type: 'USER_MESSAGE';
			readonly content: string;
			readonly submitAction?: string;
	  }
	| { readonly type: 'ESCAPE' };

/**
 * Listener called after each state change with the new render snapshot.
 */
export type RuntimeListener = (snapshot: TuiRenderSnapshot) => void;

/**
 * Configuration for `createApplicationRuntime`.
 */
export type CreateRuntimeOptions = {
	/** Directory for session snapshots (default: `"sessions"`). */
	readonly dataDir?: string;

	/** Directory for profile files (default: built-in `profiles/`). */
	readonly profileDir?: string;

	/** Pre-selected profile ID to load on startup. */
	readonly profileId?: ProfileId;

	/** Session ID to resume (overrides fresh session creation). */
	readonly sessionId?: SessionId;

	/** Use mock LLM provider instead of a real one. */
	readonly useMockLlm?: boolean;

	/** Optional custom LLM provider (overrides mock flag). */
	readonly llmProvider?: LlmProvider;

	/** Snapshot store (for injection; defaults to `createSnapshotStore`). */
	readonly store?: SnapshotStore;
};

/**
 * The application runtime — the single coordination point between all modules.
 */
export type ApplicationRuntime = {
	/** The current session ID. */
	readonly sessionId: string;

	/** Get the current runtime state (snapshot, not mutable). */
	readonly getState: () => LogosRuntimeState;

	/** Get the current TUI render snapshot. */
	readonly getSnapshot: () => TuiRenderSnapshot;

	/** Dispatch a user-intent event. */
	readonly dispatch: (event: RuntimeEvent) => Promise<void>;

	/** Subscribe to state changes. Returns an unsubscribe function. */
	readonly subscribe: (listener: RuntimeListener) => () => void;

	/** Persist the current state to the snapshot store. */
	readonly save: () => Promise<void>;

	/** Cleanup resources (signal handlers, subscriptions). */
	readonly dispose: () => void;
};

// ═══════════════════════════════════════════════════════════════════════════
// Idle snapshot helper
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a minimal idle render snapshot for the initial (no profile) screen.
 */
function buildIdleSnapshot(hasAvailableSessions: boolean): TuiRenderSnapshot {
	return {
		actionBar: {
			actions: [
				{
					enabled: true,
					id: 'select_profile',
					label: 'Select Profile',
				},
				...(hasAvailableSessions
					? [
							{
								enabled: true,
								id: 'resume_session',
								label: 'Resume Session',
							},
						]
					: []),
			],
		},
		diagnostics: [],
		input: {
			enabled: false,
			reasonIfDisabled: 'Select a profile to begin.',
		},
		mainPanel: {
			hasAvailableSessions,
			kind: 'idle',
		},
		mode: 'idle',
		sidebar: {
			activeNodeId: null,
			phases: [],
		},
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Factory (async — session resume / profile loading is I/O-bound)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create the application runtime.
 *
 * This is an async factory because session resume and profile selection
 * require filesystem I/O.
 *
 * @param options — Configuration for session, persistence, and LLM.
 * @returns A promise resolving to an `ApplicationRuntime` instance.
 */
export async function createApplicationRuntime(
	options: CreateRuntimeOptions = {},
): Promise<ApplicationRuntime> {
	const dataDir = options.dataDir ?? 'sessions';
	const profileDir = options.profileDir;
	const store = options.store ?? createSnapshotStore({ sessionsDir: dataDir });

	// ── Resolve LLM provider ─────────────────────────────────────────
	let llmProvider: LlmProvider;
	if (options.llmProvider) {
		llmProvider = options.llmProvider;
	} else if (options.useMockLlm) {
		llmProvider = new MockLlmProvider();
	} else {
		// No real provider yet — default to mock for safe startup.
		llmProvider = new MockLlmProvider();
	}

	// ── Prompt registry ──────────────────────────────────────────────
	const promptRegistry: PromptRegistry = new PromptRegistryClass();

	// ── Session initialization ───────────────────────────────────────
	let currentState: LogosRuntimeState;
	let sessionId: string;
	let currentProfile: LogosProfile | null = null;

	if (options.sessionId) {
		// Use the validated resume path from Step 13.3. This handles
		// schema migrations, state repair, and profile validation.
		const resumeResult = await resumeSessionWithDiagnostics(
			options.sessionId as string,
			{
				loadProfile: (profileId) =>
					getProfile(profileId as ProfileId, profileDir),
				store,
			},
		);

		if (resumeResult.ok) {
			currentState = resumeResult.value.state;
			sessionId = currentState.sessionId;

			// If the loaded state already has a selected profile, load it
			// so the TUI renders correctly (sidebar, structure_overview, etc.).
			// Do NOT call selectProfile() — that would reset node/document state.
			if (currentState.selectedProfileId !== null && !options.profileId) {
				const restoredProfileResult = getProfile(
					currentState.selectedProfileId,
					profileDir,
				);
				if (restoredProfileResult.ok) {
					currentProfile = restoredProfileResult.value;
				}
			}
		} else {
			// Resume failed — fall back to a fresh session.
			currentState = createSession();
			sessionId = currentState.sessionId;
		}
	} else {
		currentState = createSession();
		sessionId = currentState.sessionId;
	}

	// ── Profile selection ────────────────────────────────────────────
	if (options.profileId) {
		const profileResult = getProfile(options.profileId, profileDir);
		if (profileResult.ok) {
			// Select the profile in the state engine.
			// Only pass profileDirectory if it's defined (exactOptionalPropertyTypes).
			const selectOpts =
				profileDir !== undefined ? { profileDirectory: profileDir } : undefined;
			const result = selectProfile(currentState, options.profileId, selectOpts);

			if (result.ok) {
				currentState = result.state;
				currentProfile = profileResult.value;
			}
		}
	} else if (currentState.selectedProfileId !== null) {
		// Resume: if the loaded state has a selected profile, load it
		// so the TUI renders correctly (sidebar, structure_overview, etc.).
		// Do NOT call selectProfile() — that would reset node/document state.
		const resumedProfileResult = getProfile(
			currentState.selectedProfileId,
			profileDir,
		);
		if (resumedProfileResult.ok) {
			currentProfile = resumedProfileResult.value;
		}
	}

	// ── Check for available sessions (for idle screen) ───────────────
	const sessions = await store.listSessions();
	const hasSessions = sessions.length > 0;

	// ── Mutable references for runtime closure ───────────────────────
	let currentSnapshot: TuiRenderSnapshot;
	const listeners = new Set<RuntimeListener>();
	let disposed = false;

	/** Build a fresh render snapshot from the current state + profile. */
	function buildCurrentSnapshot(): TuiRenderSnapshot {
		if (currentProfile !== null) {
			return buildRenderSnapshot(
				buildSnapshot(currentState, currentProfile),
				currentProfile,
			);
		}
		return buildIdleSnapshot(hasSessions);
	}

	/** Notify all listeners with the current snapshot. */
	function notifyListeners(): void {
		for (const listener of listeners) {
			try {
				listener(currentSnapshot);
			} catch {
				// Listener errors should not break the runtime.
			}
		}
	}

	/** Refresh the cached snapshot and notify listeners. */
	function refreshSnapshot(): void {
		currentSnapshot = buildCurrentSnapshot();
		notifyListeners();
	}

	/** Persist the current state. */
	async function persistState(): Promise<void> {
		if (disposed) return;
		const result = await store.saveSnapshot(sessionId, currentState);
		if (!result.ok) {
			console.error(`[logos] Failed to save session: ${result.error.message}`);
		}
	}

	// Build the initial snapshot.
	currentSnapshot = buildCurrentSnapshot();

	// ── Signal handlers ──────────────────────────────────────────────
	const cleanupSignalHandlers = registerSignalHandlers(
		store,
		sessionId,
		() => currentState,
	);

	// ── Event dispatch ───────────────────────────────────────────────

	async function dispatch(event: RuntimeEvent): Promise<void> {
		if (disposed) return;

		switch (event.type) {
			// ── NODE_SELECTED ───────────────────────────────────
			case 'NODE_SELECTED': {
				if (!currentProfile) {
					return;
				}

				const result = await selectNodeUseCase(currentState, {
					llmProvider,
					nodeId: event.nodeId,
					profile: currentProfile,
					promptRegistry,
				});

				if (result.ok) {
					currentState = result.state;
					refreshSnapshot();
					await persistState();
				}
				return;
			}

			// ── USER_MESSAGE ────────────────────────────────────
			case 'USER_MESSAGE': {
				if (!currentProfile) {
					return;
				}

				// If submitAction is 'edit', route to edit use case.
				if (event.submitAction === 'edit') {
					const activeNodeId = currentState.activeNodeId;
					if (!activeNodeId) return;

					const result = await editCanonicalAnswerUseCase(currentState, {
						content: event.content,
						llmProvider,
						nodeId: activeNodeId,
						profile: currentProfile,
						promptRegistry,
					});

					if (result.ok) {
						currentState = result.state;
						refreshSnapshot();
						await persistState();
					}
					return;
				}

				const result = await submitUserMessageUseCase(currentState, {
					content: event.content,
					llmProvider,
					profile: currentProfile,
					promptRegistry,
				});

				if (result.ok) {
					currentState = result.state;
					refreshSnapshot();
					await persistState();
				}
				return;
			}

			// ── ESCAPE ───────────────────────────────────────────
			case 'ESCAPE': {
				// If in document preview, close it first.
				if (currentSnapshot.mode === 'document_preview' && currentProfile) {
					currentSnapshot = closeDocumentPreviewUseCase(
						currentState,
						currentProfile,
					);
					// closeDocumentPreviewUseCase returns a TuiRenderSnapshot directly.
					// The state is unchanged — only the rendering mode changes.
					notifyListeners();
					return;
				}

				// Otherwise deselect the active node.
				if (currentState.activeNodeId !== null) {
					const result = deselectNode(currentState);
					if (result.ok) {
						currentState = result.state;
						refreshSnapshot();
						await persistState();
					}
				}
				return;
			}

			// ── ACTION_SELECTED ─────────────────────────────────
			case 'ACTION_SELECTED': {
				const { actionId, nodeAction } = event;
				const activeNodeId = currentState.activeNodeId;
				if (!currentProfile) return;

				switch (nodeAction ?? actionId) {
					case 'accept': {
						if (!activeNodeId) return;
						const result = acceptCanonicalAnswerUseCase(currentState, {
							nodeId: activeNodeId,
							profile: currentProfile,
						});
						if (result.ok) {
							currentState = result.state;
							refreshSnapshot();
							await persistState();
						}
						return;
					}

					case 'reopen': {
						if (!activeNodeId) return;
						const result = reopenNodeUseCase(currentState, {
							nodeId: activeNodeId,
							profile: currentProfile,
						});
						if (result.ok) {
							currentState = result.state;
							refreshSnapshot();
							await persistState();
						}
						return;
					}

					case 'regenerate': {
						if (!activeNodeId) return;
						const result = await regenerateCanonicalAnswerUseCase(
							currentState,
							{
								llmProvider,
								nodeId: activeNodeId,
								profile: currentProfile,
								promptRegistry,
							},
						);
						if (result.ok) {
							currentState = result.state;
							refreshSnapshot();
							await persistState();
						}
						return;
					}

					case 'edit': {
						// The 'edit' action enables the input area with
						// submitAction='edit' — handled in USER_MESSAGE.
						return;
					}

					case 'skip':
					case 'defer': {
						const skipOpts: { profile: typeof currentProfile } & {
							nodeId?: NodeId;
						} = {
							profile: currentProfile,
						};
						if (activeNodeId !== null) skipOpts.nodeId = activeNodeId;
						const result = skipNodeUseCase(currentState, skipOpts);
						if (result.ok) {
							currentState = result.state;
							refreshSnapshot();
							await persistState();
						}
						return;
					}

					case 'continue_next': {
						const result = deselectNode(currentState);
						if (result.ok) {
							currentState = result.state;
							refreshSnapshot();
							await persistState();
						}
						return;
					}

					case 'open_document_preview': {
						const result = openDocumentPreviewUseCase(currentState, {
							profile: currentProfile,
						});
						if (result.ok) {
							currentState = result.state;
							// Use the snapshot returned by the use case —
							// refreshSnapshot() would drop the document_preview
							// mode because resolveSessionMode is structural.
							currentSnapshot = result.snapshot;
							notifyListeners();
							await persistState();
						}
						return;
					}

					// ── Export document (from document preview) ────
					case 'export_document': {
						if (
							currentSnapshot.mode === 'document_preview' &&
							currentSnapshot.mainPanel.kind === 'document_preview'
						) {
							const documentId = currentSnapshot.mainPanel.documentId;
							const exportResult = await exportMarkdown(
								documentId,
								currentState,
								currentProfile,
							);

							if (exportResult.ok) {
								// Append the new artifact to export state.
								currentState = {
									...currentState,
									exportState: {
										artifacts: [
											...currentState.exportState.artifacts,
											exportResult.value,
										],
									},
									updatedAt: nowIso(),
								};

								// Show a success diagnostic.
								currentSnapshot = {
									...currentSnapshot,
									diagnostics: [
										...currentSnapshot.diagnostics,
										{
											code: 'EXPORT_OK',
											message: `Exported to ${exportResult.value.path}`,
											severity: 'info',
										},
									],
								};
								notifyListeners();
								await persistState();
							} else {
								// Show error diagnostic.
								currentSnapshot = {
									...currentSnapshot,
									diagnostics: [
										...currentSnapshot.diagnostics,
										{
											code: `EXPORT_${exportResult.error.code}`,
											message: exportResult.error.message,
											severity: 'error',
										},
									],
								};
								notifyListeners();
							}
						}
						return;
					}

					// ── Close document preview (action bar button) ──
					case 'close_document_preview': {
						if (currentSnapshot.mode === 'document_preview' && currentProfile) {
							currentSnapshot = closeDocumentPreviewUseCase(
								currentState,
								currentProfile,
							);
							notifyListeners();
						}
						return;
					}

					// ── Regenerate document preview ────────────────
					case 'regenerate_document': {
						const result = openDocumentPreviewUseCase(currentState, {
							profile: currentProfile,
						});
						if (result.ok) {
							currentState = result.state;
							currentSnapshot = result.snapshot;
							notifyListeners();
							await persistState();
						}
						return;
					}

					// ── Structural / idle-screen actions ─────────
					case 'select_profile':
					case 'resume_session': {
						// TUI profile/session pickers are not yet wired.
						return;
					}

					default: {
						return;
					}
				}
			}
		}
	}

	// ── Public API ───────────────────────────────────────────────────
	return {
		dispatch,
		dispose() {
			if (disposed) return;
			disposed = true;
			cleanupSignalHandlers();
			listeners.clear();
		},
		getSnapshot() {
			return currentSnapshot;
		},
		getState() {
			return currentState;
		},
		save: persistState,
		sessionId,
		subscribe(listener: RuntimeListener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}
