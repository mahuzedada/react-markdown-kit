import { defineConfig } from 'tsup'
import { cp } from 'node:fs/promises'

export default defineConfig({
  // `index` is the plugin (no React, no Lexical); `editor` adds the canvas.
  entry: { index: 'src/index.ts', editor: 'src/editor.ts' },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: true,
  external: ['react', 'react/jsx-runtime', 'react-dom', 'lexical', '@lexical/utils', '@react-markdown-kit/editor', '@react-markdown-kit/editor/lexical', '@react-markdown-kit/renderer'],
  tsconfig: 'tsconfig.json',
  async onSuccess() {
    await cp('src/styles.css', 'dist/styles.css')
  },
})
