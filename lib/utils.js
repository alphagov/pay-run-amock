export function getCurrentTime() {
  return process.hrtime.bigint()
}