# munamuna

[![tests](https://github.com/insidewhy/munamuna/actions/workflows/test.yaml/badge.svg)](https://github.com/insidewhy/munamuna/actions/workflows/test.yaml)

Build mocks and spies so much more easily and with typescript assisted autocomplete.

Integrates well with [vitest](https://vitest.dev/), [jest](https://jestjs.io/) and others.

Inspired by [python's MagicMock](https://docs.python.org/3/library/unittest.mock.html#unittest.mock.MagicMock).

## Installation

```sh
pnpm install -D munamuna
```

## Motivating example

Consider the following typical use of the `@octokit/rest` library which can append text to the body of a github issue:

```typescript
// index.ts
import { Octokit } from '@octokit/rest'

export interface IssueDetails {
  owner: string
  repo: string
  issue_number: number
  body?: string
}

export function appendToIssueBody(req: IssueDetails, toAppend: string): string {
  const client = new Octokit({ auth: 'auth token' })
  const issue = await client.issues.get({ owner, repo, issue_number })
  await client.issues.update({
    owner,
    repo,
    issue_number,
    body: `${issue.data.body} ${toAppend}`,
  })
}
```

There are multiple layers of nesting here which can make it a little tricky to mock.

An typical test for this with mocking would probably look like:

```typescript
// index.spec.ts
import * as octokitRest from '@octokit/rest'

import { appendToIssueBody } from './index'

vi.mock('@octokit/rest')

it('can append to body of github ticket', async () => {
  const get = vi.fn().mockReturnValue({
    data: {
      body: 'some text',
    },
  })
  const updateMock = vi.fn()
  vi.mocked(octokitRest).Octokit.mockImplementation(() => {
    return {
      issues: {
        get,
        update,
      },
    } as unknown as Octokit
  })

  await appendToIssueBody({ owner: 'son', repo: 'me', issue_number: 15 }, 'appended')
  expect(get).toHaveBeenCalledOnce()
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ body: `some text appended` }))
})
```

The type cast, which is necessary because the mock provides part of the implementation, also removes all type safety from the mock definition.
There are many ways to work around this with different trade-offs but each of them involve boiler plate which much be repeated at the site of every mock definition.

With `munamuna` this becomes easier:

```typescript
// index.spec.ts
import * as octokitRest from '@octokit/rest'
import { expect, it, vi } from 'vitest'
import { munamuna, returns, returnsSpy, spy } from 'munamuna'

import { appendToIssueBody } from './index'

vi.mock('@octokit/rest', () => ({}))

it('can append to body of github ticket', async () => {
  const { issues } = munamuna(octokitRest).Octokit[returns]
  issues.get().data.body = 'some text'
  const update = issues.update[spy]

  await appendToIssueBody({ owner: 'son', repo: 'me', issue_number: 15 }, 'appended')
  expect(issues.get[spy]).toHaveBeenCalledOnce()
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ body: `some text appended` }))
})
```

The setup has been reduced from 14 lines to 3 lines, the entire test function is now 6 lines instead of 17.
Values returned from mock are also type checked according to the structure of the object being mocked and autocomplete can be used to assist with creating the mock.

This test shows how to mock functions:

- `returns` can be used to mock function or constructor return values without creating a spy.
- Nested path expressions can be used to create mock data at corresponding paths within a mocked object.
- A function call can be used to create a spy function (e.g. `vi.fn`) and the return value can be used to mock the return value of the mock function.
- `spy` can be used to access a spy created by `munamuna`, creating the spy if none exists.

There are other advantages, by default `vi.mock` will create a `vi.fn` for every top-level export in the mocked module which can involve creating a lot of objects that may never be needed.
These must be tracked by `vitest` and reset on every call to `vi.clearAllMocks`.
Again it's possible to work around this, at the cost of more code.
`munamuna` creates spies on demand whenever `[returnsSpy]`, `[spy]` or a function call are used.

## Tutorial

### Setup to work with vitest

```typescript
// vite.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['setup-vitest.ts'],
  },
})
```

```typescript
// setup-vitest.ts
import { setup } from 'munamuna'
import { vi } from 'vitest'

setup({ spyFunction: vi.fn })
```

### Creating deeply nested paths

Path assignment can easily be used to create a nested object:

```typescript
it('can create a deeply nested path', () => {
  const mocked = {} as { outer: { inner: { innerMost: number } } }
  munamuna(mocked).outer.inner.innerMost = 7
  expect(mocked).toEqual({ outer: { inner: { innerMost: 7 } } })
})
```

Destructuring assignment can be used to assign to multiple nested objects:

```typescript
it('can create multiple nested paths with path assignment', () => {
  type Nested = { outer: { inner: number } }
  const mocked = {} as { value1: Nested; value2: Nested }
  const { value1, value2 } = munamuna(mocked)
  value1.outer.inner = 12
  value2.outer.inner = 13
  expect(mocked).toEqual({ value1: { outer: { inner: 12 } }, value2: { outer: { inner: 13 } } })
})
```

### Mixing mock styles

It's possible to use a combination of object assignment and path assignment to modify and update mocks to allow the best syntax to be freely mixed depending on the case:

```typescript
it('can use an assignment followed by a path assignment', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mocked: any = {}
  const mock = munamuna(mocked)
  mock.obj = { top: 2, nested: { inside: 3 } }
  expect(mocked).toEqual({ obj: { top: 2, nested: { inside: 3 } } })

  const { obj } = mock
  obj.nested.also = 16
  obj.alsoTop = 4
  expect(mocked).toEqual({ obj: { alsoTop: 4, top: 2, nested: { inside: 3, also: 16 } } })
})
```

### Spying on functions

This following example shows how to create a spy easily:

```typescript
it('can spy on a function using [returnsSpy]', () => {
  const mocked = {} as { fun: () => number }
  const { fun } = munamuna(mocked)
  fun[returnsSpy] = 12
  expect(mocked.fun()).toEqual(12)
  expect(fun[spy]).toHaveBeenCalled()
})
```

It should be noted that spies are only created when `[returnsSpy]` is used, `munamuna` does not need to construct spies that are not explicitly requested.

The following syntax is equivalent:

```typescript
it('can spy on a top level function using mockReturnValue', () => {
  const mocked = {} as { fun: () => number }
  const { fun } = munamuna(mocked)
  const funSpy = fun.mockReturnValue(12)
  expect(mocked.fun()).toEqual(12)
  expect(funSpy).toHaveBeenCalled()
})
```

Here also the spy is created lazily when `mockReturnValue` is accessed.

`mockReturnValueOnce` can also be used:

```typescript
it('can spy on a top level function using mockReturnValueOnce', () => {
  const mocked = {} as { fun: () => number }
  const { fun } = munamuna(mocked)
  const funSpy = fun.mockReturnValueOnce(12)
  fun.mockReturnValueOnce(13)

  expect(mocked.fun()).toEqual(12)
  expect(funSpy).toHaveBeenCalled()
  expect(mocked.fun()).toEqual(13)
  // funSpy and fun[spy] are equivalent, either can be used below
  expect(fun[spy]).toHaveBeenCalledTimes(2)
})
```

When mocking a function that returns a nested structure it's generally easier to use the `[returnsSpy]` version:

```typescript
it('can spy on a function and set the return value with a path expression via [returnsSpy]', () => {
  const mocked = {} as { fun: () => { outer: { inner: number } } }
  const mock = munamuna(mocked)
  const fun = mock.fun[returnsSpy]
  fun.outer.inner = 12
  expect(mocked.fun()).toEqual({ outer: { inner: 12 } })
  expect(fun[spy]).toHaveBeenCalled()
})
```

A function call syntax can also be used instead of `[returnsSpy]`:

```typescript
it('can spy on a function and set the return value with a path expression via a function call', () => {
  const mocked = {} as { fun: () => { outer: { inner: number } } }
  const mock = munamuna(mocked)
  const { fun } = mock
  fun().outer.inner = 12
  expect(mocked.fun()).toEqual({ outer: { inner: 12 } })
  expect(fun[spy]).toHaveBeenCalled()
})
```

This syntax cannot be used when setting a primitive value, e.g. `fun() = 12`, for this the `fun[returnsSpy] = 12` syntax works.
`tsc` and `eslint` will both indicate an error if an attempt to use the former syntax is used as in ecmascript the left hand side of an assignment expression must be a variable or a property access.

In the above examples it can be seen that the `[spy]` accessor can be used on both `mocked.fun` and `mocked.fun[returnsSpy]` or `mocked.fun()`, both can be useful depending on the context.

The following spy methods are also supported:

- `mockResolvedValue`
- `mockResolvedValueOnce`
- `mockRejectedValue`
- `mockRejectedValueOnce`
- `mockImplementation`
- `mockImplementationOnce`

### Dealing with arrays

Arrays can be created much like objects using integral path expressions, assignments, or a mix:

```typescript
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
})
```

### Resetting mocks

A mock created with `munamuna` can be reset to ensure interactions between tests don't cause issues:

```typescript
import { beforeEach, expect, it, vi } from 'vitest'
import { munamuna, reset, returns } from 'munamuna'

import * as lib from './lib'

vi.mock('./lib', () => ({}))

const libMock = munamuna(lib)

beforeEach(() => {
  libMock[reset]()
  vi.clearAllMocks()
})
```

This can also be called on any tree to reset all the data inside of the mock.

```typescript
it('can reset mocks partially', () => {
  const mocked = {} as {
    above: {
      outer1: { inner: number }
      outer2: { inner: number }
    }
  }
  const mock = munamuna(mocked)

  const funReturns = mock.fun[returns]
  funReturns.outer1.inner = 10
  funReturns.outer2.inner = 20

  expect(mocked.fun()).toEqual({ outer1: { inner: 10 }, outer2: { inner: 20 } })

  funReturns.outer2[reset]()
  // funReturns.outer2[detach]() could be used to remove `outer2: {}`
  expect(mocked.fun()).toEqual({ outer1: { inner: 10 }, outer2: {} })
})
```

### Detaching mocks

An object created by a `munamuna` can be detached from its parent object using `[detach]`:

```typescript
it('can detach mocked data', () => {
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
```

An object can be reattached using `[reattach]`:

```typescript
it('can reattach detached mocked data', () => {
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
```

Note here that the detached `munamuna` is returned from the `[detach]` call and is used to reattach the object.
Using `funReturns.outer2[reattach]` would not work as the access of `runReturns.outer2` will create a new `munamuna` when it determines no existing `munamuna` is attached to the tree at `funReturns.outer2`.

Alternatively a reference to the `munamuna` can be created before it is detached and used to reattach it:

```typescript
it('can reattach detached mocked data using its original reference', () => {
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
```

### Using \[set]

This library is implemented using proxies which creates some restrictions.
Consider the following example:

```typescript
it('cannot alter a value by assigning directly to it', () => {
  const mocked = {} as { value: number }
  let { value } = munamuna(mocked)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  value = 5
  expect(mocked).not.toEqual({ value: 5 })
})
```

Here `value` is a proxy, assigning to it will overwrite the reference to the proxy rather than set a value at the intended path.
This issue can be noticed/avoided by using `const` for all variable definitions assigned from a `munamuna` or setting up a lint tool to check for unused variables.
To have this work as intended `munamuna(mocked).value = 5` could be used, but this notation is not always convenient.

An alternative way is shown below:

```typescript
it('can use [set] to alter an existing object', () => {
  const mocked = {} as { value: number }
  const { value } = munamuna(mocked)
  value[set] = 5
  expect(mocked).toEqual({ value: 5 })
})
```

This can be useful when using destructuring assignment to create multiple paths:

```typescript
it('can use destructuring syntax with [set] to alter multiple paths', () => {
  const mocked = {} as { value: number; outer: { inner: number } }
  const { value, outer } = munamuna(mocked)
  value[set] = 6
  outer.inner = 7
  expect(mocked).toEqual({ value: 6, outer: { inner: 7 } })
})
```

### Gotchas

Setting a primitive value then using a path assignment on an object that was constructed before this assignment will not work as the assignment of the primitive value will detach the object used by the pre-existing proxy from the mocked object graph.

```typescript
it('cannot assign a primitive value then use a path assignment from a pre-existing reference', () => {
  const mocked = {} as { outer: { inner: number } | number }
  const mock = munamuna(mocked)
  const { outer } = mock
  mock.outer = 6
  expect(mocked).toEqual({ outer: 6 })
  outer.inner = 5
  expect(mocked).not.toEqual({ outer: { inner: 5 } })
})
```

This can be worked around by grabbing a new reference and assigning the object to that:

```typescript
it('can assign a primitive value then use a path assignment from a new reference', () => {
  const mocked = {} as { outer: { inner: number } | number }
  const mock = munamuna(mocked)
  mock.outer = 6
  expect(mocked).toEqual({ outer: 6 })
  mock.outer.inner = 5
  expect(mocked).toEqual({ outer: { inner: 5 } })
})
```

The `[reattach]` method can also be used:

```typescript
it("can use [reattach] to reattach a proxy's object to the mock", () => {
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
```

The same limitation and workarounds apply when using `[set]`:

```typescript
it('cannot use [set] to create a primitive value then use a path assignment from a pre-existing reference', () => {
  const mocked = {} as { outer: { inner: number } | number }
  const { outer } = munamuna(mocked)
  outer[set] = 6
  expect(mocked).toEqual({ outer: 6 })
  outer.inner = 5
  expect(mocked).not.toEqual({ outer: { inner: 5 } })
})

it('can use [set] to create a primitive value then use a path assignment from a new reference', () => {
  const mocked = {} as { outer: { inner: number } | number }
  const mock = munamuna(mocked)
  const { outer } = mock
  outer[set] = 6
  expect(mocked).toEqual({ outer: 6 })
  mock.outer.inner = 5
  expect(mocked).toEqual({ outer: { inner: 5 } })
})
```

This limitation does not apply when assigning objects:

```typescript
it('can use an object assignment followed by a path assignment from a pre-existing reference', () => {
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

it('can use [set] to overwrite an object then alter it with a path assignment from a pre-existing reference', () => {
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
```

Multiple direct assignments of primitive values work fine:

```typescript
it('can use [set] to alter the existing object multiple times', () => {
  const mocked = {} as { value: number }
  const { value } = munamuna(mocked)
  value[set] = 5
  expect(mocked).toEqual({ value: 5 })
  value[set] = 6
  expect(mocked).toEqual({ value: 6 })
})
```

## Implementation

`munamuna` uses proxies to automatically produce mocks.
The proxies are only use when interacting with data returned from `munamuna`, the mock produced for the module being tested does not need to use proxies ensuring the runtime penalty is insignificant.
Proxies are cached and reused whenever possible: a proxy is only created on the first access of a property or nested property.

## Changelog

[munamuna changelog](changelog.md)

## Plans

### Version 1.0

- Ensure arrays are handled as expected
- Finish autocomplete support

### Version 1.1

- For spies that should return values depending on their arguments, provide a way to construct the return values easily using the function call syntax.
