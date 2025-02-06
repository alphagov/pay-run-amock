#!/usr/bin/env node

import fs from 'node:fs'
import path from 'path'
import cp from 'child_process'

const [_, __, ...args] = process.argv
const projectRoot = path.resolve(import.meta.dirname, '..')

console.log('running in dev mode with params:', args)

fs.watch(projectRoot, {
  recursive: true
}, () => {
  deboucedServerRestart()
})

let runningServerProcess
let serverProcessIsRestarting = false
let shouldRestartImmediatelyAfterRestart = false

async function deboucedServerRestart() {
  if (serverProcessIsRestarting) {
    shouldRestartImmediatelyAfterRestart = true
    return
  }
  serverProcessIsRestarting = true
  await stopServerIfNecessary()
  await new Promise(resolve => setTimeout(resolve, 50)) // to handle multiple simultanious changes, e.g. `.swp` files
  await startServer()
  if (shouldRestartImmediatelyAfterRestart) {
    process.nextTick(deboucedServerRestart)
  }
}

function startServer() {
  return new Promise((resolve, reject) => {
    shouldRestartImmediatelyAfterRestart = false
    if (runningServerProcess) {
      console.error('cannot start server, one is already running!!')
      return
    }
    runningServerProcess = cp.spawn('./bin/run.js', args, {})
    const listener = (data) => {
      const str = data.toString();
      if (str.trim() === 'starting run-amock http server') {
        serverProcessIsRestarting = false
        runningServerProcess.stdout.off('data', listener)
        resolve()
      }
    };
    runningServerProcess.stdout.on('data', listener)
    runningServerProcess.stdout.pipe(process.stdout)
    runningServerProcess.on('close', (...a) => {
      runningServerProcess = undefined
    })
  })
}

function stopServerIfNecessary() {
  if (!runningServerProcess) {
    return
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      runningServerProcess.off('close', listener)
      reject(new Error('Waited too long for the server to shut down'))
    }, 2000)
    const listener = () => {
      runningServerProcess = undefined
      clearTimeout(timeout)
      resolve()
    };
    runningServerProcess.once('close', listener)
    runningServerProcess.kill('SIGINT')

  })
}

deboucedServerRestart()
