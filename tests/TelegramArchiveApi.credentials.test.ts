import { describe, it, expect } from 'vitest';
import { TelegramArchiveApi } from '../credentials/TelegramArchiveApi.credentials';

describe('TelegramArchiveApi Credentials', () => {
	const creds = new TelegramArchiveApi();

	it('has the correct name', () => {
		expect(creds.name).toBe('telegramArchiveApi');
	});

	it('has the correct displayName', () => {
		expect(creds.displayName).toBe('Telegram Archive API');
	});

	it('has documentationUrl', () => {
		expect(creds.documentationUrl).toContain('Telegram-Archive');
	});

	it('has url property with correct default', () => {
		const urlProp = creds.properties.find((p) => p.name === 'url');
		expect(urlProp).toBeDefined();
		expect(urlProp!.type).toBe('string');
		expect(urlProp!.default).toBe('http://localhost:8000');
	});

	it('has username property', () => {
		const userProp = creds.properties.find((p) => p.name === 'username');
		expect(userProp).toBeDefined();
		expect(userProp!.type).toBe('string');
		expect(userProp!.default).toBe('');
	});

	it('has password property with password type', () => {
		const passProp = creds.properties.find((p) => p.name === 'password');
		expect(passProp).toBeDefined();
		expect(passProp!.type).toBe('string');
		expect(passProp!.typeOptions).toEqual({ password: true });
	});

	it('has exactly 3 properties', () => {
		expect(creds.properties).toHaveLength(3);
	});
});
