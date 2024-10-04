import * as net from 'node:net'
import { afterEach, beforeEach, describe, it } from 'node:test'
import * as assert from 'node:assert'

async function findAvailablePort () {
  return await new Promise((resolve) => {
    let port
    const tmpServer = net.createServer(function (sock) {
      sock.end('Hello world\n')
    })
    tmpServer.listen(0, function () {
      port = tmpServer.address().port
      tmpServer.close(() => {
        resolve(port)
      })
    })
  })
}

const mockPort = await findAvailablePort()
const mountebankConfig = {
  name: 'mountebank',
  imposterSetupUrl: 'http://localhost:2525/imposters',
  imposterClearUrl: 'http://localhost:2525/imposters',
  imposterClearMethod: 'DELETE',
  mockedHttpBaseUrl: `http://localhost:${mockPort}`,
  mockPort
}
const selfConfig = {
  name: 'http-configurable-mock-server',
  imposterSetupUrl: 'http://localhost:9999/__add-mock-endpoints__',
  imposterClearUrl: 'http://localhost:9999/__clear-all-endpoints__',
  imposterClearMethod: 'POST',
  mockedHttpBaseUrl: 'http://localhost:9999',
  mockPort: 9999
}

async function httpPostJson (url, body) {
  return await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

async function httpPatchJson (url, body) {
  return await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

async function clearAllMocks (config) {
  const result = await fetch(config.imposterClearUrl, { method: config.imposterClearMethod })
  assert.equal(200, result.status, `Failed to clear all mocks, status code [${result.status}], body [${await result.text()}`)
}

async function setupImposters (config, imposterSetupBody) {
  const setupResult = await httpPostJson(config.imposterSetupUrl, imposterSetupBody)
  const setupResultBody = await setupResult.text()
  assert.equal(201, setupResult.status, `failed setup, status code: [${setupResult.status}], response body: [${setupResultBody}]`)
}

function jsonString (main, ...parts) {
  const outParts = []
  main.forEach((item, index) => {
    outParts.push(item)
    if (parts[index] !== undefined) {
      outParts.push(JSON.stringify(parts[index]))
    }
  })
  return outParts.join('')
}

const testRunConfigs = []

if (process.env.TEST_MB === 'true') {
  testRunConfigs.push(mountebankConfig)
}
if (process.env.TEST_SELF !== 'false') {
  testRunConfigs.push(selfConfig)
}

testRunConfigs.forEach(config => {
  beforeEach(async () => {
    await clearAllMocks(config)
  })
  afterEach(async () => {
    await clearAllMocks(config)
  })
  describe('equality-with-mountebank', () => {
    it(`should give one response multiple times, and respect deletes (${config.name})`, async () => {
      const fakeBody = {
        abc: 'def'
      }
      const statusCode = 200
      const path = '/a'
      await setupImposters(config, {
        port: mockPort,
        protocol: 'http',
        stubs: [
          {
            name: `The name doesn't matter (unique: ${Math.random()})`,
            predicates: [
              {
                deepEquals: {
                  method: 'GET',
                  path
                }
              }
            ],
            responses: [
              {
                is: {
                  statusCode,
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: fakeBody
                }
              }
            ]
          }
        ]
      })

      let remainingRequests = 5
      const fullMockUrl = config.mockedHttpBaseUrl + path
      while (remainingRequests-- > 0) {
        const result = await fetch(fullMockUrl)
        const responseBody = await result.json()
        const responseStatusCode = result.status

        assert.equal(statusCode, responseStatusCode, `Response from [${fullMockUrl}] was [${responseStatusCode}], expected [${statusCode}]`)
        assert.deepEqual(fakeBody, responseBody)
      }
      await clearAllMocks(config)
      try {
        const resultAfterDelete = await fetch(fullMockUrl)
        const statusAfterDelete = resultAfterDelete.status

        assert.equal(404, statusAfterDelete, `Response from [${fullMockUrl}] was [${statusAfterDelete}], expected [404]`)
      } catch (error) {
        // ignoring because an error is one valid way to handle this
      }
    })
    it(`should alternate between two responses (${config.name})`, async () => {
      const fakeBody1 = {
        abc: 'def'
      }
      const fakeBody2 = {
        ghi: 'jkl'
      }
      const imposterSetupBody = {
        port: mockPort,
        protocol: 'http',
        stubs: [
          {
            name: `The name doesn't matter (unique: ${Math.random()})`,
            predicates: [
              {
                deepEquals: {
                  method: 'GET',
                  path: '/b'
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
                  body: fakeBody1
                }
              },
              {
                is: {
                  statusCode: 200,
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: fakeBody2
                }
              }
            ]
          }
        ]
      }

      console.log(JSON.stringify(imposterSetupBody))

      await setupImposters(config, imposterSetupBody)

      let counter = 0
      const fullMockUrl = config.mockedHttpBaseUrl + '/b'
      while (counter++ < 5) {
        const result1 = await fetch(fullMockUrl)
        const responseBody1 = await result1.json()
        const responseStatusCode1 = result1.status

        assert.equal(200, responseStatusCode1, `Response from [${fullMockUrl}] was [${responseStatusCode1}], expected [${200}]`)
        assert.deepEqual(fakeBody1, responseBody1, jsonString`Expected response body (1) (repeat counter: [${counter}]) [${responseBody1}] to equal the configured output [${fakeBody1}]`)

        const result2 = await fetch(fullMockUrl)
        const responseBody2 = await result2.json()
        const responseStatusCode2 = result2.status

        assert.equal(200, responseStatusCode2, `Response from [${fullMockUrl}] was [${responseStatusCode1}], expected [${200}]`)
        assert.deepEqual(fakeBody2, responseBody2, jsonString`Expected response body (2) (repeat counter: [${counter}]) [${responseBody2}] to equal the configured output [${fakeBody2}]`)
      }
    })
  })
  it(`should respond with the default response when configured (${config.name})`, async () => {
    const fakeBody = 'No stub predicate matches the request'
    const statusCode = 404
    await setupImposters(config, {
      port: mockPort,
      protocol: 'http',
      defaultResponse: { statusCode, body: fakeBody, headers: {} },
      stubs: []
    })

    const fullMockUrl = config.mockedHttpBaseUrl + '/abc'
    const result = await fetch(fullMockUrl)
    const responseBody = await result.text()
    const responseStatusCode = result.status

    assert.equal(statusCode, responseStatusCode, `Response from [${fullMockUrl}] was [${responseStatusCode}], expected [${statusCode}]`)
    assert.deepEqual(fakeBody, responseBody)
  })
  it(`should allow body matching in predicates (${config.name})`, async () => {
    const uri = '/v1/api/services/a-service-external-id'
    await setupImposters(config, {
      port: mockPort,
      protocol: 'http',
      defaultResponse: { statusCode: 404, body: 'No stub predicate matches the request', headers: {} },
      stubs: [{
        name: `The name doesn't matter (unique: ${Math.random()})`,
        predicates: [
          {
            deepEquals: {
              method: 'PATCH',
              path: uri,
              body: {
                op: 'replace',
                path: 'default_billing_address_country',
                value: 'GB'
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
              body: {
                matched: true
              }
            }
          }
        ]
      }]
    })

    const accepatableBodies = [
      {
        op: 'replace',
        path: 'default_billing_address_country',
        value: 'GB'
      }
    ]
    const fullMockUrl = config.mockedHttpBaseUrl + uri
    await Promise.all(accepatableBodies.map(async (body) => {
      const successResult = await httpPatchJson(fullMockUrl, body)

      assert.equal(200, successResult.status, `Expected a success response from [${fullMockUrl}], got a [${successResult.status}]`)
    }))

    const unacceptableBodies = [
      {
        op: 'replace',
        path: 'default_billing_address_country',
        value: 'GB',
        extra: true
      },
      {
        op: 'replace',
        path: 'default_billing_address_country',
        extra: true
      }
    ]
    await Promise.all(unacceptableBodies.map(async (body) => {
      const successResult = await httpPatchJson(fullMockUrl, body)

      assert.equal(404, successResult.status, `Expected a failure response from [${fullMockUrl}], got a [${successResult.status}]`)
    }))
  })
  it(`should allow deep matching for body (${config.name})`, async () => {
    const uri = '/v1/api/accounts/42/credentials/101'
    await setupImposters(config, {
      port: mockPort,
      protocol: 'http',
      defaultResponse: { statusCode: 404, body: 'No stub predicate matches the request', headers: {} },
      stubs: [{
        name: `The name doesn't matter (unique: ${Math.random()})`,
        predicates: [
          {
            deepEquals: {
              method: 'PATCH',
              path: uri,
              body: [
                {
                  op: 'replace',
                  path: 'credentials/worldpay/recurring_customer_initiated',
                  value: {
                    username: 'a-cit-username',
                    password: 'a-password',
                    merchant_code: 'a-cit-merchant-code'
                  }
                },
                {
                  op: 'replace',
                  path: 'last_updated_by_user_external_id',
                  value: 'cd0fa54cf3b7408a80ae2f1b93e7c16e'
                }
              ]
            }
          }
        ],
        responses: [
          {
            is: {
              statusCode: 200,
              headers: {
                'Content-Type': 'application/json'
              }
            }
          }
        ]
      }
      ]
    })

    const acceptableBodies = [
      [
        {
          op: 'replace',
          path: 'credentials/worldpay/recurring_customer_initiated',
          value: {
            username: 'a-cit-username',
            password: 'a-password',
            merchant_code: 'a-cit-merchant-code'
          }
        },
        {
          op: 'replace',
          path: 'last_updated_by_user_external_id',
          value: 'cd0fa54cf3b7408a80ae2f1b93e7c16e'
        }
      ],
      [
        {
          path: 'credentials/worldpay/recurring_customer_initiated',
          op: 'replace',
          value: {
            password: 'a-password',
            username: 'a-cit-username',
            merchant_code: 'a-cit-merchant-code'
          }
        },
        {
          path: 'last_updated_by_user_external_id',
          op: 'replace',
          value: 'cd0fa54cf3b7408a80ae2f1b93e7c16e'
        }
      ]
    ]
    const fullMockUrl = config.mockedHttpBaseUrl + uri
    await Promise.all(acceptableBodies.map(async (body) => {
      const successResult = await httpPatchJson(fullMockUrl, body)

      assert.equal(200, successResult.status, `Expected a success response from [${fullMockUrl}], got a [${successResult.status}]`)
    }))
  })
  it(`should use provided headers (${config.name})`, async () => {
    const uri = '/hello/world'
    const uri2 = '/hello/world2'
    await setupImposters(config, {
      port: mockPort,
      protocol: 'http',
      stubs: [{
        name: `The name doesn't matter (unique: ${Math.random()})`,
        predicates: [
          {
            deepEquals: {
              method: 'GET',
              path: uri
            }
          }
        ],
        responses: [
          {
            is: {
              statusCode: 200,
              headers: {
                'Content-Type': 'application/json',
                'X-Powered-By': 'Love'
              },
              body: {
                matched: true
              }
            }
          }
        ]
      }, {
        name: `The name doesn't matter (unique: ${Math.random()})`,
        predicates: [
          {
            deepEquals: {
              method: 'GET',
              path: uri2
            }
          }
        ],
        responses: [
          {
            is: {
              statusCode: 200,
              headers: {
                'Content-Type': 'application/json',
                'X-Powered-By': 'Vengeance'
              },
              body: {
                matched: true
              }
            }
          }
        ]
      }]
    })

    const fullMockUrl1 = config.mockedHttpBaseUrl + uri
    const result1 = await fetch(fullMockUrl1)
    assert.equal('Love', result1.headers.get('x-powered-by'))

    const fullMockUrl2 = config.mockedHttpBaseUrl + uri
    const result2 = await fetch(fullMockUrl2)
    assert.equal('Love', result2.headers.get('x-powered-by'))
  })
})
