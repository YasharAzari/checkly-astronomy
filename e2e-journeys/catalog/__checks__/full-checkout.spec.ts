import { test, expect } from '@playwright/test'

const parsePriceCents = (text: string | null) => Math.round(parseFloat((text ?? '').replace(/[^\d.]/g, '')) * 100)

test('Place an order & checkout', async ({ page }) => {

  let product_base_price: number
  await test.step('open the store page', async () => {
    await page.goto('/')
  })

  await test.step('the product list renders', async () => {
    await expect(page.locator('[data-cy="product-list"]')).toBeVisible()
    await expect(page.locator('[data-cy="product-card"]').first()).toBeVisible()
  })

  await test.step('select the first product', async () => {
    await page.locator('[data-cy="product-card"]').first().click()
  })

  await test.step('check product detail page renders', async () => {
    await expect(page.locator('[data-cy="product-detail"]')).toBeVisible()
  })

  await test.step('the recommendation list renders', async () => {
    await expect(page.locator('[data-cy="recommendation-list"]')).toBeVisible()
    await expect(page.locator('[data-cy="recommendation-list"]').locator('[data-cy="product-card"]').first()).toBeVisible()
  })

  await test.step('save product amount', async () => {
    await expect(page.locator('[data-cy="product-detail"]')).toBeVisible()
    const product_price_elem = page.locator('[data-cy="product-price"]').first()
    await expect(product_price_elem).toBeVisible()

    product_base_price = parsePriceCents(await product_price_elem.textContent())
    expect(Number.isInteger(product_base_price)).toBe(true)
  })

  await test.step('change quantity to 2', async () => {
    await page.locator('[data-cy="product-quantity"]').selectOption({value: "2"})
  })

  await test.step('add to cart', async () => {
    await page.locator('[data-cy="product-add-to-cart"]').click()
  })

  await test.step('add to cart', async () => {
    await expect(page.locator('//*[contains(text(), "Shopping Cart")]')).toBeVisible()
  })

  await test.step('check total price and shipping price based on quantity', async () => {
    const all_cart_prices = page.locator('[data-cy="product-price"]')
    await expect(all_cart_prices.nth(3), 'cart should show unit price, line total, shipping and total',).toBeVisible()

    const shipping_price = parsePriceCents(await all_cart_prices.nth(2).textContent())
    const total_price = parsePriceCents(await all_cart_prices.nth(3).textContent())

    expect(total_price, `total should be shipping (${shipping_price}) + 2 x unit price (${product_base_price})`,).toBe(shipping_price + product_base_price * 2)
  })

  await test.step('place the order', async () => {
    await page.locator('[data-cy="checkout-place-order"]').click()
  })

  await test.step('the order final page is displayed', async () => {
    await expect(page.getByRole('heading', { name: 'Your order is complete' }), 'order confirmation title should be displayed after placing the order',).toBeVisible()
  })
})
