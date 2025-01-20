export function getCurrentTime () {
  return process.hrtime.bigint()
}

export function objectsDeepEqual (l, r, config = {}) {
  console.log(l, r)
  if (!l || !r) {
    console.log(l, r, l === r)
    return l === r
  }

  const allowArraysInAnyOrder = config?.allowArraysInAnyOrder !== false
  if (Object.keys(l).length !== Object.keys(r).length) {
    return false
  }

  function itemsMatch (l, r) {
    if (typeof l === 'object') {
      return objectsDeepEqual(l, r, config)
    }

    return r === l
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
    console.log(key)
    console.log(typeof l[key])
    if (typeof l[key] === 'object') {
      if (!objectsDeepEqual(l[key], r[key], config)) {
        console.log('doesnt match:')
        console.log(l[key], r[key])
        return false
      }
    } else if (r[key] !== l[key]) {
      console.log('doesnt match:')
      console.log(key)
      console.log(l[key], r[key])
      return false
    }
  }
  return true
}
