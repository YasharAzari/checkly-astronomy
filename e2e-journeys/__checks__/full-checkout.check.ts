import { BrowserCheck } from 'checkly/constructs'
import { webStorefront } from '../../checkly.groups'

new BrowserCheck('full-checkout-journey', {
  name: 'Place an order & checkout',
  description: "Open the homepage, selects a product, add it to cart and proceed with an order with confirmation",
  tags: ['browser', 'checkout', 'flow', 'critical'],
  group: webStorefront,
  code: {
    entrypoint: './full-checkout.spec.ts',
  },
})
