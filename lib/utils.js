export function getCurrentTime () {
  return process.hrtime.bigint()
}

export function objectsDeepEqual (l, r, config = {}) {
  const allowArraysInAnyOrder = config?.allowArraysInAnyOrder !== false
  if ( l === null || l === undefined || r === null || r === undefined ){
    return l === r
  }
  if (Object.keys(l).length !== Object.keys(r).length) {
    return false
  }

  function itemsMatch (l, r) {
    if (typeof l === 'object') {
      return objectsDeepEqual(l, r, config)
    }

    return r.includes(l)
  }

  if (allowArraysInAnyOrder && Array.isArray(l)) {
    if (!Array.isArray(r) || l.length !== r.length) {
      return false
    }
    for (const key in l) {
      if (!r.find(x => itemsMatch(l[key], x))) {
        return false
      }
    }
    return true
  }
  for (const key in l) {
    if (typeof l[key] === 'object' && l[key] !== null) {
      if (!objectsDeepEqual(l[key], r[key], config)) {
        return false
      }
    } else if (r[key] !== l[key]) {
      return false
    }
  }
  return true
}
