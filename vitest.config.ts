import { defineConfig } from 'vitest/config'

/**
 * Vitest-Config: läuft eigenständig (ohne vite.config.ts, um den
 * PWA-Plugin nicht zu laden). Alle Tests deterministisch, ohne Netz.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
})
