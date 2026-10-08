import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { ChakraProvider, Checkbox } from '@chakra-ui/react'
import { createElement } from 'react'
import { setupServer } from 'msw/node'

export const server = setupServer()

Object.defineProperty(window, 'matchMedia', {
  value: (query: string) => ({
    matches: false,
    media: query,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return false },
  }),
})
HTMLElement.prototype.scrollIntoView = () => {}

beforeAll(() => {
  // Initialize Chakra's global focus tracking before user-event installs its focus interceptor.
  render(createElement(ChakraProvider, null, createElement(Checkbox)))
  cleanup()
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => {
  cleanup()
  server.resetHandlers()
})
afterAll(() => server.close())
