# vitest-automock

Write mocks using vitest so much more easily and with typescript assisted autocomplete.
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

interface IssueDetails {
  owner: string
  repo: string
  issue_number: number
  body?: string
}

function appendToIssueBody(req: IssueDetails, toAppend: string): string {
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
  const issues = automock(octokitRest).Octokit[returns].issues
  const get = issues.get[returnsSpy]
  get.data.body = 'some text'
  const update = issues.update[returnsSpy]

  await appendToIssueBody({ owner: 'son', repo: 'me', issue_number: 15 }, 'appended')
  expect(get[spy]).toHaveBeenCalledOnce()
  expect(update[spy]).toHaveBeenCalledWith(expect.objectContaining({ body: `some text appended` }))
})
```

The setup has been reduced from 14 lines to 4 lines, the entire test function is now 7 lines instead of 17.
The mock is also typesafe and autocomplete can be used to assist with creating the mock.

This test shows how to mock functions:

- `returns` can be used to mock function or constructor return values without creating a `vi.fn`.
- `returnsSpy` works the same but creates a `vi.fn` that can be used to spy on the function.

There are other advantages, by default `vi.mock` will create a `vi.fn` for every top-level export in the mocked module which can involve creating a lot of objects that are never needed.
These must be tracked by `vitest` and reset on every call to `vi.clearAllMocks`.
Again it's possible to work around this, at the cost of more code.
`vitest-automock` creates `vi.fn` objects on demand whenever `returnsSpy` is used.

## Tutorial

### Mixing mock styles

It's possible to use a combination of object assignment and path assignment to modify and update mocks to allow the best syntax to be freely mixed depending on the case:

```typescript
it('can use a mixture of assignments and paths to modify a mock', () => {
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

This following example shows how to create a `vi.fn` easily:

```typescript
it('can spy on a function using [returnsSpy]', () => {
  const mocked = {} as { fun: () => number }
  const { fun } = automock(mocked)
  fun[returnsSpy] = 12
  expect(mocked.fun()).toEqual(12)
  expect(fun[spy]).toHaveBeenCalled()
})
```

It should be noted that the `vi.fn()` is only created when `[returnsSpy]` is accessed, `vitest-automock` does not need to construct `vi.fn()` objects that are not explicitly requested.

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

Here also the `vi.fn` is created lazily when `mockReturnValue` is accessed.

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
  expect(funSpy).toHaveBeenCalledTimes(2)
})
```

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

## Implementation

`vitest-automock` uses proxies to automatically produce mocks.
The proxies are only use when interacting with data returned from `automock`, the mock produced for the module being tested does not need to use proxies ensuring the runtime penalty is insignificant.
Proxies are cached and reused whenever possible: a proxy is only created on the first access of a property or nested property.

## Plans

- Add `[returnsOnce]` and `[spyOnce]`
- Finish autocomplete support for first release
- Add ability to change function return values depending on call arguments
