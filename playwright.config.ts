import { defineConfig, devices } from '@playwright/test'
import { BASE_URL_DEV } from './checkly.fixtures'

export default defineConfig({
  testDir: '.',
  testMatch: '**/__checks__/**/*.spec.ts',
  timeout: 30000,
  use: {
    baseURL: BASE_URL_DEV,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'Chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
})
