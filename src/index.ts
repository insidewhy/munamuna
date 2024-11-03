/* eslint-disable @typescript-eslint/no-explicit-any */
interface Spy {
  mockReturnValue<T>(value: T): Spy
  mockReturnValueOnce<T>(value: T): Spy
  mockResolvedValue<T>(value: T): Spy
  mockResolvedValueOnce<T>(value: T): Spy
  mockRejectedValue<T>(value: T): Spy
  mockRejectedValueOnce<T>(value: T): Spy
  mockImplementation<T>(impl: (...args: any[]) => T): Spy
  mockImplementationOnce<T>(impl: (...args: any[]) => T): Spy
}

const spyMethods = [
  'mockReturnValue',
  'mockReturnValueOnce',
  'mockResolvedValue',
  'mockResolvedValueOnce',
  'mockRejectedValue',
  'mockRejectedValueOnce',
  'mockImplementation',
  'mockImplementationOnce',
]

export const returns = Symbol('returns')
export const returnsSpy = Symbol('returns spy')
export const spy = Symbol('spy')
export const set = Symbol('set')
export const reset = Symbol('reset')
export const reattach = Symbol('reattach')

type SpyFunction = (option?: any) => Spy

let spyFunction: SpyFunction

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
    throw new Error('Cannot create a function on a top-level munamuna')
  }

  const prevTarget = meta.parent[meta.key]

  // if there is a value then create a new object to host this value, allowing the value
  // to be altered via `retObj.value = blah` otherwise set the value to the previous target
  // so that path options on the original proxy can update the returned value
  const retObj: any = value === undefined ? { value: prevTarget } : { value }

  const implementation = function () {
    return retObj.value
  }
  const fun: any = isReturnsSpy ? spyFunction(implementation) : implementation

  meta.parent[meta.key] = fun
  // the spy can be hosted in the returned object container, it's now detached and not used
  // for anything but the function return value
  retObj[spy] = isReturnsSpy ? fun : undefined

  functionSet.set(prevTarget, retObj)

  metaMap.set(fun, meta)
  proxyMap.set(fun, proxy)

  return fun
}

const getTraps: { [index: symbol | string]: (target: any, proxy: any) => any } = {
  [returns](target: any, proxy: any) {
    if (!functionSet.has(target)) {
      mockFunction(proxy, target, undefined, false)
    }
    return proxy
  },

  [returnsSpy](target: any, proxy: any) {
    if (!functionSet.has(target)) {
      mockFunction(proxy, target, undefined, true)
    }
    return proxy
  },

  [spy](target: any, proxy: any) {
    return functionSet.get(target)?.[spy] ?? mockFunction(proxy, target, undefined, true)
  },

  [set](_: any, proxy: any) {
    return proxy
  },

  [reset](target: any) {
    return () => {
      resetMocks(target)
    }
  },

  [reattach](target: any) {
    return () => {
      reattachProxy(target)
    }
  },
}

for (const key of spyMethods) {
  getTraps[key] = (target: any, proxy: any) => {
    const retObj = functionSet.get(target)
    if (retObj) {
      return retObj[spy][key]
    } else {
      const fun = mockFunction(proxy, target, undefined, true)
      return (fun as any)[key]
    }
  }
}

const setTraps: { [index: symbol]: (target: any, newVal: any, proxy: any) => any } = {
  [returns](target: any, newVal: any, proxy: any) {
    const retObj = functionSet.get(target)
    if (retObj) {
      retObj.value = newVal
    } else {
      mockFunction(proxy, target, newVal, false)
    }
  },

  [returnsSpy](target: any, newVal: any, proxy: any) {
    const retObj = functionSet.get(target)
    if (retObj) {
      retObj[spy].mockReturnValue(newVal)
    } else {
      const fun = mockFunction(proxy, target, undefined, true)
      ;(fun as any).mockReturnValue(newVal)
    }
  },

  [set](target: any, newVal: any) {
    if (typeof newVal === 'object' && typeof target === 'object') {
      // avoid detaching the original target from its proxy
      for (const prop of Object.getOwnPropertyNames(target)) {
        delete target[prop]
      }
      Object.assign(target, newVal)
    } else {
      const meta = metaMap.get(target)
      if (!meta) {
        throw new Error('Cannot use [set] on a top-level munamuna')
      }
      meta.parent[meta.key] = newVal
    }
  },
}

export function createProxy(obj: any) {
  const proxy = new Proxy(obj, {
    get(target: any, key: string | symbol) {
      const trap = getTraps[key]
      if (trap) {
        return trap(target, proxy)
      }

      try {
        const existing = target[key]
        if (existing) {
          return munamuna(existing)
        }
      } catch {
        // vitest does something to the module that prevents checking if things exist
      }

      const newProp: any = {}
      metaMap.set(newProp, { parent: target, key })
      target[key] = newProp
      return munamuna(newProp)
    },

    set(target: any, key: string | symbol, newVal: any): boolean {
      const trap = setTraps[key as symbol]
      if (trap) {
        trap(target, newVal, proxy)
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

export function munamuna(obj: any = {}) {
  const existingProxy = proxyMap.get(obj)
  if (existingProxy) {
    return existingProxy
  } else {
    const proxy = createProxy(obj)
    proxyMap.set(obj, proxy)
    return proxy
  }
}

interface Setup {
  spyFunction: SpyFunction
}

export function setup({ spyFunction: spyFunctionParam }: Setup) {
  spyFunction = spyFunctionParam
}
