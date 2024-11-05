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
  parent: any | undefined
  objKey: string | symbol

  (): void
}

function mockFunction(target: ProxyTarget, value: any, isReturnsSpy: boolean) {
  const { parent } = target
  if (!parent) {
    throw new Error('Cannot create a function on a top-level munamuna')
  }

  const { obj } = target

  // if there is a value then create a new object to host this value, allowing the value
  // to be altered via `retObj.value = blah` otherwise set the value to the previous object
  // so that path options on the original proxy can update the returned value
  const retObj: any = value === undefined ? { value: obj } : { value }

  const implementation = function () {
    return retObj.value
  }
  const fun: any = isReturnsSpy ? spyFunction(implementation) : implementation

  // the spy can be hosted in the returned object container, it's now detached and not used
  // for anything but the function return value
  retObj[spy] = isReturnsSpy ? fun : undefined

  functionSet.set(obj, retObj)

  parent[target.objKey] = fun
  proxyMap.set(fun, target.proxy)

  return fun
}

const getTraps: { [index: symbol | string]: (target: ProxyTarget) => any } = {
  [returns](target: ProxyTarget): any {
    if (!functionSet.has(target.obj)) {
      mockFunction(target, undefined, false)
    }
    return target.proxy
  },

  [returnsSpy](target: ProxyTarget): any {
    if (!functionSet.has(target.obj)) {
      mockFunction(target, undefined, true)
    }
    return target.proxy
  },

  [spy](target: ProxyTarget): Function {
    return functionSet.get(target.obj)?.[spy] ?? mockFunction(target, undefined, true)
  },

  [set]({ proxy }: ProxyTarget): any {
    return proxy
  },

  [reset]({ obj, proxy }: ProxyTarget): () => any {
    return (): any => {
      for (const prop of Object.getOwnPropertyNames(obj)) {
        delete obj[prop]
      }
      return proxy
    }
  },

  [detach]({ parent, objKey, proxy }: ProxyTarget): () => any {
    return (): any => {
      if (!parent) {
        throw new Error('Cannot detach a root munamuna')
      }
      delete parent[objKey]
      return proxy
    }
  },

  [reattach]({ obj, proxy, parent, objKey }): () => any {
    return (): any => {
      if (!parent) {
        throw new Error('Cannot reattach a top level proxy')
      }
      parent[objKey] = obj
      return proxy
    }
  },
}

for (const key of spyMethods) {
  getTraps[key] = (target: ProxyTarget) => {
    const retObj = functionSet.get(target.obj)
    if (retObj) {
      return retObj[spy][key]
    } else {
      const fun = mockFunction(target, undefined, true)
      return (fun as any)[key]
    }
  }
}

const setTraps: { [index: symbol]: (target: ProxyTarget, newVal: any) => any } = {
  [returns](target: ProxyTarget, newVal: any): void {
    const retObj = functionSet.get(target.obj)
    if (retObj) {
      retObj.value = newVal
    } else {
      mockFunction(target, newVal, false)
    }
  },

  [returnsSpy](target: ProxyTarget, newVal: any): void {
    const retObj = functionSet.get(target.obj)
    if (retObj) {
      retObj[spy].mockReturnValue(newVal)
    } else {
      const fun = mockFunction(target, undefined, true)
      ;(fun as any).mockReturnValue(newVal)
    }
  },

  [set](target: ProxyTarget, newVal: any): void {
    const { obj } = target
    if (typeof newVal === 'object') {
      if (Array.isArray(newVal)) {
        if (Array.isArray(obj)) {
          obj.length = 0
          obj.push(...newVal)
          return
        }
      } else if (!Array.isArray(obj)) {
        // they are both objects, avoid detaching the original object from its proxy
        for (const prop of Object.getOwnPropertyNames(obj)) {
          delete obj[prop]
        }
        Object.assign(obj, newVal)
        return
      }

      // type change from object to array or vice-versa
      target.obj = newVal
      // avoid creating a new proxy when newVal is accessed via the tree
      proxyMap.set(newVal, target.proxy)
    }

    const { parent } = target
    if (!parent) {
      throw new Error('Cannot use [set] on a top-level munamuna')
    }
    parent[target.objKey] = newVal
  },
}

