import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { seo } from '../shared/vite-seo'

export default defineConfig({
  plugins: [react(), seo({ url: 'https://slides.reactmarkdownkit.com' })],
  build: { outDir: 'build' },
})
