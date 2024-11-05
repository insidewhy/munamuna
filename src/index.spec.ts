import { beforeEach, describe, expect, it, vi } from 'vitest'

import { detach, munamuna, reattach, reset, returns, returnsSpy, set, spy } from './index'
import * as lib from './testing/lib'

import {
  classWithDeeplyNestedObjects,
  classWithMultipleDeeplyNestedObjects,
  functionReturningNumber,
  functionReturningNestedNumber,
} from './testing/main'

vi.mock('./testing/lib', () => ({}))

it('can create a deeply nested path with a multi-level path expression', () => {
  const mocked = {} as { outer: { inner: { innerMost: number } } }
  munamuna(mocked).outer.inner.innerMost = 7
  expect(mocked).toEqual({ outer: { inner: { innerMost: 7 } } })
})

it('can create multiple nested paths with path assignment', () => {
  type Nested = { outer: { inner: number } }
  const mocked = {} as { value1: Nested; value2: Nested }
  const { value1, value2 } = munamuna(mocked)
  value1.outer.inner = 12
  value2.outer.inner = 13
  expect(mocked).toEqual({ value1: { outer: { inner: 12 } }, value2: { outer: { inner: 13 } } })
})

it('can mock and update a primitive', () => {
  const mocked = {} as { value: number }
  const mock = munamuna(mocked)
  mock.value = 1
  expect(mocked).toEqual({ value: 1 })

  mock.value = 2
  expect(mocked).toEqual({ value: 2 })
})

it('can mock and update nested objects using new references', () => {
  const mocked = {} as { above: { outer1: { inner: number }; outer2: { inner: number } } }
  const mock = munamuna(mocked)

  mock.above.outer1.inner = 30
  mock.above.outer2.inner = 40
  expect(mocked).toEqual({ above: { outer1: { inner: 30 }, outer2: { inner: 40 } } })

  mock.above.outer2.inner = 50
  expect(mocked).toEqual({ above: { outer1: { inner: 30 }, outer2: { inner: 50 } } })
})

it('can detach subobject through an existing reference then detach the parent through an existing reference', () => {
  const mocked = {} as { value: { inner: string } }
  const mock = munamuna(mocked)

  const { value } = mock
  const { inner } = value
  value.inner = 'merry'
  expect(mocked).toEqual({ value: { inner: 'merry' } })

  inner[detach]()
  expect(mocked).toEqual({ value: {} })

  value[detach]()
  expect(mocked).toEqual({})
})

it('reuses cached object proxies', () => {
  const mocked = {} as {
    above: { inner: { value: number } }
    inside: { nested: { moreNested: { value: number } } }
  }
  const mock = munamuna(mocked)

  // not using toBe because vitest has issues dealing with certain proxies that lead to
  // infinite stack recursion
  expect(mock.above === mock.above).toEqual(true)
  expect(mock.inside.nested === mock.inside.nested).toEqual(true)
  expect(mock.inside.nested.moreNested === mock.inside.nested.moreNested).toEqual(true)
})

it('cannot alter a value by assigning directly to it', () => {
  const mocked = {} as { value: number }
  let { value } = munamuna(mocked)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  value = 5
  expect(mocked).not.toEqual({ value: 5 })
})

it('can assign a primitive value then use a path assignment from a new reference', () => {
  const mocked = {} as { outer: { inner: number } | number }
  const mock = munamuna(mocked)
  mock.outer = 6
  expect(mocked).toEqual({ outer: 6 })
  mock.outer.inner = 5
  expect(mocked).toEqual({ outer: { inner: 5 } })
})

it('can assign a primitive value then use a nested path assignment from a new reference', () => {
  const mocked = {} as { outer: { inner: { innerMost: number } } | number }
  const mock = munamuna(mocked)
  mock.outer = 6
  expect(mocked).toEqual({ outer: 6 })
  mock.outer.inner.innerMost = 5
  expect(mocked).toEqual({ outer: { inner: { innerMost: 5 } } })
})

