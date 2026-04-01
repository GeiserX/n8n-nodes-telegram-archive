import type {
	IPollFunctions,
	INodeExecutionData,
	IDataObject,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

const SESSION_MAX_AGE_MS = 23 * 60 * 60 * 1000; // 23 h (server default: 30 days)

function credentialKey(baseUrl: string, username: string): string {
	return `${baseUrl}|${username}`;
}

async function getOrRefreshCookie(
	helpers: IPollFunctions['helpers'],
	staticData: IDataObject,
	baseUrl: string,
	username: string,
	password: string,
): Promise<string> {
	const key = credentialKey(baseUrl, username);

	// Reuse cached cookie if still fresh and credentials haven't changed
	const cached = staticData._authCookie as string | undefined;
	const cachedAt = staticData._authCookieAt as number | undefined;
	const cachedKey = staticData._authKey as string | undefined;
	if (
		cached &&
		cachedAt &&
		cachedKey === key &&
		Date.now() - cachedAt < SESSION_MAX_AGE_MS
	) {
		return cached;
	}

	// Check whether the instance actually requires authentication
	const authCheck = (await helpers.httpRequest({
		method: 'GET',
		url: `${baseUrl}/api/auth/check`,
		json: true,
	})) as IDataObject;

	if (!authCheck.auth_required) return '';
	if (!username || !password) return '';

	const response = (await helpers.httpRequest({
		method: 'POST',
		url: `${baseUrl}/api/login`,
		body: { username, password },
		json: true,
		returnFullResponse: true,
	})) as { headers: Record<string, string | string[]> };

	const setCookie = response.headers['set-cookie'];
	const raw = Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie ?? '');
	const match = raw.match(/viewer_auth=([^;]+)/);
	if (!match) throw new Error('Login failed — no session cookie received');

	const newCookie = `viewer_auth=${match[1]}`;
	staticData._authCookie = newCookie;
	staticData._authCookieAt = Date.now();
	staticData._authKey = key;
	return newCookie;
}

function clearCookieCache(staticData: IDataObject): void {
	delete staticData._authCookie;
	delete staticData._authCookieAt;
	delete staticData._authKey;
}

async function requestWithRetry(
	helpers: IPollFunctions['helpers'],
	staticData: IDataObject,
	headers: Record<string, string>,
	baseUrl: string,
	username: string,
	password: string,
	options: {
		method: 'GET' | 'POST';
		url: string;
		qs?: Record<string, string | number>;
	},
): Promise<unknown> {
	try {
		return await helpers.httpRequest({ ...options, headers, json: true });
	} catch (error: unknown) {
		const httpCode =
			(error as { httpCode?: number }).httpCode ??
			(error as { statusCode?: number }).statusCode;
		if (httpCode === 401 && headers.Cookie) {
			clearCookieCache(staticData);
			const freshCookie = await getOrRefreshCookie(
				helpers,
				staticData,
				baseUrl,
				username,
				password,
			);
			if (freshCookie) headers.Cookie = freshCookie;
			else delete headers.Cookie;
			return await helpers.httpRequest({ ...options, headers, json: true });
		}
		throw error;
	}
}

export class TelegramArchiveTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Telegram Archive Trigger',
		name: 'telegramArchiveTrigger',
		icon: 'file:telegram-archive.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '=New Messages',
		description: 'Triggers when new messages appear in a Telegram-Archive instance',
		defaults: {
			name: 'Telegram Archive Trigger',
		},
		polling: true,
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'telegramArchiveApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Chat ID',
				name: 'chatId',
				type: 'string',
				default: '',
				description:
					'Filter to a specific chat ID. Leave empty to detect new messages across all chats.',
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const credentials = await this.getCredentials('telegramArchiveApi');
		const baseUrl = credentials.url as string;
		const chatId = this.getNodeParameter('chatId', '') as string;
		const username = credentials.username as string;
		const password = credentials.password as string;

		const webhookData = this.getWorkflowStaticData('node');

		// Authenticate once per poll cycle (cached between polls, keyed by url+username)
		const cookie = await getOrRefreshCookie(
			this.helpers,
			webhookData,
			baseUrl,
			username,
			password,
		);
		const headers: Record<string, string> = { Accept: 'application/json' };
		if (cookie) headers.Cookie = cookie;

		const stats = (await requestWithRetry(
			this.helpers,
			webhookData,
			headers,
			baseUrl,
			username,
			password,
			{ method: 'GET', url: `${baseUrl}/api/stats` },
		)) as IDataObject;

		if (chatId) {
			const stateKey = `chatCount_${chatId}`;
			const perChat = (stats.per_chat_message_counts as IDataObject) ?? {};
			const currentChatCount = (perChat[chatId] as number) ?? 0;

			// First poll: seed state without emitting
			if (webhookData[stateKey] === undefined) {
				webhookData[stateKey] = currentChatCount;
				return null;
			}

			const previousChatCount = webhookData[stateKey] as number;

			if (currentChatCount <= previousChatCount) {
				webhookData[stateKey] = currentChatCount;
				return null;
			}

			const newCount = currentChatCount - previousChatCount;
			webhookData[stateKey] = currentChatCount;

			const messagesResponse = await requestWithRetry(
				this.helpers,
				webhookData,
				headers,
				baseUrl,
				username,
				password,
				{
					method: 'GET',
					url: `${baseUrl}/api/chats/${chatId}/messages`,
					qs: { limit: newCount, offset: 0 },
				},
			);

			const messages = Array.isArray(messagesResponse)
				? messagesResponse
				: ((messagesResponse as IDataObject).messages as IDataObject[]) ?? [];

			return [messages.map((msg) => ({ json: msg as IDataObject }))];
		}

		// Global mode
		const currentCount = (stats.messages as number) ?? 0;

		// First poll: seed state without emitting
		if (webhookData.lastMessageCount === undefined) {
			webhookData.lastMessageCount = currentCount;
			return null;
		}

		const previousCount = webhookData.lastMessageCount as number;

		if (currentCount <= previousCount) {
			webhookData.lastMessageCount = currentCount;
			return null;
		}

		webhookData.lastMessageCount = currentCount;

		return [
			[
				{
					json: {
						previousCount,
						currentCount,
						newMessages: currentCount - previousCount,
						...stats,
					},
				},
			],
		];
	}
}
