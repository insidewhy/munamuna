import { vi } from 'vitest'

export const returns = Symbol('returns')
export const returnsSpy = Symbol('returns spy')
export const spy = Symbol('spy')

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */

const proxyMap = new WeakMap<any, any>()
const metaMap = new WeakMap<any, any>()
const mockedFunctions = new WeakMap<any, typeof Proxy & { [spy]: Function }>()

export function automock(obj: any = {}) {
  const existingProxy = proxyMap.get(obj)
  if (existingProxy) {
    return existingProxy
  }

  const proxy = new Proxy(obj, {
    get(target: any, key) {
      const isReturnsSpy = key === returnsSpy

      if (key === returns || isReturnsSpy) {
        const prevRetVal = mockedFunctions.get(target)
        if (prevRetVal) {
          const existingProxy = proxyMap.get(prevRetVal)
          if (existingProxy) {
            // upgrade to spy if this doesn't match
            if (!isReturnsSpy || prevRetVal[spy]) {
              return existingProxy
            }
          }
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

        if (isReturnsSpy) {
          retVal[spy] = fun
        }
        metaMap.set(fun, meta)
        mockedFunctions.set(fun, retVal)
        return automock(retVal)
      }

      if (key === spy) {
        return target[spy]
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
  })

  proxyMap.set(obj, proxy)

  return proxy
}
