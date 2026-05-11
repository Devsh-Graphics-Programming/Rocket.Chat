import { UserStatus } from '@rocket.chat/core-typings';

import { Presence } from './presence';

jest.mock('meteor/meteor', () => ({
	Meteor: {
		subscribe: jest.fn(),
	},
}));

const mockGet = jest.fn();

jest.mock('../../app/utils/client/lib/SDKClient', () => ({
	sdk: {
		rest: {
			get: (...args: unknown[]) => mockGet(...args),
		},
	},
}));

describe('Presence fallback status', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.useFakeTimers();
		Presence.store.clear();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('should use DISABLED as fallback when status is set to disabled', async () => {
		mockGet.mockResolvedValue({ users: [] });
		Presence.setStatus('disabled');

		Presence.listen('user1', jest.fn());
		await jest.advanceTimersByTimeAsync(500);

		expect(Presence.store.get('user1')?.status).toBe(UserStatus.DISABLED);
	});

	it('should use OFFLINE as fallback when status is set to enabled', async () => {
		mockGet.mockResolvedValue({ users: [] });
		Presence.setStatus('enabled');

		Presence.listen('user1', jest.fn());
		await jest.advanceTimersByTimeAsync(500);

		expect(Presence.store.get('user1')?.status).toBe(UserStatus.OFFLINE);
	});

	it('should preserve statusSource and statusExpiresAt from REST response', async () => {
		const expiresAt = new Date(Date.now() + 3600_000);
		mockGet.mockResolvedValue({
			users: [
				{
					_id: 'user1',
					username: 'testuser',
					status: UserStatus.BUSY,
					statusText: 'focus time',
					statusSource: 'manual',
					statusExpiresAt: expiresAt.toISOString(),
				},
			],
		});
		Presence.setStatus('enabled');

		Presence.listen('user1', jest.fn());
		await jest.advanceTimersByTimeAsync(500);

		const stored = Presence.store.get('user1');
		expect(stored?.status).toBe(UserStatus.BUSY);
		expect(stored?.statusText).toBe('focus time');
		expect(stored?.statusSource).toBe('manual');
		expect(stored?.statusExpiresAt).toEqual(expiresAt);
	});

	it('should merge statusSource and statusExpiresAt from notify into existing store entry', async () => {
		mockGet.mockResolvedValue({ users: [] });
		Presence.setStatus('enabled');

		Presence.listen('user1', jest.fn());
		await jest.advanceTimersByTimeAsync(500);

		const expiresAt = new Date(Date.now() + 1800_000);
		Presence.notify({
			_id: 'user1',
			username: 'testuser',
			status: UserStatus.BUSY,
			statusText: 'in a meeting',
			statusSource: 'manual',
			statusExpiresAt: expiresAt,
		});

		const stored = Presence.store.get('user1');
		expect(stored?.status).toBe(UserStatus.BUSY);
		expect(stored?.statusText).toBe('in a meeting');
		expect(stored?.statusSource).toBe('manual');
		expect(stored?.statusExpiresAt).toEqual(expiresAt);
	});
});
