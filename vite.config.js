import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  // Relative assets work both in localhost and under /GOGOGOGOGO/ on Pages.
  base: './',
  build: {
    rolldownOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        celular: fileURLToPath(new URL('./celular.html', import.meta.url)),
        monitoreo: fileURLToPath(new URL('./monitoreo.html', import.meta.url)),
      },
    },
  },
})
