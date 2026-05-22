/**
 * LOGOS Pi Extension — Minimal Core result rendering boundary.
 *
 * Step 7.4 keeps rendering intentionally minimal: command adapters forward
 * Core results through this boundary, and product/rendering decisions remain
 * outside command handlers.
 */

import type { CoreResult } from '../../core/index.js';
import type { LogosPiExtensionDependencies } from '../extension-dependencies.js';
import type {
	LogosPiCommandContext,
	LogosPiEventContext,
} from '../pi-types.js';

export type RenderCoreResultInput = {
	deps: LogosPiExtensionDependencies;
	ctx: LogosPiCommandContext | LogosPiEventContext;
	result: CoreResult<unknown>;
};

type NotifyType = 'info' | 'warning' | 'error';

type MinimalUiNotify = {
	notify(message: string, type?: NotifyType): void;
};

function notifyTypeForResult(result: CoreResult<unknown>): NotifyType {
	if (
		result.status === 'blocked' ||
		result.status === 'failed' ||
		result.message.kind === 'error'
	) {
		return 'error';
	}

	if (
		result.status === 'confirmation_required' ||
		result.message.kind === 'warning' ||
		result.message.kind === 'confirmation_request'
	) {
		return 'warning';
	}

	return 'info';
}

function getNotify(
	ctx: LogosPiCommandContext | LogosPiEventContext,
): MinimalUiNotify['notify'] | undefined {
	const maybeCtx = ctx as unknown as { ui?: Partial<MinimalUiNotify> };
	return typeof maybeCtx.ui?.notify === 'function'
		? maybeCtx.ui.notify.bind(maybeCtx.ui)
		: undefined;
}

export async function renderCoreResult(
	input: RenderCoreResultInput,
): Promise<void> {
	if (input.deps.renderCoreResult !== undefined) {
		await input.deps.renderCoreResult(input.result, input.ctx);
		return;
	}

	if (typeof input.deps.pi.sendMessage === 'function') {
		input.deps.pi.sendMessage({
			content: input.result.message.body,
			customType: 'logos-core-result',
			details: input.result,
			display: true,
		});
		return;
	}

	const notify = getNotify(input.ctx);
	if (notify !== undefined) {
		notify(input.result.message.body, notifyTypeForResult(input.result));
	}
}
