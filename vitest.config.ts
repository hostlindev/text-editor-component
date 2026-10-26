import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.spec.ts'],
    globals: false,
    restoreMocks: true,
    // Vuetify ships per-component CSS imports; Vite must transform them
    // instead of letting Node try to load `.css` as a module.
    server: {
      deps: {
        inline: ['vuetify'],
      },
    },
  },
})
