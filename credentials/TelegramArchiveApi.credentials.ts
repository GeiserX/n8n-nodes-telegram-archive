import type {
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class TelegramArchiveApi implements ICredentialType {
	name = 'telegramArchiveApi';
	displayName = 'Telegram Archive API';
	documentationUrl = 'https://github.com/GeiserX/Telegram-Archive';

	properties: INodeProperties[] = [
		{
			displayName: 'URL',
			name: 'url',
			type: 'string',
			default: 'http://localhost:8000',
			placeholder: 'http://localhost:8000',
			description: 'Base URL of the Telegram-Archive instance',
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			description:
				'Login username (leave empty if authentication is disabled on the instance)',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'Login password (leave empty if authentication is disabled on the instance)',
		},
	];

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.url}}',
			url: '/api/auth/check',
			method: 'GET',
		},
	};
}
