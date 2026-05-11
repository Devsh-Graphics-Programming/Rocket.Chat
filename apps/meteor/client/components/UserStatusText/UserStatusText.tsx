import { Box } from '@rocket.chat/fuselage';
import { useTooltipClose, useTooltipOpen } from '@rocket.chat/ui-contexts';
import type { ReactElement } from 'react';
import { useRef, useCallback } from 'react';

import { useExpirationText } from './useExpirationText';
import MarkdownText from '../MarkdownText';

type UserStatusTextProps = {
	statusText?: string;
	statusExpiresAt?: Date | string;
	showExpiration?: boolean;
};

const UserStatusText = ({ statusText, statusExpiresAt, showExpiration: showExpirationProp }: UserStatusTextProps): ReactElement | null => {
	const expirationText = useExpirationText(statusExpiresAt);
	const hasValidExpiration = expirationText != null;
	const showExpiration = showExpirationProp ?? hasValidExpiration;

	const ref = useRef<HTMLDivElement>(null);
	const openTooltip = useTooltipOpen();
	const closeTooltip = useTooltipClose();

	const handleMouseEnter = useCallback(() => {
		if (!ref.current || !hasValidExpiration) {
			return;
		}
		openTooltip(<Box fontScale='p2'>{expirationText}</Box>, ref.current);
	}, [hasValidExpiration, expirationText, openTooltip]);

	if (!statusText) {
		return null;
	}

	return (
		<Box ref={ref} data-tooltip='' onMouseEnter={handleMouseEnter} onMouseLeave={closeTooltip}>
			<MarkdownText content={statusText} parseEmoji={true} variant='inlineWithoutBreaks' withTruncatedText />
			{showExpiration && hasValidExpiration && (
				<Box color='hint' fontScale='c1'>
					{expirationText}
				</Box>
			)}
		</Box>
	);
};

export default UserStatusText;
