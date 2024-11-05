import { imposterClearUrl, imposterSetupUrl, snapshotClearUrl } from './constants.js'
import * as assert from 'node:assert'

async function emptyPostToUrl (url) {
  let result
  try {
    result = await fetch(url, { method: 'POST' })
  } catch (error) {
    throw new Error(`Failed to make request to [${url}]`, error)
  }
  assert.equal(200, result.status, `Failed to clear all mocks, status code [${result.status}], body [${await result.text()}]`)
}

export async function clearAllMocks () {
  await emptyPostToUrl(imposterClearUrl)
}

export async function clearAllSnapshots () {
  await emptyPostToUrl(snapshotClearUrl)
}

export async function setupMocks (imposterSetupBody) {
  const setupResult = await httpPostJson(imposterSetupUrl, imposterSetupBody)
  const setupResultBody = await setupResult.text()
  assert.equal(201, setupResult.status, `failed setup, status code: [${setupResult.status}], response body: [${setupResultBody}]`)
}

export async function httpPostJson (url, body) {
  return await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

export async function httpPatchJson (url, body) {
  return await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

function getLinesBetween (lines, startLineContents, endLineContents) {
  const startOfSnapshotTabContents = lines.findIndex(line => line.includes(startLineContents))
  const endOfSnapshotTabContents = lines.findIndex((line, index) => index > startOfSnapshotTabContents && line.includes(endLineContents))
  return [...lines].slice(startOfSnapshotTabContents + 1, endOfSnapshotTabContents)
}

function getTabContentsById (lines, id) {
  return getLinesBetween(lines, `<div id="${id}" class="tabs__content">`, '</div>').join('\n')
}

function stripHtml (htmlIn) {
  return htmlIn
    .replaceAll(/(<(?:p|br|div|li))/g, '\n$1')
    .replaceAll(/<[^>]+>/g, '')
    .replaceAll(/\n+\s*/g, '\n')
    .replaceAll(/\s+/g, ' ')
    .trim()
}

export function parseWebsiteResponse (htmlStr) {
  const output = {
    tabs: {},
    snapshots: []
  }
  const lines = htmlStr.split('\n')

  output.tabs.latestMockStateContents = getTabContentsById(lines, 'last-mock-state')
  output.tabs.internalStateContents = getTabContentsById(lines, 'internal-state')
  output.tabs.visitedMocksContents = getTabContentsById(lines, 'visited-mocks')
  output.tabs.unvisitedMocksContents = getTabContentsById(lines, 'unvisited-mocks')
  output.tabs.unmatchedRequestsContents = getTabContentsById(lines, 'unmatched-requests')
  output.tabs.snapshotsContents = getTabContentsById(lines, 'snapshots')

  output.tabs.latestMockStateContentsWithoutHtml = stripHtml(output.tabs.latestMockStateContents)
  output.tabs.internalStateContentsWithoutHtml = stripHtml(output.tabs.internalStateContents)
  output.tabs.visitedMocksContentsWithoutHtml = stripHtml(output.tabs.visitedMocksContents)
  output.tabs.unvisitedMocksContentsWithoutHtml = stripHtml(output.tabs.unvisitedMocksContents)
  output.tabs.unmatchedRequestsContentsWithoutHtml = stripHtml(output.tabs.unmatchedRequestsContents)
  output.tabs.snapshotsContentsWithoutHtml = stripHtml(output.tabs.snapshotsContents)

  const snapshotLinkLines = getLinesBetween(output.tabs.snapshotsContents.split('\n'), '<ul', '</ul>')

  snapshotLinkLines.forEach(line => {
    const url = line.split('"').at(1)
    const name = line.split(': ')?.at(1)?.split('</a')?.at(0) || 'current'
    output.snapshots.push({
      url,
      name
    })
  })
  return output
}

export function parseJsonRemoveDate (str) {
  const parsed = JSON.parse(str)
  return deepObjectWithoutKeys(parsed, ['lastUsedDate'])
}

function deepObjectWithoutKeys (obj, keysToRemove) {
  function getValue (value) {
    if (Array.isArray(value)) {
      return value.map(x => getValue(x))
    }
    if (typeof value === 'object') {
      return deepObjectWithoutKeys(value, keysToRemove)
    }
    return value
  }

  return Object.keys(obj).reduce((acc, key) => {
    const value = obj[key]
    if (!keysToRemove.includes(key)) {
      acc[key] = getValue(value)
    }
    return acc
  }, {})
}
