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

it('can mock the return value of a function', () => {
  libMock.returnNumber[returns] = 8
  expect(functionReturningNumber()).toEqual(8)
})

it('can mock the return value of a function and spy on it', () => {
  libMock.returnNumber[returnsSpy] = 9
  expect(functionReturningNumber()).toEqual(9)
  expect(libMock.returnNumber[spy]).toHaveBeenCalledOnce()
})

it('can mock the return value of a function using mockReturnValue', () => {
  const funSpy = libMock.returnNumber.mockReturnValue(72)
  expect(functionReturningNumber()).toEqual(72)
  expect(funSpy).toHaveBeenCalledOnce()
})

it('can mock the return value of a function twice and spy on both calls', () => {
  libMock.returnNumber[returnsSpy] = 100
  expect(functionReturningNumber()).toEqual(100)
  expect(libMock.returnNumber[spy]).toHaveBeenCalledOnce()

  libMock.returnNumber[returnsSpy] = 101
  expect(functionReturningNumber()).toEqual(101)
  expect(libMock.returnNumber[spy]).toHaveBeenCalledTimes(2)
})

it('can override spies with both returnsSpy and mockReturnValue', () => {
  // TODO: consider allowing this to preserve the number of calls
  libMock.returnNumber[returnsSpy] = 36
  expect(functionReturningNumber()).toEqual(36)
  expect(libMock.returnNumber[spy]).toHaveBeenCalledOnce()

  const funSpy = libMock.returnNumber.mockReturnValue(37)
  expect(functionReturningNumber()).toEqual(37)
  expect(funSpy).toHaveBeenCalledOnce()

  libMock.returnNumber[returnsSpy] = 38
  expect(functionReturningNumber()).toEqual(38)
  expect(libMock.returnNumber[spy]).toHaveBeenCalledOnce()
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
