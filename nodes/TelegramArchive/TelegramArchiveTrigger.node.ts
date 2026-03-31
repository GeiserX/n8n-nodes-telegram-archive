import type {
	IPollFunctions,
	INodeExecutionData,
	IDataObject,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

async function getSessionCookie(
	helpers: IPollFunctions['helpers'],
	baseUrl: string,
	username: string,
	password: string,
): Promise<string> {
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
	return `viewer_auth=${match[1]}`;
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

		const cookie = await getSessionCookie(
			this.helpers,
			baseUrl,
			credentials.username as string,
			credentials.password as string,
		);

		const webhookData = this.getWorkflowStaticData('node');

		const headers: Record<string, string> = { Accept: 'application/json' };
		if (cookie) headers.Cookie = cookie;

		const statsResponse = await this.helpers.httpRequest({
			method: 'GET',
			url: `${baseUrl}/api/stats`,
			headers,
			json: true,
		});

		const stats = statsResponse as IDataObject;

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

			const messagesResponse = await this.helpers.httpRequest({
				method: 'GET',
				url: `${baseUrl}/api/chats/${chatId}/messages`,
				qs: { limit: newCount, offset: 0 },
				headers,
				json: true,
			});

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
