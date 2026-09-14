import { defineConfig } from 'checkly'
import {Frequency } from 'checkly/constructs'
import { BASE_URL_DEV } from './checkly.fixtures'

const PRIVATE_LOCATION_SLUG = 'localhost-agent-mac'

const config = defineConfig({
  projectName: 'checkly-astronomy',
  logicalId: 'checkly-astronomy',
  checks: {
    frequency: Frequency.EVERY_5M,
    environmentVariables: [
      // Note: this url and global config was set up for a local dev environment
      // For better environment management, extend the config
      // to use https://www.checklyhq.com/docs/concepts/environments/ for production env management
      { key: 'BASE_URL_DEV', value: BASE_URL_DEV },
    ],
    locations: [],
    privateLocations: [PRIVATE_LOCATION_SLUG],
    runtimeId: '2026.04',
    checkMatch: '**/__checks__/**/*.check.ts',
    playwrightConfig: {
      timeout: 30000,
      use: {
        // Note: this url and global config was set up for a local dev environment
        // For better environment management, extend the config
        // to use https://www.checklyhq.com/docs/concepts/environments/ for production env management
        baseURL: BASE_URL_DEV,
        viewport: { width: 1280, height: 720 },
      },
    },
    browserChecks: {
      testMatch: '**/__checks__/**/*.spec.ts',
    },
  },
  cli: {
    privateRunLocation: PRIVATE_LOCATION_SLUG,
    reporters: ['list'],
    retries: 0,
  },
})

export default config
