import { defineConfig } from 'tsup'
import { cp } from 'node:fs/promises'

export default defineConfig({
  // `lexical` is the extension-author entry: the one place Lexical types are public.
  // `table-of-contents` carries no Lexical, for pages that only want the heading list.
  entry: { index: 'src/index.ts', lexical: 'src/lexical.ts', 'table-of-contents': 'src/table-of-contents.ts' },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: true,
  external: ['react', 'react-dom', 'react/jsx-runtime', '@react-markdown-kit/renderer'],
  // `@internal/*` is build-time shared source: it compiles into each package so
  // no third public package exists (spec 3.3).
  tsconfig: 'tsconfig.json',
  async onSuccess() {
    await cp('src/styles.css', 'dist/styles.css')
  },
})
