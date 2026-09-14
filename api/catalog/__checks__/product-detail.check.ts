import { ApiCheck, Frequency, AssertionBuilder, QueryParam } from 'checkly/constructs'
import { productCatalogue } from '../../../checkly.groups'
import { DEFAULT_CURRENCY, PRODUCT_ID, PRODUCT_NAME, UNKNOWN_PRODUCT_ID, jsonHeader } from '../../../checkly.fixtures'

new ApiCheck('product-detail', {
  name: 'GET /api/products/{productId} - single product',
  description: "Fetch one product from the catalog",
  tags: ['api', 'catalog', 'critical'],
  group: productCatalogue,
  degradedResponseTime: 2000,
  maxResponseTime: 5000,
  request: {
    method: 'GET',
    url: `{{{BASE_URL_DEV}}}/api/products/${PRODUCT_ID}`,
    headers: [jsonHeader],
    queryParameters: [<QueryParam>{key: "currencyCode", value: DEFAULT_CURRENCY}],
    followRedirects: true,
    assertions: [
      AssertionBuilder.statusCode().equals(200),
      AssertionBuilder.headers('content-type').contains('application/json'),
      AssertionBuilder.jsonBody('$.id').equals(PRODUCT_ID),
      AssertionBuilder.jsonBody('$.name').equals(PRODUCT_NAME),
      AssertionBuilder.jsonBody('$.priceUsd.units').isNotNull(),
    ]
  },
})

new ApiCheck('product-detail-unknown-id', {
  name: 'GET /api/products/{productId} - 500 on unknown id',
  description: "Unknown product ids surface as 500, not 404",
  tags: ['api', 'catalog', 'negative'],
  group: productCatalogue,
  frequency: Frequency.EVERY_10M,
  shouldFail: true,
  degradedResponseTime: 2000,
  maxResponseTime: 5000,
  request: {
    method: 'GET',
    url: `{{{BASE_URL_DEV}}}/api/products/${UNKNOWN_PRODUCT_ID}`,
    headers: [jsonHeader],
    queryParameters: [<QueryParam>{key: "currencyCode", value: DEFAULT_CURRENCY}],
    followRedirects: true,
    assertions: [
      AssertionBuilder.statusCode().equals(500),
      AssertionBuilder.textBody().contains('Internal Server Error'),
    ]
  },
})
