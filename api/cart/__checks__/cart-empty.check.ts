import { ApiCheck, AssertionBuilder } from 'checkly/constructs'
import { CART_WRITE_SESSION_ID, jsonHeader } from '../../../checkly.fixtures'

const EMPTY_CART_BODY = {
  userId: CART_WRITE_SESSION_ID,
}

new ApiCheck('cart-empty', {
  name: 'DELETE /api/cart - empty cart',
  description: "Empty the cart for a session",
  tags: ['api', 'cart'],
  degradedResponseTime: 1500,
  maxResponseTime: 3000,
  request: {
    method: 'DELETE',
    url: '{{{BASE_URL_DEV}}}/api/cart',
    headers: [jsonHeader],
    bodyType: 'JSON',
    body: JSON.stringify(EMPTY_CART_BODY),
    followRedirects: true,
    assertions: [
      AssertionBuilder.statusCode().equals(204),
    ]
  },
})
