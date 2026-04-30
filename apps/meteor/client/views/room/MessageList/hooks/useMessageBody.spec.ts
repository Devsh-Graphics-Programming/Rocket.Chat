import { renderHook } from '@testing-library/react';

import { useMessageBody } from './useMessageBody';

const mockParseMessageTextToAstMarkdown = jest.fn();

jest.mock('./useAutoLinkDomains', () => ({
	useAutoLinkDomains: () => [],
}));

jest.mock('../../../../components/message/list/MessageListContext', () => ({
	useMessageListAutoTranslate: () => ({
		showAutoTranslate: () => false,
		autoTranslateLanguage: '',
	}),
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
	});

	it('should return raw msg and skips parsing when msg exceeds maxMarkdownParseLength', () => {
		const longMsg = 'a'.repeat(101);
		const message = { ...baseMessage, msg: longMsg, md: [{ type: 'PARAGRAPH', value: [] }] };

		const { result } = renderHook(() => useMessageBody(message as any, 100));

		expect(result.current).toBe(longMsg);
		expect(mockParseMessageTextToAstMarkdown).not.toHaveBeenCalled();
	});

	it('should call parser when message has md and is within maxMarkdownParseLength', () => {
		const md = [{ type: 'PARAGRAPH', value: [] }];
		const message = { ...baseMessage, msg: 'Hello world', md };
		mockParseMessageTextToAstMarkdown.mockReturnValue({ ...message, md });

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
});
