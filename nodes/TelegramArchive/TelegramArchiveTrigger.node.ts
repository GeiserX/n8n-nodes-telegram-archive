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
		const previousCount = (webhookData.lastMessageCount as number) ?? 0;

		// Fetch global stats to get current total message count
		const statsResponse = await this.helpers.httpRequest({
			method: 'GET',
			url: `${baseUrl}/api/stats`,
			headers: {
				Authorization: `Bearer ${credentials.authToken}`,
				Accept: 'application/json',
			},
			json: true,
		});

		const currentCount = (statsResponse as IDataObject).totalMessages as number;

		if (currentCount <= previousCount) {
			webhookData.lastMessageCount = currentCount;
			return null;
		}

		webhookData.lastMessageCount = currentCount;

		// If a specific chat is selected, fetch latest messages from that chat
		if (chatId) {
			const newCount = currentCount - previousCount;
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

		// No specific chat: return the stats delta as a single item
		return [
			[
				{
					json: {
						previousCount,
						currentCount,
						newMessages: currentCount - previousCount,
						...(statsResponse as IDataObject),
					},
				},
			],
		];
	}
}
