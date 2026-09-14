import { test, expect } from '@playwright/test'

test('homepage lists products', async ({ page }) => {
  await test.step('open the storefront', async () => {
    await page.goto('/')
  })

  await test.step('the product list renders', async () => {
    await expect(page.locator('[data-cy="product-list"]')).toBeVisible()
    await expect(page.locator('[data-cy="product-card"]').first()).toBeVisible()
  })

  await test.step('the first product image loads', async () => {
    const card_image = page.locator('[data-cy="product-card"]').first().locator('div').first()
    await expect.poll(() => {
      return card_image.evaluate(elem => getComputedStyle(elem).backgroundImage)
    }, {
      timeout: 10000
    }).toContain('blob:')
  })
})
