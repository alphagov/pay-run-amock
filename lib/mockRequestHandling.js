import {coreHandlers} from "./coreHandlers.js";
import {getCurrentTime, objectsDeepEqual} from "./utils.js";
import {getConfiguredHandlersSharedState, isDebug} from "./sharedState.js";

const configuredHandlers = getConfiguredHandlersSharedState()

export function getResultForRequest(request) {
  const handler = getHandlerForRequest(request)
  return handler(request);
}

function getHandlerForRequest({method, url, queryObj, body}) {
  if (coreHandlers[method] && coreHandlers[method][url]) {
    return coreHandlers[method][url]
  }
  if (configuredHandlers[method] && configuredHandlers[method][url] && configuredHandlers[method][url].length > 0) {
    const handlers = configuredHandlers[method][url]
    const filtered = handlers.filter(conf => queryObjectsMatch(queryObj, conf.queryObj)).filter(conf => bodyObjectsMatch(body, conf.bodyObj))
    if (filtered.length > 0) {
      const foundHandler = filtered.sort(oldestLastUsedFirst)[0]
      foundHandler.lastUsedDate = getCurrentTime()
      if (isDebug) {
        console.log('handling request:', {method, url, queryObj, body, foundHandler})
      }
      return () => foundHandler
    }
  }

  if (isDebug) {
    console.log('Configured handlers (on 404)', configuredHandlers)
  }

  const availableUrls = new Set()
  const urls = Object.keys(configuredHandlers[method] || {})
  urls.forEach(url => {
    configuredHandlers[method][url].forEach(config => {
      availableUrls.add(getFullUrl(url, config.queryObj))
    })
  })
  if (isDebug) {
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
    console.log('Available urls:')
    availableUrls.forEach(url => console.log(` - ${url}`))
    console.log('')
    console.log('- - -')
    console.log('')
  }

  return defaultHandler
}

function bodyObjectsMatch(actualBody, configuredBody) {
  if (configuredBody === undefined) {
    return true
  }
  return objectsDeepEqual(actualBody, configuredBody)
}

function getFullUrl(url, queryObj) {
  return url + queryStringFromObject(queryObj)
}

const defaultHandler = (req) => {
  if (configuredHandlers.__default__) {
    return configuredHandlers.__default__
  }

  return {
    statusCode: 200,
    body: undefined
  }
}


function oldestLastUsedFirst(l, r) {
  if (l.lastUsedDate > r.lastUsedDate) {
    return 1
  }
  if (l.lastUsedDate < r.lastUsedDate) {
    return -1
  }
  return 0
}

function queryStringFromObject(queryObj) {
  if (!queryObj) {
    return ''
  }
  const qs = Object.keys(queryObj).map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(queryObj[key])}`).join('&')
  return qs.length > 0 ? `?${qs}` : ''
}

function queryObjectsMatch(actualQO, configuredQO) {
  const sanitisedActualQO = actualQO || {}

  if (!configuredQO) {
    return true
  }
  const result = !Object.keys(configuredQO).find((key) => ('' + sanitisedActualQO[key]) !== ('' + configuredQO[key]))
  return result
}
