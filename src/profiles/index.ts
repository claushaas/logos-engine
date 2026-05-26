/**
 * Profiles module — profile loading, validation, dependency graph, and node tree.
 *
 * Exports:
 * - `loadProfile(path)` — load and validate a single profile file.
 * - `listProfiles(dir?)` — scan a directory for profile IDs.
 * - `getProfile(id, dir?)` — load a profile by ID from a directory.
 * - `LoadError` — the error type returned by all load operations.
 * - `DEFAULT_PROFILE_DIRECTORY` — default scan directory.
 * - `buildDependencyGraph(profile)` — compute node dependency relationships.
 * - `buildNodeTree(profile)` — build nested Phase → Document → Node structure.
 * - `NodeDependencyGraph` type, `NodeTree` type, `NodeTreeNode`, etc.
 */

export {
	buildDependencyGraph,
	type NodeDependencyGraph,
} from './dependency-graph.js';
export {
	buildNodeTree,
	type NodeTree,
	type NodeTreeDocument,
	type NodeTreeNode,
	type NodeTreePhase,
} from './node-tree.js';
export { type LoadError, loadProfile } from './profile-loader.js';
export {
	DEFAULT_PROFILE_DIRECTORY,
	getProfile,
	listProfiles,
} from './profile-registry.js';