describe('function', () => {
  it('returning a primitive can be created by assigning to [returns]', () => {
    const mocked = {} as { fun: () => number }
    const mock = munamuna(mocked)
    mock.fun[returns] = 12
    expect(mocked.fun()).toEqual(12)
  })

  it('returning an object can be created with a path assignment on [returns]', () => {
    const mocked = {} as { fun: () => { inner: number } }
    const mock = munamuna(mocked)
    mock.fun[returns].inner = 12
    expect(mocked.fun()).toEqual({ inner: 12 })
  })

  describe('return data can be empied can be reset with [reset]', () => {
    it('on the top level path of a return path', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mocked: any = {}
      const mock = munamuna(mocked)

      const funReturns = mock.fun[returns]
      funReturns.outer1.inner = 10
      funReturns.outer2.inner = 20
      expect(mocked.fun()).toEqual({ outer1: { inner: 10 }, outer2: { inner: 20 } })

      // funReturns.outer2[detach]() could be used to remove `outer2: {}`
      funReturns.outer2[reset]()
      expect(mocked.fun()).toEqual({ outer1: { inner: 10 }, outer2: {} })
    })

    it('on the function itself to have the function return an empty object', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mocked: any = {}
      const mock = munamuna(mocked)

      const funReturns = mock.fun[returns]
      funReturns.outer1.inner = 10
      funReturns.outer2.inner = 20
      expect(mocked.fun()).toEqual({ outer1: { inner: 10 }, outer2: { inner: 20 } })

      funReturns[reset]()
      expect(mocked.fun()).toEqual({})
    })
  })

  describe('returned objects can be detached with [detach]', () => {
    it('from the top level of a nested return object on a new reference', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mocked: any = {}
      const mock = munamuna(mocked)

      const funReturns = mock.fun[returns]
      funReturns.outer1.inner = 10
      funReturns.outer2.inner = 20
      expect(mocked.fun()).toEqual({ outer1: { inner: 10 }, outer2: { inner: 20 } })

      funReturns.outer2[detach]()
      expect(mocked.fun()).toEqual({ outer1: { inner: 10 } })
    })

    it('and reattached with [reattach] from a new reference', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mocked: any = {}
      const mock = munamuna(mocked)

      const funReturns = mock.fun[returns]
      funReturns.outer1.inner = 10
      funReturns.outer2.inner = 20
      expect(mocked.fun()).toEqual({ outer1: { inner: 10 }, outer2: { inner: 20 } })

      const detached = funReturns.outer2[detach]()
      expect(mocked.fun()).toEqual({ outer1: { inner: 10 } })

      detached[reattach]()
      expect(mocked.fun()).toEqual({ outer1: { inner: 10 }, outer2: { inner: 20 } })
    })

    it('and reattached with [reattach] from an existing reference', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mocked: any = {}
      const mock = munamuna(mocked)

      const { outer1, outer2 } = mock.fun[returns]
      outer1.inner = 10
      outer2.inner = 20
      expect(mocked.fun()).toEqual({ outer1: { inner: 10 }, outer2: { inner: 20 } })

      outer2[detach]()
      expect(mocked.fun()).toEqual({ outer1: { inner: 10 } })

      outer2[reattach]()
      expect(mocked.fun()).toEqual({ outer1: { inner: 10 }, outer2: { inner: 20 } })
    })
  })
})

