import { useFocusManager } from '@react-aria/focus';
import type { VideoConfPopupType } from '@rocket.chat/apps-engine/definition/ui';
import type { IRoom } from '@rocket.chat/core-typings';
import { useUserRoom } from '@rocket.chat/ui-contexts';
import {
	useVideoConfAcceptCall,
	useVideoConfAbortCall,
	useVideoConfRejectIncomingCall,
	useVideoConfDismissCall,
	useVideoConfStartCall,
	useVideoConfDismissOutgoing,
} from '@rocket.chat/ui-video-conf';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import IncomingPopup from './IncomingPopup';
import OutgoingPopup from './OutgoingPopup';
import StartCallPopup from './StartCallPopup';
import { useVideoConfPopupAppsActionButtons } from '../../../../../../hooks/useVideoConfPopupAppsActionButtons';

type TimedVideoConfPopupProps = {
	id: string;
	rid: IRoom['_id'];
	isReceiving?: boolean;
	isCalling?: boolean;
	position: number;
	onClose?: (id: string) => void;
};

const TimedVideoConfPopup = ({
	id,
	rid,
	isReceiving = false,
	isCalling = false,
	position,
}: TimedVideoConfPopupProps): ReactElement | null => {
	const [starting, setStarting] = useState(false);
	const acceptCall = useVideoConfAcceptCall();
	const abortCall = useVideoConfAbortCall();
	const rejectCall = useVideoConfRejectIncomingCall();
	const dismissCall = useVideoConfDismissCall();
	const startCall = useVideoConfStartCall();
	const dismissOutgoing = useVideoConfDismissOutgoing();
	const focusManager = useFocusManager();
	const room = useUserRoom(rid);

	// Derive popupType and call hook unconditionally (before any conditional returns)
	let popupType: VideoConfPopupType;

	if (isReceiving) {
		popupType = 'incoming';
	} else if (isCalling) {
		popupType = 'outgoing';
	} else {
		popupType = 'start';
	}

	const appButtons = useVideoConfPopupAppsActionButtons({ room: room!, callId: id, popupType });

	useEffect(() => {
		focusManager?.focusFirst();
	}, [focusManager]);

	if (!room) {
		return null;
	}

	const handleConfirm = (): void => {
		acceptCall(id);
	};

	const handleClose = (id: string): void => {
		if (isReceiving) {
			rejectCall(id);
			return;
		}

		abortCall();
	};

	const handleMute = (): void => {
		dismissCall(id);
	};

	const handleStartCall = async (): Promise<void> => {
		setStarting(true);
		startCall(rid);
	};

	if (isReceiving) {
		return (
			<IncomingPopup
				room={room}
				id={id}
				position={position}
				onClose={handleClose}
				onMute={handleMute}
				onConfirm={handleConfirm}
				appButtons={appButtons}
			/>
		);
	}

	if (isCalling) {
		return <OutgoingPopup room={room} id={id} onClose={handleClose} appButtons={appButtons} />;
	}

	return (
		<StartCallPopup loading={starting} room={room} id={id} onClose={dismissOutgoing} onConfirm={handleStartCall} appButtons={appButtons} />
	);
};

export default TimedVideoConfPopup;
