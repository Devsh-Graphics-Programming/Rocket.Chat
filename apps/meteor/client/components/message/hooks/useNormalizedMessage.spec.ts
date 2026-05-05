import { renderHook } from '@testing-library/react';

import { useNormalizedMessage } from './useNormalizedMessage';

const mockParseMessageTextToAstMarkdown = jest.fn((msg: any, ..._args: any[]) => msg);

let mockAutoTranslateOptions = {
	showAutoTranslate: () => false,
	autoTranslateLanguage: '',
};

jest.mock('../list/MessageListContext', () => ({
	useMessageListKatex: () => null,
	useMessageListAutoTranslate: () => mockAutoTranslateOptions,
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
		mockAutoTranslateOptions = {
			showAutoTranslate: () => false,
			autoTranslateLanguage: '',
		};
	});

	it('should skip parsing and returns PARAGRAPH node when msg exceeds maxMarkdownParseLength', () => {
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

	it('should call parseMessageTextToAstMarkdown when msg is within maxMarkdownParseLength', () => {
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

	it('should return PARAGRAPH node with translated text when auto-translate is active and msg exceeds limit', () => {
		const longMsg = 'a'.repeat(101);
		const translatedText = 'long translated text';

		mockAutoTranslateOptions = {
			showAutoTranslate: () => true,
			autoTranslateLanguage: 'en',
		};

		const message = {
			...baseMessage,
			msg: longMsg,
			translations: { en: translatedText },
		};

		const { result } = renderHook(() => useNormalizedMessage(message as any, 100));

		expect(result.current.md).toEqual([
			{
				type: 'PARAGRAPH',
				value: [{ type: 'PLAIN_TEXT', value: translatedText }],
			},
		]);
		expect(mockParseMessageTextToAstMarkdown).not.toHaveBeenCalled();
	});
});
