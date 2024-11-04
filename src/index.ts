/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-function-type */
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
export const detach = Symbol('detach')
export const reattach = Symbol('reattach')

type SpyFunction = (option?: any) => Spy

let spyFunction: SpyFunction

const proxyMap = new WeakMap<any, ProxyConstructor>()

// maps the mock data to the return object container
const functionSet = new WeakMap<any, any>()

interface ProxyTarget {
  obj: any
  proxy: any

  (): void
}

interface ProxyMeta {
  key: string | symbol
  parent: any
}

const metaMap = new WeakMap<any, ProxyMeta>()

function mockFunction(proxy: ProxyConstructor, obj: any, value: any, isReturnsSpy: boolean) {
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

  // the spy can be hosted in the returned object container, it's now detached and not used
  // for anything but the function return value
  retObj[spy] = isReturnsSpy ? fun : undefined

  functionSet.set(prevTarget, retObj)

  meta.parent[meta.key] = fun
  metaMap.set(fun, meta)
  proxyMap.set(fun, proxy)

  return fun
}

const getTraps: { [index: symbol | string]: (obj: any, proxy: any) => any } = {
  [returns](obj: any, proxy: any): any {
    if (!functionSet.has(obj)) {
      mockFunction(proxy, obj, undefined, false)
    }
    return proxy
  },

  [returnsSpy](obj: any, proxy: any): any {
    if (!functionSet.has(obj)) {
      mockFunction(proxy, obj, undefined, true)
    }
    return proxy
  },

  [spy](obj: any, proxy: any): Function {
    return functionSet.get(obj)?.[spy] ?? mockFunction(proxy, obj, undefined, true)
  },

  [set](_: any, proxy: any): any {
    return proxy
  },

  [reset](obj: any, proxy: any): () => any {
    return (): any => {
      for (const prop of Object.getOwnPropertyNames(obj)) {
        delete obj[prop]
      }
      return proxy
    }
  },

  [detach](obj: any, proxy: any): () => any {
    return (): any => {
      const meta = metaMap.get(obj)
      if (!meta) {
        throw new Error('Cannot detach a root munamuna')
      }
      delete meta.parent[meta.key]
      return proxy
    }
  },

  [reattach](obj: any, proxy: any): () => any {
    return (): any => {
      const meta = metaMap.get(obj)
      if (!meta) {
        throw new Error('Cannot reattach a top level proxy')
      }
      meta.parent[meta.key] = obj
      return proxy
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
  [returns](obj: any, newVal: any, proxy: any): void {
    const retObj = functionSet.get(obj)
    if (retObj) {
      retObj.value = newVal
    } else {
      mockFunction(proxy, obj, newVal, false)
    }
  },

  [returnsSpy](obj: any, newVal: any, proxy: any): void {
    const retObj = functionSet.get(obj)
    if (retObj) {
      retObj[spy].mockReturnValue(newVal)
    } else {
      const fun = mockFunction(proxy, obj, undefined, true)
      ;(fun as any).mockReturnValue(newVal)
    }
  },

  [set](obj: any, newVal: any): void {
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

const proxyHandler: ProxyHandler<ProxyTarget> = {
  get(target: ProxyTarget, key: string | symbol): any {
    const { obj, proxy } = target
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
    if (Array.isArray(obj)) {
      const meta = metaMap.get(obj)
      if (!meta) {
        throw new Error(
          'Something went badly wrong when accesing a path that used to be an array, please report a bug',
        )
      }

      const newObj: any = {}
      newObj[key] = newProp
      target.obj = newObj
      meta.parent[meta.key] = newObj
      metaMap.set(newObj, meta)
      proxyMap.set(newObj, proxy)
      metaMap.set(newProp, { parent: newObj, key })
    } else {
      obj[key] = newProp
      metaMap.set(newProp, { parent: obj, key })
    }

    return munamuna(newProp)
  },

  set(target: ProxyTarget, key: string | symbol, newVal: any): boolean {
    const { obj, proxy } = target
    const trap = setTraps[key as symbol]
    if (trap) {
      trap(obj, newVal, proxy)
      return true
    }

    if (!isNaN(key as unknown as number)) {
      // have an assignment to a numeric property
      if (Array.isArray(obj)) {
        obj[key as unknown as number] = newVal
      } else {
        const meta = metaMap.get(obj)
        if (!meta) {
          throw new Error('Cannot set an array index on a top-level munamuna')
        }

        const newArray: any[] = []
        meta.parent[meta.key] = newArray
        metaMap.set(newArray, meta)
        proxyMap.set(newArray, proxy)
        newArray[key as unknown as number] = newVal
        target.obj = newArray
      }
      return true
    }

    if (typeof newVal === 'object') {
      const objToAssignTo = obj[key]
      if (typeof objToAssignTo === 'object') {
        if (Array.isArray(newVal)) {
          if (Array.isArray(objToAssignTo)) {
            // they are both arrays
            objToAssignTo.length = 0
            objToAssignTo.push(...newVal)
            return true
          }
        } else if (!Array.isArray(objToAssignTo)) {
          // they are both objects
          for (const prop of Object.getOwnPropertyNames(objToAssignTo)) {
            delete obj[prop]
          }
          Object.assign(objToAssignTo, newVal)
          return true
        }

        // one is an array and one is an object
        const meta = metaMap.get(objToAssignTo)
        if (!meta) {
          throw new Error('Cannot reassign an object to a top-level munamuna')
        }

        meta.parent[meta.key] = newVal
        metaMap.set(newVal, { parent: obj, key })
        return true
      }

      obj[key] = newVal
      // TODO: more needed here? target?
      // TODO: is this line correct? need more tests involving array->object and vice-versa
      metaMap.set(newVal, { parent: obj, key })
      return true
    }

    if (Array.isArray(obj)) {
      // overwrite array as object
      const meta = metaMap.get(obj)
      if (!meta) {
        throw new Error('Something went badly wrong when overwriting an array, please report a bug')
      }
      const newObj: any = {}

      meta.parent[meta.key] = newObj
      metaMap.set(newObj, meta)
      proxyMap.set(newObj, proxy)
      newObj[key] = newVal

      target.obj = newObj
      return true
    }

    obj[key] = newVal
    return true
  },

  apply({ obj, proxy }: ProxyTarget): any {
    if (!functionSet.has(obj)) {
      mockFunction(proxy, obj, undefined, true)
    }
    return proxy
  },
}

export function createProxy(obj: any): any {
  // the proxy has to be a function or the apply trap cannot work
  const dummyFunction: ProxyTarget = () => {}
  dummyFunction.obj = obj
  const proxy: any = new Proxy(dummyFunction, proxyHandler)
  dummyFunction.proxy = proxy
  return proxy
}

export function munamuna(obj: any = {}): any {
  const existingProxy = proxyMap.get(obj)
  // console.log(existingProxy ? 'reuse' : 'create')
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

export function setup({ spyFunction: spyFunctionParam }: Setup): void {
  spyFunction = spyFunctionParam
}
