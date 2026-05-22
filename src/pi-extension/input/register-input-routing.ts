/**
 * LOGOS Pi Extension — Input routing registration boundary (Step 8.1).
 *
 * Registers the Pi `input` event handler that delegates active-intake natural
 * user messages to the adapter-only router.  Registration does not call Core.
 */

import type { LogosPiExtensionDependencies } from '../extension-dependencies.js';
import type {
	LogosPiEventContext,
	LogosPiInputEvent,
	LogosPiInputHandlerResult,
} from '../pi-types.js';
import { routePiInput, toPiInputResult } from './input-router.js';

type InputOnRegistrar = {
	on?: (
		event: 'input',
		handler: (
			event: LogosPiInputEvent,
			ctx: LogosPiEventContext,
		) => Promise<LogosPiInputHandlerResult> | LogosPiInputHandlerResult,
	) => void;
};

const registeredInputRoutingApis = new WeakSet<object>();

export function registerLogosInputRouting(
	deps: LogosPiExtensionDependencies,
): void {
	const maybePi = deps.pi as InputOnRegistrar;

	if (typeof maybePi.on !== 'function') {
		return;
	}

	if (registeredInputRoutingApis.has(deps.pi)) {
		return;
	}

	maybePi.on('input', async (event, ctx) => {
		const result = await routePiInput({ ctx, deps, event });
		return toPiInputResult(result);
	});

	registeredInputRoutingApis.add(deps.pi);
}
