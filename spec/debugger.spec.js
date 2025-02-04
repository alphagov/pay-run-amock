import { afterEach, beforeEach, describe, it } from 'node:test'
import * as assert from 'node:assert'
import {
  clearAllMocks,
  clearAllSnapshots,
  httpPostJson,
  parseJsonRemoveDate,
  parseWebsiteResponse,
  setupMocks
} from './utils.js'
import { createSnapshotUrl, debuggerUrl, mockedHttpBaseUrl } from './constants.js'

console.clear()

async function setupStandardMocks () {
  const imposterSetupBody = {
    defaultResponse: { statusCode: 404, body: 'Default 404', headers: {} },
    stubs: [
      {
        predicates: [
          {
            equals: {
              method: 'GET',
              path: '/example',
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
  }
  await setupMocks(imposterSetupBody)
  return imposterSetupBody
}

async function createSnapshot (name) {
  const createSnapshotResult = await httpPostJson(createSnapshotUrl, {
    name
  })

  assert.equal(200, createSnapshotResult.status, `Expected a failure response from [${createSnapshotUrl}], got a [${(await createSnapshotResult.text())}]`)
  return createSnapshotResult
}

async function getDebuggerPageInfo (url) {
  const result = await fetch(url || debuggerUrl)
  const html = await result.text()

  assert.equal(200, result.status, `Expected a failure response from [${createSnapshotUrl}], got a [${html}]`)

  return parseWebsiteResponse(html)
}

async function getPageInfoForSnapshot (snapshotName) {
  const response = await fetch(debuggerUrl)
  const pageInfo = parseWebsiteResponse(await response.text())
  const snapshotFromPage = pageInfo.snapshots.filter(x => x.name === snapshotName)
  if (snapshotFromPage.length === 0) {
    throw new Error(`Expected one snapshot to include "${snapshotName}", none matched: [${pageInfo.snapshots.map(x => x.name).join(', ')}]`)
  }
  if (snapshotFromPage.length > 1) {
    throw new Error(`Expected one snapshot to include "${snapshotName}", but got [${snapshotFromPage.length}]: [${snapshotFromPage.map(x => x.name).join(', ')}]`)
  }
  const initialSnapshotUrl = mockedHttpBaseUrl + snapshotFromPage[0].url
  const initialSnapshotRequest = await fetch(initialSnapshotUrl)
  const initialSnapshotPageHtml = await initialSnapshotRequest.text()
  assert.equal(200, initialSnapshotRequest.status, `Expected a failure response from [${initialSnapshotUrl}], got a [${initialSnapshotPageHtml}]`)
  return parseWebsiteResponse(initialSnapshotPageHtml)
}

describe('equality-with-mountebank', () => {
  beforeEach(async () => {
    await clearAllMocks()
    await clearAllSnapshots()
  })
  afterEach(async () => {
    await clearAllMocks()
    await clearAllSnapshots()
  })
  it('should replay the mock setup', async () => {
    const requestBodyAsJsonString = await setupStandardMocks()

    const pageInfo = await getDebuggerPageInfo()

    assert.deepEqual(requestBodyAsJsonString, JSON.parse(pageInfo.tabs.latestMockStateContentsWithoutHtml))
  })
  it('should replay multiple mock setups using snapshots', async () => {
    const initialJsonBody = await setupStandardMocks()

    await createSnapshot('initial')

    const secondJsonBody = {
      stubs: [
        {
          predicates: [
            {
              equals: {
                method: 'GET',
                path: '/demo',
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
                body: {
                  hello: 'world'
                }
              }
            }
          ]
        }
      ]

    }

    await setupMocks(secondJsonBody)

    const createSnapshotResult = await createSnapshot('second')

    const result = await fetch(debuggerUrl)
    const html = await result.text()

    assert.equal(200, createSnapshotResult.status, `Expected a failure response from [${createSnapshotUrl}], got a [${html}]`)

    const initialSnapshotPageInfo = await getPageInfoForSnapshot('initial')
    const secondSnapshotPageInfo = await getPageInfoForSnapshot('second')

    assert.deepEqual(initialJsonBody, JSON.parse(initialSnapshotPageInfo.tabs.latestMockStateContentsWithoutHtml))
    assert.deepEqual(secondJsonBody, JSON.parse(secondSnapshotPageInfo.tabs.latestMockStateContentsWithoutHtml))
  })
  it('should not clear snapshots when clearing endpoints', async () => {
    const initialJsonBody = await setupStandardMocks()

    await createSnapshot('initial')

    await clearAllMocks()

    const initialSnapshotPageInfo = await getPageInfoForSnapshot('initial')

    assert.deepEqual(initialJsonBody, JSON.parse(initialSnapshotPageInfo.tabs.latestMockStateContentsWithoutHtml))
  })
  it('should update matched urls when they are called', async () => {
    await setupStandardMocks()

    await createSnapshot('initial')

    await fetch(mockedHttpBaseUrl + '/example?page=1&status=failed2-this-will-not-be-matched', {
      headers: {
        host: 'localhost:9999',
        connection: 'keep-alive',
        accept: '*/*',
        'accept-language': '*',
        'sec-fetch-mode': 'cors',
        'user-agent': 'node',
        'x-something-custom': 'abcdefg',
        'accept-encoding': 'gzip, deflate'
      }
    })

    await createSnapshot('second')

    await fetch(mockedHttpBaseUrl + '/example?page=1&status=failed')

    await createSnapshot('third')

    const first = await getPageInfoForSnapshot('initial')
    const second = await getPageInfoForSnapshot('second')
    const third = await getPageInfoForSnapshot('third')

    // visited mocks
    assert.deepEqual({}, parseJsonRemoveDate(first.tabs.visitedMocksContentsWithoutHtml))
    assert.deepEqual({
      __default__: {
        body: 'Default 404',
        callCount: 1,
        headers: {},
        statusCode: 404
      }
    }, parseJsonRemoveDate(second.tabs.visitedMocksContentsWithoutHtml))
    assert.deepEqual({
      GET: {
        '/example': [
          {
            body: {},
            callCount: 1,
            headers: {
              'Content-Type': 'application/json'
            },
            isDeepEquals: false,
            queryObj: {
              page: '1',
              status: 'failed'
            },
            statusCode: 200
          }
        ]
      },
      __default__: {
        body: 'Default 404',
        callCount: 1,
        headers: {},
        statusCode: 404
      }
    }, parseJsonRemoveDate(third.tabs.visitedMocksContentsWithoutHtml))

    // unvisited mocks
    assert.deepEqual({
      GET: {
        '/example': [
          {
            body: {},
            callCount: 0,
            headers: {
              'Content-Type': 'application/json'
            },
            isDeepEquals: false,
            queryObj: {
              page: '1',
              status: 'failed'
            },
            statusCode: 200
          }
        ]
      },
      __default__: {
        body: 'Default 404',
        callCount: 0,
        headers: {},
        statusCode: 404
      }
    }, parseJsonRemoveDate(first.tabs.unvisitedMocksContentsWithoutHtml))
    assert.deepEqual({
      GET: {
        '/example': [
          {
            body: {},
            callCount: 0,
            headers: {
              'Content-Type': 'application/json'
            },
            isDeepEquals: false,
            queryObj: {
              page: '1',
              status: 'failed'
            },
            statusCode: 200
          }
        ]
      }
    }, parseJsonRemoveDate(second.tabs.unvisitedMocksContentsWithoutHtml))
    assert.deepEqual({}, parseJsonRemoveDate(third.tabs.unvisitedMocksContentsWithoutHtml))

    // unmatched routes
    const populatedUnmatchedRequests = [
      {
        method: 'GET',
        url: '/example',
        headers: {
          host: 'localhost:9999',
          connection: 'keep-alive',
          accept: '*/*',
          'accept-language': '*',
          'sec-fetch-mode': 'cors',
          'user-agent': 'node',
          'x-something-custom': 'abcdefg',
          'accept-encoding': 'gzip, deflate'
        },
        queryObj: {
          page: '1',
          status: 'failed2-this-will-not-be-matched'
        }
      }
    ]
    assert.deepEqual(populatedUnmatchedRequests, JSON.parse(third.tabs.unmatchedRequestsContentsWithoutHtml))
    assert.deepEqual(populatedUnmatchedRequests, JSON.parse(second.tabs.unmatchedRequestsContentsWithoutHtml))
    assert.deepEqual([], JSON.parse(first.tabs.unmatchedRequestsContentsWithoutHtml))
  })
})
