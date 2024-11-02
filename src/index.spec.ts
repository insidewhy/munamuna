import { beforeEach, describe, expect, it, vi } from 'vitest'

import { automock, reset, returns, returnsSpy, spy } from './index'
import * as lib from './testing/lib'

import {
  classWithDeeplyNestedObjects,
  classWithMultipleDeeplyNestedObjects,
  functionReturningNumber,
  functionReturningNestedNumber,
} from './testing/main'

vi.mock('./testing/lib', () => ({}))

const libMock = automock(lib)

beforeEach(() => {
  libMock[reset]()
  vi.clearAllMocks()
})

describe('when used to mock module via vi.mock', () => {
  it('can mock the return value of a function', () => {
    libMock.returnNumber[returns] = 8
    expect(functionReturningNumber()).toEqual(8)
  })

  it('can mock the return value of a function and spy on it through its original reference', () => {
    const { returnNumber } = libMock
    returnNumber[returnsSpy] = 9
    expect(functionReturningNumber()).toEqual(9)
    // these are equivalent
    expect(returnNumber[spy]).toHaveBeenCalledOnce()
    expect(returnNumber[returnsSpy][spy]).toHaveBeenCalledOnce()
  })

  it('can mock the return value of a function and spy on it through a new reference', () => {
    libMock.returnNumber[returnsSpy] = 9
    expect(functionReturningNumber()).toEqual(9)
    // these are equivalent
    expect(libMock.returnNumber[spy]).toHaveBeenCalledOnce()
    expect(libMock.returnNumber[returnsSpy][spy]).toHaveBeenCalledOnce()
  })

  it('can reset a mock', () => {
    libMock.returnNumber[returnsSpy] = 472
    expect(functionReturningNumber()).toEqual(472)
    expect(libMock.returnNumber[spy]).toHaveBeenCalledOnce()

    libMock[reset]()
    expect(functionReturningNumber).toThrow()
  })

  it('can mock the return value of a function using mockReturnValue through its original reference', () => {
    const funSpy = libMock.returnNumber.mockReturnValue(72)
    expect(functionReturningNumber()).toEqual(72)
    expect(funSpy).toHaveBeenCalledOnce()
  })

  it('can mock the return value of a function using mockReturnValue through a new reference', () => {
    libMock.returnNumber.mockReturnValue(72)
    expect(functionReturningNumber()).toEqual(72)
    expect(libMock.returnNumber[spy]).toHaveBeenCalledOnce()
  })

  it('can mock the return value of a function twice and spy on both calls through its original reference', () => {
    const { returnNumber } = libMock
    returnNumber[returnsSpy] = 100
    expect(functionReturningNumber()).toEqual(100)
    expect(returnNumber[spy]).toHaveBeenCalledOnce()

    returnNumber[returnsSpy] = 101
    expect(functionReturningNumber()).toEqual(101)
    expect(returnNumber[spy]).toHaveBeenCalledTimes(2)
  })

  it('can mock the return value of a function twice and spy on both calls through a new reference', () => {
    libMock.returnNumber[returnsSpy] = 100
    expect(functionReturningNumber()).toEqual(100)
    expect(libMock.returnNumber[spy]).toHaveBeenCalledOnce()

    libMock.returnNumber[returnsSpy] = 101
    expect(functionReturningNumber()).toEqual(101)
    expect(libMock.returnNumber[spy]).toHaveBeenCalledTimes(2)
  })

  it('can mock the return value of a spy twice and spy on both calls through the original reference', () => {
    const { returnNumber } = libMock
    returnNumber[returnsSpy] = 100
    expect(functionReturningNumber()).toEqual(100)
    expect(returnNumber[spy]).toHaveBeenCalledOnce()

    returnNumber[returnsSpy] = 101
    expect(functionReturningNumber()).toEqual(101)
    expect(returnNumber[spy]).toHaveBeenCalledTimes(2)
  })

  it('can mock the return value of a function twice', () => {
    const { returnNumber } = libMock
    returnNumber[returns] = 900
    expect(functionReturningNumber()).toEqual(900)

    returnNumber[returns] = 901
    expect(functionReturningNumber()).toEqual(901)
  })

  it('can override value spies with both returnsSpy and mockReturnValue', () => {
    const { returnNumber } = libMock

    returnNumber[returnsSpy] = 36
    expect(functionReturningNumber()).toEqual(36)
    expect(returnNumber[spy]).toHaveBeenCalledOnce()

    const funSpy = returnNumber.mockReturnValue(37)
    expect(functionReturningNumber()).toEqual(37)
    expect(funSpy).toHaveBeenCalledTimes(2)

    returnNumber[returnsSpy] = 38
    expect(functionReturningNumber()).toEqual(38)
    expect(returnNumber[spy]).toHaveBeenCalledTimes(3)
  })

  it('can override value spies with both returnsSpy and mockReturnValue in a different order', () => {
    const { returnNumber } = libMock

    const funSpy1 = returnNumber.mockReturnValue(47)
    expect(functionReturningNumber()).toEqual(47)
    expect(funSpy1).toHaveBeenCalledOnce()

    returnNumber[returnsSpy] = 48
    expect(functionReturningNumber()).toEqual(48)
    expect(returnNumber[spy]).toHaveBeenCalledTimes(2)

    const funSpy2 = returnNumber.mockReturnValue(49)
    expect(functionReturningNumber()).toEqual(49)
    expect(funSpy2).toHaveBeenCalledTimes(3)
  })

  it('can mock the return of a nested function', () => {
    libMock.returnNestedNumber[returns].nested = 12
    expect(functionReturningNestedNumber().nested).toEqual(12)
  })

  it('can mock the return of a nested function twice through new references', () => {
    const fun1 = libMock.returnNestedNumber[returnsSpy]
    fun1.nested = 12
    expect(functionReturningNestedNumber().nested).toEqual(12)
    expect(fun1[spy]).toHaveBeenCalledOnce()

    const fun2 = libMock.returnNestedNumber[returnsSpy]
    fun2.nested = 13
    expect(functionReturningNestedNumber().nested).toEqual(13)
    expect(fun2[spy]).toHaveBeenCalledTimes(2)
  })

  it('can mock the return of a nested function twice through the original reference', () => {
    const fun = libMock.returnNestedNumber[returnsSpy]
    fun.nested = 94
    expect(functionReturningNestedNumber().nested).toEqual(94)
    expect(fun[spy]).toHaveBeenCalledOnce()

    fun.nested = 95
    expect(functionReturningNestedNumber().nested).toEqual(95)
    expect(fun[spy]).toHaveBeenCalledTimes(2)
  })

  it('can mock the return of a nested function twice with a reference above the [returnsSpy]', () => {
    const fun = libMock.returnNestedNumber
    fun[returnsSpy].nested = 202
    expect(functionReturningNestedNumber().nested).toEqual(202)
    // these are equivalent
    expect(fun[spy]).toHaveBeenCalledOnce()
    expect(fun[returnsSpy][spy]).toHaveBeenCalledOnce()

    fun[returnsSpy].nested = 203
    expect(functionReturningNestedNumber().nested).toEqual(203)
    // these are equivalent
    expect(fun[spy]).toHaveBeenCalledTimes(2)
    expect(fun[returnsSpy][spy]).toHaveBeenCalledTimes(2)
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

  it.skip('can upgrade a function generated by [returns] to a spy using [returnsSpy]', () => {
    const { returnNumber } = libMock
    returnNumber[returns] = 8
    expect(functionReturningNumber()).toEqual(8)

    returnNumber[returnsSpy] = 9
    expect(functionReturningNumber()).toEqual(9)
    // these are equivalent
    expect(returnNumber[spy]).toHaveBeenCalledOnce()
    expect(returnNumber[returnsSpy][spy]).toHaveBeenCalledOnce()
  })
})

it('can mock and update a property', () => {
  const mocked = {} as { value: number }
  const mock = automock(mocked)
  mock.value = 1
  expect(mocked).toEqual({ value: 1 })

  mock.value = 2
  expect(mocked).toEqual({ value: 2 })
})

it('can mock and update nested objects', () => {
  const mocked = {} as { above: { outer1: { inner: number }; outer2: { inner: number } } }
  const mock = automock(mocked)

  mock.above.outer1.inner = 30
  mock.above.outer2.inner = 40
  expect(mocked).toEqual({ above: { outer1: { inner: 30 }, outer2: { inner: 40 } } })

  mock.above.outer2.inner = 50
  expect(mocked).toEqual({ above: { outer1: { inner: 30 }, outer2: { inner: 50 } } })
})

it('can reset mocks partially', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mocked: any = {}
  const mock = automock(mocked)

  const funReturns = mock.fun[returns]
  funReturns.outer1.inner = 10
  funReturns.outer2.inner = 20

  expect(mocked.fun()).toEqual({ outer1: { inner: 10 }, outer2: { inner: 20 } })

  funReturns.outer2[reset]()
  expect(mocked.fun()).toEqual({ outer1: { inner: 10 } })
})

it('can mock top level function', () => {
  const mocked = {} as { fun: () => number }
  const mock = automock(mocked)
  mock.fun[returns] = 12
  expect(mocked.fun()).toEqual(12)
})

it('can mock top level function with a return path', () => {
  const mocked = {} as { fun: () => { inner: number } }
  const mock = automock(mocked)
  mock.fun[returns].inner = 12
  expect(mocked.fun()).toEqual({ inner: 12 })
})

it('can use the previous proxy to manipulate a function spy set with a value', () => {
  const mocked = {} as { fun: () => number }
  const mock = automock(mocked)

  const { fun } = mock
  fun[returnsSpy] = 14
  expect(mocked.fun()).toEqual(14)

  expect(fun[spy]).toHaveBeenCalled()
  // different way to access the same spy
  expect(mock.fun[spy]).toHaveBeenCalled()

  // using new reference to manipulate same function works
  mock.fun[returnsSpy] = 15
  expect(mocked.fun()).toEqual(15)
  expect(mock.fun[spy]).toHaveBeenCalledTimes(2)

  fun[returnsSpy] = 16
  expect(mocked.fun()).toEqual(16)
  // TODO: using the previous reference replaces the underlying mock
  expect(mock.fun[spy]).toHaveBeenCalledTimes(3)
  // expect(mock.fun[spy]).toHaveBeenCalledTimes(1) // wrong
  // expect(fun[spy]).toHaveBeenCalledTimes(2) // wrong

  // // TODO: and using the old reference switches it back again
  mock.fun[returnsSpy] = 17
  expect(mocked.fun()).toEqual(17)
  expect(mock.fun[spy]).toHaveBeenCalledTimes(4)
  // expect(mock.fun[spy]).toHaveBeenCalledTimes(2) // wrong
  // expect(fun[spy]).toHaveBeenCalledTimes(2) // wrong
})

it('can use the previous proxy reference to access a function spy set with a path', () => {
  const mocked = {} as { fun: () => { inner: number } }
  const mock = automock(mocked)

  const { fun } = mock
  fun[returnsSpy].inner = 24
  expect(mocked.fun()).toEqual({ inner: 24 })

  // these are all equivalent
  expect(fun[returnsSpy][spy]).toHaveBeenCalled()
  expect(fun[spy]).toHaveBeenCalled()
  expect(mock.fun[returnsSpy][spy]).toHaveBeenCalled()
  expect(mock.fun[spy]).toHaveBeenCalled()
})

it('can spy on a top level function using [returnsSpy]', () => {
  const mocked = {} as { fun: () => number }
  const { fun } = automock(mocked)
  fun[returnsSpy] = 12
  expect(mocked.fun()).toEqual(12)
  expect(fun[spy]).toHaveBeenCalled()
})

it('can spy on a top level function using mockReturnValue', () => {
  const mocked = {} as { fun: () => number }
  const { fun } = automock(mocked)
  const funSpy = fun.mockReturnValue(12)
  expect(mocked.fun()).toEqual(12)
  expect(funSpy).toHaveBeenCalled()
})

it('can spy on a top level function using mockReturnValueOnce', () => {
  const mocked = {} as { fun: () => number }
  const { fun } = automock(mocked)
  const funSpy = fun.mockReturnValueOnce(12)
  fun.mockReturnValueOnce(13)

  expect(mocked.fun()).toEqual(12)
  expect(funSpy).toHaveBeenCalled()
  expect(mocked.fun()).toEqual(13)
  expect(funSpy).toHaveBeenCalledTimes(2)
})

it('can spy on a top level function with a return path', () => {
  const mocked = {} as { fun: () => { inner: number } }
  const mock = automock(mocked)
  const fun = mock.fun[returnsSpy]
  fun.inner = 12
  expect(mocked.fun()).toEqual({ inner: 12 })
  expect(fun[spy]).toHaveBeenCalled()
})

it('can use a mixture of assignments and paths to modify a mock', () => {
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mocked: any = {}
  const mock = automock(mocked)
  mock.obj = { top: 2, nested: { inside: 3 } }
  expect(mocked).toEqual({ obj: { top: 2, nested: { inside: 3 } } })

  const { obj } = mock
  obj.nested.also = 16
  obj.alsoTop = 4
  expect(mocked).toEqual({ obj: { alsoTop: 4, top: 2, nested: { inside: 3, also: 16 } } })
})

it('can mock the return value of a function twice with a return path and spy on both calls', () => {
  const mocked = {} as { fun: () => { inner: number } }
  const mock = automock(mocked)

  const fun1 = mock.fun[returnsSpy]
  fun1.inner = 100
  expect(mocked.fun()).toEqual({ inner: 100 })
  expect(fun1[spy]).toHaveBeenCalledOnce()

  const fun2 = mock.fun[returnsSpy]
  fun2.inner = 101
  expect(mocked.fun()).toEqual({ inner: 101 })
  expect(fun2[spy]).toHaveBeenCalledTimes(2)
})

it('reuses cached object proxies', () => {
  const mocked = {} as {
    above: { inner: { value: number } }
    inside: { nested: { moreNested: { value: number } } }
  }
  const mock = automock(mocked)

  // not using toBe because vitest has issues dealing with certain proxies that lead to
  // infinite stack recursion
  expect(mock.above === mock.above).toEqual(true)
  expect(mock.inside.nested === mock.inside.nested).toEqual(true)
  expect(mock.inside.nested.moreNested === mock.inside.nested.moreNested).toEqual(true)
})
