import { vi } from 'vitest'

export const returns = Symbol('returns')
export const returnsSpy = Symbol('returns spy')
export const spy = Symbol('spy')
export const set = Symbol('set')
export const reset = Symbol('reset')
export const reattach = Symbol('reattach')

/* eslint-disable @typescript-eslint/no-explicit-any */

const proxyMap = new WeakMap<any, any>()
const metaMap = new WeakMap<any, any>()
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

function reattachProxy(target: any) {
  const meta = metaMap.get(target)
  if (!meta) {
    throw new Error('Cannot reattach a top level proxy')
  }
  meta.parent[meta.key] = target
}

function mockFunction(proxy: any, target: any, value: any, isReturnsSpy: boolean) {
  const meta = metaMap.get(target)
  if (!meta) {
    throw new Error('Cannot create a function on a top-level automock')
  }

  const prevTarget = meta.parent[meta.key]

  // if there is a value then create a new object to host this value, allowing the value
  // to be altered via `retObj.value = blah` otherwise set the value to the previous target
  // so that path options on the original proxy can update the returned value
  const retObj: any = value === undefined ? { value: prevTarget } : { value }

  const implementation = function () {
    return retObj.value
  }
  const fun: (() => void) & { [spy]?: any } = isReturnsSpy ? vi.fn(implementation) : implementation

  meta.parent[meta.key] = fun
  // the spy can be hosted in the returned object container, it's now detached and not used
  // for anything but the function return value
  retObj[spy] = isReturnsSpy ? fun : undefined

  functionSet.set(prevTarget, retObj)

  metaMap.set(fun, meta)
  proxyMap.set(fun, proxy)

  return fun
}

export function createProxy(obj: any) {
  const proxy = new Proxy(obj, {
    get(target: any, key: string | symbol) {
      const isReturnsSpy = key === returnsSpy

      if (key === returns || isReturnsSpy) {
        if (functionSet.has(target)) {
          // console.log('reuse mock function')
          return proxy
        }
        // console.log('create mock function')

        mockFunction(proxy, target, undefined, isReturnsSpy)
        return proxy
      }

      if (key === spy) {
        return functionSet.get(target)?.[spy] ?? mockFunction(proxy, target, undefined, true)
      }

      if (key === 'mockReturnValue' || key === 'mockReturnValueOnce') {
        const retObj = functionSet.get(target)
        if (retObj) {
          // console.log('reuse mock function')
          return retObj[spy][key]
        } else {
          // console.log('create mock function')
          const fun = mockFunction(proxy, target, undefined, true)
          return (fun as any)[key]
        }
      }

      if (key === set) {
        return proxy
      }

      if (key === reset) {
        return () => {
          resetMocks(target)
        }
      }

      if (key === reattach) {
        return () => {
          reattachProxy(target)
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

    set(target: any, key: string | symbol, newVal: any): boolean {
      const isReturnsSpy = key === returnsSpy

      if (key === returns || isReturnsSpy) {
        const retObj = functionSet.get(target)
        if (retObj) {
          // console.log('update mock function')
          if (isReturnsSpy) {
            retObj[spy].mockReturnValue(newVal)
          } else {
            retObj.value = newVal
          }
        } else {
          // console.log('create mock function')
          if (isReturnsSpy) {
            const fun = mockFunction(proxy, target, undefined, true)
            ;(fun as any).mockReturnValue(newVal)
          } else {
            mockFunction(proxy, target, newVal, false)
          }
        }
      } else if (key === set) {
        if (typeof newVal === 'object' && typeof target === 'object') {
          // avoid detaching the original target from its proxy
          for (const prop of Object.getOwnPropertyNames(target)) {
            delete target[prop]
          }
          Object.assign(target, newVal)
        } else {
          const meta = metaMap.get(target)
          if (!meta) {
            throw new Error('Cannot use [set] on a top-level automock')
          }
          meta.parent[meta.key] = newVal
        }
      } else {
        let assignObj: any
        if (typeof newVal === 'object' && typeof (assignObj = target[key]) === 'object') {
          for (const prop of Object.getOwnPropertyNames(assignObj)) {
            delete target[prop]
          }
          Object.assign(assignObj, newVal)
        } else {
          target[key] = newVal
        }
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
