import type { IUser, IUserSessionConnection } from '@rocket.chat/core-typings';
import { UserStatus } from '@rocket.chat/core-typings';

import { processPresence } from './presenceEngine';

/**
 * Use case matrix: https://docs.google.com/spreadsheets/d/19C5WoBoOeuVjkK-sXjIkk-UB6N6kMq0WX1lOpag5MJI/edit?gid=892305183#gid=892305183
 */

const ONE_HOUR = 3600_000;

const user = (o: Partial<IUser> = {}): IUser => ({
	statusDefault: UserStatus.ONLINE,
	statusText: '',
	...o,
});

const session = (status: UserStatus = UserStatus.ONLINE): IUserSessionConnection => ({
	id: 'random',
	instanceId: 'random',
	status,
	_createdAt: new Date(),
	_updatedAt: new Date(),
});

describe('processPresence', () => {
	describe('baseline', () => {
		test('UC-01: active user, no status set → ONLINE', () => {
			const result = processPresence(user(), [session(UserStatus.ONLINE)]);
			expect(result.values).toMatchObject({ status: UserStatus.ONLINE, statusConnection: UserStatus.ONLINE });
		});

		test('UC-02: active user with manual status → shows manual status', () => {
			const result = processPresence(user({ statusDefault: UserStatus.BUSY, statusText: 'Working from home' }), [
				session(UserStatus.ONLINE),
			]);
			expect(result.values).toMatchObject({ status: UserStatus.BUSY, statusConnection: UserStatus.ONLINE });
		});

		test('UC-03: user idle → AWAY', () => {
			const result = processPresence(user(), [session(UserStatus.AWAY)]);
			expect(result.values).toMatchObject({ status: UserStatus.AWAY, statusConnection: UserStatus.AWAY });
		});

		test('UC-04: user disconnects → OFFLINE', () => {
			const result = processPresence(user(), []);
			expect(result.values).toMatchObject({ status: UserStatus.OFFLINE, statusConnection: UserStatus.OFFLINE });
		});
	});

	describe('manual status', () => {
		test('UC-05: user sets Busy manually', () => {
			const result = processPresence(user(), [session()], {
				type: 'setActive',
				newState: { statusDefault: UserStatus.BUSY, statusSource: 'manual' },
			});
			expect(result.values.status).toBe(UserStatus.BUSY);
			expect(result.values.statusSource).toBe('manual');
		});

		test('UC-06: user sets OOO with expiry', () => {
			const exp = new Date(Date.now() + ONE_HOUR);
			const result = processPresence(user(), [session()], {
				type: 'setActive',
				newState: {
					statusDefault: UserStatus.BUSY,
					statusText: 'Out of office',
					statusSource: 'manual',
					statusEmoji: '🏖️',
					statusExpiresAt: exp,
				},
			});
			expect(result.values.statusEmoji).toBe('🏖️');
			expect(result.values.statusExpiresAt).toEqual(exp);
		});

		test('UC-07: manual status then offline → OFFLINE, statusDefault persists', () => {
			const result = processPresence(user({ statusDefault: UserStatus.BUSY, statusText: 'Focusing' }), []);
			expect(result.values).toMatchObject({ status: UserStatus.OFFLINE, statusConnection: UserStatus.OFFLINE });
		});

		test('UC-08: timed status expires → endActive restores previous or resets', () => {
			const result = processPresence(
				user({
					statusSource: 'manual',
					statusDefault: UserStatus.BUSY,
					statusText: 'Design work',
					statusExpiresAt: new Date(Date.now() - 1000),
				}),
				[session()],
				{ type: 'endActive' },
			);
			expect(result.values).toMatchObject({ statusDefault: UserStatus.ONLINE });
			expect(result.clear).toEqual(expect.arrayContaining(['statusEmoji', 'statusSource', 'statusExpiresAt', 'previousState']));
		});
	});

	describe('system and multi-device', () => {
		test('UC-09: active on mobile, idle on desktop → ONLINE wins', () => {
			const result = processPresence(user(), [session(UserStatus.ONLINE), session(UserStatus.AWAY)]);
			expect(result.values).toMatchObject({ status: UserStatus.ONLINE, statusConnection: UserStatus.ONLINE });
		});

		test('UC-09 (reverse order): idle first, active second → still ONLINE', () => {
			const result = processPresence(user(), [session(UserStatus.AWAY), session(UserStatus.ONLINE)]);
			expect(result.values).toMatchObject({ status: UserStatus.ONLINE, statusConnection: UserStatus.ONLINE });
		});

		test('UC-10: all sessions idle → AWAY', () => {
			const result = processPresence(user(), [session(UserStatus.AWAY), session(UserStatus.AWAY)]);
			expect(result.values).toMatchObject({ status: UserStatus.AWAY, statusConnection: UserStatus.AWAY });
		});

		test('UC-11: reconnect preserves statusDefault', () => {
			const result = processPresence(user({ statusDefault: UserStatus.BUSY, statusText: 'Focusing' }), [session(UserStatus.ONLINE)]);
			expect(result.values).toMatchObject({ status: UserStatus.BUSY, statusConnection: UserStatus.ONLINE });
		});
	});

	describe('internal - voice calls', () => {
		test('UC-12: voice call starts → internal claim applied', () => {
			const result = processPresence(user(), [session()], {
				type: 'setActive',
				newState: { statusDefault: UserStatus.BUSY, statusText: 'On a call', statusSource: 'internal' },
			});
			expect(result.values.statusSource).toBe('internal');
			expect(result.values.status).toBe(UserStatus.BUSY);
		});

		test('UC-13: voice call over manual status → saves manual as previous', () => {
			const result = processPresence(
				user({ statusSource: 'manual', statusDefault: UserStatus.BUSY, statusText: 'Focusing' }),
				[session()],
				{ type: 'setActive', newState: { statusDefault: UserStatus.BUSY, statusText: 'On a call', statusSource: 'internal' } },
			);
			expect(result.values.statusSource).toBe('internal');
			expect(result.values.previousState).toMatchObject({ statusSource: 'manual', statusText: 'Focusing' });
		});

		test('UC-14: voice call ends → restores manual status', () => {
			const result = processPresence(
				user({
					statusSource: 'internal',
					statusDefault: UserStatus.BUSY,
					previousState: { statusDefault: UserStatus.BUSY, statusText: 'Focusing', statusSource: 'manual' },
				}),
				[session()],
				{ type: 'endActive' },
			);
			expect(result.values).toMatchObject({ statusSource: 'manual', statusText: 'Focusing' });
			expect(result.clear).toContain('previousState');
		});

		test('UC-15: manual override during voice call → queued, persists after call ends', () => {
			// manual arrives during internal → queued as previousState
			const setResult = processPresence(
				user({ statusSource: 'internal', statusDefault: UserStatus.BUSY, statusText: 'On a call' }),
				[session()],
				{ type: 'setActive', newState: { statusDefault: UserStatus.AWAY, statusText: 'Lunch', statusSource: 'manual' } },
			);
			expect(setResult.values.previousState).toMatchObject({ statusDefault: UserStatus.AWAY, statusText: 'Lunch', statusSource: 'manual' });
			expect(setResult.values.statusSource).toBeUndefined();

			// call ends → manual restored
			const endResult = processPresence(
				user({
					statusSource: 'internal',
					statusDefault: UserStatus.BUSY,
					previousState: { statusDefault: UserStatus.AWAY, statusText: 'Lunch', statusSource: 'manual' },
				}),
				[session()],
				{ type: 'endActive' },
			);
			expect(endResult.values).toMatchObject({ statusSource: 'manual', statusText: 'Lunch', statusDefault: UserStatus.AWAY });
			expect(endResult.clear).toContain('previousState');
		});
	});

	describe('conflicts', () => {
		test('UC-20: voice + pexip overlap (same priority) → second overwrites first', () => {
			const result = processPresence(
				user({ statusSource: 'internal', statusDefault: UserStatus.BUSY, statusText: 'On a call' }),
				[session()],
				{ type: 'setActive', newState: { statusDefault: UserStatus.BUSY, statusText: 'In a meeting', statusSource: 'internal' } },
			);
			expect(result.values.statusText).toBe('In a meeting');
			expect(result.values.statusSource).toBe('internal');
		});

		test('UC-21: voice active + external arrives → external queued (internal > external)', () => {
			const result = processPresence(
				user({ statusSource: 'internal', statusDefault: UserStatus.BUSY, statusText: 'On a call' }),
				[session()],
				{ type: 'setActive', newState: { statusDefault: UserStatus.BUSY, statusText: 'Meeting', statusSource: 'external' } },
			);
			expect(result.values.previousState).toMatchObject({ statusSource: 'external', statusText: 'Meeting' });
			expect(result.values.statusSource).toBeUndefined();
		});
	});

	describe('external - calendar events', () => {
		test('UC-23: meeting starts, no prior status → external claim applied', () => {
			const result = processPresence(user(), [session()], {
				type: 'setActive',
				newState: { statusDefault: UserStatus.BUSY, statusText: 'In a meeting', statusSource: 'external', statusEmoji: '📅' },
			});
			expect(result.values.statusSource).toBe('external');
			expect(result.values.statusEmoji).toBe('📅');
			expect(result.values.status).toBe(UserStatus.BUSY);
		});

		test('UC-24: meeting ends, no prior status → resets to ONLINE', () => {
			const result = processPresence(user({ statusSource: 'external', statusDefault: UserStatus.BUSY }), [session()], {
				type: 'endActive',
			});
			expect(result.values).toMatchObject({ statusDefault: UserStatus.ONLINE });
			expect(result.clear).toEqual(expect.arrayContaining(['statusSource', 'previousState']));
		});

		test('UC-25: meeting ends, had manual before → restores manual', () => {
			const result = processPresence(
				user({
					statusSource: 'external',
					statusDefault: UserStatus.BUSY,
					previousState: { statusDefault: UserStatus.BUSY, statusText: 'Focusing', statusSource: 'manual' },
				}),
				[session()],
				{ type: 'endActive' },
			);
			expect(result.values).toMatchObject({ statusSource: 'manual', statusText: 'Focusing' });
			expect(result.clear).toContain('previousState');
		});

		test('UC-26: back-to-back meetings (same priority) → second overwrites first', () => {
			const result = processPresence(
				user({ statusSource: 'external', statusDefault: UserStatus.BUSY, statusText: 'Meeting 1' }),
				[session()],
				{ type: 'setActive', newState: { statusDefault: UserStatus.BUSY, statusText: 'Meeting 2', statusSource: 'external' } },
			);
			expect(result.values.statusText).toBe('Meeting 2');
		});

		test('UC-30: manual status during external meeting → manual wins, external queued', () => {
			const result = processPresence(
				user({ statusSource: 'external', statusDefault: UserStatus.BUSY, statusText: 'In a meeting' }),
				[session()],
				{ type: 'setActive', newState: { statusDefault: UserStatus.BUSY, statusText: 'Focusing', statusSource: 'manual' } },
			);
			expect(result.values.statusSource).toBe('manual');
			expect(result.values.statusText).toBe('Focusing');
			expect(result.values.previousState).toMatchObject({ statusSource: 'external', statusText: 'In a meeting' });
		});
	});

	describe('edge cases', () => {
		test('UC-31: two external apps at same priority → last write wins', () => {
			const result = processPresence(
				user({
					statusSource: 'external',
					statusDefault: UserStatus.BUSY,
					statusText: 'App A',
					previousState: { statusDefault: UserStatus.BUSY, statusText: 'Manual', statusSource: 'manual' },
				}),
				[session()],
				{ type: 'setActive', newState: { statusDefault: UserStatus.BUSY, statusText: 'App B', statusSource: 'external' } },
			);
			expect(result.values.statusText).toBe('App B');
			expect(result.values.previousState).toBeUndefined();
		});

		test('UC-32: manual set during auto event, event ends → manual persists', () => {
			// internal active, manual arrives (lower priority) → queued
			const setResult = processPresence(user({ statusSource: 'internal', statusDefault: UserStatus.BUSY }), [session()], {
				type: 'setActive',
				newState: { statusDefault: UserStatus.AWAY, statusText: 'Lunch', statusSource: 'manual' },
			});
			expect(setResult.values.previousState).toMatchObject({ statusSource: 'manual' });

			// event ends → manual restored
			const endResult = processPresence(
				user({
					statusSource: 'internal',
					statusDefault: UserStatus.BUSY,
					previousState: { statusDefault: UserStatus.AWAY, statusText: 'Lunch', statusSource: 'manual' },
				}),
				[session()],
				{ type: 'endActive' },
			);
			expect(endResult.values).toMatchObject({ statusSource: 'manual', statusText: 'Lunch' });
		});

		test('UC-33: offline when calendar starts → external claim rejected', () => {
			const result = processPresence(user({ statusDefault: UserStatus.OFFLINE }), [], {
				type: 'setActive',
				newState: { statusDefault: UserStatus.BUSY, statusSource: 'external' },
			});
			expect(result.values).toMatchObject({});
		});

		test('UC-33: offline user accepts manual claim', () => {
			const result = processPresence(user({ statusDefault: UserStatus.OFFLINE }), [], {
				type: 'setActive',
				newState: { statusDefault: UserStatus.BUSY, statusSource: 'manual' },
			});
			expect(result.values.statusSource).toBe('manual');
			expect(result.values.status).toBe(UserStatus.BUSY);
		});

		test('UC-35: status text for offline user → statusDefault persists, display is OFFLINE', () => {
			const result = processPresence(user({ statusDefault: UserStatus.BUSY, statusText: 'Custom text' }), []);
			expect(result.values).toMatchObject({ status: UserStatus.OFFLINE, statusConnection: UserStatus.OFFLINE });
		});
	});

	// Engine internals not tied to specific UCs but required for correctness
	describe('engine internals', () => {
		test('higher priority with no existing claim → no previousState saved', () => {
			const result = processPresence(user(), [session()], {
				type: 'setActive',
				newState: { statusDefault: UserStatus.BUSY, statusText: 'Deep work', statusSource: 'manual' },
			});
			expect(result.values.statusSource).toBe('manual');
			expect(result.values.previousState).toBeUndefined();
		});

		test('lower priority with expired previous → treats as empty slot', () => {
			const newState = { statusDefault: UserStatus.BUSY, statusText: 'Deep work', statusSource: 'manual' as const };
			const result = processPresence(
				user({
					statusSource: 'internal',
					statusDefault: UserStatus.BUSY,
					previousState: {
						statusDefault: UserStatus.BUSY,
						statusText: 'Old',
						statusSource: 'external',
						statusExpiresAt: new Date(Date.now() - ONE_HOUR),
					},
				}),
				[session()],
				{ type: 'setActive', newState },
			);
			expect(result.values.previousState).toMatchObject(newState);
		});

		test('lower priority discarded when previous has higher priority', () => {
			const result = processPresence(
				user({
					statusSource: 'internal',
					statusDefault: UserStatus.BUSY,
					previousState: {
						statusDefault: UserStatus.BUSY,
						statusText: 'Deep work',
						statusSource: 'manual',
						statusExpiresAt: new Date(Date.now() + ONE_HOUR),
					},
				}),
				[session()],
				{ type: 'setActive', newState: { statusDefault: UserStatus.BUSY, statusText: 'Standup', statusSource: 'external' } },
			);
			expect(result.values).toMatchObject({});
		});

		test('emoji and expiresAt cleared when absent from new claim', () => {
			const result = processPresence(user({ statusEmoji: '🔥', statusExpiresAt: new Date() }), [session()], {
				type: 'setActive',
				newState: { statusDefault: UserStatus.BUSY, statusText: 'Focus', statusSource: 'manual' },
			});
			expect(result.clear).toContain('statusEmoji');
			expect(result.clear).toContain('statusExpiresAt');
		});

		test('endActive with expired previous → resets to system', () => {
			const result = processPresence(
				user({
					statusSource: 'internal',
					statusDefault: UserStatus.BUSY,
					previousState: {
						statusDefault: UserStatus.BUSY,
						statusText: 'Focus',
						statusSource: 'manual',
						statusExpiresAt: new Date(Date.now() - 600_000),
					},
				}),
				[session()],
				{ type: 'endActive' },
			);
			expect(result.values).toMatchObject({ statusDefault: UserStatus.ONLINE });
			expect(result.clear).toContain('previousState');
		});

		test('endActive restores previous with emoji and expiresAt', () => {
			const exp = new Date(Date.now() + ONE_HOUR);
			const result = processPresence(
				user({
					statusSource: 'internal',
					statusDefault: UserStatus.BUSY,
					previousState: {
						statusDefault: UserStatus.BUSY,
						statusText: 'Standup',
						statusSource: 'external',
						statusEmoji: '📅',
						statusExpiresAt: exp,
					},
				}),
				[session()],
				{ type: 'endActive' },
			);
			expect(result.values).toMatchObject({ statusSource: 'external', statusEmoji: '📅', statusExpiresAt: exp });
			expect(result.clear).toContain('previousState');
			expect(result.clear).not.toContain('statusEmoji');
		});

		test('clearActive resets everything', () => {
			const result = processPresence(user({ statusSource: 'manual', statusDefault: UserStatus.BUSY }), [session()], {
				type: 'clearActive',
			});
			expect(result.values).toMatchObject({ statusDefault: UserStatus.ONLINE, statusText: '', status: UserStatus.ONLINE });
			expect(result.clear).toEqual(expect.arrayContaining(['statusEmoji', 'statusSource', 'statusExpiresAt', 'previousState']));
		});

		test('session-less user with manual claim → trust intent', () => {
			const result = processPresence(user({ statusDefault: UserStatus.OFFLINE }), [], {
				type: 'setActive',
				newState: { statusDefault: UserStatus.BUSY, statusSource: 'manual', statusText: 'Working' },
			});
			expect(result.values.status).toBe(UserStatus.BUSY);
			expect(result.values.statusConnection).toBe(UserStatus.OFFLINE);
		});

		test('claim with OFFLINE session → display OFFLINE', () => {
			const result = processPresence(user(), [session(UserStatus.OFFLINE)], {
				type: 'setActive',
				newState: { statusDefault: UserStatus.BUSY, statusSource: 'manual' },
			});
			expect(result.values.status).toBe(UserStatus.OFFLINE);
		});

		test('clearActive + session AWAY → AWAY (ONLINE defers to connection)', () => {
			const result = processPresence(user({ statusDefault: UserStatus.BUSY, statusSource: 'manual' }), [session(UserStatus.AWAY)], {
				type: 'clearActive',
			});
			expect(result.values.status).toBe(UserStatus.AWAY);
			expect(result.values.statusDefault).toBe(UserStatus.ONLINE);
		});

		test('invisible user (OFFLINE statusDefault with sessions) → stays OFFLINE', () => {
			const result = processPresence(user({ statusDefault: UserStatus.OFFLINE }), [session(UserStatus.ONLINE)]);
			expect(result.values).toMatchObject({ status: UserStatus.OFFLINE, statusConnection: UserStatus.ONLINE });
		});
	});
});
