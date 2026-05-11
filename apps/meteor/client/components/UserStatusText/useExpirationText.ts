import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useFormatDate } from '../../hooks/useFormatDate';
import { useFormatTime } from '../../hooks/useFormatTime';

// Handles Date, ISO string, and EJSON { $date } (from DDP streamer which does raw JSON.parse without EJSON deserialization)
export function parseExpiresAt(value?: unknown): Date | undefined {
	if (!value) {
		return undefined;
	}

	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? undefined : value;
	}

	if (typeof value === 'object' && '$date' in (value as Record<string, unknown>)) {
		const date = new Date((value as { $date: number }).$date);
		return Number.isNaN(date.getTime()) ? undefined : date;
	}

	if (typeof value === 'string') {
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? undefined : date;
	}

	return undefined;
}

function isSameDay(a: Date, b: Date): boolean {
	return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function useExpirationText(statusExpiresAt?: Date | string): string | undefined {
	const { t } = useTranslation();
	const formatTime = useFormatTime();
	const formatDate = useFormatDate();

	return useMemo(() => {
		const expiresAt = parseExpiresAt(statusExpiresAt);
		if (!expiresAt || expiresAt.getTime() <= Date.now()) {
			return undefined;
		}

		const isToday = isSameDay(expiresAt, new Date());
		return `${t('Until')} ${isToday ? formatTime(expiresAt) : formatDate(expiresAt)}`;
	}, [statusExpiresAt, t, formatTime, formatDate]);
}
