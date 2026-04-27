import { useSetting } from '@rocket.chat/ui-contexts';
import { useMemo } from 'react';

import { MESSAGE_PARSE_HARD_LIMIT } from '../../../lib/constants';

/**
 * Returns the maximum allowed size for message parsing.
 * Uses Math.min to ensure it never exceeds the hard limit to avoid performance issues.
 * Always returns a number, never null or undefined.
 */
export const useMaxMessageParseSize = (): number => {
	const settingValue = useSetting('Message_MaxAllowedSize', 5000);

	return useMemo(() => {
		const maxSize = typeof settingValue === 'number' && settingValue > 0 ? settingValue : 5000;
		return Math.min(maxSize, MESSAGE_PARSE_HARD_LIMIT);
	}, [settingValue]);
};
