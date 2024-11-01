import { vi } from 'vitest'

export const returns = Symbol('returns')
export const returnsSpy = Symbol('returns spy')
export const spy = Symbol('spy')
export const reset = Symbol('reset')

/* eslint-disable @typescript-eslint/no-explicit-any */

const proxyMap = new WeakMap<any, any>()
const metaMap = new WeakMap<any, any>()
const mockedFunctions = new WeakMap<any, any>()

function resetMocks(target: any) {
  for (const prop of Object.getOwnPropertyNames(target)) {
    delete target[prop]
  }

  const meta = metaMap.get(target)
  if (meta) {
    delete meta.parent[meta.key]
  }
}

function mockFunction(target: any, value: any, isReturnsSpy: boolean) {
  const prevRetObj = mockedFunctions.get(target)
  if (prevRetObj) {
    const existingProxy = proxyMap.get(prevRetObj)
    if (!existingProxy) {
      throw new Error(
        'Internal bug: previous function return value was set but there is no proxy cached, please report this',
      )
    }

    // upgrade to spy if this doesn't match
    if (!isReturnsSpy || prevRetObj[spy]) {
      // console.log('reuse return value')
      return { existing: existingProxy, retObj: prevRetObj }
    }
  }
  // console.log('new return value')

  const retObj: any = { value }

  const fun: (() => void) & { [spy]?: any } = isReturnsSpy
    ? vi.fn(() => retObj.value)
    : function () {
        return retObj.value
      }

  const meta = metaMap.get(target)
  const prevTarget = meta!.parent[meta!.key]
  meta!.parent[meta!.key] = fun
  retObj[spy] = isReturnsSpy ? fun : undefined

  metaMap.set(fun, meta)
  mockedFunctions.set(fun, retObj)

  return { retObj, fun, meta, prevTarget }
}

export function createProxy(initialObj: any, associatedSpy?: any) {
  return new Proxy(initialObj, {
    get(target: any, key: string | symbol) {
      const isReturnsSpy = key === returnsSpy

      if (key === returns || isReturnsSpy) {
        const mockedFunction = mockFunction(target, {}, isReturnsSpy)
        const { existing } = mockedFunction
        if (existing) {
          return existing
        }

        const { retObj, fun } = mockedFunction

        // TODO: find a way to hook into the proxy associated with the previous object
        // instead of creating a new proxy so that references to the previously created
        // proxy will act the same as this one
        const proxy = createProxy(retObj.value, isReturnsSpy ? fun : undefined)
        proxyMap.set(retObj, proxy)
        return proxy
      }

      if (key === spy) {
        return associatedSpy ?? target[spy]
      }

      if (key === 'mockReturnValue' || key === 'mockReturnValueOnce') {
        // TODO: do this in a way that can preserve the existing mocked function
        const meta = metaMap.get(target)
        // remove any existing mock function that may have been set using [returns] or [returnsSpy]
        mockedFunctions.delete(meta!.parent[meta!.key])

        const newProp: any = vi.fn()
        meta!.parent[meta!.key] = newProp

        proxyMap.set(newProp, proxyMap.get(target))
        return newProp[key]
      }

      if (key === reset) {
        return () => {
          resetMocks(target)
        }
      }

      try {
        const existing = target[key]
        if (existing) {
          return automock(existing)
        }
      } catch {
        // vitest does something to the module that prevents checking if things exist
      }

      const newProp: any = {}
      metaMap.set(newProp, { parent: target, key })
      target[key] = newProp
      return automock(newProp)
    },

    set(target: any, key: string | symbol, newVal: any, receiver): boolean {
      const isReturnsSpy = key === returnsSpy

      if (key === returns || isReturnsSpy) {
        const mockedFunction = mockFunction(target, newVal, isReturnsSpy)
        const { existing, retObj: prevRetObj } = mockedFunction
        if (existing) {
          // console.log('reuse return value simple')
          prevRetObj.value = newVal
          return existing
        }
        // console.log('new return value simple')

        const { retObj, fun, prevTarget } = mockedFunction
        if (isReturnsSpy) {
          fun![spy] = fun

          // TODO: find a way to reuse the previous proxy, see below
          // on the first path access an object proxy is created, this is then replaced when
          // [returnsSpy] is used as this is the point it is known that the path will be a function
          // the next line ensures the spy can be accessed from references to the previous proxy
          // however other accesses to the previous proxy can have undesired results, for example
          // using it to set a new [returnsSpy] will clobber the one created by this new proxy
          prevTarget[spy] = fun

          // TODO: provide a way to access this the same way that it works for path style mocks?
        }

        proxyMap.set(retObj, this)
        Reflect.set(target, key, fun, receiver)
      } else {
        Reflect.set(target, key, newVal, receiver)
      }
      return true
    },
  })
}

export function automock(obj: any = {}) {
  const existingProxy = proxyMap.get(obj)
  // console.log(existingProxy ? 'reuse' : 'new')
  if (existingProxy) {
    return existingProxy
  } else {
    const proxy = createProxy(obj)
    proxyMap.set(obj, proxy)
    return proxy
  }
}
