import type { IDataObject, INodeExecutionData } from 'n8n-workflow';
import type { OptionsWithUri } from 'request-promise-native';

import set from 'lodash/set';

export type BodyParameter = { name: string; value: string };

export type IAuthDataSanitizeKeys = {
	[key: string]: string[];
};

export const replaceNullValues = (item: INodeExecutionData) => {
	if (item.json === null) {
		item.json = {};
	}
	return item;
};

export function sanitizeUiMessage(request: OptionsWithUri, authDataKeys: IAuthDataSanitizeKeys) {
	let sendRequest = request as unknown as IDataObject;

	// Protect browser from sending large binary data
	if (Buffer.isBuffer(sendRequest.body) && sendRequest.body.length > 250000) {
		sendRequest = {
			...request,
			body: `Binary data got replaced with this text. Original was a Buffer with a size of ${request.body.length} byte.`,
		};
	}

	// Remove credential information
	for (const requestProperty of Object.keys(authDataKeys)) {
		sendRequest = {
			...sendRequest,
			[requestProperty]: Object.keys(sendRequest[requestProperty] as object).reduce(
        // eslint-disable-next-line @typescript-eslint/no-loop-func
				(acc: IDataObject, curr) => {
					acc[curr] = authDataKeys[requestProperty].includes(curr)
						? '** hidden **'
						: (sendRequest[requestProperty] as IDataObject)[curr];
					return acc;
				},
				{},
			),
		};
	}

	return sendRequest;
}

//https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types
export const binaryContentTypes = [
	'image/',
	'audio/',
	'video/',
	'application/octet-stream',
	'application/gzip',
	'application/zip',
	'application/vnd.rar',
	'application/epub+zip',
	'application/x-bzip',
	'application/x-bzip2',
	'application/x-cdf',
	'application/vnd.amazon.ebook',
	'application/msword',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/vnd.ms-fontobject',
	'application/vnd.oasis.opendocument.presentation',
	'application/pdf',
	'application/x-tar',
	'application/vnd.visio',
	'application/vnd.ms-excel',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'application/x-7z-compressed',
];

export type BodyParametersReducer = (
	acc: IDataObject,
	cur: { name: string; value: string },
) => IDataObject;

export const prepareRequestBody = (
	parameters: BodyParameter[],
	bodyType: string,
	version: number,
	defaultReducer: BodyParametersReducer,
) => {
	if (bodyType === 'json' && version >= 4) {
		return parameters.reduce((acc, entry) => {
			const value = entry.value;
			set(acc, entry.name, value);
			return acc;
		}, {} as IDataObject);
	} else {
		return parameters.reduce(defaultReducer, {});
	}
};