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
