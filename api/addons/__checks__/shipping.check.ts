import { ApiCheck, AssertionBuilder, QueryParam } from 'checkly/constructs'
import { ADDRESS, DEFAULT_CURRENCY, PRODUCT_ID, QUANTITY, jsonHeader } from '../../../checkly.fixtures'

const ITEM_LIST = [
  { productId: PRODUCT_ID, quantity: QUANTITY },
]

new ApiCheck('shipping-quote', {
  name: 'GET /api/shipping - shipping quote',
  description: "Quote shipping for an item list and address",
  tags: ['api', 'addons', 'critical'],
  degradedResponseTime: 2500,
  maxResponseTime: 5000,
  request: {
    method: 'GET',
    url: '{{{BASE_URL_DEV}}}/api/shipping',
    headers: [jsonHeader],
    queryParameters: [
      <QueryParam>{key: "itemList", value: JSON.stringify(ITEM_LIST)},
      <QueryParam>{key: "address", value: JSON.stringify(ADDRESS)},
      <QueryParam>{key: "currencyCode", value: DEFAULT_CURRENCY},
    ],
    followRedirects: true,
    assertions: [
      AssertionBuilder.statusCode().equals(200),
      AssertionBuilder.headers('content-type').contains('application/json'),
      AssertionBuilder.jsonBody('$.currencyCode').isNotNull(),
      AssertionBuilder.jsonBody('$.units').isNotNull(),
    ]
  },
})
