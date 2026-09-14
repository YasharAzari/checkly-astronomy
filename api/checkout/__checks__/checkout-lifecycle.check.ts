import { MultiStepCheck } from 'checkly/constructs'

new MultiStepCheck('checkout-lifecycle', {
  name: 'Checkout lifecycle — browse, add to cart, purchase',
  tags: ['api', 'checkout', 'e2e'],
  code: {
    entrypoint: './checkout-lifecycle.spec.ts',
  },
})
