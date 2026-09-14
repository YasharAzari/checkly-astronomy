import { ApiCheck, AssertionBuilder } from 'checkly/constructs'
import { DEFAULT_CURRENCY, jsonHeader } from '../../../checkly.fixtures'

new ApiCheck('currency-list', {
  name: 'GET /api/currency - supported currencies',
  description: "List the supported ISO-4217 currency codes",
  tags: ['api', 'addons', 'critical'],
  degradedResponseTime: 1000,
  maxResponseTime: 2000,
  request: {
    method: 'GET',
    url: '{{{BASE_URL_DEV}}}/api/currency',
    headers: [jsonHeader],
    followRedirects: true,
    assertions: [
      AssertionBuilder.statusCode().equals(200),
      AssertionBuilder.headers('content-type').contains('application/json'),
      AssertionBuilder.jsonBody('$[0]').isNotNull(),
      AssertionBuilder.textBody().contains(DEFAULT_CURRENCY),
    ]
  },
})
