import type { Readable } from 'stream';
import { fetchWithL402 } from 'alby-tools';
import { webln } from 'alby-js-sdk';
import 'websocket-polyfill';

import * as crypto from 'crypto';
 // @ts-ignore
global.crypto = crypto as any;

import type {
	IBinaryKeyData,
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject
} from 'n8n-workflow';

import {
	jsonParse,
	NodeApiError,
	NodeOperationError,
	sleep,
	//removeCircularRefs,
} from 'n8n-workflow';

import type { RequestPromiseOptions } from 'request-promise-native';

import type { BodyParameter, IAuthDataSanitizeKeys } from './GenericFunctions';

import {
	binaryContentTypes,
	prepareRequestBody,
	replaceNullValues,
	sanitizeUiMessage,
} from './GenericFunctions';

function keysToLowercase<T>(headers: T) {
	if (typeof headers !== 'object' || Array.isArray(headers) || headers === null) return headers;
	return Object.entries(headers).reduce((acc, [key, value]) => {
		acc[key.toLowerCase()] = value;
		return acc;
	}, {} as IDataObject);
};

function toText<T>(data: T) {
	if (typeof data === 'object' && data !== null) {
		return JSON.stringify(data);
	}
	return data;
}

export class L402Request implements INodeType {
	description: INodeTypeDescription = {
    displayName: 'L402 Request',
    name: 'l402Request',
    icon: 'fa:bolt',
    group: ['output'],
    subtitle: '={{$parameter["requestMethod"] + ": " + $parameter["url"]}}',
    description: 'Makes an L402 request and returns the response data',
    version: 1,
    defaults: {
      name: 'L402 Request',
      color: '#FEDF6F',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'l402Api',
        required: true,
        //testedBy: 'testNWC',
      },
    ],
    properties: [
      {
        displayName: 'Method',
        name: 'method',
        type: 'options',
        options: [
          {
            name: 'DELETE',
            value: 'DELETE',
          },
          {
            name: 'GET',
            value: 'GET',
          },
          {
            name: 'HEAD',
            value: 'HEAD',
          },
          {
            name: 'OPTIONS',
            value: 'OPTIONS',
          },
          {
            name: 'PATCH',
            value: 'PATCH',
          },
          {
            name: 'POST',
            value: 'POST',
          },
          {
            name: 'PUT',
            value: 'PUT',
          },
        ],
        default: 'GET',
        description: 'The request method to use',
      },
      {
        displayName: 'URL',
        name: 'url',
        type: 'string',
        default: '',
        placeholder: 'https://lsat-weather-api.getalby.repl.co/kigali',
        description: 'The URL to make the request to',
        required: true,
      },
      {
        displayName: 'Send Query Parameters',
        name: 'sendQuery',
        type: 'boolean',
        default: false,
        noDataExpression: true,
        description: 'Whether the request has query params or not',
      },
      {
        displayName: 'Specify Query Parameters',
        name: 'specifyQuery',
        type: 'options',
        displayOptions: {
          show: {
            sendQuery: [true],
          },
        },
        options: [
          {
            name: 'Using Fields Below',
            value: 'keypair',
          },
          {
            name: 'Using JSON',
            value: 'json',
          },
        ],
        default: 'keypair',
      },
      {
        displayName: 'Query Parameters',
        name: 'queryParameters',
        type: 'fixedCollection',
        displayOptions: {
          show: {
            sendQuery: [true],
            specifyQuery: ['keypair'],
          },
        },
        typeOptions: {
          multipleValues: true,
        },
        placeholder: 'Add Parameter',
        default: {
          parameters: [
            {
              name: '',
              value: '',
            },
          ],
        },
        options: [
          {
            name: 'parameters',
            displayName: 'Parameter',
            values: [
              {
                displayName: 'Name',
                name: 'name',
                type: 'string',
                default: '',
              },
              {
                displayName: 'Value',
                name: 'value',
                type: 'string',
                default: '',
              },
            ],
          },
        ],
      },
      {
        displayName: 'JSON',
        name: 'jsonQuery',
        type: 'json',
        displayOptions: {
          show: {
            sendQuery: [true],
            specifyQuery: ['json'],
          },
        },
        default: '',
      },
      {
        displayName: 'Send Headers',
        name: 'sendHeaders',
        type: 'boolean',
        default: false,
        noDataExpression: true,
        description: 'Whether the request has headers or not',
      },
      {
        displayName: 'Specify Headers',
        name: 'specifyHeaders',
        type: 'options',
        displayOptions: {
          show: {
            sendHeaders: [true],
          },
        },
        options: [
          {
            name: 'Using Fields Below',
            value: 'keypair',
          },
          {
            name: 'Using JSON',
            value: 'json',
          },
        ],
        default: 'keypair',
      },
      {
        displayName: 'Header Parameters',
        name: 'headerParameters',
        type: 'fixedCollection',
        displayOptions: {
          show: {
            sendHeaders: [true],
            specifyHeaders: ['keypair'],
          },
        },
        typeOptions: {
          multipleValues: true,
        },
        placeholder: 'Add Parameter',
        default: {
          parameters: [
            {
              name: '',
              value: '',
            },
          ],
        },
        options: [
          {
            name: 'parameters',
            displayName: 'Parameter',
            values: [
              {
                displayName: 'Name',
                name: 'name',
                type: 'string',
                default: '',
              },
              {
                displayName: 'Value',
                name: 'value',
                type: 'string',
                default: '',
              },
            ],
          },
        ],
      },
      {
        displayName: 'JSON',
        name: 'jsonHeaders',
        type: 'json',
        displayOptions: {
          show: {
            sendHeaders: [true],
            specifyHeaders: ['json'],
          },
        },
        default: '',
      },
      {
        displayName: 'Send Body',
        name: 'sendBody',
        type: 'boolean',
        default: false,
        noDataExpression: true,
        description: 'Whether the request has a body or not',
      },
      {
        displayName: 'Body Content Type',
        name: 'contentType',
        type: 'options',
        displayOptions: {
          show: {
            sendBody: [true],
          },
        },
        options: [
          {
            name: 'Form Urlencoded',
            value: 'form-urlencoded',
          },
          {
            name: 'Form-Data',
            value: 'multipart-form-data',
          },
          {
            name: 'JSON',
            value: 'json',
          },
          {
            // eslint-disable-next-line n8n-nodes-base/node-param-display-name-miscased
            name: 'n8n Binary Data',
            value: 'binaryData',
          },
          {
            name: 'Raw',
            value: 'raw',
          },
        ],
        default: 'json',
        description: 'Content-Type to use to send body parameters',
      },
      {
        displayName: 'Specify Body',
        name: 'specifyBody',
        type: 'options',
        displayOptions: {
          show: {
            sendBody: [true],
            contentType: ['json'],
          },
        },
        options: [
          {
            name: 'Using Fields Below',
            value: 'keypair',
          },
          {
            name: 'Using JSON',
            value: 'json',
          },
        ],
        default: 'keypair',
        // eslint-disable-next-line n8n-nodes-base/node-param-description-miscased-json
        description:
          'The body can be specified using explicit fields (<code>keypair</code>) or using a JavaScript object (<code>json</code>)',
      },
      {
        displayName: 'Body Parameters',
        name: 'bodyParameters',
        type: 'fixedCollection',
        displayOptions: {
          show: {
            sendBody: [true],
            contentType: ['json'],
            specifyBody: ['keypair'],
          },
        },
        typeOptions: {
          multipleValues: true,
        },
        placeholder: 'Add Parameter',
        default: {
          parameters: [
            {
              name: '',
              value: '',
            },
          ],
        },
        options: [
          {
            name: 'parameters',
            displayName: 'Parameter',
            values: [
              {
                displayName: 'Name',
                name: 'name',
                type: 'string',
                default: '',
                description:
                  'ID of the field to set. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
              },
              {
                displayName: 'Value',
                name: 'value',
                type: 'string',
                default: '',
                description: 'Value of the field to set',
              },
            ],
          },
        ],
      },
      {
        displayName: 'JSON',
        name: 'jsonBody',
        type: 'json',
        displayOptions: {
          show: {
            sendBody: [true],
            contentType: ['json'],
            specifyBody: ['json'],
          },
        },
        default: '',
      },
      {
        displayName: 'Body Parameters',
        name: 'bodyParameters',
        type: 'fixedCollection',
        displayOptions: {
          show: {
            sendBody: [true],
            contentType: ['multipart-form-data'],
          },
        },
        typeOptions: {
          multipleValues: true,
        },
        placeholder: 'Add Parameter',
        default: {
          parameters: [
            {
              name: '',
              value: '',
            },
          ],
        },
        options: [
          {
            name: 'parameters',
            displayName: 'Parameter',
            values: [
              {
                displayName: 'Parameter Type',
                name: 'parameterType',
                type: 'options',
                options: [
                  {
                    // eslint-disable-next-line n8n-nodes-base/node-param-display-name-miscased
                    name: 'n8n Binary Data',
                    value: 'formBinaryData',
                  },
                  {
                    name: 'Form Data',
                    value: 'formData',
                  },
                ],
                default: 'formData',
              },
              {
                displayName: 'Name',
                name: 'name',
                type: 'string',
                default: '',
                description:
                  'ID of the field to set. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
              },
              {
                displayName: 'Value',
                name: 'value',
                type: 'string',
                displayOptions: {
                  show: {
                    parameterType: ['formData'],
                  },
                },
                default: '',
                description: 'Value of the field to set',
              },
              {
                displayName: 'Input Data Field Name',
                name: 'inputDataFieldName',
                type: 'string',
                noDataExpression: true,
                displayOptions: {
                  show: {
                    parameterType: ['formBinaryData'],
                  },
                },
                default: '',
                description:
                  'The name of the incoming field containing the binary file data to be processed',
              },
            ],
          },
        ],
      },
      {
        displayName: 'Specify Body',
        name: 'specifyBody',
        type: 'options',
        displayOptions: {
          show: {
            sendBody: [true],
            contentType: ['form-urlencoded'],
          },
        },
        options: [
          {
            name: 'Using Fields Below',
            value: 'keypair',
          },
          {
            name: 'Using Single Field',
            value: 'string',
          },
        ],
        default: 'keypair',
      },
      {
        displayName: 'Body Parameters',
        name: 'bodyParameters',
        type: 'fixedCollection',
        displayOptions: {
          show: {
            sendBody: [true],
            contentType: ['form-urlencoded'],
            specifyBody: ['keypair'],
          },
        },
        typeOptions: {
          multipleValues: true,
        },
        placeholder: 'Add Parameter',
        default: {
          parameters: [
            {
              name: '',
              value: '',
            },
          ],
        },
        options: [
          {
            name: 'parameters',
            displayName: 'Parameter',
            values: [
              {
                displayName: 'Name',
                name: 'name',
                type: 'string',
                default: '',
                description:
                  'ID of the field to set. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
              },
              {
                displayName: 'Value',
                name: 'value',
                type: 'string',
                default: '',
                description: 'Value of the field to set',
              },
            ],
          },
        ],
      },
      {
        displayName: 'Body',
        name: 'body',
        type: 'string',
        displayOptions: {
          show: {
            sendBody: [true],
            specifyBody: ['string'],
          },
        },
        default: '',
        placeholder: 'field1=value1&field2=value2',
      },
      {
        displayName: 'Input Data Field Name',
        name: 'inputDataFieldName',
        type: 'string',
        noDataExpression: true,
        displayOptions: {
          show: {
            sendBody: [true],
            contentType: ['binaryData'],
          },
        },
        default: '',
        description:
          'The name of the incoming field containing the binary file data to be processed',
      },
      {
        displayName: 'Content Type',
        name: 'rawContentType',
        type: 'string',
        displayOptions: {
          show: {
            sendBody: [true],
            contentType: ['raw'],
          },
        },
        default: '',
        placeholder: 'text/html',
      },
      {
        displayName: 'Body',
        name: 'body',
        type: 'string',
        displayOptions: {
          show: {
            sendBody: [true],
            contentType: ['raw'],
          },
        },
        default: '',
        placeholder: '',
      },
      {
        displayName:
          "You can view the raw requests this node makes in your browser's developer console",
        name: 'infoMessage',
        type: 'notice',
        default: '',
      },
    ],
  };


	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const nodeVersion = this.getNode().typeVersion;

		const fullResponseProperties = ['body', 'headers', 'statusCode', 'statusMessage'];

    const credentials = (await this.getCredentials('l402Api')) as IDataObject;
    const nwc = new webln.NostrWebLNProvider({ nostrWalletConnectUrl: credentials.nwcURL as string });

		type RequestOptions = RequestPromiseOptions & { useStream?: boolean };
		let requestOptions: RequestOptions = {};

		let returnItems: INodeExecutionData[] = [];
		const requestPromises = [];

		let fullResponse = false;

		let autoDetectResponseFormat = false;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			const requestMethod = this.getNodeParameter('method', itemIndex) as string;

			const sendQuery = this.getNodeParameter('sendQuery', itemIndex, false) as boolean;
			const queryParameters = this.getNodeParameter(
				'queryParameters.parameters',
				itemIndex,
				[],
			) as [{ name: string; value: string }];
			const specifyQuery = this.getNodeParameter('specifyQuery', itemIndex, 'keypair') as string;
			const jsonQueryParameter = this.getNodeParameter('jsonQuery', itemIndex, '') as string;

			const sendBody = this.getNodeParameter('sendBody', itemIndex, false) as boolean;
			const bodyContentType = this.getNodeParameter('contentType', itemIndex, '') as string;
			const specifyBody = this.getNodeParameter('specifyBody', itemIndex, '') as string;
			const bodyParameters = this.getNodeParameter(
				'bodyParameters.parameters',
				itemIndex,
				[],
			) as BodyParameter[];
			const jsonBodyParameter = this.getNodeParameter('jsonBody', itemIndex, '') as string;
			const body = this.getNodeParameter('body', itemIndex, '') as string;

			const sendHeaders = this.getNodeParameter('sendHeaders', itemIndex, false) as boolean;

			const headerParameters = this.getNodeParameter(
				'headerParameters.parameters',
				itemIndex,
				[],
			) as [{ name: string; value: string }];

			const specifyHeaders = this.getNodeParameter(
				'specifyHeaders',
				itemIndex,
				'keypair',
			) as string;

			const jsonHeadersParameter = this.getNodeParameter('jsonHeaders', itemIndex, '') as string;

			const {
				redirect,
				batching,
				proxy,
				timeout,
				allowUnauthorizedCerts,
				queryParameterArrays,
				response,
			} = this.getNodeParameter('options', itemIndex, {}) as {
				batching: { batch: { batchSize: number; batchInterval: number } };
				proxy: string;
				timeout: number;
				allowUnauthorizedCerts: boolean;
				queryParameterArrays: 'indices' | 'brackets' | 'repeat';
				response: {
					response: { neverError: boolean; responseFormat: string; fullResponse: boolean };
				};
				redirect: { redirect: { maxRedirects: number; followRedirects: boolean } };
			};

			const url = this.getNodeParameter('url', itemIndex) as string;

			const responseFormat = response?.response?.responseFormat || 'autodetect';

			fullResponse = response?.response?.fullResponse || false;

			autoDetectResponseFormat = responseFormat === 'autodetect';

			// defaults batch size to 1 of it's set to 0
			const batchSize = batching?.batch?.batchSize > 0 ? batching?.batch?.batchSize : 1;
			const batchInterval = batching?.batch.batchInterval;

			if (itemIndex > 0 && batchSize >= 0 && batchInterval > 0) {
				if (itemIndex % batchSize === 0) {
					await sleep(batchInterval);
				}
			}

			requestOptions = {
				headers: {},
				method: requestMethod,
				gzip: true,
				rejectUnauthorized: !allowUnauthorizedCerts || false,
				followRedirect: false,
			};

			// When response format is set to auto-detect,
			// we need to access to response header content-type
			// and the only way is using "resolveWithFullResponse"
			if (autoDetectResponseFormat || fullResponse) {
				requestOptions.resolveWithFullResponse = true;
			}

			if (requestOptions.method !== 'GET' && nodeVersion >= 4.1) {
				requestOptions = { ...requestOptions, followAllRedirects: false };
			}

			const defaultRedirect = nodeVersion >= 4 && redirect === undefined;

			if (redirect?.redirect?.followRedirects || defaultRedirect) {
				requestOptions.followRedirect = true;
				requestOptions.followAllRedirects = true;
			}

			if (redirect?.redirect?.maxRedirects || defaultRedirect) {
				requestOptions.maxRedirects = redirect?.redirect?.maxRedirects;
			}

			if (response?.response?.neverError) {
				requestOptions.simple = false;
			}

			if (proxy) {
				requestOptions.proxy = proxy;
			}

			if (timeout) {
				requestOptions.timeout = timeout;
			} else {
				// set default timeout to 1 hour
				requestOptions.timeout = 3600000;
			}
			if (sendQuery && queryParameterArrays) {
				Object.assign(requestOptions, {
					qsStringifyOptions: { arrayFormat: queryParameterArrays },
				});
			}

			const parametersToKeyValue = (
				accumulator: { [key: string]: any },
				cur: { name: string; value: string; parameterType?: string; inputDataFieldName?: string },
			) => {
				if (cur.parameterType === 'formBinaryData') {
					if (!cur.inputDataFieldName) return accumulator;
					const binaryData = this.helpers.assertBinaryData(itemIndex, cur.inputDataFieldName);
					let uploadData: Buffer | Readable;
					const itemBinaryData = items[itemIndex].binary![cur.inputDataFieldName];
					if (itemBinaryData.id) {
						uploadData = this.helpers.getBinaryStream(itemBinaryData.id);
					} else {
						uploadData = Buffer.from(itemBinaryData.data, 'base64');
					}

					accumulator[cur.name] = {
						value: uploadData,
						options: {
							filename: binaryData.fileName,
							contentType: binaryData.mimeType,
						},
					};
					return accumulator;
				}
				accumulator[cur.name] = cur.value;
				return accumulator;
			};

			// Get parameters defined in the UI
			if (sendBody && bodyParameters) {
				if (specifyBody === 'keypair' || bodyContentType === 'multipart-form-data') {
					requestOptions.body = prepareRequestBody(
						bodyParameters,
						bodyContentType,
						nodeVersion,
						parametersToKeyValue,
					);
				} else if (specifyBody === 'json') {
					// body is specified using JSON
					if (typeof jsonBodyParameter !== 'object' && jsonBodyParameter !== null) {
						try {
							JSON.parse(jsonBodyParameter);
						} catch {
							throw new NodeOperationError(
								this.getNode(),
								'JSON parameter need to be an valid JSON',
								{
									itemIndex,
								},
							);
						}

						requestOptions.body = jsonParse(jsonBodyParameter);
					} else {
						requestOptions.body = jsonBodyParameter;
					}
				} else if (specifyBody === 'string') {
					//form urlencoded
					requestOptions.body = Object.fromEntries(new URLSearchParams(body));
				}
			}

			// Change the way data get send in case a different content-type than JSON got selected
			if (sendBody && ['PATCH', 'POST', 'PUT', 'GET'].includes(requestMethod)) {
				if (bodyContentType === 'multipart-form-data') {
					requestOptions.formData = requestOptions.body;
					delete requestOptions.body;
				} else if (bodyContentType === 'form-urlencoded') {
					requestOptions.form = requestOptions.body;
					delete requestOptions.body;
				} else if (bodyContentType === 'binaryData') {
					const inputDataFieldName = this.getNodeParameter(
						'inputDataFieldName',
						itemIndex,
					) as string;

					let uploadData: Buffer | Readable;
					let contentLength: number;

					const itemBinaryData = this.helpers.assertBinaryData(itemIndex, inputDataFieldName);

					if (itemBinaryData.id) {
						uploadData = this.helpers.getBinaryStream(itemBinaryData.id);
						const metadata = await this.helpers.getBinaryMetadata(itemBinaryData.id);
						contentLength = metadata.fileSize;
					} else {
						uploadData = Buffer.from(itemBinaryData.data, 'base64');
						contentLength = uploadData.length;
					}
					requestOptions.body = uploadData;
					requestOptions.headers = {
						...requestOptions.headers,
						'content-length': contentLength,
						'content-type': itemBinaryData.mimeType ?? 'application/octet-stream',
					};
				} else if (bodyContentType === 'raw') {
					requestOptions.body = body;
				}
			}

			// Get parameters defined in the UI
			if (sendQuery && queryParameters) {
				if (specifyQuery === 'keypair') {
					requestOptions.qs = queryParameters.reduce(parametersToKeyValue, {});
				} else if (specifyQuery === 'json') {
					// query is specified using JSON
					try {
						JSON.parse(jsonQueryParameter);
					} catch {
						throw new NodeOperationError(
							this.getNode(),
							'JSON parameter need to be an valid JSON',
							{
								itemIndex,
							},
						);
					}

					requestOptions.qs = jsonParse(jsonQueryParameter);
				}
			}

			// Get parameters defined in the UI
			if (sendHeaders && headerParameters) {
				let additionalHeaders: IDataObject = {};
				if (specifyHeaders === 'keypair') {
					additionalHeaders = headerParameters.reduce(parametersToKeyValue, {});
				} else if (specifyHeaders === 'json') {
					// body is specified using JSON
					try {
						JSON.parse(jsonHeadersParameter);
					} catch {
						throw new NodeOperationError(
							this.getNode(),
							'JSON parameter need to be an valid JSON',
							{
								itemIndex,
							},
						);
					}

					additionalHeaders = jsonParse(jsonHeadersParameter);
				}
				requestOptions.headers = {
					...requestOptions.headers,
					...keysToLowercase(additionalHeaders),
				};
			}

			if (autoDetectResponseFormat || responseFormat === 'file') {
				requestOptions.encoding = null;
				requestOptions.json = false;
				requestOptions.useStream = true;
			} else if (bodyContentType === 'raw') {
				requestOptions.json = false;
				requestOptions.useStream = true;
			} else {
				requestOptions.json = true;
			}

			// // Add Content Type if any are set
			if (bodyContentType === 'raw') {
				if (requestOptions.headers === undefined) {
					requestOptions.headers = {};
				}
				const rawContentType = this.getNodeParameter('rawContentType', itemIndex) as string;
				requestOptions.headers['content-type'] = rawContentType;
			}

			const authDataKeys: IAuthDataSanitizeKeys = {};

			if (requestOptions.headers!.accept === undefined) {
				if (responseFormat === 'json') {
					requestOptions.headers!.accept = 'application/json,text/*;q=0.99';
				} else if (responseFormat === 'text') {
					requestOptions.headers!.accept =
						'application/json,text/html,application/xhtml+xml,application/xml,text/*;q=0.9, */*;q=0.1';
				} else {
					requestOptions.headers!.accept =
						'application/json,text/html,application/xhtml+xml,application/xml,text/*;q=0.9, image/*;q=0.8, */*;q=0.7';
				}
			}
			try {
				this.sendMessageToUI(sanitizeUiMessage({...requestOptions, uri: url}, authDataKeys));
			} catch (e) {
        console.log("sendMessageToUI err")
      }
      // bearerAuth, queryAuth, headerAuth, digestAuth, none
      const request = fetchWithL402(url, requestOptions, { webln: nwc });
      request.catch(() => {});
      requestPromises.push(request);
		}
    const promisesResponses = await Promise.allSettled(requestPromises);

		let response: any;
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			response = promisesResponses.shift();
			if (response!.status !== 'fulfilled') {
				if (!this.continueOnFail()) {
					if (autoDetectResponseFormat && response.reason.error instanceof Buffer) {
						response.reason.error = Buffer.from(response.reason.error as Buffer).toString();
					}
					throw new NodeApiError(this.getNode(), response as JsonObject, { itemIndex });
				} else {
					// removeCircularRefs(response.reason as JsonObject);
					// Return the actual reason as error
					returnItems.push({
						json: {
							error: response.reason,
						},
						pairedItem: {
							item: itemIndex,
						},
					});
					continue;
				}
			}

			response = response.value;

			const url = this.getNodeParameter('url', itemIndex) as string;

			let responseFormat = this.getNodeParameter(
				'options.response.response.responseFormat',
				0,
				'autodetect',
			) as string;

			fullResponse = this.getNodeParameter(
				'options.response.response.fullResponse',
				0,
				false,
			) as boolean;

			if (autoDetectResponseFormat) {
				const responseContentType = response.headers.get('content-type') ?? '';
				if (responseContentType.includes('application/json')) {
					responseFormat = 'json';
					response = {
            ...response,
            body: await response.json()
          };
				} else if (binaryContentTypes.some((e) => responseContentType.includes(e))) {
					responseFormat = 'file';
				} else {
					responseFormat = 'text';
					const data = await this.helpers
						.binaryToBuffer(response.body as Buffer | Readable)
						.then((body) => body.toString());
					response.body = !data ? undefined : data;
				}
			}

			if (autoDetectResponseFormat && !fullResponse) {
				delete response.headers;
				delete response.statusCode;
				delete response.statusMessage;
				response = response.body;
				requestOptions.resolveWithFullResponse = false;
			}

			if (responseFormat === 'file') {
        // L402 File Format Not Tested
				const outputPropertyName = this.getNodeParameter(
					'options.response.response.outputPropertyName',
					0,
					'data',
				) as string;

				const newItem: INodeExecutionData = {
					json: {},
					binary: {},
					pairedItem: {
						item: itemIndex,
					},
				};

				if (items[itemIndex].binary !== undefined) {
					// Create a shallow copy of the binary data so that the old
					// data references which do not get changed still stay behind
					// but the incoming data does not get changed.
					Object.assign(newItem.binary as IBinaryKeyData, items[itemIndex].binary);
				}

				const fileName = url.split('/').pop();

				if (fullResponse) {
					const returnItem: IDataObject = {};
					for (const property of fullResponseProperties) {
						if (property === 'body') {
							continue;
						}
						returnItem[property] = response![property];
					}

					newItem.json = returnItem;

					newItem.binary![outputPropertyName] = await this.helpers.prepareBinaryData(
						response!.body as Buffer | Readable,
						fileName,
					);
				} else {
					newItem.json = items[itemIndex].json;

					newItem.binary![outputPropertyName] = await this.helpers.prepareBinaryData(
						response! as Buffer | Readable,
						fileName,
					);
				}

				returnItems.push(newItem);
			} else if (responseFormat === 'text') {
        // L402 Text Format Not Tested
				const outputPropertyName = this.getNodeParameter(
					'options.response.response.outputPropertyName',
					0,
					'data',
				) as string;
				if (fullResponse) {
					const returnItem: IDataObject = {};
					for (const property of fullResponseProperties) {
						if (property === 'body') {
							returnItem[outputPropertyName] = toText(response![property]);
							continue;
						}

						returnItem[property] = response![property];
					}
					returnItems.push({
						json: returnItem,
						pairedItem: {
							item: itemIndex,
						},
					});
				} else {
					returnItems.push({
						json: {
							[outputPropertyName]: toText(response),
						},
						pairedItem: {
							item: itemIndex,
						},
					});
				}
			} else {
				// responseFormat: 'json'
        // Tested for L402
				if (requestOptions.resolveWithFullResponse === true) {
					const returnItem: IDataObject = {};
					for (const property of fullResponseProperties) {
						returnItem[property] = response![property];
					}

					if (responseFormat === 'json' && typeof returnItem.body === 'string') {
						try {
							returnItem.body = JSON.parse(returnItem.body);
						} catch (error) {
							throw new NodeOperationError(
								this.getNode(),
								'Response body is not valid JSON. Change "Response Format" to "Text"',
								{ itemIndex },
							);
						}
					}

					returnItems.push({
						json: returnItem,
						pairedItem: {
							item: itemIndex,
						},
					});
				} else {
					if (responseFormat === 'json' && typeof response === 'string') {
						try {
							response = JSON.parse(response);
						} catch (error) {
							throw new NodeOperationError(
								this.getNode(),
								'Response body is not valid JSON. Change "Response Format" to "Text"',
								{ itemIndex },
							);
						}
					}

					if (Array.isArray(response)) {
						// eslint-disable-next-line @typescript-eslint/no-loop-func
						response.forEach((item) =>
							returnItems.push({
								json: item,
								pairedItem: {
									item: itemIndex,
								},
							}),
						);
					} else {
						returnItems.push({
							json: response,
							pairedItem: {
								item: itemIndex,
							},
						});
					}
				}
			}
		}

		returnItems = returnItems.map(replaceNullValues);

		return this.prepareOutputData(returnItems);
	}
}