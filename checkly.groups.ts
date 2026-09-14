import { CheckGroupV2 } from 'checkly/constructs'

export const webStorefront = new CheckGroupV2('web-storefront', {
  name: 'Web storefront',
})

export const productCatalogue = new CheckGroupV2('product-catalogue', {
  name: 'Product catalogue',
})

export const shoppingCart = new CheckGroupV2('shopping-cart', {
  name: 'Shopping cart',
})

export const checkoutPayment = new CheckGroupV2('checkout-payment', {
  name: 'Checkout & payment',
})

export const supportingServices = new CheckGroupV2('supporting-services', {
  name: 'Supporting services',
})
