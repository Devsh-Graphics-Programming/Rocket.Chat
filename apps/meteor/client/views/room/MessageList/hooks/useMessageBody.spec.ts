import { renderHook } from '@testing-library/react';

import { useMessageBody } from './useMessageBody';

const mockParseMessageTextToAstMarkdown = jest.fn();

let mockAutoTranslateOptions = {
	showAutoTranslate: () => false,
	autoTranslateLanguage: '',
};

jest.mock('./useAutoLinkDomains', () => ({
	useAutoLinkDomains: () => [],
}));

jest.mock('../../../../components/message/list/MessageListContext', () => ({
	useMessageListAutoTranslate: () => mockAutoTranslateOptions,
}));

jest.mock('../../../../lib/parseMessageTextToAstMarkdown', () => ({
	parseMessageTextToAstMarkdown: (msg: any, ...args: any[]) => mockParseMessageTextToAstMarkdown(msg, ...args),
}));

const baseMessage = {
	_id: 'msg1',
	rid: 'room1',
	u: { _id: 'u1', username: 'user', name: 'User' },
	ts: new Date(),
	_updatedAt: new Date(),
};

describe('useMessageBody', () => {
	beforeEach(() => {
		mockParseMessageTextToAstMarkdown.mockClear();
		mockAutoTranslateOptions = {
			showAutoTranslate: () => false,
			autoTranslateLanguage: '',
		};
	});

	it('should not call parser when message exceeds maxMarkdownParseLength', () => {
		const longMsg = 'a'.repeat(101);
		const message = { ...baseMessage, msg: longMsg };
		mockParseMessageTextToAstMarkdown.mockReturnValue(message);

		const { result } = renderHook(() => useMessageBody(message as any, 100));

		expect(mockParseMessageTextToAstMarkdown).not.toHaveBeenCalledWith(message, expect.anything(), expect.anything());
		expect(result.current).toStrictEqual([
			{
				type: 'PARAGRAPH',
				value: [{ type: 'PLAIN_TEXT', value: longMsg }],
			},
		]);
	});

	it('should call parser when message has md and is within maxMarkdownParseLength', () => {
		const text = 'Hello world';
		const md = [{ type: 'PARAGRAPH', value: [{ type: 'PLAIN_TEXT', value: text }] }];
		const message = { ...baseMessage, msg: text, md };
		mockParseMessageTextToAstMarkdown.mockReturnValue(message);

		const { result } = renderHook(() => useMessageBody(message as any, 100));

		expect(mockParseMessageTextToAstMarkdown).toHaveBeenCalledWith(message, expect.anything(), expect.anything());
		expect(result.current).toBe(md);
	});

	it('should return raw msg without parsing when message has no md', () => {
		const message = { ...baseMessage, msg: 'Hello world' };

		const { result } = renderHook(() => useMessageBody(message as any, 100));

		expect(mockParseMessageTextToAstMarkdown).not.toHaveBeenCalled();
		expect(result.current).toBe('Hello world');
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

		const { result } = renderHook(() => useMessageBody(message as any, 100));

		expect(result.current).toEqual([
			{
				type: 'PARAGRAPH',
				value: [{ type: 'PLAIN_TEXT', value: translatedText }],
			},
		]);
		expect(mockParseMessageTextToAstMarkdown).not.toHaveBeenCalled();
	});
});
