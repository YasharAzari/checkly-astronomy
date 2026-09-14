import { MultiStepCheck } from 'checkly/constructs'

new MultiStepCheck('cart-lifecycle', {
  name: 'Cart lifecycle - empty, add, read, delete, empty',
  tags: ['api', 'cart', 'e2e'],
  code: {
    entrypoint: './cart-lifecycle.spec.ts',
  },
})
