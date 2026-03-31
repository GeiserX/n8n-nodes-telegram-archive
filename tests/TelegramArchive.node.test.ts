import { describe, it, expect } from 'vitest';
import { TelegramArchive } from '../nodes/TelegramArchive/TelegramArchive.node';

describe('TelegramArchive Node', () => {
	const node = new TelegramArchive();
	const desc = node.description;

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

	it('Message List uses GET /api/chats/{chatId}/messages', () => {
		const messageOps = desc.properties.find(
			(p) =>
				p.name === 'operation' &&
				p.displayOptions?.show?.resource?.includes('message'),
		);
		expect(messageOps).toBeDefined();
		const listOp = (messageOps as any).options.find(
			(o: any) => o.value === 'list',
		);
		expect(listOp).toBeDefined();
		expect(listOp.routing.request.method).toBe('GET');
		expect(listOp.routing.request.url).toContain('/messages');
	});

	it('Message List has limit, offset, and search params', () => {
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

	it('Chat Export uses GET /api/chats/{chatId}/export', () => {
		const chatOps = desc.properties.find(
			(p) =>
				p.name === 'operation' &&
				p.displayOptions?.show?.resource?.includes('chat'),
		);
		expect(chatOps).toBeDefined();
		const exportOp = (chatOps as any).options.find(
			(o: any) => o.value === 'export',
		);
		expect(exportOp).toBeDefined();
		expect(exportOp.routing.request.method).toBe('GET');
		expect(exportOp.routing.request.url).toContain('/export');
	});

	it('Stats Get Global uses GET /api/stats', () => {
		const statsOps = desc.properties.find(
			(p) =>
				p.name === 'operation' &&
				p.displayOptions?.show?.resource?.includes('stats'),
		);
		const globalOp = (statsOps as any).options.find(
			(o: any) => o.value === 'getGlobal',
		);
		expect(globalOp.routing.request.method).toBe('GET');
		expect(globalOp.routing.request.url).toBe('/api/stats');
	});

	it('Chat List uses GET /api/chats', () => {
		const chatOps = desc.properties.find(
			(p) =>
				p.name === 'operation' &&
				p.displayOptions?.show?.resource?.includes('chat'),
		);
		const listOp = (chatOps as any).options.find(
			(o: any) => o.value === 'list',
		);
		expect(listOp.routing.request.method).toBe('GET');
		expect(listOp.routing.request.url).toBe('/api/chats');
	});
});