describe('spy', () => {
  it('can be created with a primitive return value by assigning it to [returnsSpy]', () => {
    const mocked = {} as { fun: () => number }
    const { fun } = munamuna(mocked)
    fun[returnsSpy] = 12
    expect(mocked.fun()).toEqual(12)
    expect(fun[spy]).toHaveBeenCalled()
  })

  it('can be created using mockReturnValue', () => {
    const mocked = {} as { fun: () => number }
    const { fun } = munamuna(mocked)
    const funSpy = fun.mockReturnValue(12)
    expect(mocked.fun()).toEqual(12)
    expect(funSpy).toHaveBeenCalled()
  })

  it('can be created using mockReturnValueOnce', () => {
    const mocked = {} as { fun: () => number }
    const { fun } = munamuna(mocked)
    const funSpy = fun.mockReturnValueOnce(12)
    fun.mockReturnValueOnce(13)

    expect(mocked.fun()).toEqual(12)
    expect(funSpy).toHaveBeenCalled()
    expect(mocked.fun()).toEqual(13)
    expect(fun[spy]).toHaveBeenCalledTimes(2)
  })

  it('can be created with returns a nested object using a path expression on [returnsSpy]', () => {
    const mocked = {} as { fun: () => { outer: { inner: number } } }
    const mock = munamuna(mocked)
    const fun = mock.fun[returnsSpy]
    fun.outer.inner = 12
    expect(mocked.fun()).toEqual({ outer: { inner: 12 } })
    expect(fun[spy]).toHaveBeenCalled()
  })

  it('can be created which returns a nested object using a path expression on a function call return value', () => {
    const mocked = {} as { fun: () => { outer: { inner: number } } }
    const mock = munamuna(mocked)
    const { fun } = mock
    fun().outer.inner = 12
    expect(mocked.fun()).toEqual({ outer: { inner: 12 } })
    expect(fun[spy]).toHaveBeenCalled()
  })

  it('returning a nested object can be created then overwritten using path assignment on new references without recreating the spy', () => {
    const mocked = {} as { fun: () => { inner: number } }
    const mock = munamuna(mocked)

    const fun1 = mock.fun[returnsSpy]
    fun1.inner = 100
    expect(mocked.fun()).toEqual({ inner: 100 })
    expect(fun1[spy]).toHaveBeenCalledOnce()

    const fun2 = mock.fun[returnsSpy]
    fun2.inner = 101
    expect(mocked.fun()).toEqual({ inner: 101 })
    expect(fun2[spy]).toHaveBeenCalledTimes(2)
  })

  it('returning undefined can be created using [spy] without [returnsSpy] or a function call', () => {
    const mocked = {} as { fun: () => void }
    const fun = munamuna(mocked).fun[spy]

    mocked.fun()
    expect(fun).toHaveBeenCalled()
  })

  it('can be created by assigning a primitive to [returnsSpy] then updated with new primitive assignments on new and existing references without recreating teh spy', () => {
    const mocked = {} as { fun: () => number }
    const mock = munamuna(mocked)

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
    expect(mock.fun[spy]).toHaveBeenCalledTimes(3)

    mock.fun[returnsSpy] = 17
    expect(mocked.fun()).toEqual(17)
    expect(mock.fun[spy]).toHaveBeenCalledTimes(4)
  })

  it('which returns a primitive can be accessed using [spy] on new and preexisting references', () => {
    const mocked = {} as { fun: () => { inner: number } }
    const mock = munamuna(mocked)

    const { fun } = mock
    fun[returnsSpy].inner = 24
    expect(mocked.fun()).toEqual({ inner: 24 })

    // these are all equivalent
    expect(fun[returnsSpy][spy]).toHaveBeenCalled()
    expect(fun[spy]).toHaveBeenCalled()
    expect(mock.fun[returnsSpy][spy]).toHaveBeenCalled()
    expect(mock.fun[spy]).toHaveBeenCalled()
  })

  it('which returns a nested object can be accessed using [spy] on new and preexisting references', () => {
    const mocked = {} as { fun: () => { inner: number } }
    const mock = munamuna(mocked)

    const { fun } = mock
    fun().inner = 24
    expect(mocked.fun()).toEqual({ inner: 24 })

    // these are all equivalent
    expect(fun()[spy]).toHaveBeenCalled()
    expect(fun[spy]).toHaveBeenCalled()
    expect(mock.fun()[spy]).toHaveBeenCalled()
    expect(mock.fun[spy]).toHaveBeenCalled()
  })
})

