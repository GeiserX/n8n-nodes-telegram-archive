import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from 'n8n-workflow';

async function getSessionCookie(
	helpers: IExecuteFunctions['helpers'],
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

export class TelegramArchive implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Telegram Archive',
		name: 'telegramArchive',
		icon: 'file:telegram-archive.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Query archived Telegram chats, messages, and statistics via Telegram-Archive',
		defaults: { name: 'Telegram Archive' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'telegramArchiveApi',
				required: true,
			},
		],
		properties: [
			// ── Resource ──
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Archive', value: 'archive' },
					{ name: 'Chat', value: 'chat' },
					{ name: 'Folder', value: 'folder' },
					{ name: 'Message', value: 'message' },
					{ name: 'Stats', value: 'stats' },
				],
				default: 'chat',
			},

			// ── Chat operations ──
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['chat'] } },
				options: [
					{
						name: 'Export',
						value: 'export',
						description: 'Export a chat',
						action: 'Export a chat',
					},
					{
						name: 'Get Stats',
						value: 'getStats',
						description: 'Get statistics for a chat',
						action: 'Get stats for a chat',
					},
					{
						name: 'Get Topics',
						value: 'getTopics',
						description: 'Get topics for a chat',
						action: 'Get topics for a chat',
					},
					{
						name: 'List',
						value: 'list',
						description: 'List all chats',
						action: 'List all chats',
					},
				],
				default: 'list',
			},

			// ── Message operations ──
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['message'] } },
				options: [
					{
						name: 'Get by Date',
						value: 'getByDate',
						description: 'Get messages by date',
						action: 'Get messages by date',
					},
					{
						name: 'Get Pinned',
						value: 'getPinned',
						description: 'Get pinned messages',
						action: 'Get pinned messages',
					},
					{
						name: 'List',
						value: 'list',
						description: 'List messages in a chat',
						action: 'List messages in a chat',
					},
				],
				default: 'list',
			},

			// ── Stats operations ──
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['stats'] } },
				options: [
					{
						name: 'Get Global',
						value: 'getGlobal',
						description: 'Get global statistics',
						action: 'Get global statistics',
					},
					{
						name: 'Refresh',
						value: 'refresh',
						description: 'Refresh statistics',
						action: 'Refresh statistics',
					},
				],
				default: 'getGlobal',
			},

			// ── Folder operations ──
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['folder'] } },
				options: [
					{
						name: 'List',
						value: 'list',
						description: 'List all folders',
						action: 'List all folders',
					},
				],
				default: 'list',
			},

			// ── Archive operations ──
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['archive'] } },
				options: [
					{
						name: 'Get Count',
						value: 'getCount',
						description: 'Get archived message count',
						action: 'Get archived message count',
					},
				],
				default: 'getCount',
			},

			// ── Shared: chatId ──
			{
				displayName: 'Chat ID',
				name: 'chatId',
				type: 'string',
				required: true,
				default: '',
				description: 'The ID of the chat',
				displayOptions: {
					show: {
						resource: ['chat'],
						operation: ['export', 'getStats', 'getTopics'],
					},
				},
			},
			{
				displayName: 'Chat ID',
				name: 'chatId',
				type: 'string',
				required: true,
				default: '',
				description: 'The ID of the chat',
				displayOptions: {
					show: {
						resource: ['message'],
					},
				},
			},

			// ── Message List params ──
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 50,
				description: 'Max number of results to return',
				typeOptions: { minValue: 1 },
				displayOptions: {
					show: { resource: ['message'], operation: ['list'] },
				},
			},
			{
				displayName: 'Offset',
				name: 'offset',
				type: 'number',
				default: 0,
				description: 'Number of results to skip',
				displayOptions: {
					show: { resource: ['message'], operation: ['list'] },
				},
			},
			{
				displayName: 'Search Query',
				name: 'search',
				type: 'string',
				default: '',
				description: 'Optional search query to filter messages',
				displayOptions: {
					show: { resource: ['message'], operation: ['list'] },
				},
			},

			// ── Message by-date param ──
			{
				displayName: 'Date',
				name: 'date',
				type: 'string',
				required: true,
				default: '',
				placeholder: '2024-01-15',
				description: 'Date to fetch messages for (YYYY-MM-DD)',
				displayOptions: {
					show: { resource: ['message'], operation: ['getByDate'] },
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const credentials = await this.getCredentials('telegramArchiveApi');
		const baseUrl = credentials.url as string;
		const cookie = await getSessionCookie(
			this.helpers,
			baseUrl,
			credentials.username as string,
			credentials.password as string,
		);

		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const resource = this.getNodeParameter('resource', i) as string;
			const operation = this.getNodeParameter('operation', i) as string;

			let method: 'GET' | 'POST' = 'GET';
			let path = '';
			const qs: Record<string, string | number> = {};

			if (resource === 'chat') {
				const chatId =
					operation !== 'list'
						? (this.getNodeParameter('chatId', i) as string)
						: '';
				const routes: Record<string, string> = {
					list: '/api/chats',
					export: `/api/chats/${chatId}/export`,
					getStats: `/api/chats/${chatId}/stats`,
					getTopics: `/api/chats/${chatId}/topics`,
				};
				path = routes[operation];
			} else if (resource === 'message') {
				const chatId = this.getNodeParameter('chatId', i) as string;
				if (operation === 'list') {
					path = `/api/chats/${chatId}/messages`;
					qs.limit = this.getNodeParameter('limit', i) as number;
					qs.offset = this.getNodeParameter('offset', i) as number;
					const search = this.getNodeParameter('search', i) as string;
					if (search) qs.search = search;
				} else if (operation === 'getByDate') {
					path = `/api/chats/${chatId}/messages/by-date`;
					qs.date = this.getNodeParameter('date', i) as string;
				} else {
					path = `/api/chats/${chatId}/pinned`;
				}
			} else if (resource === 'stats') {
				path = operation === 'refresh' ? '/api/stats/refresh' : '/api/stats';
				method = operation === 'refresh' ? 'POST' : 'GET';
			} else if (resource === 'folder') {
				path = '/api/folders';
			} else {
				path = '/api/archived/count';
			}

			const headers: Record<string, string> = { Accept: 'application/json' };
			if (cookie) headers.Cookie = cookie;

			const response = await this.helpers.httpRequest({
				method,
				url: `${baseUrl}${path}`,
				qs,
				headers,
				json: true,
			});

			if (Array.isArray(response)) {
				returnData.push(
					...response.map((item) => ({ json: item as IDataObject })),
				);
			} else {
				returnData.push({ json: response as IDataObject });
			}
		}

		return [returnData];
	}
}
