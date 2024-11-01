import { vi } from 'vitest'

export const returns = Symbol('returns')
export const returnsSpy = Symbol('returns spy')
export const spy = Symbol('spy')
export const reset = Symbol('reset')

/* eslint-disable @typescript-eslint/no-explicit-any */

const proxyMap = new WeakMap<any, any>()
const metaMap = new WeakMap<any, any>()
const targetRedirects = new WeakMap<any, any>()
// function against return object container
const functionSet = new WeakMap<any, any>()

function resetMocks(target: any) {
  for (const prop of Object.getOwnPropertyNames(target)) {
    delete target[prop]
  }

  const meta = metaMap.get(target)
  if (meta) {
    delete meta.parent[meta.key]
  }
}

function mockFunction(
  target: any,
  value: any,
  isReturnsSpy: boolean,
  redirectTargetToValue = false,
) {
  const retObj: any = { value }

  const fun: (() => void) & { [spy]?: any } = isReturnsSpy
    ? vi.fn(() => retObj.value)
    : function () {
        return retObj.value
      }

  const meta = metaMap.get(target)
  const prevTarget = meta!.parent[meta!.key]
  meta!.parent[meta!.key] = fun
  target[spy] = isReturnsSpy ? fun : undefined
  functionSet.set(target, retObj)

  metaMap.set(fun, meta)

  if (redirectTargetToValue) {
    // ensure setting path values on any handles to the previous proxy work
    targetRedirects.set(prevTarget, retObj.value)
  }

  return fun
}

export function createProxy(initialObj: any) {
  const proxy = new Proxy(initialObj, {
    get(initialTarget: any, key: string | symbol) {
      const isReturnsSpy = key === returnsSpy

      if (key === returns || isReturnsSpy) {
        if (functionSet.has(initialTarget)) {
          // console.log('reuse mock function')
          return proxy
        }
        // console.log('create mock function')

        const fun = mockFunction(initialTarget, {}, isReturnsSpy, true)
        // this ensures the proxy can be reused if accessed via an ancestor proxy
        proxyMap.set(fun, proxy)
        return proxy
      }

      if (key === spy) {
        return initialTarget[spy]
      }

      if (key === 'mockReturnValue' || key === 'mockReturnValueOnce') {
        if (functionSet.has(initialTarget)) {
          // console.log('reuse mock function')
          return initialTarget[spy][key]
        } else {
          // console.log('create mock function')
          const fun = mockFunction(initialTarget, undefined, true)

          // to reuse the proxy if accessed via the ancestor again
          proxyMap.set(fun, proxy)
          return (fun as any)[key]
        }
      }

      const target = targetRedirects.get(initialTarget) ?? initialTarget

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

    set(initialTarget: any, key: string | symbol, newVal: any): boolean {
      const isReturnsSpy = key === returnsSpy

      if (key === returns || isReturnsSpy) {
        const retObj = functionSet.get(initialTarget)
        if (!retObj) {
          // console.log('create mock function')
          if (isReturnsSpy) {
            const fun = mockFunction(initialTarget, undefined, true)
            ;(fun as any).mockReturnValue(newVal)
            proxyMap.set(fun, proxy)
          } else {
            const fun = mockFunction(initialTarget, newVal, false)
            proxyMap.set(fun, proxy)
          }
        } else {
          // console.log('update mock function')
          if (isReturnsSpy) {
            initialTarget[spy].mockReturnValue(newVal)
          } else {
            retObj.value = newVal
          }
        }
      } else {
        const target = targetRedirects.get(initialTarget) ?? initialTarget
        target[key] = newVal
      }
      return true
    },
  })

  return proxy
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
