import { Box, Text } from 'ink';
import type React from 'react';

type ProviderNoticeProps = {
	readonly config: {
		enabled: boolean;
		provider: string | null;
		remoteContextDisclosureAccepted: boolean;
	};
};

export function ProviderNotice({
	config,
}: ProviderNoticeProps): React.ReactElement {
	if (!config.enabled || !config.provider) {
		return (
			<Box>
				<Text dimColor>
					AI: Disabled (deterministic mode). No data leaves this machine.
				</Text>
			</Box>
		);
	}

	if (config.provider !== 'mock' && !config.remoteContextDisclosureAccepted) {
		return (
			<Box>
				<Text color="yellow">
					⚠ AI: {config.provider} configured. Remote disclosure not accepted.
					Run /config ai --allow-remote to acknowledge.
				</Text>
			</Box>
		);
	}

	if (config.provider === 'mock') {
		return (
			<Box>
				<Text dimColor>
					AI: Mock provider (local testing). No data leaves this machine.
				</Text>
			</Box>
		);
	}

	return (
		<Box>
			<Text color="cyan">
				ℹ AI: {config.provider} configured. Project context may be sent to
				remote provider. Run /config ai --show to review.
			</Text>
		</Box>
	);
}