describe('[set]', () => {
  it('can be used to alter an existing target', () => {
    const mocked = {} as { value: number }
    const { value } = munamuna(mocked)
    value[set] = 5
    expect(mocked).toEqual({ value: 5 })
  })

  it('can be used with destructuring syntax to alter multiple paths', () => {
    const mocked = {} as { value: number; outer: { inner: number } }
    const { value, outer } = munamuna(mocked)
    value[set] = 6
    outer.inner = 7
    expect(mocked).toEqual({ value: 6, outer: { inner: 7 } })
  })

  it('can be used to alter an existing object using a path', () => {
    const mocked = {} as { outer: { inner: number } }
    const { outer } = munamuna(mocked)
    outer[set].inner = 5
    expect(mocked).toEqual({ outer: { inner: 5 } })
  })

  it('can be used to alter an existing object using a path', () => {
    const mocked = {} as { outer: { inner: number } }
    const { outer } = munamuna(mocked)
    outer[set].inner = 5
    expect(mocked).toEqual({ outer: { inner: 5 } })
  })

  it('detaches preexisting proxies from the tree when used to assign a primitive', () => {
    const mocked = {} as { outer: { inner: number } | number }
    const { outer } = munamuna(mocked)
    outer[set] = 6
    expect(mocked).toEqual({ outer: 6 })
    outer.inner = 5
    expect(mocked).not.toEqual({ outer: { inner: 5 } })
  })

  it('can be used to create a primitive value then altered with a path assignment from a new reference', () => {
    const mocked = {} as { outer: { inner: number } | number }
    const mock = munamuna(mocked)
    const { outer } = mock
    outer[set] = 6
    expect(mocked).toEqual({ outer: 6 })
    mock.outer.inner = 5
    expect(mocked).toEqual({ outer: { inner: 5 } })
  })

  it('can be used to overwrite an object then altered with a path assignment from a preexisting reference', () => {
    const mocked = {} as { outer: { first: number; second?: number } }
    const { outer } = munamuna(mocked)

    // this doesn't affect whether the test passes but shows that `[set]` can be used to
    // remove existing properties
    outer.second = 12
    outer[set] = { first: 5 }
    expect(mocked).toEqual({ outer: { first: 5 } })

    outer.second = 292
    expect(mocked).toEqual({ outer: { first: 5, second: 292 } })
  })

  it('can be used to alter a property multiple times', () => {
    const mocked = {} as { value: number }
    const { value } = munamuna(mocked)
    value[set] = 5
    expect(mocked).toEqual({ value: 5 })
    value[set] = 6
    expect(mocked).toEqual({ value: 6 })
  })
})

