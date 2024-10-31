# vitest-automock

Write mocks using vitest so much more easily and with typescript assisted autocomplete.
Inspired by [python's MagicMock](https://docs.python.org/3/library/unittest.mock.html#unittest.mock.MagicMock).

## Installation

```sh
pnpm install -D vitest-automock
```

## Tutorial

### Example one

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

The type cast, which is necessary because the mock provides part of the implementation, also removes all type safety from the mock definition (which can be worked around at the cost of even more lines of code).

With `vitest-automock` this becomes easier:

```typescript
// index.spec.ts
import { expect, it, vi } from 'vitest'
import * as octokitRest from '@octokit/rest'

import { appendToIssueBody } from './index'

const { automock, automocked, returns, returnsSpy, spy } = await vi.hoisted(
  () => import('vitest-automock'),
)

vi.mock('@octokit/rest', automocked)

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

There are other advantages, by default `vi.mock` will create a `vi.fn` for every top-level export in the mocked module which can involve creating a lot of objects that are never needed.
These must be tracked by `vitest` and reset on every call to `vi.clearAllMocks`.
Again it's possible to work around this, at the cost of more code.
`vitest-automock` creates `vi.fn` objects on demand whenever `returnsSpy` is used.

### Example two

The following toy example shows how easy it is to mock deeply nested data structures:

The library to mock:

```typescript
// lib.ts
export class MuchNesting {
  outer: {
    inner: {
      getStuff: (val: number) => {
        deep: {
          veryDeep: number
          alsoVeryDeep: number
        }
      }
    }
  }

  constructor() {
    this.outer = {
      inner: {
        getStuff: (_val: number) => ({
          deep: {
            veryDeep: 420,
            alsoVeryDeep: 421,
          },
        }),
      },
    }
  }
}
```

The module to test:

```typescript
// index.ts
import { MuchNesting } from './lib'

export function classWithMultipleDeeplyNestedObjects(): [number, number] {
  const stuff = new MuchNesting().outer.inner.getStuff(12)
  return [stuff.deep.veryDeep, stuff.deep.alsoVeryDeep]
}
```

The test:

```typescript
// index.spec.ts
import { beforeEach, expect, it, vi } from 'vitest'

import { classWithMultipleDeeplyNestedObjects } from './index'
import * as lib from './lib'

const { automock, automocked, returns, returnsSpy, spy } = await vi.hoisted(
  () => import('vitest-automock'),
)

vi.mock('./lib', automocked)

it('can mock multiple nested properties within deeply nested function with a spy', () => {
  const libMock = automock(lib)
  const getStuff = libMock.MuchNesting[returns].outer.inner.getStuff[returnsSpy]
  const { deep } = getStuff
  deep.veryDeep = 16
  deep.alsoVeryDeep = 17
  expect(classWithMultipleDeeplyNestedObjects()).toEqual([16, 17])
  expect(getStuff[spy]).toHaveBeenCalledWith(12)
})
```

This shows how `returns` can be used to mock function or constructor return values without creating a `vi.fn`.

## Implementation

`vitest-automock` uses proxies to automatically produce mocks.
The proxies are only use when interacting with data returned from `automock`, the mock produced for the module being tested does not need to use proxies ensuring the runtime penalty is insignificant.
Proxies are cached and reused whenever possible: a proxy is only created on the first access of a property or nested property.

## Plans

- Finish autocomplete support for first release
- Add ability to change function return values depending on call arguments
