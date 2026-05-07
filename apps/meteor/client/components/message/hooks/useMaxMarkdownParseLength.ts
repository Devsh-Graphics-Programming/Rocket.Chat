import { useSetting } from '@rocket.chat/ui-contexts';
import { useMemo } from 'react';

export const useMaxMarkdownParseLength = (): number => {
	const settingValue = useSetting('Message_MaxMarkdownParseLength', 0);

	return useMemo(() => {
		if (typeof settingValue !== 'number' || settingValue <= 0) {
			return Infinity;
		}
		return settingValue;
	}, [settingValue]);
};
