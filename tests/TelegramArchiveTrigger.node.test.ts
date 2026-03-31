import { describe, it, expect, vi } from 'vitest';
import { TelegramArchiveTrigger } from '../nodes/TelegramArchive/TelegramArchiveTrigger.node';

function createMockContext(
	params: Record<string, any>,
	staticData: Record<string, any>,
	httpResponses: any[],
) {
	let callIndex = 0;
	return {
		getNodeParameter: (name: string, fallback?: any) =>
			params[name] ?? fallback,
		getWorkflowStaticData: () => staticData,
		helpers: {
			httpRequest: vi.fn().mockImplementation(() => {
				const response = httpResponses[callIndex] ?? httpResponses[0];
				callIndex++;
				return Promise.resolve(response);
			}),
		},
		getCredentials: vi.fn().mockResolvedValue({
			url: 'http://localhost:8000',
			username: '',
			password: '',
		}),
	};
}

describe('TelegramArchiveTrigger Node', () => {
	const trigger = new TelegramArchiveTrigger();

	it('has correct node name', () => {
		expect(trigger.description.name).toBe('telegramArchiveTrigger');
	});

	it('is a polling trigger', () => {
		expect(trigger.description.polling).toBe(true);
	});

	it('first poll (global) seeds state and returns null', async () => {
		const staticData: Record<string, any> = {};
		const ctx = createMockContext(
			{ chatId: '' },
			staticData,
			[{ messages: 100, chats: 5 }],
		);

		const result = await trigger.poll.call(ctx as any);

		expect(result).toBeNull();
		expect(staticData.lastMessageCount).toBe(100);
	});

	it('detects new messages after seeding (global)', async () => {
		const staticData: Record<string, any> = { lastMessageCount: 10 };
		const ctx = createMockContext(
			{ chatId: '' },
			staticData,
			[{ messages: 15, chats: 3 }],
		);

		const result = await trigger.poll.call(ctx as any);

		expect(result).not.toBeNull();
		expect(result![0][0].json.newMessages).toBe(5);
		expect(staticData.lastMessageCount).toBe(15);
	});

	it('returns null when no new messages (global)', async () => {
		const staticData: Record<string, any> = { lastMessageCount: 100 };
		const ctx = createMockContext(
			{ chatId: '' },
			staticData,
			[{ messages: 100, chats: 5 }],
		);

		const result = await trigger.poll.call(ctx as any);

		expect(result).toBeNull();
	});

	it('first poll with chatId seeds state and returns null', async () => {
		const staticData: Record<string, any> = {};
		const ctx = createMockContext(
			{ chatId: '456' },
			staticData,
			[
				{
					messages: 200,
					per_chat_message_counts: { '456': 30 },
				},
			],
		);

		const result = await trigger.poll.call(ctx as any);

		expect(result).toBeNull();
		expect(staticData['chatCount_456']).toBe(30);
	});

	it('when chatId set: detects new per-chat messages', async () => {
		const staticData: Record<string, any> = { 'chatCount_123': 50 };
		const ctx = createMockContext(
			{ chatId: '123' },
			staticData,
			[
				{
					messages: 200,
					per_chat_message_counts: { '123': 55 },
				},
				[
					{ id: 1, text: 'hello' },
					{ id: 2, text: 'world' },
					{ id: 3, text: 'foo' },
					{ id: 4, text: 'bar' },
					{ id: 5, text: 'baz' },
				],
			],
		);

		const result = await trigger.poll.call(ctx as any);

		expect(result).not.toBeNull();
		expect(staticData['chatCount_123']).toBe(55);
	});

	it('returns null when per-chat count unchanged', async () => {
		const staticData: Record<string, any> = { 'chatCount_789': 42 };
		const ctx = createMockContext(
			{ chatId: '789' },
			staticData,
			[
				{
					messages: 200,
					per_chat_message_counts: { '789': 42 },
				},
			],
		);

		const result = await trigger.poll.call(ctx as any);

		expect(result).toBeNull();
	});
});
