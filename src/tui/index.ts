/** TUI entry point — isolates Ink rendering from CLI bootstrap */

import { render } from 'ink';
import React from 'react';
import { App } from './App.js';

export async function startTui(): Promise<void> {
	const { waitUntilExit } = render(React.createElement(App));
	await waitUntilExit();
}
