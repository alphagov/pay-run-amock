import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getConfiguredHandlersSharedState, getDebuggerSharedState } from './sharedState.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.join(__dirname, '..')

const pageTemplateLocation = path.join(projectRoot, 'debugger-assets', 'page-template.html')
const pageTemplateSnapshotNotFoundLocation = path.join(projectRoot, 'debugger-assets', 'page-template-snapshot-not-found.html')
const faviconLocation = path.join(projectRoot, 'debugger-assets', 'favicon.ico')
const boilerplateStylesheetLocation = path.join(projectRoot, 'debugger-assets', 'css-boilerplate.css')
const stylesheetLocation = path.join(projectRoot, 'debugger-assets', 'style.css')
const scriptLocation = path.join(projectRoot, 'debugger-assets', 'client-side-script.js')

const runAmockVersion = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')).version

const debuggerSharedState = getDebuggerSharedState()
const configuredHandlers = getConfiguredHandlersSharedState()

const jsonReplacer = (key, value) => {
  if (typeof value === 'bigint') {
    return Number(value)
  }
  return value
}

function setupHandlerForFile (filePath, mimeType) {
  return () => {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': mimeType
      },
      body: fs.createReadStream(filePath)
    }
  }
}

const globalConstants = { runAmockVersion }

function replaceVariables (source, ...variableSources) {
  const allSourcesMixedTogether = Object.assign({}, ...variableSources)
  return Object.keys(allSourcesMixedTogether).reduce((accumulator, key) => {
    const find = `{{${key}}}`
    const rawValue = allSourcesMixedTogether[key]
    const processedValue = typeof rawValue === 'object' ? `<code><pre>${JSON.stringify(rawValue, jsonReplacer, 2)}</pre></code>` : rawValue
    return accumulator.replaceAll(find, processedValue)
  }, source)
}

function filterConfiguredHandlers (handlers, filterFn) {
  const output = {}
  Object.keys(handlers).forEach(methodOrDefault => {
    if (methodOrDefault === '__default__') {
      if (filterFn(handlers[methodOrDefault])) {
        output.__default__ = handlers[methodOrDefault]
      }
      return
    }
    Object.keys(handlers[methodOrDefault]).forEach(key => {
      const handlersArray = handlers[methodOrDefault][key]
      if (!Array.isArray(handlersArray)) {
        console.error('Expected array, got', handlersArray)
        console.error(`Lookup was [${key}] in`, handlers[methodOrDefault])
      }
      handlersArray.filter(filterFn).forEach(handlerConfig => {
        output[methodOrDefault] = output[methodOrDefault] || {}
        output[methodOrDefault][key] = output[methodOrDefault][key] || []
        output[methodOrDefault][key].push(handlerConfig)
      })
    })
  })
  return output
}

function getSnapshotListHtml () {
  const defaultLi = '<li><a href="/__debugger__">Current state (not a snapshot)</a></li>'
  return [defaultLi].concat(Object.keys(debuggerSharedState.snapshots)
    .map(key => `<li><a href="/__debugger__?snapshot=${encodeURIComponent(key)}">${key}</a></li>`))
    .join('\n')
}

export function clearSnapshotsEndpoint (req) {
  debuggerSharedState.snapshots = []
  const url = '/__debugger__#snapshots'
  return {
    statusCode: 302,
    headers: {
      Location: url
    },
    body: `Redirecting to ${url}`
  }
}

function parseSnapshotJson (json) {
  return JSON.parse(json)
}

export function debuggerSnapshotEndpoint (req) {
  const snapshotName = [
    new Date().toISOString(),
    req.body?.name
  ]
    .filter(x => !!x)
    .join(': ')

  debuggerSharedState.snapshots[snapshotName] = {
    latestMockRequest: JSON.stringify(debuggerSharedState.latestMockRequest || 'Not called the snapshot was made', jsonReplacer),
    configuredHandlers: JSON.stringify(configuredHandlers, jsonReplacer),
    unmatchedRequests: JSON.stringify(debuggerSharedState.unmatchedRequests, jsonReplacer)
  }
  return {
    statusCode: 200,
    body: {
      name: snapshotName
    }
  }
}

export function debuggerGETEndpoints () {
  return {
    '/__debugger__/favicon.ico': setupHandlerForFile(faviconLocation, 'image/x-icon'),
    '/__debugger__/css-boilerplate.css': setupHandlerForFile(boilerplateStylesheetLocation, 'text/css'),
    '/__debugger__/style.css': setupHandlerForFile(stylesheetLocation, 'text/css'),
    '/__debugger__/client-side-script.js': setupHandlerForFile(scriptLocation, 'application/javascript'),
    '/__debugger__': (req) => {
      const requestedSnapshotName = req.queryObj?.snapshot
      const snapshot = debuggerSharedState.snapshots[requestedSnapshotName]
      if (requestedSnapshotName && !snapshot) {
        const body = fs.readFileSync(pageTemplateSnapshotNotFoundLocation, 'utf8')
        return {
          statusCode: 404,
          headers: {
            'Content-Type': 'text/html; charset=UTF-8'
          },
          body
        }
      }
      const fileContents = fs.readFileSync(pageTemplateLocation, 'utf8')
      const handlers = snapshot ? parseSnapshotJson(snapshot.configuredHandlers) : configuredHandlers
      const latestMockRequest = snapshot ? parseSnapshotJson(snapshot.latestMockRequest) : debuggerSharedState.latestMockRequest
      const unmatchedRequests = snapshot ? parseSnapshotJson(snapshot.unmatchedRequests) : debuggerSharedState.unmatchedRequests

      const body = replaceVariables(fileContents, globalConstants, {
        viewingSnapshotHtml: snapshot ? `<h3>You are viewing snapshot: ${requestedSnapshotName}</h3>` : '',
        latestMockRequest: latestMockRequest,
        internalState: handlers,
        unvisitedMocks: filterConfiguredHandlers(handlers, ({ callCount }) => !(callCount > 0)),
        visitedMocks: filterConfiguredHandlers(handlers, ({ callCount }) => callCount > 0),
        unmatchedRequests: unmatchedRequests || 'No unmatched requests since last reset',
        snapshotListHtml: getSnapshotListHtml()
      })
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8'
        },
        body
      }
    }
  }
}
