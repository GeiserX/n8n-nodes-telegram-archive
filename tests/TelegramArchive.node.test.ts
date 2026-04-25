import { describe, it, expect, vi } from 'vitest';
import { TelegramArchive } from '../nodes/TelegramArchive/TelegramArchive.node';

const node = new TelegramArchive();
const desc = node.description;

// ---------------------------------------------------------------------------
// Mock helpers for the execute() method
// ---------------------------------------------------------------------------
function createExecuteContext(
	params: Record<string, Record<string, any>>,
	httpResponses: any[],
	credentials?: Record<string, string>,
) {
	let callIndex = 0;
	const inputItems = [{ json: {} }];

	return {
		getCredentials: vi.fn().mockResolvedValue({
			url: 'http://localhost:8000',
			username: '',
			password: '',
			...credentials,
		}),
		getInputData: () => inputItems,
		getNodeParameter: (name: string, itemIndex: number) => {
			const itemParams = params[itemIndex] ?? params[0];
			return itemParams[name];
		},
		helpers: {
			httpRequest: vi.fn().mockImplementation(() => {
				const response = httpResponses[callIndex] ?? httpResponses[httpResponses.length - 1];
				callIndex++;
				if (response instanceof Error) return Promise.reject(response);
				return Promise.resolve(response);
			}),
		},
	};
}

// ---------------------------------------------------------------------------
// Node metadata
// ---------------------------------------------------------------------------
describe('TelegramArchive Node', () => {
	it('has correct node name', () => {
		expect(desc.name).toBe('telegramArchive');
	});

	it('requires telegramArchiveApi credentials', () => {
		const credNames = desc.credentials!.map((c) => c.name);
		expect(credNames).toContain('telegramArchiveApi');
	});

	it('has 5 resources', () => {
		const resourceProp = desc.properties.find((p) => p.name === 'resource');
		expect(resourceProp).toBeDefined();
		const options = (resourceProp as any).options as { value: string }[];
		const values = options.map((o) => o.value);
		expect(values).toEqual(
			expect.arrayContaining([
				'chat',
				'message',
				'stats',
				'folder',
				'archive',
			]),
		);
		expect(values).toHaveLength(5);
	});

	it('has chat operations: list, export, getStats, getTopics', () => {
		const chatOps = desc.properties.find(
			(p) =>
				p.name === 'operation' &&
				p.displayOptions?.show?.resource?.includes('chat'),
		);
		expect(chatOps).toBeDefined();
		const values = (chatOps as any).options.map((o: any) => o.value);
		expect(values).toEqual(
			expect.arrayContaining(['list', 'export', 'getStats', 'getTopics']),
		);
	});

	it('has message operations: list, getByDate, getPinned', () => {
		const messageOps = desc.properties.find(
			(p) =>
				p.name === 'operation' &&
				p.displayOptions?.show?.resource?.includes('message'),
		);
		expect(messageOps).toBeDefined();
		const values = (messageOps as any).options.map((o: any) => o.value);
		expect(values).toEqual(
			expect.arrayContaining(['list', 'getByDate', 'getPinned']),
		);
	});

	it('has message list params: limit, offset, search', () => {
		const limitProp = desc.properties.find(
			(p) =>
				p.name === 'limit' &&
				p.displayOptions?.show?.resource?.includes('message'),
		);
		const offsetProp = desc.properties.find(
			(p) =>
				p.name === 'offset' &&
				p.displayOptions?.show?.resource?.includes('message'),
		);
		const searchProp = desc.properties.find(
			(p) =>
				p.name === 'search' &&
				p.displayOptions?.show?.resource?.includes('message'),
		);
		expect(limitProp).toBeDefined();
		expect(offsetProp).toBeDefined();
		expect(searchProp).toBeDefined();
	});

	it('has an execute method (programmatic node)', () => {
		expect(typeof node.execute).toBe('function');
	});
});

