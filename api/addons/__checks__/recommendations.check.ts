import { ApiCheck, Frequency, AssertionBuilder, QueryParam } from 'checkly/constructs'
import { supportingServices } from '../../../checkly.groups'
import { DEFAULT_CURRENCY, PRODUCT_ID, jsonHeader } from '../../../checkly.fixtures'

const SEED_PRODUCT_IDS = [PRODUCT_ID]

new ApiCheck('recommendations-list', {
  name: 'GET /api/recommendations - recommended products',
  description: "Fetch recommendations seeded from a known product",
  tags: ['api', 'addons'],
  group: supportingServices,
  degradedResponseTime: 10000,
  maxResponseTime: 20000,
  request: {
    method: 'GET',
    url: '{{{BASE_URL_DEV}}}/api/recommendations',
    headers: [jsonHeader],
    queryParameters: [
      ...SEED_PRODUCT_IDS.map(id => <QueryParam>{key: "productIds", value: id}),
      <QueryParam>{key: "sessionId", value: '{{CHECK_RUN_ID}}'},
      <QueryParam>{key: "currencyCode", value: DEFAULT_CURRENCY},
    ],
    followRedirects: true,
    assertions: [
      AssertionBuilder.statusCode().equals(200),
      AssertionBuilder.headers('content-type').contains('application/json'),
      AssertionBuilder.jsonBody('$[0].id').isNotNull(),
    ]
  },
})

new ApiCheck('recommendations-method-not-allowed', {
  name: 'POST /api/recommendations - 405 method not allowed',
  description: "Reject an unsupported method on the recommendations route",
  tags: ['api', 'addons', 'negative'],
  group: supportingServices,
  frequency: Frequency.EVERY_10M,
  shouldFail: true,
  degradedResponseTime: 1000,
  maxResponseTime: 2000,
  request: {
    method: 'POST',
    url: '{{{BASE_URL_DEV}}}/api/recommendations',
    headers: [jsonHeader],
    followRedirects: true,
    assertions: [
      AssertionBuilder.statusCode().equals(405),
    ]
  },
})
