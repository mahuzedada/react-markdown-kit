import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const src = (path: string): string => new URL(path, import.meta.url).pathname

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Subpaths before their package root: aliases match in order.
    alias: {
      '@internal': src('./internal'),
      '@react-markdown-kit/renderer/gfm': src('./packages/renderer/src/gfm.ts'),
      '@react-markdown-kit/renderer': src('./packages/renderer/src/index.ts'),
      '@react-markdown-kit/editor/lexical': src('./packages/editor/src/lexical.ts'),
      '@react-markdown-kit/editor': src('./packages/editor/src/index.ts'),
      '@react-markdown-kit/template/editor': src('./plugins/template/src/editor.ts'),
      '@react-markdown-kit/template': src('./plugins/template/src/index.ts'),
      '@react-markdown-kit/mermaid/editor': src('./plugins/mermaid/src/editor.ts'),
      '@react-markdown-kit/mermaid': src('./plugins/mermaid/src/index.ts'),
      '@react-markdown-kit/slides/present': src('./plugins/slides/src/present.ts'),
      '@react-markdown-kit/slides/editor': src('./plugins/slides/src/editor.ts'),
      '@react-markdown-kit/slides': src('./plugins/slides/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}', 'packages/*/tests/**/*.test.{ts,tsx}', 'plugins/*/tests/**/*.test.{ts,tsx}'],
    environmentMatchGlobs: [
      ['**/*.dom.test.{ts,tsx}', 'jsdom'],
      ['packages/editor/**', 'jsdom'],
      ['plugins/template/tests/editor*', 'jsdom'],
      ['plugins/mermaid/tests/editor*', 'jsdom'],
      ['plugins/slides/tests/editor*', 'jsdom'],
      ['packages/renderer/tests/render*', 'jsdom'],
    ],
  },
})
