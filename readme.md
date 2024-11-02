# vitest-automock

Build mocks and spies so much more easily and with typescript assisted autocomplete.

Integrates well with [vitest](https://vitest.dev/), [jest](https://jestjs.io/) and others.

Inspired by [python's MagicMock](https://docs.python.org/3/library/unittest.mock.html#unittest.mock.MagicMock).

## Installation

```sh
pnpm install -D vitest-automock
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

With `vitest-automock` this becomes easier:

```typescript
// index.spec.ts
import * as octokitRest from '@octokit/rest'
import { expect, it, vi } from 'vitest'
import { automock, returns, returnsSpy, spy } from 'vitest-automock'

import { appendToIssueBody } from './index'

vi.mock('@octokit/rest', () => ({}))

it('can append to body of github ticket', async () => {
  const { issues } = automock(octokitRest).Octokit[returns]
  issues.get[returnsSpy].data.body = 'some text'
  const update = issues.update[spy]

  await appendToIssueBody({ owner: 'son', repo: 'me', issue_number: 15 }, 'appended')
  expect(issues.get[spy]).toHaveBeenCalledOnce()
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ body: `some text appended` }))
})
```

The setup has been reduced from 14 lines to 3 lines, the entire test function is now 6 lines instead of 17.
Values returned from mock are also type checked according to the structure of the object being mocked and autocomplete can be used to assist with creating the mock.

This test shows how to mock functions:

- `returns` can be used to mock function or constructor return values without creating a `vi.fn`.
- `returnsSpy` works the same but creates a spy function (e.g. `vi.fn`)
- `spy` can be used to access a spy created by `automock` and it will create the spy if none exists.

There are other advantages, by default `vi.mock` will create a `vi.fn` for every top-level export in the mocked module which can involve creating a lot of objects that are never needed.
These must be tracked by `vitest` and reset on every call to `vi.clearAllMocks`.
Again it's possible to work around this, at the cost of more code.
`vitest-automock` creates spies on demand whenever `returnsSpy` is used.

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
import { vi } from 'vitest'
import { setup } from 'vitest-automock'

setup({ spyFunction: vi.fn })
```

### Creating deeply nested paths

Path assignment can easily be used to create a nested object:

```typescript
it('can create a deeply nested path', () => {
  const mocked = {} as { outer: { inner: { innerMost: number } } }
  automock(mocked).outer.inner.innerMost = 7
  expect(mocked).toEqual({ outer: { inner: { innerMost: 7 } } })
})
```

Destructuring assignment can be used to assign to multiple nested objects:

```typescript
it('can create multiple nested paths with path assignment', () => {
  type Nested = { outer: { inner: number } }
  const mocked = {} as { value1: Nested; value2: Nested }
  const { value1, value2 } = automock(mocked)
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
  const mock = automock(mocked)
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
  const { fun } = automock(mocked)
  fun[returnsSpy] = 12
  expect(mocked.fun()).toEqual(12)
  expect(fun[spy]).toHaveBeenCalled()
})
```

It should be noted that spies are only created when `[returnsSpy]` is used, `vitest-automock` does not need to construct spies that are not explicitly requested.

The following syntax can also be used:

```typescript
it('can spy on a top level function using mockReturnValue', () => {
  const mocked = {} as { fun: () => number }
  const { fun } = automock(mocked)
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
  const { fun } = automock(mocked)
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
it('can spy on a function with a return path', () => {
  const mocked = {} as { fun: () => { outer: { inner: number } } }
  const mock = automock(mocked)
  const fun = mock.fun[returnsSpy]
  fun.outer.inner = 12
  expect(mocked.fun()).toEqual({ outer: { inner: 12 } })
  expect(fun[spy]).toHaveBeenCalled()
})
```

In the above examples it can be seen that the `[spy]` accessor can be used on both `mocked.fun` and `mocked.fun[returnsSpy]`, either can be useful depending on the context.
From the above examples it may be noticed that the latter leads to shorter code when `automock` is used to build a return path and the former leads to shorter code in all other cases.

### Resetting mocks

A mock created with `vitest-automock` can be reset to ensure interactions between tests don't cause issues:

```typescript
import { beforeEach, expect, it, vi } from 'vitest'
import { automock, reset, returns } from 'vitest-automock'

import * as lib from './lib'

vi.mock('./lib', () => ({}))

const libMock = automock(lib)

beforeEach(() => {
  libMock[reset]()
  vi.clearAllMocks()
})
```

