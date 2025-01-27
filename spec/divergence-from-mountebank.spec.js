import { afterEach, beforeEach, describe, it } from 'node:test'
import * as assert from 'node:assert'
import { clearAllMocks, setupMocks } from './utils.js'
import { mockedHttpBaseUrl } from './constants.js'

describe('divergence-from-mountebank', () => {
  beforeEach(async () => {
    await clearAllMocks()
  })
  afterEach(async () => {
    await clearAllMocks()
  })
  it('should require query strings to be case sensitive using equals', async () => {
    await setupMocks({
      defaultResponse: { statusCode: 404, body: 'Default 404', headers: {} },
      stubs: [
        {
          predicates: [
            {
              equals: {
                method: 'GET',
                path: '/v1/webhook/webhook-id/message',
                query: {
                  page: 1,
                  status: 'failed'
                }
              }
            }
          ],
          responses: [
            {
              is: {
                statusCode: 200,
                headers: {
                  'Content-Type': 'application/json'
                },
                body: {}
              }
            }
          ]
        }
      ]
    })

    const fullMockUrl = mockedHttpBaseUrl + '/v1/webhook/webhook-id/message'
    const acceptableQueryStrings = [
      'page=1&status=failed',
      'status=failed&page=1'
    ]
    const unacceptableQueryStrings = [
      'page=1&status=FAILED',
      'page=1&STATUS=FAILED',
      'page=1&status=FaIlEd',
      'StAtUs=fAiLeD&page=1',
      'page=1&status=failed%20'
    ]
    await Promise.all(acceptableQueryStrings.map(async (queryString) => {
      const successResult = await fetch(fullMockUrl + '?' + queryString)

      assert.equal(200, successResult.status, `Expected a success response from [${fullMockUrl}], got a [${successResult.status}] with query string [${queryString}]`)
    }))
    await Promise.all(unacceptableQueryStrings.map(async (queryString) => {
      const successResult = await fetch(fullMockUrl + '?' + queryString)

      assert.equal(404, successResult.status, `Expected a failure response from [${fullMockUrl}], got a [${successResult.status}] with query string [${queryString}]`)
    }))
  })
  it(`should require no query string when using deep equals with no query string`, async () => {
    const uri = '/v1/example'
    await setupMocks({
      defaultResponse: { statusCode: 404, body: 'No stub predicate matches the request', headers: {} },
      stubs: [
        {
          predicates: [
            {
              deepEquals: {
                method: "GET",
                path: uri
              }
            }
          ],
          responses: [
            {
              is: {
                statusCode: 200,
                headers: {
                  'Content-Type': "application/json"
                },
                body: {
                  hello: 'world'
                }
              }
            }
          ]
        }
      ]
    })

    const fullMockUrl = mockedHttpBaseUrl + uri

    const successResult = await fetch(fullMockUrl)

    assert.equal(200, successResult.status, `Expected a success response from [${fullMockUrl}], got a [${successResult.status}] with no query string`)

    const unacceptableQueryStrings = [
      'abc=def'
    ]
    await Promise.all(unacceptableQueryStrings.map(async (queryString) => {
      const successResult = await fetch(fullMockUrl + '?' + queryString)

      assert.equal(404, successResult.status, `Expected a failure response from [${fullMockUrl}], got a [${successResult.status}] with query string [${queryString}]`)
    }))
  })

})