// ---------------------------------------------------------------------------
// getSessionCookie (tested via execute)
// ---------------------------------------------------------------------------
describe('execute — auth: no auth required', () => {
	it('skips login when auth_required is false', async () => {
		const ctx = createExecuteContext(
			{ 0: { resource: 'chat', operation: 'list' } },
			[
				{ auth_required: false },
				[{ id: 1, name: 'Chat A' }],
			],
		);
		const result = await node.execute.call(ctx as any);
		expect(result[0]).toHaveLength(1);
		expect(result[0][0].json.name).toBe('Chat A');
	});
});

describe('execute — auth: login required', () => {
	it('logs in and uses session cookie when auth_required is true', async () => {
		const ctx = createExecuteContext(
			{ 0: { resource: 'chat', operation: 'list' } },
			[
				{ auth_required: true },
				{
					headers: {
						'set-cookie': ['viewer_auth=sess123; Path=/; HttpOnly'],
					},
				},
				[{ id: 1, name: 'Chat A' }],
			],
			{ username: 'admin', password: 'secret' },
		);
		const result = await node.execute.call(ctx as any);
		expect(result[0]).toHaveLength(1);
		// Verify Cookie header was set
		const lastCall = ctx.helpers.httpRequest.mock.calls[2];
		expect(lastCall[0].headers.Cookie).toBe('viewer_auth=sess123');
	});

	it('skips login when auth_required but no username/password', async () => {
		const ctx = createExecuteContext(
			{ 0: { resource: 'chat', operation: 'list' } },
			[
				{ auth_required: true },
				[{ id: 1, name: 'Chat A' }],
			],
		);
		const result = await node.execute.call(ctx as any);
		expect(result[0]).toHaveLength(1);
	});

	it('throws when login response has no session cookie', async () => {
		const ctx = createExecuteContext(
			{ 0: { resource: 'chat', operation: 'list' } },
			[
				{ auth_required: true },
				{ headers: { 'set-cookie': ['other=abc'] } },
			],
			{ username: 'admin', password: 'secret' },
		);
		await expect(node.execute.call(ctx as any)).rejects.toThrow(
			'Login failed',
		);
	});

	it('handles set-cookie as string instead of array', async () => {
		const ctx = createExecuteContext(
			{ 0: { resource: 'chat', operation: 'list' } },
			[
				{ auth_required: true },
				{
					headers: {
						'set-cookie': 'viewer_auth=sessStr; Path=/',
					},
				},
				[{ id: 1, name: 'Chat A' }],
			],
			{ username: 'admin', password: 'secret' },
		);
		const result = await node.execute.call(ctx as any);
		expect(result[0]).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// execute — chat resource
// ---------------------------------------------------------------------------
describe('execute — chat resource', () => {
	it('list chats', async () => {
		const ctx = createExecuteContext(
			{ 0: { resource: 'chat', operation: 'list' } },
			[{ auth_required: false }, [{ id: 1 }, { id: 2 }]],
		);
		const result = await node.execute.call(ctx as any);
		expect(result[0]).toHaveLength(2);
	});

	it('export a chat', async () => {
		const ctx = createExecuteContext(
			{ 0: { resource: 'chat', operation: 'export', chatId: '123' } },
			[{ auth_required: false }, { exported: true }],
		);
		const result = await node.execute.call(ctx as any);
		expect(result[0][0].json.exported).toBe(true);
	});

	it('getStats for a chat', async () => {
		const ctx = createExecuteContext(
			{ 0: { resource: 'chat', operation: 'getStats', chatId: '123' } },
			[{ auth_required: false }, { messages: 100 }],
		);
		const result = await node.execute.call(ctx as any);
		expect(result[0][0].json.messages).toBe(100);
	});

	it('getTopics for a chat', async () => {
		const ctx = createExecuteContext(
			{ 0: { resource: 'chat', operation: 'getTopics', chatId: '123' } },
			[{ auth_required: false }, [{ topic: 'General' }]],
		);
		const result = await node.execute.call(ctx as any);
		expect(result[0]).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// execute — message resource
// ---------------------------------------------------------------------------
describe('execute — message resource', () => {
	it('list messages with search', async () => {
		const ctx = createExecuteContext(
			{
				0: {
					resource: 'message',
					operation: 'list',
					chatId: '123',
					limit: 10,
					offset: 0,
					search: 'hello',
				},
			},
			[{ auth_required: false }, [{ id: 1, text: 'hello world' }]],
		);
		const result = await node.execute.call(ctx as any);
		expect(result[0]).toHaveLength(1);
	});

	it('list messages without search', async () => {
		const ctx = createExecuteContext(
			{
				0: {
					resource: 'message',
					operation: 'list',
					chatId: '123',
					limit: 50,
					offset: 0,
					search: '',
				},
			},
			[{ auth_required: false }, [{ id: 1 }]],
		);
		const result = await node.execute.call(ctx as any);
		expect(result[0]).toHaveLength(1);
	});

	it('getByDate', async () => {
		const ctx = createExecuteContext(
			{
				0: {
					resource: 'message',
					operation: 'getByDate',
					chatId: '123',
					date: '2024-01-15',
				},
			},
			[{ auth_required: false }, [{ id: 1, date: '2024-01-15' }]],
		);
		const result = await node.execute.call(ctx as any);
		expect(result[0]).toHaveLength(1);
	});

	it('getPinned', async () => {
		const ctx = createExecuteContext(
			{
				0: {
					resource: 'message',
					operation: 'getPinned',
					chatId: '123',
				},
			},
			[{ auth_required: false }, [{ id: 1, pinned: true }]],
		);
		const result = await node.execute.call(ctx as any);
		expect(result[0]).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// execute — stats resource
// ---------------------------------------------------------------------------
describe('execute — stats resource', () => {
	it('getGlobal stats', async () => {
		const ctx = createExecuteContext(
			{ 0: { resource: 'stats', operation: 'getGlobal' } },
			[{ auth_required: false }, { messages: 1000, chats: 50 }],
		);
		const result = await node.execute.call(ctx as any);
		expect(result[0][0].json.messages).toBe(1000);
	});

	it('refresh stats uses POST', async () => {
		const ctx = createExecuteContext(
			{ 0: { resource: 'stats', operation: 'refresh' } },
			[{ auth_required: false }, { refreshed: true }],
		);
		const result = await node.execute.call(ctx as any);
		expect(result[0][0].json.refreshed).toBe(true);
		// Check that it used POST
		const call = ctx.helpers.httpRequest.mock.calls[1];
		expect(call[0].method).toBe('POST');
	});
});

// ---------------------------------------------------------------------------
// execute — folder resource
// ---------------------------------------------------------------------------
describe('execute — folder resource', () => {
	it('list folders', async () => {
		const ctx = createExecuteContext(
			{ 0: { resource: 'folder', operation: 'list' } },
			[{ auth_required: false }, [{ id: 1, name: 'Folder A' }]],
		);
		const result = await node.execute.call(ctx as any);
		expect(result[0]).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// execute — archive resource
// ---------------------------------------------------------------------------
describe('execute — archive resource', () => {
	it('getCount returns archived message count', async () => {
		const ctx = createExecuteContext(
			{ 0: { resource: 'archive', operation: 'getCount' } },
			[{ auth_required: false }, { count: 5000 }],
		);
		const result = await node.execute.call(ctx as any);
		expect(result[0][0].json.count).toBe(5000);
	});
});

// ---------------------------------------------------------------------------
// execute — response handling
// ---------------------------------------------------------------------------
describe('execute — response handling', () => {
	it('wraps non-array responses as single item', async () => {
		const ctx = createExecuteContext(
			{ 0: { resource: 'stats', operation: 'getGlobal' } },
			[{ auth_required: false }, { messages: 100 }],
		);
		const result = await node.execute.call(ctx as any);
		expect(result[0]).toHaveLength(1);
		expect(result[0][0].json.messages).toBe(100);
	});

	it('spreads array responses into separate items', async () => {
		const ctx = createExecuteContext(
			{ 0: { resource: 'chat', operation: 'list' } },
			[{ auth_required: false }, [{ id: 1 }, { id: 2 }, { id: 3 }]],
		);
		const result = await node.execute.call(ctx as any);
		expect(result[0]).toHaveLength(3);
	});
});