This can also be called on any tree to reset all the mocks reachable from that point

```typescript
it('can reset mocks partially', () => {
  const mocked = {} as {
    above: {
      outer1: { inner: number }
      outer2: { inner: number }
    }
  }
  const mock = automock(mocked)

  const funReturns = mock.fun[returns]
  funReturns.outer1.inner = 10
  funReturns.outer2.inner = 20

  expect(mocked.fun()).toEqual({ outer1: { inner: 10 }, outer2: { inner: 20 } })

  funReturns.outer2[reset]()
  expect(mocked.fun()).toEqual({ outer1: { inner: 10 } })
})
```

### Using \[set]

This library is implemented using proxies which creates some restrictions.
Consider the following example:

```typescript
it('cannot alter a value by assigning directly to it', () => {
  const mocked = {} as { value: number }
  let { value } = automock(mocked)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  value = 5
  expect(mocked).not.toEqual({ value: 5 })
})
```

Here `value` is a proxy, assigning to it will overwrite the reference to the proxy rather than set a value at the intended path.
Always using `const` when assigning values from automock paths can be used to avoid this to have the typesystem check it.
Linter checks for unused variables will also usually indicate this mistake.
To have this work as intended `automock(mocked).value = 5` could be used, but this notation is not always convenient.

An alternative way is shown below:

```typescript
it('can use [set] to alter an existing object', () => {
  const mocked = {} as { value: number }
  const { value } = automock(mocked)
  value[set] = 5
  expect(mocked).toEqual({ value: 5 })
})
```

This can be useful when using destructuring assignment to create multiple paths:

```typescript
it('can use destructuring syntax with [set] to alter multiple paths', () => {
  const mocked = {} as { value: number; outer: { inner: number } }
  const { value, outer } = automock(mocked)
  value[set] = 6
  outer.inner = 7
  expect(mocked).toEqual({ value: 6, outer: { inner: 7 } })
})
```

### Gotchas

Setting a non-object value then using a path assignment on an object that was constructed before this will not work as the assignment of the primitive value will detach the object used by the pre-existing proxy from the mocked object graph.

```typescript
it('cannot assign a primitive value then use a path assignment from a pre-existing reference', () => {
  const mocked = {} as { outer: { inner: number } | number }
  const mock = automock(mocked)
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
  const mock = automock(mocked)
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
  const mock = automock(mocked)
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

The same limitation and work-arounds apply when using `[set]`:

```typescript
it('cannot use [set] to create a primitive value then use a path assignment from a pre-existing reference', () => {
  const mocked = {} as { outer: { inner: number } | number }
  const { outer } = automock(mocked)
  outer[set] = 6
  expect(mocked).toEqual({ outer: 6 })
  outer.inner = 5
  expect(mocked).not.toEqual({ outer: { inner: 5 } })
})

it('can use [set] to create a primitive value then use a path assignment from a new reference', () => {
  const mocked = {} as { outer: { inner: number } | number }
  const mock = automock(mocked)
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
  const mock = automock(mocked)
  const { obj } = mock
  mock.obj = { top: 2, nested: { inside: 3 } }
  expect(mocked).toEqual({ obj: { top: 2, nested: { inside: 3 } } })

  obj.nested.also = 16
  obj.alsoTop = 4
  expect(mocked).toEqual({ obj: { alsoTop: 4, top: 2, nested: { inside: 3, also: 16 } } })
})

it('can use [set] to overwrite an object then alter it with a path assignment from a pre-existing reference', () => {
  const mocked = {} as { outer: { first: number; second?: number } }
  const { outer } = automock(mocked)

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
  const { value } = automock(mocked)
  value[set] = 5
  expect(mocked).toEqual({ value: 5 })
  value[set] = 6
  expect(mocked).toEqual({ value: 6 })
})
```

## Implementation

`vitest-automock` uses proxies to automatically produce mocks.
The proxies are only use when interacting with data returned from `automock`, the mock produced for the module being tested does not need to use proxies ensuring the runtime penalty is insignificant.
Proxies are cached and reused whenever possible: a proxy is only created on the first access of a property or nested property.

## Plans

- Finish autocomplete support for first release
- Add ability to change function return values depending on call arguments
