/* eslint-disable @typescript-eslint/no-unused-vars */

export function returnNumber(): number {
  return 420
}

export function returnNestedNumber(): { nested: number } {
  return { nested: 420 }
}

export class DeeplyNestedObjects {
  outer: {
    inner: {
      getStuff: (val: number) => {
        deep: {
          veryDeep: number
        }
      }
    }
  }

  constructor() {
    this.outer = {
      inner: {
        getStuff: (_val: number) => ({ deep: { veryDeep: 420 } }),
      },
    }
  }
}

export class MultipleDeeplyNestedObjects {
  outer: {
    inner: {
      getStuff: (val: number) => {
        deep: {
          veryDeep: number
          alsoVeryDeep: number
        }
      }
    }
  }

  constructor() {
    this.outer = {
      inner: {
        getStuff: (_val: number) => ({
          deep: {
            veryDeep: 420,
            alsoVeryDeep: 421,
          },
        }),
      },
    }
  }
}
