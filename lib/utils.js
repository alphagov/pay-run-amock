export function getCurrentTime() {
  return process.hrtime.bigint()
}

export function objectsDeepEqual(l, r, {allowArraysInAnyOrder = true} = {}) {
  if (Object.keys(l).length !== Object.keys(r).length) {
    return false
  }

  function itemsMatch(l, r) {
    if (typeof l === 'object') {
      return objectsDeepEqual(l, r)
    }

    return r.includes(l)
  }

  if (allowArraysInAnyOrder && Array.isArray(l)) {
    if (!Array.isArray(r) || l.length !== r.length) {
      return false
    }
    for (const key in l) {
      if (r.filter(x => itemsMatch(l[key], x)).length === 0) {
        return false
      }
    }
    return true
  }
  for (const key in l) {
    if (typeof l[key] === 'object') {
      if (!objectsDeepEqual(l[key], r[key])) {
        return false
      }
    } else if (r[key] !== l[key]) {
      return false
    }
  }
  return true
}
