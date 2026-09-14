import { test, expect, APIRequestContext } from '@playwright/test'
import {
  ADDRESS,
  BASE_URL_DEV,
  CREDIT_CARD,
  DEFAULT_CURRENCY,
  EMAIL,
  PRODUCT_ID,
  PRODUCT_NAME,
  PURCHASE_LIFECYCLE_SESSION_ID,
  QUANTITY,
} from '../../../checkly.fixtures'

const readCart = (request: APIRequestContext) =>
  request.get(`${BASE_URL_DEV}/api/cart`, {
    params: { sessionId: PURCHASE_LIFECYCLE_SESSION_ID, currencyCode: DEFAULT_CURRENCY },
  })

test('checkout lifecycle', async ({ request }) => {
  let catalogPrice: { currencyCode: string; units: number; nanos: number }

  await test.step('start from an empty cart', async () => {
    const response = await request.delete(`${BASE_URL_DEV}/api/cart`, {
      data: { userId: PURCHASE_LIFECYCLE_SESSION_ID },
    })
    expect(response.status()).toBe(204)
  })

  await test.step('read the product from the catalogue', async () => {
    const response = await request.get(`${BASE_URL_DEV}/api/products/${PRODUCT_ID}`, {
      params: { currencyCode: DEFAULT_CURRENCY },
    })
    expect(response.status()).toBe(200)

    const product = await response.json()
    expect(product.id).toBe(PRODUCT_ID)
    expect(product.name).toBe(PRODUCT_NAME)
    expect(product.priceUsd.currencyCode).toBe(DEFAULT_CURRENCY)

    catalogPrice = product.priceUsd
  })

  await test.step('add it to the cart', async () => {
    const response = await request.post(`${BASE_URL_DEV}/api/cart`, {
      params: { currencyCode: DEFAULT_CURRENCY },
      data: {
        userId: PURCHASE_LIFECYCLE_SESSION_ID,
        item: { productId: PRODUCT_ID, quantity: QUANTITY },
      },
    })
    expect(response.status()).toBe(200)
  })

  await test.step('cart holds the item', async () => {
    const response = await readCart(request)
    expect(response.status()).toBe(200)

    const cart = await response.json()
    expect(cart.items).toHaveLength(1)
    expect(cart.items[0].productId).toBe(PRODUCT_ID)
    expect(cart.items[0].quantity).toBe(QUANTITY)
  })

  await test.step('place the order', async () => {
    const response = await request.post(`${BASE_URL_DEV}/api/checkout`, {
      params: { currencyCode: DEFAULT_CURRENCY },
      data: {
        userId: PURCHASE_LIFECYCLE_SESSION_ID,
        userCurrency: DEFAULT_CURRENCY,
        email: EMAIL,
        address: ADDRESS,
        creditCard: CREDIT_CARD,
      },
    })
    expect(response.status()).toBe(200)

    const order = await response.json()
    expect(order.orderId).toBeTruthy()
    expect(order.shippingTrackingId).toBeTruthy()
    expect(order.shippingCost.currencyCode).toBe(DEFAULT_CURRENCY)
    expect(order.shippingAddress).toMatchObject(ADDRESS)
    expect(order.items).toHaveLength(1)
    expect(order.items[0].item.productId).toBe(PRODUCT_ID)
    expect(order.items[0].item.quantity).toBe(QUANTITY)
    expect(order.items[0].cost.currencyCode).toBe(catalogPrice.currencyCode)
    expect(order.items[0].cost.units).toBe(catalogPrice.units)
  })

  await test.step('cart is emptied by the order', async () => {
    const response = await readCart(request)
    expect(response.status()).toBe(200)

    const cart = await response.json()
    expect(cart.items).toHaveLength(0)
  })
})
