import axios from 'axios'
import { BASE_URL_DEV, DECLINE_SESSION_ID, PRODUCT_ID } from '../../../checkly.fixtures'

await axios.post(`${BASE_URL_DEV}/api/cart`, {
  userId: DECLINE_SESSION_ID,
  item: { productId: PRODUCT_ID, quantity: 1 },
})
