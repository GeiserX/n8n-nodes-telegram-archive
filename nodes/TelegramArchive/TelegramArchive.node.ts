import type { INodeType, INodeTypeDescription } from 'n8n-workflow';

export class TelegramArchive implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Telegram Archive',
		name: 'telegramArchive',
		icon: 'file:telegram-archive.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Query archived Telegram chats, messages, and statistics via Telegram-Archive',
		defaults: {
			name: 'Telegram Archive',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'telegramArchiveApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: '={{$credentials.url}}',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
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
						routing: {
							request: {
								method: 'GET',
								url: '=/api/chats/{{$parameter["chatId"]}}/export',
							},
						},
					},
					{
						name: 'Get Stats',
						value: 'getStats',
						description: 'Get statistics for a chat',
						action: 'Get stats for a chat',
						routing: {
							request: {
								method: 'GET',
								url: '=/api/chats/{{$parameter["chatId"]}}/stats',
							},
						},
					},
					{
						name: 'Get Topics',
						value: 'getTopics',
						description: 'Get topics for a chat',
						action: 'Get topics for a chat',
						routing: {
							request: {
								method: 'GET',
								url: '=/api/chats/{{$parameter["chatId"]}}/topics',
							},
						},
					},
					{
						name: 'List',
						value: 'list',
						description: 'List all chats',
						action: 'List all chats',
						routing: {
							request: {
								method: 'GET',
								url: '/api/chats',
							},
						},
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
						routing: {
							request: {
								method: 'GET',
								url: '=/api/chats/{{$parameter["chatId"]}}/messages/by-date',
							},
						},
					},
					{
						name: 'Get Pinned',
						value: 'getPinned',
						description: 'Get pinned messages',
						action: 'Get pinned messages',
						routing: {
							request: {
								method: 'GET',
								url: '=/api/chats/{{$parameter["chatId"]}}/pinned',
							},
						},
					},
					{
						name: 'List',
						value: 'list',
						description: 'List messages in a chat',
						action: 'List messages in a chat',
						routing: {
							request: {
								method: 'GET',
								url: '=/api/chats/{{$parameter["chatId"]}}/messages',
							},
						},
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
						routing: {
							request: {
								method: 'GET',
								url: '/api/stats',
							},
						},
					},
					{
						name: 'Refresh',
						value: 'refresh',
						description: 'Refresh statistics',
						action: 'Refresh statistics',
						routing: {
							request: {
								method: 'POST',
								url: '/api/stats/refresh',
							},
						},
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
						routing: {
							request: {
								method: 'GET',
								url: '/api/folders',
							},
						},
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
						routing: {
							request: {
								method: 'GET',
								url: '/api/archived/count',
							},
						},
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
				routing: {
					request: {
						qs: { limit: '={{$value}}' },
					},
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
				routing: {
					request: {
						qs: { offset: '={{$value}}' },
					},
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
				routing: {
					send: {
						type: 'query',
						property: 'search',
						value: '={{$value}}',
					},
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
				routing: {
					request: {
						qs: { date: '={{$value}}' },
					},
				},
			},
		],
	};
}
