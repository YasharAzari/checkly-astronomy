import { ApiCheck, Frequency, AssertionBuilder, QueryParam } from 'checkly/constructs'
import { DEFAULT_CURRENCY, PRODUCT_ID, jsonHeader } from '../../../checkly.fixtures'

new ApiCheck('products-list', {
  name: 'GET /api/products - catalogue',
  description: "List all the product catalog",
  tags: ['api', 'catalog', 'critical'],
  degradedResponseTime: 1000,
  maxResponseTime: 2000,
  request: {
    method: 'GET',
    url: '{{{BASE_URL_DEV}}}/api/products',
    headers: [jsonHeader],
    queryParameters: [<QueryParam>{key: "currencyCode", value: DEFAULT_CURRENCY}],
    followRedirects: true,
    assertions: [
      AssertionBuilder.statusCode().equals(200),
      AssertionBuilder.headers('content-type').contains('application/json'),
      AssertionBuilder.jsonBody('$[0].id').isNotNull(),
      AssertionBuilder.textBody().contains(PRODUCT_ID),
    ]
  },
})

new ApiCheck('products-list-method-not-allowed', {
  name: 'POST /api/products - 405 method not allowed',
  description: "Reject an unsupported method on the catalog route",
  tags: ['api', 'catalog', 'negative'],
  frequency: Frequency.EVERY_10M,
  shouldFail: true,
  degradedResponseTime: 1000,
  maxResponseTime: 2000,
  request: {
    method: 'POST',
    url: '{{{BASE_URL_DEV}}}/api/products',
    headers: [jsonHeader],
    followRedirects: true,
    assertions: [
      AssertionBuilder.statusCode().equals(405),
    ]
  },
})
