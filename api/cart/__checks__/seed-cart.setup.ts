import axios from 'axios'
import { BASE_URL_DEV, PRODUCT_ID, SEEDED_SESSION_ID } from '../../../checkly.fixtures'

await axios.post(`${BASE_URL_DEV}/api/cart`, {
  userId: SEEDED_SESSION_ID,
  item: { productId: PRODUCT_ID, quantity: 1 },
})