describe('mocked array', () => {
  it('can be created using a numeric index', () => {
    const mocked = {} as { value: number[] }
    const mock = munamuna(mocked)
    mock.value[0] = 12
    expect(mocked).toEqual({ value: [12] })
  })

  it('can be created containing a nested object using a path expression after an integral index', () => {
    const mocked = {} as { value: Array<{ outer: { inner: string } }> }
    const mock = munamuna(mocked)
    mock.value[0].outer.inner = 'the funs'
    expect(mocked).toEqual({ value: [{ outer: { inner: 'the funs' } }] })
  })

  it('can be created containing a nested object using a path expression after an array assignment', () => {
    const mocked = {} as { value: Array<{ outer: { inner: string } }> }
    const mock = munamuna(mocked)
    mock.value = [{ outer: { inner: 'small cheese' } }]
    mock.value[1].outer.inner = 'big cheese'
    expect(mocked).toEqual({
      value: [{ outer: { inner: 'small cheese' } }, { outer: { inner: 'big cheese' } }],
    })
  })

  it('can be created containing with nested arrays using consecutive integral indexes', () => {
    const mocked = {} as { value: Array<Array<{ inner: string }>> }
    const mock = munamuna(mocked)
    mock.value[0][0].inner = 'your cat'
    expect(mocked).toEqual({ value: [[{ inner: 'your cat' }]] })
  })

  it('can be created using a integral index then updated through a new reference', () => {
    const mocked = {} as { value: number[] }
    const mock = munamuna(mocked)
    mock.value[1] = 12
    expect(mocked).toEqual({ value: [undefined, 12] })

    mock.value[0] = 11
    expect(mocked).toEqual({ value: [11, 12] })
  })

  it('can be created using a integral index then updated through an integral index on an existing reference', () => {
    const mocked = {} as { value: number[] }
    const { value } = munamuna(mocked)
    value[1] = 14
    expect(mocked).toEqual({ value: [undefined, 14] })

    value[0] = 13
    expect(mocked).toEqual({ value: [13, 14] })
  })

  it('can be assigned twice through new references', () => {
    const mocked = {} as { value: number[] }
    const mock = munamuna(mocked)
    mock.value = [14]
    expect(mocked).toEqual({ value: [14] })

    mock.value[1] = 13
    expect(mocked).toEqual({ value: [14, 13] })
  })

  it('can be updated through an integral index on an existing reference after an assignment', () => {
    const mocked = {} as { value: number[] }
    const mock = munamuna(mocked)
    const { value } = mock
    mock.value = [14]
    expect(mocked).toEqual({ value: [14] })

    // a new array will be created
    value[1] = 13
    expect(mocked).toEqual({ value: [14, 13] })

    value[2] = 11
    expect(mocked).toEqual({ value: [14, 13, 11] })
  })

  it('can be overwritten after assignment by an object using a path assignment on a new object', () => {
    const mocked = {} as { value: number[] | { inner: number } }
    const mock = munamuna(mocked)
    mock.value = [14]
    expect(mocked).toEqual({ value: [14] })

    mock.value.inner = 'merry'
    expect(mocked).toEqual({ value: { inner: 'merry' } })

    mock.value.inner = 'holiday'
    expect(mocked).toEqual({ value: { inner: 'holiday' } })
  })

  it('can be overwritten after creation with an integral index by using a path assignment on a new reference', () => {
    const mocked = {} as { value: number[] | { inner: string } }
    const mock = munamuna(mocked)
    mock.value[1] = 12
    expect(mocked).toEqual({ value: [undefined, 12] })

    mock.value.inner = 'hi'
    expect(mocked).toEqual({ value: { inner: 'hi' } })

    mock.value.inner = 'ho'
    expect(mocked).toEqual({ value: { inner: 'ho' } })
  })

  it('can be overwritten by an object via a path assignment then a primitive assignment on new references after creation with an integral index', () => {
    const mocked = {} as { value: number[] | { inner: number } | number }
    const mock = munamuna(mocked)
    mock.value = [14]
    expect(mocked).toEqual({ value: [14] })

    mock.value.inner = 'merry'
    expect(mocked).toEqual({ value: { inner: 'merry' } })

    mock.value = 6
    expect(mocked).toEqual({ value: 6 })
  })

  it('can be overwritten by a path assignment which can be detached after creation with an assignment', () => {
    const mocked = {} as { value: number[] | { inner: string } }
    const mock = munamuna(mocked)
    mock.value = [14]
    expect(mocked).toEqual({ value: [14] })

    mock.value.inner = 'merry'
    expect(mocked).toEqual({ value: { inner: 'merry' } })

    mock.value.inner[detach]()
    expect(mocked).toEqual({ value: {} })

    mock.value[detach]()
    expect(mocked).toEqual({})
  })

  it('can be overwritten by a path assignment which can be detached using existing references after creation with an assignment', () => {
    const mocked = {} as { value: number[] | { inner: string } }
    const mock = munamuna(mocked)
    mock.value = [14]
    expect(mocked).toEqual({ value: [14] })

    const { value } = mock
    value.inner = 'merry'
    expect(mocked).toEqual({ value: { inner: 'merry' } })

    value.inner[detach]()
    expect(mocked).toEqual({ value: {} })

    value[detach]()
    expect(mocked).toEqual({})
  })

  it('can be overwritten after assignment using [set] on a new reference', () => {
    const mocked = {} as { value: number[] | { inner: string } }
    const mock = munamuna(mocked)
    mock.value = [14]
    expect(mocked).toEqual({ value: [14] })

    const { inner } = mock.value
    inner[set] = 'merry'
    expect(mocked).toEqual({ value: { inner: 'merry' } })
  })

  it('via assignment can overwrite an object created with a path expression, which can then by overwritten by another object via a new path assignment all on new references', () => {
    const mocked = {} as { value: number[] | { inner: string } }
    const mock = munamuna(mocked)

    mock.value.inner = 'hoho'
    mock.value = [14]
    expect(mocked).toEqual({ value: [14] })

    mock.value.inner = 'merry'
    expect(mocked).toEqual({ value: { inner: 'merry' } })
  })

  it('created by assignment can be overwritten by assignment of an object', () => {
    const mocked = {} as { value: number[] | { inner: string } }
    const mock = munamuna(mocked)
    mock.value = [141]
    expect(mocked).toEqual({ value: [141] })

    mock.value = { inner: 'tots' }
    expect(mocked).toEqual({ value: { inner: 'tots' } })
  })

  it('can overwrite an object created by assignment using array assignment on a new reference', () => {
    const mocked = {} as { value: number[] | { inner: string } }
    const mock = munamuna(mocked)

    mock.value = { inner: 'tots' }
    expect(mocked).toEqual({ value: { inner: 'tots' } })

    mock.value = [141]
    expect(mocked).toEqual({ value: [141] })
  })

  it('can be assigned via [set] then overwritten by an object via [set] on the same reference', () => {
    const mocked = {} as { value: number[] | { inner: string } }
    const mock = munamuna(mocked)
    const { value } = mock
    value[set] = [141]
    expect(mocked).toEqual({ value: [141] })

    value[set] = { inner: 'tots' }
    expect(mocked).toEqual({ value: { inner: 'tots' } })
  })

  it('can be assigned via [set] then overwritten by an object via [set] on a new reference', () => {
    const mocked = {} as { value: number[] | { inner: string } }
    const mock = munamuna(mocked)
    const { value } = mock
    value[set] = [141]
    expect(mocked).toEqual({ value: [141] })

    mock.value[set] = { inner: 'tots' }
    expect(mocked).toEqual({ value: { inner: 'tots' } })
  })

  it('can overwrite an object created using [set] by using an array assignment on the same reference with [set]', () => {
    const mocked = {} as { value: number[] | { inner: string } }
    const mock = munamuna(mocked)
    const { value } = mock

    value[set] = { inner: 'tots' }
    expect(mocked).toEqual({ value: { inner: 'tots' } })

    value[set] = [141]
    expect(mocked).toEqual({ value: [141] })
  })

  it('can be assigned with [set] then updated using an integral assignment on the same reference', () => {
    const mocked = {} as { value: number[] | { inner: string } }
    const mock = munamuna(mocked)
    const { value } = mock

    value[set] = [141]
    expect(mocked).toEqual({ value: [141] })

    value[1] = 2
    expect(mocked).toEqual({ value: [141, 2] })
  })

  it('can be assigned with [set] then updated using an integral assignment on a new reference', () => {
    const mocked = {} as { value: number[] | { inner: string } }
    const mock = munamuna(mocked)
    const { value } = mock

    value[set] = [141]
    expect(mocked).toEqual({ value: [141] })

    mock.value[1] = 2
    expect(mocked).toEqual({ value: [141, 2] })
  })
})

