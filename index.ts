// LOGOS Pi Extension — auto-discovery entrypoint.
//
// Pi loads this file via jiti when it discovers the extension at
// ~/.pi/agent/extensions/logos-engine/index.ts.
//
// This file is deliberately thin: it only re-exports the default factory
// from the pi-extension source. No product logic, command registration,
// or Core imports belong here.
export { default } from './src/pi-extension/index.js';
