import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import dts from 'vite-plugin-dts'

/**
 * Dev server (`pnpm dev`) serves the playground in `playground/`.
 * `pnpm build` compiles the library in `src/` as ESM + CJS plus type declarations.
 *
 * `vue`, `vuetify` and every `@tiptap/*` package stay external:
 * bundling a second copy of them (ProseMirror especially) breaks identity checks
 * and duplicates runtime state in the host application.
 */
export default defineConfig(({ command }) => ({
  plugins: [
    vue(),
    command === 'serve' ? vueDevTools() : undefined,
    command === 'build'
      ? dts({
          include: ['src'],
          exclude: ['src/**/__tests__/**', 'src/**/*.spec.ts'],
          insertTypesEntry: true,
          tsconfigPath: './tsconfig.app.json',
        })
      : undefined,
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      name: 'VueVuetifyPdfDesigner',
      formats: ['es', 'cjs'],
      fileName: (format) =>
        format === 'es'
          ? 'vue-vuetify-pdf-designer.js'
          : 'vue-vuetify-pdf-designer.cjs',
      cssFileName: 'vue-vuetify-pdf-designer',
    },
    rollupOptions: {
      external: ['vue', 'vuetify', /^vuetify\/.*/, /^@tiptap\/.*/],
      output: {
        globals: {
          vue: 'Vue',
          vuetify: 'Vuetify',
        },
        // The entry exposes a default plugin plus named components/helpers.
        // Declaring named exports keeps the CJS build predictable:
        // `require('pkg').default` is the plugin, the rest are properties.
        exports: 'named',
      },
    },
    sourcemap: true,
  },
}))
