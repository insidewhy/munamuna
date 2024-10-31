import { beforeEach, expect, it, vi } from 'vitest'

import * as lib from './testing/lib'

import { classWithDeeplyNestedObjects, classWithMultipleDeeplyNestedObjects } from './testing/main'

const { automock, returns, returnsSpy, spy } = await vi.hoisted(() => import('./index'))

vi.mock('./testing/lib', () => ({}))

const libMock = automock(lib)

beforeEach(() => {
  vi.clearAllMocks()
})

it('can mock nested properties within deeply nested function with a spy', () => {
  const getStuff = libMock.DeeplyNestedObjects[returns].outer.inner.getStuff[returnsSpy]
  getStuff.deep.veryDeep = 16
  expect(classWithDeeplyNestedObjects()).toEqual(16)
  expect(getStuff[spy]).toHaveBeenCalledWith(12)
})

it('can mock multiple nested properties within deeply nested function with a spy', () => {
  const getStuff = libMock.MultipleDeeplyNestedObjects[returns].outer.inner.getStuff[returnsSpy]
  const { deep } = getStuff
  deep.veryDeep = 16
  deep.alsoVeryDeep = 17
  expect(classWithMultipleDeeplyNestedObjects()).toEqual([16, 17])
  expect(getStuff[spy]).toHaveBeenCalledWith(12)
})
