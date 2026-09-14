import { BrowserCheck } from 'checkly/constructs'
import { webStorefront } from '../../../checkly.groups'

new BrowserCheck('homepage-journey', {
  name: 'Homepage - healthcheck',
  description: "Open the storefront and confirm the list of products renders",
  tags: ['browser', 'catalog', 'flow', 'critical'],
  group: webStorefront,
  code: {
    entrypoint: './homepage.spec.ts',
  },
})
