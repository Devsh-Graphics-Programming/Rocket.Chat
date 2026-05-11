import type { IRoom } from '@rocket.chat/core-typings';
import { isDirectMessageRoom, isPrivateRoom, isPublicRoom, isTeamRoom } from '@rocket.chat/core-typings';
import { Box } from '@rocket.chat/fuselage';
import { useUserId, useRouter, useUserPresence } from '@rocket.chat/ui-contexts';
import { useTranslation } from 'react-i18next';

import MarkdownText from '../../../components/MarkdownText';
import { UserStatusText } from '../../../components/UserStatusText';
import { useCanEditRoom } from '../contextualBar/Info/hooks/useCanEditRoom';

type RoomTopicProps = {
	room: IRoom;
};

const RoomTopic = ({ room }: RoomTopicProps) => {
	const { t } = useTranslation();
	const canEdit = useCanEditRoom(room);
	const userId = useUserId();
	const directUserId = room.uids?.filter((uid) => uid !== userId).shift() ?? (room.uids?.length === 1 ? userId : undefined);
	const directUserData = useUserPresence(directUserId);
	const router = useRouter();

	const currentRoute = router.getLocationPathname();
	const href = isTeamRoom(room) ? `${currentRoute}/team-info` : `${currentRoute}/channel-settings`;

	const isDirect = isDirectMessageRoom(room) && (room.uids?.length ?? 0) < 3;
	const topic = isDirect ? directUserData?.statusText : room.topic;
	const canEditTopic = canEdit && (isPublicRoom(room) || isPrivateRoom(room));

	if (!topic && !canEditTopic) {
		return null;
	}

	if (!topic && canEditTopic) {
		return (
			<Box is='a' href={href}>
				{t('Add_topic')}
			</Box>
		);
	}

	if (isDirect) {
		return <UserStatusText statusText={topic} statusExpiresAt={directUserData?.statusExpiresAt} showExpiration={false} />;
	}

	return <MarkdownText color='default' parseEmoji={true} variant='inlineWithoutBreaks' withTruncatedText content={topic} />;
};

export default RoomTopic;
