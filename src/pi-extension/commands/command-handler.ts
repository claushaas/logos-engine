import type { LogosPiCommandContext } from '../pi-types.js';

export type PiCommandHandler = (
	args: string,
	ctx: LogosPiCommandContext,
) => Promise<void>;

export function argsToAdapterArgs(args: string): string[] | undefined {
	return args.trim().length > 0 ? [args] : undefined;
}
