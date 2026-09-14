import { ApiCheck, AssertionBuilder, QueryParam } from 'checkly/constructs'
import { CART_WRITE_SESSION_ID, DEFAULT_CURRENCY, PRODUCT_ID, QUANTITY, jsonHeader } from '../../../checkly.fixtures'

const ADD_ITEM_BODY = {
  userId: CART_WRITE_SESSION_ID,
  item: {
    productId: PRODUCT_ID,
    quantity: QUANTITY,
  },
}

const MALFORMED_ADD_ITEM_BODY = {
  foo: 'bar',
}

new ApiCheck('cart-add-item', {
  name: 'POST /api/cart - add item',
  description: "Add an item to the cart for a session",
  tags: ['api', 'cart'],
  degradedResponseTime: 1500,
  maxResponseTime: 3000,
  request: {
    method: 'POST',
    url: '{{{BASE_URL_DEV}}}/api/cart',
    headers: [jsonHeader],
    queryParameters: [<QueryParam>{key: "currencyCode", value: DEFAULT_CURRENCY}],
    bodyType: 'JSON',
    body: JSON.stringify(ADD_ITEM_BODY),
    followRedirects: true,
    assertions: [
      AssertionBuilder.statusCode().equals(200),
      AssertionBuilder.headers('content-type').contains('application/json'),
      AssertionBuilder.jsonBody('$.items').isNotNull(),
      AssertionBuilder.textBody().contains(PRODUCT_ID),
    ]
  },
})

new ApiCheck('cart-add-item-malformed-body', {
  name: 'POST /api/cart - 500 on malformed body',
  description: "A body missing userId and item fails the cart write",
  tags: ['api', 'cart', 'negative'],
  shouldFail: true,
  degradedResponseTime: 1500,
  maxResponseTime: 3000,
  request: {
    method: 'POST',
    url: '{{{BASE_URL_DEV}}}/api/cart',
    headers: [jsonHeader],
    queryParameters: [<QueryParam>{key: "currencyCode", value: DEFAULT_CURRENCY}],
    bodyType: 'JSON',
    body: JSON.stringify(MALFORMED_ADD_ITEM_BODY),
    followRedirects: true,
    assertions: [
      AssertionBuilder.statusCode().equals(500),
      AssertionBuilder.textBody().contains('Internal Server Error'),
    ]
  },
})
