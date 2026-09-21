/**
 * Two builds, one package.
 *
 * `index` is the headless plugin: no React, no Lexical, safe in a server
 * component. `present` and `editor` are client entries and must start with
 * `'use client'`; tsup's code splitting drops a directive that lives in a
 * source file, so those two are built by a second config that prepends it as
 * a banner. Both configs leave `dist` alone (`clean: false`); the build
 * script empties it once before tsup runs, so the second build cannot erase
 * the first.
 */
import { defineConfig, type Options } from 'tsup'
import { cp } from 'node:fs/promises'

const shared: Options = {
  format: ['esm'],
  dts: true,
  clean: false,
  sourcemap: true,
  treeshake: true,
  external: [
    'react',
    'react/jsx-runtime',
    'react-dom',
    'lexical',
    '@lexical/utils',
    '@react-markdown-kit/editor',
    '@react-markdown-kit/editor/lexical',
    '@react-markdown-kit/renderer',
  ],
  tsconfig: 'tsconfig.json',
}

export default defineConfig([
  {
    ...shared,
    entry: { index: 'src/index.ts' },
    async onSuccess() {
      await cp('src/styles.css', 'dist/styles.css')
    },
  },
  {
    ...shared,
    entry: { present: 'src/present.ts', editor: 'src/editor.ts' },
    splitting: true,
    banner: { js: "'use client';" },
    // tsup's treeshake pass runs rollup over esbuild's output and drops a
    // module-level directive ("Module level directives cause errors when
    // bundled ... was ignored"), banner included. esbuild already
    // tree-shakes ESM, so the client entries skip that pass and keep it.
    treeshake: false,
  },
])
