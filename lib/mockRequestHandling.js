import { coreHandlers } from './coreHandlers.js'
import { getCurrentTime, objectsDeepEqual } from './utils.js'
import { getConfiguredHandlersSharedState, isDebug } from './sharedState.js'

const configuredHandlers = getConfiguredHandlersSharedState()

export function getResultForRequest (request) {
  const handler = getHandlerForRequest(request)
  return handler(request)
}

function getHandlerForRequest ({ method, url, queryObj, body }) {
  if (coreHandlers[method] && coreHandlers[method][url]) {
    return coreHandlers[method][url]
  }

  if (configuredHandlers[method] && configuredHandlers[method][url] && configuredHandlers[method][url].length > 0) {
    const handlers = configuredHandlers[method][url]
    const filtered = handlers
      .filter(conf => objectsMatch(queryObj, conf.queryObj, conf.isDeepEquals))
      .filter(conf => objectsMatch(body, conf.bodyObj, conf.isDeepEquals))

    if (filtered.length > 0) {
      const foundHandler = filtered.sort(leastRecentlyUsedFirst).at(0)
      foundHandler.lastUsedDate = getCurrentTime()
      foundHandler.callCount++
      if (isDebug) {
        console.log('handling request:', { method, url, queryObj, body, foundHandler })
      }
      return () => foundHandler
    }
  }

  if (isDebug) {
    const availableUrls = new Set()
    const urls = Object.keys(configuredHandlers[method] || {})
    urls.forEach(url => {
      configuredHandlers[method][url].forEach(config => {
        availableUrls.add(getFullUrl(url, config.queryObj))
      })
    })
    console.log('')
    console.log('- - -')
    console.log('')
    console.log(`No [${method}] handler found for URL:`)
    console.log('')
    console.log(getFullUrl(url, queryObj))
    if (body) {
      console.log('')
      console.log('With body:')
      console.log('')
      console.log(JSON.stringify(body, null, 2))
    }
    console.log('')
    console.log(`Available urls for [${method}]:`)
    availableUrls.forEach(url => console.log(` - ${url}`))
    console.log('')
    console.log('- - -')
    console.log('')
  }

  return defaultHandler
}

function objectsMatch (received, configured, exact) {
  if (configured && !received) {
    return false
  }
  if (exact === true) {
    return objectsExactlyMatch(received, configured)
  }
  if (exact === false) {
    return objectsLooselyMatch(received, configured)
  }
  throw new Error('Object matching must be specified to be exact or loose')
}

function objectsExactlyMatch (received, configured) {
  if (configured === undefined) {
    return true
  }
  return objectsDeepEqual(received, configured)
}

function objectsLooselyMatch (received, configured) {
  if (configured === undefined) {
    return true
  }

  return !Object.keys(configured).find((key) => (received[key]) !== (configured[key]))
}

function getFullUrl (url, queryObj) {
  return url + queryStringFromObject(queryObj)
}

const defaultHandler = () => {
  const theDefaultHandler = configuredHandlers.__default__;
  if (theDefaultHandler) {
    configuredHandlers.__default__.callCount++
    return configuredHandlers.__default__
  }

  return {
    statusCode: 200,
    body: undefined
  }
}

function leastRecentlyUsedFirst (l, r) {
  if (l.lastUsedDate > r.lastUsedDate) {
    return 1
  }
  if (l.lastUsedDate < r.lastUsedDate) {
    return -1
  }
  return 0
}

function queryStringFromObject (queryObj) {
  if (!queryObj) {
    return ''
  }
  const qs = Object.keys(queryObj).map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(queryObj[key])}`).join('&')
  return qs.length > 0 ? `?${qs}` : ''
}
