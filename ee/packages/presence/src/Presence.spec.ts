import type { IUser } from '@rocket.chat/core-typings';
import { UserStatus } from '@rocket.chat/core-typings';
import { registerModel } from '@rocket.chat/models';

import { Presence } from './Presence';

const findUserMock = jest.fn();
const updatePresenceMock = jest.fn();
const findSessionMock = jest.fn();

registerModel('IUsersModel', {
	findOneById: findUserMock,
	updatePresenceAndStatus: updatePresenceMock,
	findExpiredStatuses: jest.fn(),
} as any);

registerModel('IUsersSessionsModel', {
	findOneById: findSessionMock,
	addConnectionById: jest.fn(),
	removeConnectionByConnectionId: jest.fn(),
	updateConnectionStatusById: jest.fn(),
} as any);

const user = (o: Partial<IUser> = {}): IUser =>
	({
		_id: 'u1',
		username: 'test',
		roles: ['user'],
		status: UserStatus.ONLINE,
		statusDefault: UserStatus.ONLINE,
		statusConnection: UserStatus.ONLINE,
		statusText: '',
		...o,
	}) as IUser;

const withOnlineSession = () =>
	findSessionMock.mockResolvedValue({ connections: [{ id: 's1', instanceId: 'i1', status: UserStatus.ONLINE }] });

const withNoSessions = () => findSessionMock.mockResolvedValue(null);

