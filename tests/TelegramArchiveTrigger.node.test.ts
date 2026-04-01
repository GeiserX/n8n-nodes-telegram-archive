import { describe, it, expect, vi } from 'vitest';
import { TelegramArchiveTrigger } from '../nodes/TelegramArchive/TelegramArchiveTrigger.node';

const AUTH_DISABLED = { auth_required: false };
const AUTH_ENABLED = { auth_required: true };
const LOGIN_RESPONSE = {
	headers: {
		'set-cookie': ['viewer_auth=sess_abc123; Path=/; HttpOnly; SameSite=Lax'],
	},
};
const LOGIN_RESPONSE_NEW = {
	headers: {
		'set-cookie': ['viewer_auth=sess_newuser; Path=/; HttpOnly; SameSite=Lax'],
	},
};

function createMockContext(
	params: Record<string, any>,
	staticData: Record<string, any>,
	httpResponses: any[],
	credentials?: Record<string, string>,
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
				if (response instanceof Error) return Promise.reject(response);
				return Promise.resolve(response);
			}),
		},
		getCredentials: vi.fn().mockResolvedValue({
			url: 'http://localhost:8000',
			username: '',
			password: '',
			...credentials,
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

	// ── Auth-disabled tests ──

	it('first poll (global) seeds state and returns null', async () => {
		const staticData: Record<string, any> = {};
		const ctx = createMockContext(
			{ chatId: '' },
			staticData,
			[AUTH_DISABLED, { messages: 100, chats: 5 }],
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
			[AUTH_DISABLED, { messages: 15, chats: 3 }],
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
			[AUTH_DISABLED, { messages: 100, chats: 5 }],
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
				AUTH_DISABLED,
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
				AUTH_DISABLED,
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
				AUTH_DISABLED,
				{
					messages: 200,
					per_chat_message_counts: { '789': 42 },
				},
			],
		);

		const result = await trigger.poll.call(ctx as any);

		expect(result).toBeNull();
	});

	// ── Auth-enabled: session caching ──

	it('auth-enabled: logs in on first poll and caches cookie with key', async () => {
		const staticData: Record<string, any> = {};
		const ctx = createMockContext(
			{ chatId: '' },
			staticData,
			[
				AUTH_ENABLED, // auth check
				LOGIN_RESPONSE, // login
				{ messages: 50, chats: 2 }, // stats
			],
			{ username: 'admin', password: 'secret' },
		);

		const result = await trigger.poll.call(ctx as any);

		expect(result).toBeNull(); // first poll seeds
		expect(staticData.lastMessageCount).toBe(50);
		expect(staticData._authCookie).toBe('viewer_auth=sess_abc123');
		expect(staticData._authCookieAt).toBeTypeOf('number');
		expect(staticData._authKey).toBe('http://localhost:8000|admin|secret');
	});

	it('auth-enabled: reuses cached cookie without login', async () => {
		const staticData: Record<string, any> = {
			lastMessageCount: 50,
			_authCookie: 'viewer_auth=cached_token',
			_authCookieAt: Date.now(),
			_authKey: 'http://localhost:8000|admin|secret',
		};
		const ctx = createMockContext(
			{ chatId: '' },
			staticData,
			[{ messages: 55, chats: 2 }],
			{ username: 'admin', password: 'secret' },
		);

		const result = await trigger.poll.call(ctx as any);

		expect(result).not.toBeNull();
		expect(result![0][0].json.newMessages).toBe(5);
		expect(ctx.helpers.httpRequest).toHaveBeenCalledTimes(1);
		expect(staticData._authCookie).toBe('viewer_auth=cached_token');
	});

	it('auth-enabled: re-logins when cached cookie is expired', async () => {
		const staticData: Record<string, any> = {
			lastMessageCount: 50,
			_authCookie: 'viewer_auth=old_expired',
			_authCookieAt: Date.now() - 24 * 60 * 60 * 1000,
			_authKey: 'http://localhost:8000|admin|secret',
		};
		const ctx = createMockContext(
			{ chatId: '' },
			staticData,
			[
				AUTH_ENABLED,
				LOGIN_RESPONSE,
				{ messages: 55, chats: 2 },
			],
			{ username: 'admin', password: 'secret' },
		);

		const result = await trigger.poll.call(ctx as any);

		expect(result).not.toBeNull();
		expect(staticData._authCookie).toBe('viewer_auth=sess_abc123');
	});

	// ── Auth-enabled: credential change invalidation ──

	it('auth-enabled: invalidates cache when username changes', async () => {
		const staticData: Record<string, any> = {
			lastMessageCount: 50,
			_authCookie: 'viewer_auth=old_user_session',
			_authCookieAt: Date.now(), // fresh, but wrong user
			_authKey: 'http://localhost:8000|admin|secret', // cached for "admin"
		};
		const ctx = createMockContext(
			{ chatId: '' },
			staticData,
			[
				AUTH_ENABLED, // auth check (cache miss due to key mismatch)
				LOGIN_RESPONSE_NEW, // login as new user
				{ messages: 55, chats: 2 }, // stats
			],
			{ username: 'viewer2', password: 'pass2' }, // different user
		);

		const result = await trigger.poll.call(ctx as any);

		expect(result).not.toBeNull();
		expect(staticData._authCookie).toBe('viewer_auth=sess_newuser');
		expect(staticData._authKey).toBe('http://localhost:8000|viewer2|pass2');
	});

	it('auth-enabled: invalidates cache when URL changes', async () => {
		const staticData: Record<string, any> = {
			lastMessageCount: 50,
			_authCookie: 'viewer_auth=old_instance_session',
			_authCookieAt: Date.now(),
			_authKey: 'http://localhost:8000|admin|secret', // cached for old URL
		};
		const ctx = createMockContext(
			{ chatId: '' },
			staticData,
			[
				AUTH_ENABLED,
				LOGIN_RESPONSE,
				{ messages: 55, chats: 2 },
			],
			{
				url: 'http://new-server:8000' as any,
				username: 'admin',
				password: 'secret',
			},
		);

		const result = await trigger.poll.call(ctx as any);

		expect(result).not.toBeNull();
		expect(staticData._authKey).toBe('http://new-server:8000|admin|secret');
		expect(staticData._authCookie).toBe('viewer_auth=sess_abc123');
	});

	it('auth-enabled: invalidates cache when password changes', async () => {
		const staticData: Record<string, any> = {
			lastMessageCount: 50,
			_authCookie: 'viewer_auth=old_password_session',
			_authCookieAt: Date.now(),
			_authKey: 'http://localhost:8000|admin|oldpass',
		};
		const ctx = createMockContext(
			{ chatId: '' },
			staticData,
			[
				AUTH_ENABLED,
				LOGIN_RESPONSE,
				{ messages: 55, chats: 2 },
			],
			{ username: 'admin', password: 'newpass' },
		);

		const result = await trigger.poll.call(ctx as any);

		expect(result).not.toBeNull();
		expect(staticData._authCookie).toBe('viewer_auth=sess_abc123');
		expect(staticData._authKey).toBe('http://localhost:8000|admin|newpass');
	});

	// ── Auth-enabled: 401 retry ──

	it('auth-enabled: retries stats on 401 with fresh session', async () => {
		const staticData: Record<string, any> = {
			lastMessageCount: 50,
			_authCookie: 'viewer_auth=revoked_session',
			_authCookieAt: Date.now(),
			_authKey: 'http://localhost:8000|admin|secret',
		};

		const err401 = Object.assign(new Error('Unauthorized'), {
			httpCode: 401,
		});

		const ctx = createMockContext(
			{ chatId: '' },
			staticData,
			[
				err401, // first stats attempt → 401
				AUTH_ENABLED, // auth check for retry
				LOGIN_RESPONSE, // fresh login
				{ messages: 60, chats: 3 }, // retry stats succeeds
			],
			{ username: 'admin', password: 'secret' },
		);

		const result = await trigger.poll.call(ctx as any);

		expect(result).not.toBeNull();
		expect(result![0][0].json.newMessages).toBe(10);
		expect(staticData._authCookie).toBe('viewer_auth=sess_abc123');
		expect(staticData.lastMessageCount).toBe(60);
	});
});
