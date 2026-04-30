import { useSetting } from '@rocket.chat/ui-contexts';
import { useMemo } from 'react';

/**
 * Returns the maximum number of characters a message can have for markdown parsing.
 * Returns Infinity when the setting is 0 or negative, meaning the limit is disabled
 * and all messages will be parsed regardless of length.
 */
export const useMaxMarkdownParseLength = (): number => {
	const settingValue = useSetting('Message_MaxMarkdownParseLength', 0);

	return useMemo(() => {
		if (typeof settingValue !== 'number' || settingValue <= 0) {
			return Infinity;
		}
		return settingValue;
	}, [settingValue]);
};
