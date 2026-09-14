import { test, expect, APIRequestContext } from '@playwright/test'
import {
  BASE_URL_DEV,
  sessionId,
  DEFAULT_CURRENCY,
  PRODUCT_ID,
  PRODUCT_NAME,
  QUANTITY,
} from '../../../checkly.fixtures'

const SESSION_ID = sessionId()

const readCart = (request: APIRequestContext) =>
  request.get(`${BASE_URL_DEV}/api/cart`, {
    params: { sessionId: SESSION_ID, currencyCode: DEFAULT_CURRENCY },
  })

test('cart lifecycle', async ({ request }) => {
  await test.step('cart starts empty', async () => {
    const response = await readCart(request)
    expect(response.status()).toBe(200)

    const cart = await response.json()
    expect(cart.items).toHaveLength(0)
  })

  await test.step('add an item', async () => {
    const response = await request.post(`${BASE_URL_DEV}/api/cart`, {
      params: { currencyCode: DEFAULT_CURRENCY },
      data: {
        userId: SESSION_ID,
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
    expect(cart.items[0].product.name).toBe(PRODUCT_NAME)
  })

  await test.step('empty the cart', async () => {
    const response = await request.delete(`${BASE_URL_DEV}/api/cart`, {
      data: { userId: SESSION_ID },
    })
    expect(response.status()).toBe(204)
  })

  await test.step('cart is empty again', async () => {
    const response = await readCart(request)
    expect(response.status()).toBe(200)

    const cart = await response.json()
    expect(cart.items).toHaveLength(0)
  })
})
