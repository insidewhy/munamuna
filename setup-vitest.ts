import { vi } from 'vitest'

import { setup } from './src/index'

setup({ spyFunction: vi.fn })
