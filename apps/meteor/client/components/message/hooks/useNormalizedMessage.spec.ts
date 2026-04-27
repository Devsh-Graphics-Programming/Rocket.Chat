import { renderHook } from '@testing-library/react';

import { useNormalizedMessage } from './useNormalizedMessage';

const mockParseMessageTextToAstMarkdown = jest.fn((msg: any, ..._args: any[]) => msg);

jest.mock('../list/MessageListContext', () => ({
	useMessageListKatex: () => null,
	useMessageListAutoTranslate: () => ({
		showAutoTranslate: () => false,
		autoTranslateLanguage: '',
	}),
	useMessageListShowColors: () => false,
}));

jest.mock('../../../lib/parseMessageTextToAstMarkdown', () => ({
	parseMessageTextToAstMarkdown: (msg: any, ...args: any[]) => mockParseMessageTextToAstMarkdown(msg, ...args),
}));

jest.mock('../../../views/room/MessageList/hooks/useAutoLinkDomains', () => ({ useAutoLinkDomains: () => [] }));

const baseMessage = {
	_id: 'msg1',
	rid: 'room1',
	u: { _id: 'u1', username: 'user', name: 'User' },
	ts: new Date(),
	_updatedAt: new Date(),
};

describe('useNormalizedMessage', () => {
	beforeEach(() => {
		mockParseMessageTextToAstMarkdown.mockClear();
	});

	it('should skip parsing and returns PARAGRAPH node when msg exceeds maxMessageParseSize', () => {
		const longMsg = 'a'.repeat(101);
		const message = { ...baseMessage, msg: longMsg };

		const { result } = renderHook(() => useNormalizedMessage(message as any, 100));

		expect(mockParseMessageTextToAstMarkdown).not.toHaveBeenCalled();
		expect(result.current.md).toEqual([
			{
				type: 'PARAGRAPH',
				value: [{ type: 'PLAIN_TEXT', value: longMsg }],
			},
		]);
	});

	it('should call parseMessageTextToAstMarkdown when msg is within maxMessageParseSize', () => {
		const message = { ...baseMessage, msg: 'Hello world' };

		renderHook(() => useNormalizedMessage(message as any, 100));

		expect(mockParseMessageTextToAstMarkdown).toHaveBeenCalledWith(message, expect.anything(), expect.anything());
	});

	it('should preserve attachments when bypassing parsing due to size', () => {
		const longMsg = 'a'.repeat(101);
		const attachments = [{ type: 'quote', text: 'quoted' }];
		const message = { ...baseMessage, msg: longMsg, attachments };

		const { result } = renderHook(() => useNormalizedMessage(message as any, 100));

		expect(mockParseMessageTextToAstMarkdown).not.toHaveBeenCalled();
		expect(result.current.attachments).toEqual(attachments);
	});
});
