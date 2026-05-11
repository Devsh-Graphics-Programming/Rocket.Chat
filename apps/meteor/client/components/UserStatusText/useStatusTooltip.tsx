import { Box } from '@rocket.chat/fuselage';
import { useTooltipOpen, useTooltipClose } from '@rocket.chat/ui-contexts';
import type { MouseEvent } from 'react';
import { useCallback } from 'react';

import { useExpirationText } from './useExpirationText';

export function useStatusTooltip(statusText?: string, statusExpiresAt?: Date | string) {
	const expirationText = useExpirationText(statusExpiresAt);
	const openTooltip = useTooltipOpen();
	const closeTooltip = useTooltipClose();

	const handleMouseEnter = useCallback(
		(e: MouseEvent<HTMLElement>) => {
			if (!statusText) {
				return;
			}
			openTooltip(
				<Box>
					<Box fontScale='p2'>{statusText}</Box>
					{expirationText && (
						<Box fontScale='c1' color='hint'>
							{expirationText}
						</Box>
					)}
				</Box>,
				e.currentTarget,
			);
		},
		[statusText, expirationText, openTooltip],
	);

	return {
		hasStatusText: !!statusText,
		handleMouseEnter,
		handleMouseLeave: closeTooltip,
	};
}
