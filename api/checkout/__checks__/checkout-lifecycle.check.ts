import { MultiStepCheck } from 'checkly/constructs'
import { checkoutPayment } from '../../../checkly.groups'

new MultiStepCheck('checkout-lifecycle', {
  name: 'Checkout lifecycle — browse, add to cart, purchase',
  tags: ['api', 'checkout', 'flow', 'critical'],
  group: checkoutPayment,
  code: {
    entrypoint: './checkout-lifecycle.spec.ts',
  },
})
