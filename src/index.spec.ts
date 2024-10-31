import { beforeEach, expect, it, vi } from 'vitest'

import * as lib from './testing/lib'

import {
  classWithDeeplyNestedObjects,
  classWithMultipleDeeplyNestedObjects,
  functionReturningNumber,
  functionReturningNestedNumber,
} from './testing/main'

const { automock, returns, returnsSpy, spy } = await vi.hoisted(() => import('./index'))

vi.mock('./testing/lib', () => ({}))

const libMock = automock(lib)

beforeEach(() => {
  vi.clearAllMocks()
})

it.skip('can mock the return of a function', () => {
  libMock.returnNumber[returns] = 8
  console.log(lib.returnNumber)
  expect(functionReturningNumber()).toEqual(8)
})

it('can mock the return of a nested function', () => {
  libMock.returnNestedNumber[returns].nested = 12
  expect(functionReturningNestedNumber().nested).toEqual(12)
})

it('can mock the return of a nested function twice', () => {
  const fun1 = libMock.returnNestedNumber[returnsSpy]
  fun1.nested = 12
  expect(functionReturningNestedNumber().nested).toEqual(12)
  expect(fun1[spy]).toHaveBeenCalled()

  const fun2 = libMock.returnNestedNumber[returnsSpy]
  fun2.nested = 13
  expect(functionReturningNestedNumber().nested).toEqual(13)
  expect(fun2[spy]).toHaveBeenCalled()
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
