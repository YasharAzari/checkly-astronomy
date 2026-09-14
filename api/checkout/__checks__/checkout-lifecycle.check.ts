import { MultiStepCheck } from 'checkly/constructs'

new MultiStepCheck('checkout-lifecycle', {
  name: 'Checkout lifecycle — browse, add to cart, purchase',
  tags: ['api', 'checkout', 'flow', 'critical'],
  code: {
    entrypoint: './checkout-lifecycle.spec.ts',
  },
})
