import { vi } from 'vitest'

export const returns = Symbol('returns')
export const returnsSpy = Symbol('returns spy')
export const spy = Symbol('spy')

/* eslint-disable @typescript-eslint/no-explicit-any */

const returnMap = new WeakMap<any, any>()
const proxyMap = new WeakMap<any, any>()
const metaMap = new WeakMap<any, any>()

export function automock(obj: any = {}) {
  const dataObj = returnMap.get(obj) ?? obj
  const existingProxy = proxyMap.get(dataObj)
  if (existingProxy) {
    return existingProxy
  }

  const proxy = new Proxy(dataObj, {
    get(target: any, key) {
      const isReturnsSpy = key === returnsSpy

      if (key === returns || isReturnsSpy) {
        const prevRetVal = returnMap.get(obj)
        const existingProxy = prevRetVal && proxyMap.get(prevRetVal)
        if (existingProxy) {
          return existingProxy
        }

        const retVal: any = {}
        let fun: any = function () {
          return retVal
        }
        if (isReturnsSpy) {
          fun = vi.fn(fun)
        }

        const meta = metaMap.get(target)
        meta!.parent[meta!.key] = fun

        returnMap.set(fun, retVal)
        retVal[spy] = fun
        return automock(fun)
      }

      if (key === spy) {
        return returnMap.get(obj)[spy]
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
        // TODO: I think this is needed?
        returnMap.set(newProp, returnMap.get(target))
        return newProp[key]
      }

      const newProp: any = {}
      metaMap.set(newProp, { parent: target, key })
      target[key] = newProp
      return automock(newProp)
    },
  })

  proxyMap.set(dataObj, proxy)

  return proxy
}
