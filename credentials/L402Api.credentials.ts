import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class L402Api implements ICredentialType {
	name = 'l402Api';
	displayName = 'L402 API';
	properties: INodeProperties[] = [
		{
			displayName: 'Nostr Wallet Connect URL',
			name: 'nwcURL',
			type: 'string',
			default: '',
		},
	];
}
