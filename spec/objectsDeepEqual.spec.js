import {afterEach, beforeEach, describe, it} from 'node:test'
import * as assert from 'node:assert'
import {objectsDeepEqual} from "../lib/utils.js";

const defaultConfig = undefined

function expectMatch(basis, comparison, config = defaultConfig) {
  const result = objectsDeepEqual(basis, comparison, config)
  if (!result) {
    console.error('Expected objects to match, but they didn\'t')
    console.error('Basis', basis)
    console.error('Comparison', comparison)
    console.error('Config', config)
    throw new Error(`Expected to match but didn't. [${JSON.stringify(basis)}] compared with [${JSON.stringify(comparison)}]`)
  }
}

function expectNotToMatch(basis, comparison, config = defaultConfig) {
  const result = objectsDeepEqual(basis, comparison, config)
  if (result) {
    console.error('Expected objects not to match, but they did')
    console.error('Basis', basis)
    console.error('Comparison', comparison)
    console.error('Config', config)
    throw new Error(`Matched but expected not to. [${JSON.stringify(basis)}] compared with [${JSON.stringify(comparison)}]`)
  }
}

describe('objectDeepEqual', () => {
  it('should match simple objects', () => {
    const basis = {
      a: 'b',
      c: 'd'
    }
    expectMatch(basis, {a: 'b', c: 'd'})
    expectMatch(basis, {c: 'd', a: 'b'})
    expectNotToMatch(basis, {a: 'b', c: 'd', e: 'f'})
    expectNotToMatch(basis, {a: 'b'})
  })
  it('should match arrays in any order', () => {
    const basis = {
      a: 'b',
      c: ['d', 'e', 'f']
    }
    expectMatch(basis, {
      a: 'b',
      c: ['d', 'e', 'f']
    })
    expectMatch(basis, {
      a: 'b',
      c: ['d', 'f', 'e']
    })
    expectMatch(basis, {
      c: ['d', 'f', 'e'],
      a: 'b'
    })
    expectNotToMatch(basis, {
      a: 'b',
      c: ['d', 'e']
    })
    expectNotToMatch(basis, {
      a: 'b',
      c: ['d', 'e', 'f', 'g']
    })
  })
  it('should match arrays in specified order', () => {
    const basis = {
      a: 'b',
      c: ['d', 'e', 'f']
    }
    expectMatch(basis, {
      a: 'b',
      c: ['d', 'e', 'f']
    }, {allowArraysInAnyOrder: false})
    expectNotToMatch(basis, {
      a: 'b',
      c: ['d', 'f', 'e']
    }, {allowArraysInAnyOrder: false})
    expectNotToMatch(basis, {
      c: ['d', 'f', 'e'],
      a: 'b'
    }, {allowArraysInAnyOrder: false})
    expectMatch(basis, {
      c: ['d', 'e', 'f'],
      a: 'b'
    }, {allowArraysInAnyOrder: false})
    expectNotToMatch(basis, {
      a: 'b',
      c: ['d', 'e']
    }, {allowArraysInAnyOrder: false})
    expectNotToMatch(basis, {
      a: 'b',
      c: ['d', 'e', 'f', 'g']
    }, {allowArraysInAnyOrder: false})
  })
  it('deep object match inside array in any order', () => {
    const basis = {
      arr1: [
        {obj1: 'a'},
        {obj2: 'b'},
        {obj3: 'c'},
      ]
    }
    expectMatch(basis, {
      arr1: [
        {obj1: 'a'},
        {obj3: 'c'},
        {obj2: 'b'},
      ]
    })
    expectNotToMatch(basis, {
      arr1: [
        {obj1: 'a'},
        {obj3: 'c'},
        {obj3: 'c'},
        {obj2: 'b'},
      ]
    })
    expectNotToMatch(basis, {
      arr1: [
        {obj1: 'a'},
        {obj3: 'd'},
        {obj2: 'b'},
      ]
    })
  })
})
