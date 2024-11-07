const portArgFromArgv = process.argv.find(x => x.startsWith('--port='))
const portFromArgv = portArgFromArgv && Number(portArgFromArgv.substring('--port='.length))
export const isDebug = process.argv.includes('--debug')
export const port = portFromArgv || process.env.PORT || 9999

const configuredHandlers = {}
const debuggerSharedState = {}

export function resetDebuggerSharedState (isInitialStart = false) {
  Object.keys(debuggerSharedState).forEach((key) => {
    delete debuggerSharedState[key]
  })
  debuggerSharedState.snapshots = []
  debuggerSharedState.unmatchedRequests = []
  debuggerSharedState.latestMockRequest = `Not called since ${isInitialStart ? 'run-amock first started' : 'last reset'} at ${new Date().toISOString()}`
}

export function getDebuggerSharedState () {
  return debuggerSharedState
}

export function getConfiguredHandlersSharedState () {
  return configuredHandlers
}

resetDebuggerSharedState(true)
