import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'https://admin-fixture.invalid' } },
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.tsx'],
    testTimeout: 15000,
  },
})