describe('Presence class', () => {
	let presence: Presence;

	beforeEach(() => {
		jest.clearAllMocks();
		presence = new Presence();
		(presence as any).broadcastEnabled = true;
		(presence as any).api = { broadcast: jest.fn(), nodeList: jest.fn().mockResolvedValue([]) };
		updatePresenceMock.mockResolvedValue(user());
	});

	describe('updateUserPresence', () => {
		it('should recalculate status from sessions', async () => {
			findUserMock.mockResolvedValue(user({ statusDefault: UserStatus.BUSY }));
			withOnlineSession();

			await presence.updateUserPresence('u1');

			expect(updatePresenceMock).toHaveBeenCalledWith(
				'u1',
				expect.objectContaining({ status: UserStatus.BUSY, statusConnection: UserStatus.ONLINE }),
				undefined,
			);
		});

		it('when user has no sessions, should resolve to offline', async () => {
			findUserMock.mockResolvedValue(user());
			withNoSessions();

			await presence.updateUserPresence('u1');

			expect(updatePresenceMock).toHaveBeenCalledWith(
				'u1',
				expect.objectContaining({ status: UserStatus.OFFLINE, statusConnection: UserStatus.OFFLINE }),
				undefined,
			);
		});

		it('when user is not found, should not write anything', async () => {
			findUserMock.mockResolvedValue(null);

			await presence.updateUserPresence('u1');

			expect(updatePresenceMock).not.toHaveBeenCalled();
		});
	});

	describe('setActiveState', () => {
		it('should apply claim and write combined result', async () => {
			findUserMock.mockResolvedValue(user());
			withOnlineSession();

			await presence.setActiveState('u1', {
				statusDefault: UserStatus.BUSY,
				statusSource: 'manual',
				statusText: 'Focus',
			});

			expect(updatePresenceMock).toHaveBeenCalledWith(
				'u1',
				expect.objectContaining({ statusDefault: UserStatus.BUSY, statusSource: 'manual', status: UserStatus.BUSY }),
				expect.any(Array),
			);
		});

		it('when claim is rejected (offline + external), should not write', async () => {
			findUserMock.mockResolvedValue(user({ statusDefault: UserStatus.OFFLINE }));
			withNoSessions();

			await presence.setActiveState('u1', {
				statusDefault: UserStatus.BUSY,
				statusSource: 'external',
			});

			expect(updatePresenceMock).not.toHaveBeenCalled();
		});

		it('session-less user with manual claim should keep claimed status', async () => {
			findUserMock.mockResolvedValue(user({ statusDefault: UserStatus.ONLINE }));
			withNoSessions();

			await presence.setActiveState('u1', {
				statusDefault: UserStatus.BUSY,
				statusSource: 'manual',
				statusText: 'Working',
			});

			expect(updatePresenceMock).toHaveBeenCalledWith(
				'u1',
				expect.objectContaining({ status: UserStatus.BUSY, statusConnection: UserStatus.OFFLINE }),
				expect.any(Array),
			);
		});

		it('should pass emoji and expiresAt when provided', async () => {
			const expiresAt = new Date(Date.now() + 3600_000);
			findUserMock.mockResolvedValue(user());
			withOnlineSession();

			await presence.setActiveState('u1', {
				statusDefault: UserStatus.BUSY,
				statusSource: 'manual',
				statusText: 'Focus',
				statusEmoji: '🔥',
				statusExpiresAt: expiresAt,
			});

			expect(updatePresenceMock).toHaveBeenCalledWith(
				'u1',
				expect.objectContaining({ statusEmoji: '🔥', statusExpiresAt: expiresAt }),
				undefined,
			);
		});
	});

	describe('endActiveState', () => {
		it('should restore previous and write', async () => {
			findUserMock.mockResolvedValue(
				user({
					statusSource: 'manual',
					statusDefault: UserStatus.BUSY,
					previousState: { statusDefault: UserStatus.BUSY, statusText: 'Meeting', statusSource: 'external' },
				}),
			);
			withOnlineSession();

			await presence.endActiveState('u1');

			expect(updatePresenceMock).toHaveBeenCalledWith(
				'u1',
				expect.objectContaining({ statusSource: 'external', statusText: 'Meeting' }),
				expect.arrayContaining(['previousState']),
			);
		});
	});

	describe('clearActiveState', () => {
		it('should reset to online and write', async () => {
			findUserMock.mockResolvedValue(user({ statusDefault: UserStatus.BUSY, statusSource: 'manual' }));
			withOnlineSession();

			await presence.clearActiveState('u1');

			expect(updatePresenceMock).toHaveBeenCalledWith(
				'u1',
				expect.objectContaining({ statusDefault: UserStatus.ONLINE, statusText: '', status: UserStatus.ONLINE }),
				expect.arrayContaining(['statusSource', 'previousState']),
			);
		});
	});

	describe('setStatus', () => {
		it('should return true when status changed', async () => {
			findUserMock.mockResolvedValue(user());
			withOnlineSession();

			const result = await presence.setStatus('u1', UserStatus.BUSY, 'Working');

			expect(result).toBe(true);
			expect(updatePresenceMock).toHaveBeenCalledWith(
				'u1',
				expect.objectContaining({ statusDefault: UserStatus.BUSY, statusSource: 'manual' }),
				expect.any(Array),
			);
		});

		it('ONLINE with no text should trigger clearActive', async () => {
			findUserMock.mockResolvedValue(user({ statusDefault: UserStatus.BUSY, statusSource: 'manual' }));
			withOnlineSession();

			await presence.setStatus('u1', UserStatus.ONLINE);

			expect(updatePresenceMock).toHaveBeenCalledWith(
				'u1',
				expect.objectContaining({ statusDefault: UserStatus.ONLINE }),
				expect.arrayContaining(['statusSource', 'previousState']),
			);
		});

		it('ONLINE with text should setActive, not clearActive', async () => {
			findUserMock.mockResolvedValue(user());
			withOnlineSession();

			await presence.setStatus('u1', UserStatus.ONLINE, 'brb');

			expect(updatePresenceMock).toHaveBeenCalledWith(
				'u1',
				expect.objectContaining({ statusDefault: UserStatus.ONLINE, statusSource: 'manual', statusText: 'brb' }),
				expect.any(Array),
			);
		});

		it('empty string statusText should clear it (write empty string)', async () => {
			findUserMock.mockResolvedValue(user({ statusText: 'Old text' }));
			withOnlineSession();

			await presence.setStatus('u1', UserStatus.BUSY, '');

			expect(updatePresenceMock).toHaveBeenCalledWith(
				'u1',
				expect.objectContaining({ statusDefault: UserStatus.BUSY, statusText: '' }),
				expect.any(Array),
			);
		});

		it('undefined statusText should not be included in the update', async () => {
			findUserMock.mockResolvedValue(user({ statusText: 'Old text' }));
			withOnlineSession();

			await presence.setStatus('u1', UserStatus.BUSY);

			const updateArg = updatePresenceMock.mock.calls[0][1];
			expect(updateArg).not.toHaveProperty('statusText');
		});

		it('should return false when user not found', async () => {
			findUserMock.mockResolvedValue(null);

			const result = await presence.setStatus('u1', UserStatus.BUSY);

			expect(result).toBe(false);
		});
	});
});
