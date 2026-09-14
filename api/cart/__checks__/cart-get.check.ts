import { ApiCheck, Frequency, AssertionBuilder, QueryParam } from 'checkly/constructs'
import { DEFAULT_CURRENCY, SEEDED_SESSION_ID, jsonHeader } from '../../../checkly.fixtures'

const WRONG_IDENTITY_KEY = 'userId'

new ApiCheck('cart-get', {
  name: 'GET /api/cart - read cart',
  description: "Read the hydrated cart for a session",
  tags: ['api', 'cart', 'critical'],
  setupScript: {
    entrypoint: './seed-cart.setup.ts',
  },
  degradedResponseTime: 1500,
  maxResponseTime: 3000,
  request: {
    method: 'GET',
    url: '{{{BASE_URL_DEV}}}/api/cart',
    headers: [jsonHeader],
    queryParameters: [
      <QueryParam>{key: "sessionId", value: SEEDED_SESSION_ID},
      <QueryParam>{key: "currencyCode", value: DEFAULT_CURRENCY},
    ],
    followRedirects: true,
    assertions: [
      AssertionBuilder.statusCode().equals(200),
      AssertionBuilder.headers('content-type').contains('application/json'),
      AssertionBuilder.jsonBody('$.items').isNotNull(),
      AssertionBuilder.jsonBody('$.items[0].productId').isNotNull(),
    ]
  },
})

new ApiCheck('cart-get-wrong-param', {
  name: 'GET /api/cart - wrong identity param returns an empty cart',
  description: "Sending userId instead of sessionId silently yields 200 with an empty cart",
  tags: ['api', 'cart', 'negative'],
  frequency: Frequency.EVERY_10M,
  degradedResponseTime: 1500,
  maxResponseTime: 3000,
  request: {
    method: 'GET',
    url: '{{{BASE_URL_DEV}}}/api/cart',
    headers: [jsonHeader],
    queryParameters: [
      <QueryParam>{key: WRONG_IDENTITY_KEY, value: SEEDED_SESSION_ID},
      <QueryParam>{key: "currencyCode", value: DEFAULT_CURRENCY},
    ],
    followRedirects: true,
    assertions: [
      AssertionBuilder.statusCode().equals(200),
      AssertionBuilder.jsonBody('$.userId').equals(''),
      AssertionBuilder.textBody().contains('"items":[]'),
    ]
  },
})
