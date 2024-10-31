import { vi } from 'vitest'

export const returns = Symbol('returns')
export const returnsSpy = Symbol('returns spy')
export const spy = Symbol('spy')

/* eslint-disable @typescript-eslint/no-explicit-any */

const proxyMap = new WeakMap<any, any>()
const metaMap = new WeakMap<any, any>()
const mockedFunctions = new WeakMap<any, any>()

function mockFunction(target: any, isReturnsSpy: boolean, value: any) {
  const prevRetVal = mockedFunctions.get(target)
  if (prevRetVal) {
    const existingProxy = proxyMap.get(prevRetVal)
    if (existingProxy) {
      // upgrade to spy if this doesn't match
      if (!isReturnsSpy || prevRetVal[spy]) {
        // console.log('reuse return value')
        return { existing: existingProxy, retVal: prevRetVal }
      }
    }
  }
  // console.log('new return value')

  const retVal: any = { value }
  let fun: any = function () {
    return retVal.value
  }
  if (isReturnsSpy) {
    fun = vi.fn(fun)
  }

  const meta = metaMap.get(target)
  meta!.parent[meta!.key] = fun
  retVal[spy] = isReturnsSpy ? fun : undefined

  return { retVal, fun, meta }
}

export function createProxy(obj: any, associatedSpy?: any) {
  return new Proxy(obj, {
    get(target: any, key) {
      const isReturnsSpy = key === returnsSpy

      if (key === returns || isReturnsSpy) {
        const mockedFunction = mockFunction(target, isReturnsSpy, {})
        if (mockedFunction.existing) {
          return mockedFunction.existing
        }

        const { retVal, meta, fun } = mockedFunction
        metaMap.set(fun, meta)
        mockedFunctions.set(fun, retVal)

        const proxy = createProxy(retVal.value, isReturnsSpy ? fun : undefined)
        proxyMap.set(retVal, proxy)
        // TODO: is this needed?
        // proxyMap.set(meta.parent, proxy)
        return proxy
      }

      if (key === spy) {
        return associatedSpy ?? target[spy]
      }

      try {
        const existing = target[key]
        if (existing) {
          return automock(existing)
        }
      } catch {
        // vitest does something to the module that prevents checking if things exist
      }

      if (key === 'mockReturnValue' || key === 'mockReturnValueOnce') {
        const newProp: any = vi.fn()
        const meta = metaMap.get(target)
        meta!.parent[meta!.key] = newProp
        proxyMap.set(newProp, proxyMap.get(target))
        return newProp[key]
      }

      const newProp: any = {}
      metaMap.set(newProp, { parent: target, key })
      target[key] = newProp
      return automock(newProp)
    },

    set(target: any, key, newVal, receiver): boolean {
      const isReturnsSpy = key === returnsSpy

      if (key === returns || isReturnsSpy) {
        const mockedFunction = mockFunction(target, isReturnsSpy, newVal)
        const { existing, retVal: prevRetVal } = mockedFunction
        if (existing) {
          // console.log('reuse return value simple')
          prevRetVal.value = newVal
          return mockedFunction.existing
        }
        // console.log('new return value simple')

        const { retVal, meta, fun } = mockedFunction
        if (isReturnsSpy) {
          fun[spy] = fun
        }

        proxyMap.set(retVal, this)
        metaMap.set(fun, meta)
        mockedFunctions.set(fun, retVal)
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
