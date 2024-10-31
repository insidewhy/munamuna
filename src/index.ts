import { vi } from 'vitest'

const returnValueKey = Symbol('return value')
const proxyKey = Symbol('proxy')
const metaKey = Symbol('meta')

export const returns = Symbol('returns')
export const returnsSpy = Symbol('returns spy')
export const spy = Symbol('spy')

/* eslint-disable @typescript-eslint/no-explicit-any */

export function automock(obj: any = {}) {
  const dataObj = obj[returnValueKey] ?? obj
  const existingProxy = dataObj[proxyKey]
  if (existingProxy) {
    return existingProxy
  }

  const proxy = new Proxy(dataObj, {
    get(target: any, key) {
      const isReturnsSpy = key === returnsSpy

      if (key === returns || isReturnsSpy) {
        const meta = target[metaKey]
        const existingProxy = obj[returnValueKey]?.[proxyKey]
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
        meta!.parent[meta!.key] = fun
        fun[returnValueKey] = retVal
        fun[returnValueKey][spy] = fun
        return automock(fun)
      }

      if (key === spy) {
        return obj[returnValueKey][spy]
      }

      const existing = target[key]
      if (existing) {
        return automock(existing)
      }

      if (key === 'mockReturnValue' || key === 'mockReturnValueOnce') {
        const newProp: any = vi.fn()
        const meta = target[metaKey]
        meta!.parent[meta!.key] = newProp
        newProp[proxyKey] = target[proxyKey]
        // TODO: I think this is needed?
        newProp[returnValueKey] = target[returnValueKey]
        return newProp[key]
      }

      const newProp: any = {}
      newProp[metaKey] = { parent: target, key }
      target[key] = newProp
      return automock(newProp)
    },
  })

  dataObj[proxyKey] = proxy

  return proxy
}

export function automocked(): any {
  const mocked: any = {}
  mocked[returnValueKey] = mocked
  return mocked
}
