import { BrowserCheck } from 'checkly/constructs'

new BrowserCheck('homepage-journey', {
  name: 'Homepage - healthcheck',
  description: "Open the storefront and confirm the list of products renders",
  tags: ['browser', 'catalog', 'flow', 'critical'],
  code: {
    entrypoint: './homepage.spec.ts',
  },
})
