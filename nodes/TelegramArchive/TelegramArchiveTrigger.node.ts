import type {
	IPollFunctions,
	INodeExecutionData,
	IDataObject,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

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

		const webhookData = this.getWorkflowStaticData('node');

		// Fetch global stats — the API returns "messages" (not "totalMessages")
		// and "per_chat_message_counts" with per-chat breakdowns
		const statsResponse = await this.helpers.httpRequest({
			method: 'GET',
			url: `${baseUrl}/api/stats`,
			headers: {
				Authorization: `Bearer ${credentials.authToken}`,
				Accept: 'application/json',
			},
			json: true,
		});

		const stats = statsResponse as IDataObject;

		if (chatId) {
			// Per-chat mode: track this specific chat's message count independently
			const stateKey = `chatCount_${chatId}`;
			const previousChatCount = (webhookData[stateKey] as number) ?? 0;

			// Extract per-chat count from the stats response
			const perChat = (stats.per_chat_message_counts as IDataObject) ?? {};
			const currentChatCount = (perChat[chatId] as number) ?? 0;

			if (currentChatCount <= previousChatCount) {
				webhookData[stateKey] = currentChatCount;
				return null;
			}

			const newCount = currentChatCount - previousChatCount;
			webhookData[stateKey] = currentChatCount;

			// Fetch the latest messages from this specific chat
			const messagesResponse = await this.helpers.httpRequest({
				method: 'GET',
				url: `${baseUrl}/api/chats/${chatId}/messages`,
				qs: {
					limit: newCount,
					offset: 0,
				},
				headers: {
					Authorization: `Bearer ${credentials.authToken}`,
					Accept: 'application/json',
				},
				json: true,
			});

			const messages = Array.isArray(messagesResponse)
				? messagesResponse
				: ((messagesResponse as IDataObject).messages as IDataObject[]) ?? [];

			return [messages.map((msg) => ({ json: msg as IDataObject }))];
		}

		// Global mode: track total message count across all chats
		const previousCount = (webhookData.lastMessageCount as number) ?? 0;
		const currentCount = (stats.messages as number) ?? 0;

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
