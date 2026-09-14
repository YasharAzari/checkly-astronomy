import { MultiStepCheck } from 'checkly/constructs'
import { shoppingCart } from '../../../checkly.groups'

new MultiStepCheck('cart-lifecycle', {
  name: 'Cart lifecycle - empty, add, read, delete, empty',
  tags: ['api', 'cart', 'flow', 'critical'],
  group: shoppingCart,
  code: {
    entrypoint: './cart-lifecycle.spec.ts',
  },
})
