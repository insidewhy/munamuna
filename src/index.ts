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

function mockFunction(proxy: any, obj: any, value: any, isReturnsSpy: boolean) {
  const meta = metaMap.get(obj)
  if (!meta) {
    throw new Error('Cannot create a function on a top-level munamuna')
  }

  const prevTarget = meta.parent[meta.key]

  // if there is a value then create a new object to host this value, allowing the value
  // to be altered via `retObj.value = blah` otherwise set the value to the previous object
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

const getTraps: { [index: symbol | string]: (obj: any, proxy: any) => any } = {
  [returns](obj: any, proxy: any) {
    if (!functionSet.has(obj)) {
      mockFunction(proxy, obj, undefined, false)
    }
    return proxy
  },

  [returnsSpy](obj: any, proxy: any) {
    if (!functionSet.has(obj)) {
      mockFunction(proxy, obj, undefined, true)
    }
    return proxy
  },

  [spy](obj: any, proxy: any) {
    return functionSet.get(obj)?.[spy] ?? mockFunction(proxy, obj, undefined, true)
  },

  [set](_: any, proxy: any) {
    return proxy
  },

  [reset](obj: any) {
    return () => {
      for (const prop of Object.getOwnPropertyNames(obj)) {
        delete obj[prop]
      }

      const meta = metaMap.get(obj)
      if (meta) {
        delete meta.parent[meta.key]
      }
    }
  },

  [reattach](obj: any) {
    return () => {
      const meta = metaMap.get(obj)
      if (!meta) {
        throw new Error('Cannot reattach a top level proxy')
      }
      meta.parent[meta.key] = obj
    }
  },
}

for (const key of spyMethods) {
  getTraps[key] = (obj: any, proxy: any) => {
    const retObj = functionSet.get(obj)
    if (retObj) {
      return retObj[spy][key]
    } else {
      const fun = mockFunction(proxy, obj, undefined, true)
      return (fun as any)[key]
    }
  }
}

const setTraps: { [index: symbol]: (obj: any, newVal: any, proxy: any) => any } = {
  [returns](obj: any, newVal: any, proxy: any) {
    const retObj = functionSet.get(obj)
    if (retObj) {
      retObj.value = newVal
    } else {
      mockFunction(proxy, obj, newVal, false)
    }
  },

  [returnsSpy](obj: any, newVal: any, proxy: any) {
    const retObj = functionSet.get(obj)
    if (retObj) {
      retObj[spy].mockReturnValue(newVal)
    } else {
      const fun = mockFunction(proxy, obj, undefined, true)
      ;(fun as any).mockReturnValue(newVal)
    }
  },

  [set](obj: any, newVal: any) {
    if (typeof newVal === 'object' && typeof obj === 'object') {
      // avoid detaching the original object from its proxy
      for (const prop of Object.getOwnPropertyNames(obj)) {
        delete obj[prop]
      }
      Object.assign(obj, newVal)
    } else {
      const meta = metaMap.get(obj)
      if (!meta) {
        throw new Error('Cannot use [set] on a top-level munamuna')
      }
      meta.parent[meta.key] = newVal
    }
  },
}

// all proxies wrap this same dummy function, this allows intercepting calls to
// apply
function dummyFunction() {}

export function createProxy(obj: any) {
  const proxy: ProxyConstructor = new Proxy(dummyFunction, {
    get(_: any, key: string | symbol) {
      const trap = getTraps[key]
      if (trap) {
        return trap(obj, proxy)
      }

      try {
        const existing = obj[key]
        if (existing) {
          return munamuna(existing)
        }
      } catch {
        // vitest does something to the module that prevents checking if things exist
      }

      const newProp: any = {}
      metaMap.set(newProp, { parent: obj, key })
      obj[key] = newProp
      return munamuna(newProp)
    },

    set(_: any, key: string | symbol, newVal: any): boolean {
      const trap = setTraps[key as symbol]
      if (trap) {
        trap(obj, newVal, proxy)
      } else {
        let assignObj: any
        if (typeof newVal === 'object' && typeof (assignObj = obj[key]) === 'object') {
          for (const prop of Object.getOwnPropertyNames(assignObj)) {
            delete obj[prop]
          }
          Object.assign(assignObj, newVal)
        } else {
          obj[key] = newVal
        }
      }

      return true
    },

    apply() {
      if (!functionSet.has(obj)) {
        mockFunction(proxy, obj, undefined, true)
      }
      return proxy
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
