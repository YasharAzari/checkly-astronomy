import { ApiCheck, AssertionBuilder, QueryParam } from 'checkly/constructs'
import {
  ADDRESS,
  CHECKOUT_SESSION_ID,
  CREDIT_CARD,
  DECLINE_SESSION_ID,
  DECLINED_CREDIT_CARD,
  DEFAULT_CURRENCY,
  EMAIL,
  EXPIRED_CREDIT_CARD,
  SEEDED_SESSION_ID,
  UNSEEDED_SESSION_ID,
  jsonHeader,
} from '../../../checkly.fixtures'

const PLACE_ORDER_BODY = {
  userId: SEEDED_SESSION_ID,
  userCurrency: DEFAULT_CURRENCY,
  email: EMAIL,
  address: ADDRESS,
  creditCard: CREDIT_CARD,
}

const SUCCESSFUL_ORDER_BODY = {
  ...PLACE_ORDER_BODY,
  userId: CHECKOUT_SESSION_ID,
}

const EMPTY_CART_ORDER_BODY = {
  ...PLACE_ORDER_BODY,
  userId: UNSEEDED_SESSION_ID,
}

const WRONG_IDENTITY_KEY_ORDER_BODY = {
  ...PLACE_ORDER_BODY,
  userId: undefined,
  user_id: SEEDED_SESSION_ID,
}

const DECLINED_ORDER_BODY = {
  ...PLACE_ORDER_BODY,
  userId: DECLINE_SESSION_ID,
  creditCard: DECLINED_CREDIT_CARD,
}

const EXPIRED_ORDER_BODY = {
  ...PLACE_ORDER_BODY,
  userId: DECLINE_SESSION_ID,
  creditCard: EXPIRED_CREDIT_CARD,
}

const seedDeclineCart = {
  entrypoint: './seed-decline-cart.setup.ts',
}

new ApiCheck('checkout-place-order', {
  name: 'POST /api/checkout — place order',
  description: "Place an order, exercising seven services end to end",
  tags: ['api', 'checkout'],
  setupScript: {
    entrypoint: './seed-checkout-cart.setup.ts',
  },
  degradedResponseTime: 5000,
  maxResponseTime: 15000,
  request: {
    method: 'POST',
    url: '{{{BASE_URL_DEV}}}/api/checkout',
    headers: [jsonHeader],
    queryParameters: [<QueryParam>{key: "currencyCode", value: DEFAULT_CURRENCY}],
    bodyType: 'JSON',
    body: JSON.stringify(SUCCESSFUL_ORDER_BODY),
    followRedirects: true,
    assertions: [
      AssertionBuilder.statusCode().equals(200),
      AssertionBuilder.headers('content-type').contains('application/json'),
      AssertionBuilder.jsonBody('$.orderId').isNotNull(),
      AssertionBuilder.jsonBody('$.shippingTrackingId').isNotNull(),
      AssertionBuilder.jsonBody('$.shippingCost.units').isNotNull(),
    ]
  },
})

new ApiCheck('checkout-empty-cart', {
  name: 'POST /api/checkout — 500 on empty cart',
  description: "Placing an order against a session with no cart fails",
  tags: ['api', 'checkout', 'negative'],
  shouldFail: true,
  degradedResponseTime: 5000,
  maxResponseTime: 15000,
  request: {
    method: 'POST',
    url: '{{{BASE_URL_DEV}}}/api/checkout',
    headers: [jsonHeader],
    queryParameters: [<QueryParam>{key: "currencyCode", value: DEFAULT_CURRENCY}],
    bodyType: 'JSON',
    body: JSON.stringify(EMPTY_CART_ORDER_BODY),
    followRedirects: true,
    assertions: [
      AssertionBuilder.statusCode().equals(500),
      AssertionBuilder.jsonBody('$.error').contains('Failed to place order'),
    ]
  },
})

new ApiCheck('checkout-wrong-identity-key', {
  name: 'POST /api/checkout — 500 on user_id instead of userId',
  description: "The snake_case identity key is not read and the order fails",
  tags: ['api', 'checkout', 'negative'],
  shouldFail: true,
  degradedResponseTime: 5000,
  maxResponseTime: 15000,
  request: {
    method: 'POST',
    url: '{{{BASE_URL_DEV}}}/api/checkout',
    headers: [jsonHeader],
    queryParameters: [<QueryParam>{key: "currencyCode", value: DEFAULT_CURRENCY}],
    bodyType: 'JSON',
    body: JSON.stringify(WRONG_IDENTITY_KEY_ORDER_BODY),
    followRedirects: true,
    assertions: [
      AssertionBuilder.statusCode().equals(500),
      AssertionBuilder.jsonBody('$.error').contains('Failed to place order'),
    ]
  },
})

new ApiCheck('checkout-card-declined', {
  name: 'POST /api/checkout — 422 on an invalid card number',
  description: "A card failing the Luhn check is declined as a business outcome",
  tags: ['api', 'checkout', 'negative'],
  shouldFail: true,
  setupScript: seedDeclineCart,
  degradedResponseTime: 5000,
  maxResponseTime: 15000,
  request: {
    method: 'POST',
    url: '{{{BASE_URL_DEV}}}/api/checkout',
    headers: [jsonHeader],
    queryParameters: [<QueryParam>{key: "currencyCode", value: DEFAULT_CURRENCY}],
    bodyType: 'JSON',
    body: JSON.stringify(DECLINED_ORDER_BODY),
    followRedirects: true,
    assertions: [
      AssertionBuilder.statusCode().equals(422),
      AssertionBuilder.jsonBody('$.code').equals('PAYMENT_FAILED'),
    ]
  },
})

new ApiCheck('checkout-card-expired', {
  name: 'POST /api/checkout — 422 on an expired card',
  description: "An expired expiry year is declined as a business outcome",
  tags: ['api', 'checkout', 'negative'],
  shouldFail: true,
  setupScript: seedDeclineCart,
  degradedResponseTime: 5000,
  maxResponseTime: 15000,
  request: {
    method: 'POST',
    url: '{{{BASE_URL_DEV}}}/api/checkout',
    headers: [jsonHeader],
    queryParameters: [<QueryParam>{key: "currencyCode", value: DEFAULT_CURRENCY}],
    bodyType: 'JSON',
    body: JSON.stringify(EXPIRED_ORDER_BODY),
    followRedirects: true,
    assertions: [
      AssertionBuilder.statusCode().equals(422),
      AssertionBuilder.jsonBody('$.code').equals('PAYMENT_FAILED'),
    ]
  },
})

new ApiCheck('checkout-method-not-allowed', {
  name: 'GET /api/checkout — 405 method not allowed',
  description: "Reject an unsupported method on the checkout route",
  tags: ['api', 'checkout', 'negative'],
  shouldFail: true,
  degradedResponseTime: 1000,
  maxResponseTime: 2000,
  request: {
    method: 'GET',
    url: '{{{BASE_URL_DEV}}}/api/checkout',
    headers: [jsonHeader],
    followRedirects: true,
    assertions: [
      AssertionBuilder.statusCode().equals(405),
    ]
  },
})