describe('a preexisting reference', () => {
  it('cannot alter mocked data after assigning a primitive value using a path assignment', () => {
    const mocked = {} as { value: { inner: number } | number }
    const mock = munamuna(mocked)
    const { value } = mock
    mock.value = 6
    expect(mocked).toEqual({ value: 6 })
    value.inner = 5
    expect(mocked).not.toEqual({ value: { inner: 5 } })
  })

  it('can alter mocked data using a path assignment after an object assignment', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mocked: any = {}
    const mock = munamuna(mocked)
    const { obj } = mock
    mock.obj = { top: 2, nested: { inside: 3 } }
    expect(mocked).toEqual({ obj: { top: 2, nested: { inside: 3 } } })

    obj.nested.also = 16
    obj.alsoTop = 4
    expect(mocked).toEqual({ obj: { alsoTop: 4, top: 2, nested: { inside: 3, also: 16 } } })
  })

  it('can be reattached using [reattach] and have a path assignment modify a path that was assigned a primitive', () => {
    const mocked = {} as { outer: { inner: number } | number }
    const mock = munamuna(mocked)
    const { outer } = mock
    outer.inner = 5

    mock.outer = 6
    expect(mocked).toEqual({ outer: 6 })

    outer[reattach]()
    expect(mocked).toEqual({ outer: { inner: 5 } })

    outer.inner = 7
    expect(mocked).toEqual({ outer: { inner: 7 } })
  })
})

