import axios from 'axios'
import { BASE_URL_DEV, PRODUCT_ID } from '../../../checkly.fixtures'

const session = process.env.CHECK_RUN_ID

if (!session) {
  throw new Error('CHECK_RUN_ID is not set, cannot seed a cart for this run')
}

await axios.post(`${BASE_URL_DEV}/api/cart`, {
  userId: session,
  item: { productId: PRODUCT_ID, quantity: 1 },
})
