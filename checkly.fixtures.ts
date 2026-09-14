import { randomUUID } from 'node:crypto'

export const BASE_URL_DEV = process.env.BASE_URL_DEV ?? 'http://frontend-proxy:8080'
export const DEFAULT_CURRENCY = 'EUR'

export const jsonHeader = {
  key: 'Content-Type',
  value: 'application/json',
}

export const PRODUCT_ID = 'OLJCESPC7Z'
export const PRODUCT_NAME = 'National Park Foundation Explorascope'
export const UNKNOWN_PRODUCT_ID = 'NO-SUCH-PRODUCT'
export const QUANTITY = 2


export const sessionId = () => randomUUID()

export const EMAIL = 'check@example.com'

export const ADDRESS = {
  streetAddress: '1600 Amphitheatre Parkway',
  city: 'Mountain View',
  state: 'CA',
  country: 'USA',
  zipCode: '94043',
}

export const CREDIT_CARD = {
  creditCardNumber: '4432-8015-6152-0454',
  creditCardCvv: 672,
  creditCardExpirationYear: 2030,
  creditCardExpirationMonth: 1,
}

export const DECLINED_CREDIT_CARD = {
  ...CREDIT_CARD,
  creditCardNumber: '1234-5678-9012-3456',
}

export const EXPIRED_CREDIT_CARD = {
  ...CREDIT_CARD,
  creditCardExpirationYear: 2020,
}
