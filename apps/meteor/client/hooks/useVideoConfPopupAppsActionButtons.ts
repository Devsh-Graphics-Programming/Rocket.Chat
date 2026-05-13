import type { IUIActionButton, VideoConfPopupType } from '@rocket.chat/apps-engine/definition/ui';
import type { IRoom } from '@rocket.chat/core-typings';
import { useToastMessageDispatch } from '@rocket.chat/ui-contexts';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppActionButtons } from './useAppActionButtons';
import { applyRoomFilter, useApplyButtonAuthFilter } from './useApplyButtonFilters';
import { UiKitTriggerTimeoutError } from '../../app/ui-message/client/UiKitTriggerTimeoutError';
import { Utilities } from '../../ee/lib/misc/Utilities';
import { useUiKitActionManager } from '../uikit/hooks/useUiKitActionManager';

type VideoConfPopupAppButton = {
	label: string;
	variant?: 'danger';
	onClick: () => void;
};

type Options = {
	room: IRoom;
	callId: string;
	popupType: VideoConfPopupType;
};

const useApplyVideoConfActionButtonFilters = (room: IRoom): ((button: IUIActionButton) => boolean) => {
	const applyAuthFilter = useApplyButtonAuthFilter();

	return useCallback((button: IUIActionButton) => applyAuthFilter(button, room) && applyRoomFilter(button, room), [applyAuthFilter, room]);
};

export const useVideoConfPopupAppsActionButtons = ({ room, callId, popupType }: Options): VideoConfPopupAppButton[] => {
	const result = useAppActionButtons('videoConfPopupAction');
	const actionManager = useUiKitActionManager();
	const applyButtonFilters = useApplyVideoConfActionButtonFilters(room);
	const { t } = useTranslation();
	const dispatchToastMessage = useToastMessageDispatch();

	return useMemo(
		() =>
			result.data
				?.filter(applyButtonFilters)
				.filter((action) => {
					// `popupTypes` is only present on the VIDEO_CONF_POPUP_ACTION discriminant variant
					const { popupTypes } = (action as IUIActionButton & { when?: { popupTypes?: VideoConfPopupType[] } }).when ?? {};
					return !popupTypes || popupTypes.includes(popupType);
				})
				.map(
					(action): VideoConfPopupAppButton => ({
						label: t(Utilities.getI18nKeyForApp(action.labelI18n, action.appId)),
						variant: action.variant,
						onClick: () => {
							void actionManager
								.emitInteraction(action.appId, {
									type: 'actionButton',
									actionId: action.actionId,
									rid: room._id,
									payload: { context: 'videoConfPopupAction' as const, callId },
								})
								.catch(async (reason: unknown) => {
									if (reason instanceof UiKitTriggerTimeoutError) {
										dispatchToastMessage({ type: 'error', message: t('UIKit_Interaction_Timeout') });
										return;
									}
									return reason;
								});
						},
					}),
				) ?? [],
		[actionManager, applyButtonFilters, callId, dispatchToastMessage, popupType, result.data, room._id, t],
	);
};