describe('when used to mock module via vi.mock', () => {
  const libMock = munamuna(lib)

  beforeEach(() => {
    libMock[reset]()
  })

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

  it('can mock the return of a nested function twice via [returnsSpy] with new references', () => {
    const fun1 = libMock.returnNestedNumber[returnsSpy]
    fun1.nested = 12
    expect(functionReturningNestedNumber().nested).toEqual(12)
    expect(fun1[spy]).toHaveBeenCalledOnce()

    const fun2 = libMock.returnNestedNumber[returnsSpy]
    fun2.nested = 13
    expect(functionReturningNestedNumber().nested).toEqual(13)
    expect(fun2[spy]).toHaveBeenCalledTimes(2)
  })

  it('can mock the return of a nested function twice via [returnsSpy] with the original reference', () => {
    const fun = libMock.returnNestedNumber[returnsSpy]
    fun.nested = 94
    expect(functionReturningNestedNumber().nested).toEqual(94)
    expect(fun[spy]).toHaveBeenCalledOnce()

    fun.nested = 95
    expect(functionReturningNestedNumber().nested).toEqual(95)
    expect(fun[spy]).toHaveBeenCalledTimes(2)
  })

  it('can mock the return of a nested function twice via call syntax with new references', () => {
    const fun1 = libMock.returnNestedNumber()
    fun1.nested = 12
    expect(functionReturningNestedNumber().nested).toEqual(12)
    expect(fun1[spy]).toHaveBeenCalledOnce()

    const fun2 = libMock.returnNestedNumber()
    fun2.nested = 13
    expect(functionReturningNestedNumber().nested).toEqual(13)
    expect(fun2[spy]).toHaveBeenCalledTimes(2)
  })

  it('can mock the return of a nested function twice via call syntax with the original reference', () => {
    const fun = libMock.returnNestedNumber()
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

  it('can mock the return of a nested function twice with a reference above the call', () => {
    const fun = libMock.returnNestedNumber
    fun().nested = 202
    expect(functionReturningNestedNumber().nested).toEqual(202)
    // these are equivalent
    expect(fun[spy]).toHaveBeenCalledOnce()
    expect(fun()[spy]).toHaveBeenCalledOnce()

    fun().nested = 203
    expect(functionReturningNestedNumber().nested).toEqual(203)
    // these are equivalent
    expect(fun[spy]).toHaveBeenCalledTimes(2)
    expect(fun()[spy]).toHaveBeenCalledTimes(2)
  })

  it('can mock nested properties within deeply nested function with a spy via [returnsSpy]', () => {
    const getStuff = libMock.DeeplyNestedObjects[returns].outer.inner.getStuff[returnsSpy]
    getStuff.deep.veryDeep = 16
    expect(classWithDeeplyNestedObjects()).toEqual(16)
    expect(getStuff[spy]).toHaveBeenCalledWith(12)
  })

  it('can mock nested properties within deeply nested function with a spy via call syntax', () => {
    const getStuff = libMock.DeeplyNestedObjects[returns].outer.inner.getStuff()
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
