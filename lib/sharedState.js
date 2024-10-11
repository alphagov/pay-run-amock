const portArgFromArgv = process.argv.find(x => x.startsWith('--port='))
const portFromArgv = portArgFromArgv && Number(portArgFromArgv.substring('--port='.length))
export const isDebug = process.argv.includes('--debug')
export const port = portFromArgv || process.env.PORT || 9999

const configuredHandlers = {}

export function getConfiguredHandlersSharedState () {
  return configuredHandlers
}
