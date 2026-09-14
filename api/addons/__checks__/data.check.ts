import { ApiCheck, Frequency, AssertionBuilder, QueryParam } from 'checkly/constructs'
import { supportingServices } from '../../../checkly.groups'
import { jsonHeader } from '../../../checkly.fixtures'

const CONTEXT_KEYS = ['telescopes']

new ApiCheck('ads-list', {
  name: 'GET /api/data - contextual ads',
  description: "Fetch contextual ads for a set of context keys",
  tags: ['api', 'addons'],
  group: supportingServices,
  degradedResponseTime: 1000,
  maxResponseTime: 2000,
  request: {
    method: 'GET',
    url: '{{{BASE_URL_DEV}}}/api/data',
    headers: [jsonHeader],
    queryParameters: [
      ...CONTEXT_KEYS.map(key => <QueryParam>{key: "contextKeys", value: key}),
    ],
    followRedirects: true,
    assertions: [
      AssertionBuilder.statusCode().equals(200),
      AssertionBuilder.headers('content-type').contains('application/json'),
      AssertionBuilder.jsonBody('$[0].text').isNotNull(),
    ]
  },
})

new ApiCheck('ads-method-not-allowed', {
  name: 'POST /api/data - 405 method not allowed',
  description: "Reject an unsupported method on the ads route",
  tags: ['api', 'addons', 'negative'],
  group: supportingServices,
  frequency: Frequency.EVERY_10M,
  shouldFail: true,
  degradedResponseTime: 1000,
  maxResponseTime: 2000,
  request: {
    method: 'POST',
    url: '{{{BASE_URL_DEV}}}/api/data',
    headers: [jsonHeader],
    followRedirects: true,
    assertions: [
      AssertionBuilder.statusCode().equals(405),
    ]
  },
})