const proxyHandler: ProxyHandler<ProxyTarget> = {
  get(target: ProxyTarget, key: string | symbol): any {
    const trap = getTraps[key]
    if (trap) {
      return trap(target)
    }

    const { obj } = target
    try {
      const existing = obj[key]
      if (existing) {
        const existingProxy = proxyMap.get(existing)
        if (existingProxy) {
          // console.log('reuse')
          return existingProxy
        } else {
          // console.log('create')
          return createProxy(existing, obj, key)
        }
      }
    } catch {
      // vitest does something to the module that prevents checking if things exist
    }

    const newProp: any = {}
    if (!isNaN(key as unknown as number)) {
      if (Array.isArray(obj)) {
        obj[key as unknown as number] = newProp
        return createProxy(newProp, obj, key)
      } else {
        const newObj: any[] = []
        newObj[key as unknown as number] = newProp
        target.obj = newObj
        const { parent } = target
        if (!parent) {
          throw new Error(
            'Something went badly wrong when converting a path from an array to an object, please report a bug',
          )
        }
        parent[target.objKey] = newObj
        return createProxy(newProp, newObj, key)
      }
    }

    if (Array.isArray(obj)) {
      const { parent } = target
      if (!parent) {
        throw new Error(
          'Something went badly wrong when converting a path from an object to an array, please report a bug',
        )
      }

      const newObj: any = {}
      newObj[key] = newProp
      target.obj = newObj
      parent[target.objKey] = newObj
      return createProxy(newProp, newObj, key)
    }

    obj[key] = newProp
    return createProxy(newProp, obj, key)
  },

  set(target: ProxyTarget, key: string | symbol, newVal: any): boolean {
    const { obj } = target
    const trap = setTraps[key as symbol]
    if (trap) {
      trap(target, newVal)
      return true
    }

    if (!isNaN(key as unknown as number)) {
      // have an assignment to a numeric property
      if (Array.isArray(obj)) {
        obj[key as unknown as number] = newVal
      } else {
        const { parent } = target
        if (!parent) {
          throw new Error('Cannot set an array index on a top-level munamuna')
        }

        const associatedObj = parent[target.objKey]
        if (Array.isArray(associatedObj)) {
          // A reference was created to this proxy before the array was assigned using a
          // different proxy. This proxy will then continue to target the default object
          // created by default when a `get` is trapped, so retarget it here
          target.obj = associatedObj
          associatedObj[key as unknown as number] = newVal
        } else {
          const newArray: any[] = []
          parent[target.objKey] = newArray
          proxyMap.set(newArray, target.proxy)
          newArray[key as unknown as number] = newVal
          target.obj = newArray
        }
      }
      return true
    }

    if (typeof newVal === 'object') {
      if (newVal instanceof Function) {
        // although it wouldn't be hard to support and might be useful for interop
        throw new Error(
          'Use [returnsSpy], function call syntax or [returns] to create a spy or function',
        )
      }

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
      }

      // from object to array or vice-versa
      obj[key] = newVal
      return true
    }

    if (Array.isArray(obj)) {
      // overwrite array with primitive
      const { parent } = target
      if (!parent) {
        throw new Error('Something went badly wrong when overwriting an array, please report a bug')
      }
      const newObj: any = {}

      parent[target.objKey] = newObj
      proxyMap.set(newObj, target.proxy)
      newObj[key] = newVal
      target.obj = newObj
      return true
    }

    obj[key] = newVal
    return true
  },

  apply(target: ProxyTarget): any {
    if (!functionSet.has(target.obj)) {
      mockFunction(target, undefined, true)
    }
    return target.proxy
  },
}

export function createProxy(obj: any, parent: any | undefined, objKey: string | symbol) {
  // the proxy has to be a function or the apply trap cannot work
  const dummyFunction: ProxyTarget = () => {}
  dummyFunction.obj = obj
  dummyFunction.parent = parent
  dummyFunction.objKey = objKey
  const proxy: any = new Proxy(dummyFunction, proxyHandler)
  dummyFunction.proxy = proxy
  proxyMap.set(obj, proxy)
  return proxy
}

export function munamuna(obj: any): any {
  return proxyMap.get(obj) ?? createProxy(obj, undefined, 'root')
}

interface Setup {
  spyFunction: SpyFunction
}

export function setup({ spyFunction: spyFunctionParam }: Setup): void {
  spyFunction = spyFunctionParam
}
