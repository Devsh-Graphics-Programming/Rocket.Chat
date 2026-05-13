import type { IRoom } from '@rocket.chat/core-typings';
import { Divider } from '@rocket.chat/fuselage';
import {
	VideoConfPopup,
	VideoConfPopupContent,
	VideoConfPopupControllers,
	VideoConfController,
	useVideoConfControllers,
	VideoConfButton,
	VideoConfPopupFooter,
	VideoConfPopupFooterButtons,
	VideoConfPopupTitle,
	VideoConfPopupHeader,
	useVideoConfCapabilities,
	useVideoConfPreferences,
} from '@rocket.chat/ui-video-conf';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import VideoConfPopupRoomInfo from './VideoConfPopupRoomInfo';
import { useVideoConfRoomName } from '../../hooks/useVideoConfRoomName';

type OutgoingPopupProps = {
	id: string;
	room: IRoom;
	onClose: (id: string) => void;
	appButtons?: { label: string; variant?: 'danger'; onClick: () => void }[];
};

const OutgoingPopup = ({ room, onClose, id, appButtons = [] }: OutgoingPopupProps): ReactElement => {
	const { t } = useTranslation();
	const videoConfPreferences = useVideoConfPreferences();
	const { controllersConfig } = useVideoConfControllers(videoConfPreferences);
	const capabilities = useVideoConfCapabilities();
	const roomName = useVideoConfRoomName(room);

	const showCam = !!capabilities.cam;
	const showMic = !!capabilities.mic;

	return (
		<VideoConfPopup aria-label={t('Calling__roomName__', { roomName })}>
			<VideoConfPopupHeader>
				<VideoConfPopupTitle text={t('Calling')} counter />
				{(showCam || showMic) && (
					<VideoConfPopupControllers>
						{showCam && (
							<VideoConfController
								active={controllersConfig.cam}
								title={controllersConfig.cam ? t('Cam_on') : t('Cam_off')}
								icon={controllersConfig.cam ? 'video' : 'video-off'}
								disabled
							/>
						)}
						{showMic && (
							<VideoConfController
								active={controllersConfig.mic}
								title={controllersConfig.mic ? t('Mic_on') : t('Mic_off')}
								icon={controllersConfig.mic ? 'mic' : 'mic-off'}
								disabled
							/>
						)}
					</VideoConfPopupControllers>
				)}
			</VideoConfPopupHeader>
			<VideoConfPopupContent>
				<VideoConfPopupRoomInfo room={room} />
			</VideoConfPopupContent>
			<VideoConfPopupFooter>
				{appButtons.length > 0 && (
					<>
						<VideoConfPopupFooterButtons>
							{appButtons.map((btn) => (
								<VideoConfButton key={btn.label} danger={btn.variant === 'danger'} secondary={!btn.variant} onClick={btn.onClick}>
									{btn.label}
								</VideoConfButton>
							))}
						</VideoConfPopupFooterButtons>
						<Divider />
					</>
				)}
				<VideoConfPopupFooterButtons>
					{appButtons.map((btn) => (
						<VideoConfButton key={btn.label} danger={btn.variant === 'danger'} secondary={!btn.variant} onClick={btn.onClick}>
							{btn.label}
						</VideoConfButton>
					))}
					{onClose && <VideoConfButton onClick={(): void => onClose(id)}>{t('Cancel')}</VideoConfButton>}
				</VideoConfPopupFooterButtons>
			</VideoConfPopupFooter>
		</VideoConfPopup>
	);
};

export default OutgoingPopup;
