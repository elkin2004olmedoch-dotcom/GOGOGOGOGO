import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // Relative assets work both in localhost and under /GOGOGOGOGO/ on Pages.
  base: './',
})
