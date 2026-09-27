import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { seo } from '../shared/vite-seo'

export default defineConfig({
  plugins: [react(), tailwindcss(), seo({ url: 'https://editor.reactmarkdownkit.com' })],
  build: { outDir: 'build' },
})
