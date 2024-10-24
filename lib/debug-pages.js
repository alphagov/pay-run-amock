import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {getConfiguredHandlersSharedState, getDebuggerSharedState} from "./sharedState.js";

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.join(__dirname, '..')

const pageTemplateLocation = path.join(projectRoot, 'debugger-assets', 'page-template.html');
const faviconLocation = path.join(projectRoot, 'debugger-assets', 'favicon.ico');
const boilerplateStylesheetLocation = path.join(projectRoot, 'debugger-assets', 'css-boilerplate.css');
const stylesheetLocation = path.join(projectRoot, 'debugger-assets', 'style.css');
const scriptLocation = path.join(projectRoot, 'debugger-assets', 'client-side-script.js');

const runAmockVersion = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')).version

const debuggerSharedState = getDebuggerSharedState()
const configuredHandlers = getConfiguredHandlersSharedState()
const startDateStr = new Date().toISOString()

const jsonReplacer = (key, value) => {
  if (typeof value === 'bigint') {
    return value.toString()
  }
  return value
}

function setupHandlerForFile(filePath, mimeType) {
  return (req) => {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': mimeType
      },
      body: fs.createReadStream(filePath)
    }
  };
}

const globalConstants = {runAmockVersion}

function replaceVariables(source, ...variableSources) {
  const allSourcesMixedTogether = Object.assign({}, ...variableSources);
  return Object.keys(allSourcesMixedTogether).reduce((accumulator, key) => {
    const find = `{{${key}}}`;
    const rawValue = allSourcesMixedTogether[key];
    const processedValue = typeof rawValue === 'object' ? `<code><pre>${JSON.stringify(rawValue, jsonReplacer, 2)}</pre></code>` : rawValue;
    return accumulator.replaceAll(find, processedValue)
  }, source)
}

function filterConfiguredHandlers(filterFn) {
  const output = {}
  Object.keys(configuredHandlers).forEach(methodOrDefault => {
    if (methodOrDefault === '__default__') {
      if (filterFn(configuredHandlers[methodOrDefault])) {
        output.__default__ = configuredHandlers[methodOrDefault]
      }
      return
    }
    Object.keys(configuredHandlers[methodOrDefault]).forEach(key => {
      const handlersArray = configuredHandlers[methodOrDefault][key];
      handlersArray.filter(filterFn).forEach(handlerConfig => {
        output[methodOrDefault] = output[methodOrDefault] || {}
        output[methodOrDefault][key] = output[methodOrDefault][key] || []
        output[methodOrDefault][key].push(handlerConfig)
      })
    })
  })
  return output
}

export function debuggerEndpoints(req) {
  return {
    '/__debugger__/favicon.ico': setupHandlerForFile(faviconLocation, 'image/x-icon'),
    '/__debugger__/css-boilerplate.css': setupHandlerForFile(boilerplateStylesheetLocation, 'text/css'),
    '/__debugger__/style.css': setupHandlerForFile(stylesheetLocation, 'text/css'),
    '/__debugger__/client-side-script.js': setupHandlerForFile(scriptLocation, 'application/javascript'),
    '/__debugger__': (req) => {
      const fileContents = fs.readFileSync(pageTemplateLocation, 'utf8');
      const body = replaceVariables(fileContents, globalConstants, {
        latestMockRequest: debuggerSharedState.latestMockRequest || `Not called since run-amock started at ${startDateStr}`,
        internalState: configuredHandlers || `Not called since run-amock started at ${startDateStr}`,
        unvisitedMocks: filterConfiguredHandlers(({callCount}) => !(callCount > 0)),
        visitedMocks: filterConfiguredHandlers(({callCount}) => callCount > 0)
      })
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
        body: body
      }
    }
  }
}
