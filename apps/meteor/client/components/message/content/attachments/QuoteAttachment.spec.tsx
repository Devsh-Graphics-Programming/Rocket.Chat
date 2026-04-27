import { render, screen } from '@testing-library/react';

import { QuoteAttachment } from './QuoteAttachment';

jest.mock('../../hooks/useMaxMessageParseSize', () => ({
	useMaxMessageParseSize: () => 100,
}));

jest.mock('@rocket.chat/ui-contexts', () => ({
	useUserPreference: () => true,
}));

jest.mock('../../../../hooks/useTimeAgo', () => ({
	useTimeAgo: () => (date: Date) => date.toISOString(),
}));

jest.mock('../../MessageContentBody', () => ({
	__esModule: true,
	default: () => <div data-testid='message-content-body' />,
}));

const baseAttachment = {
	author_name: 'User',
	author_icon: '',
	ts: new Date(),
	text: 'short text',
	md: [{ type: 'PARAGRAPH', value: [{ type: 'PLAIN_TEXT', value: 'short text' }] }],
};

describe('QuoteAttachment', () => {
	it('renders MessageContentBody when text length is within maxMessageParseSize', () => {
		render(<QuoteAttachment attachment={baseAttachment as any} />);
		expect(screen.getByTestId('message-content-body')).toBeInTheDocument();
	});

	it('renders plain text when text exceeds maxMessageParseSize', () => {
		const longText = 'a'.repeat(101);
		const attachment = { ...baseAttachment, text: longText };

		render(<QuoteAttachment attachment={attachment as any} />);

		expect(screen.queryByTestId('message-content-body')).not.toBeInTheDocument();
	});
});
