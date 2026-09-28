/**
 * Two builds, one package.
 *
 * `index` is the headless plugin: no React, no Lexical, safe in a server
 * component; `pptx` is the PowerPoint export, also free of React. `present` and `editor` are client entries and must start with
 * `'use client'`; tsup's code splitting drops a directive that lives in a
 * source file, so those two are built by a second config that prepends it as
 * a banner. Both configs leave `dist` alone (`clean: false`); the build
 * script empties it once before tsup runs, so the second build cannot erase
 * the first.
 */
import { defineConfig, type Options } from 'tsup'
import { readFile, readdir, writeFile } from 'node:fs/promises'

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
    'pptxgenjs',
  ],
  tsconfig: 'tsconfig.json',
}

/** The shipped styles.css: every file of src/styles/, one per concern, joined in name order. */
async function joinStyles(directory: string): Promise<string> {
  const names = (await readdir(directory)).filter((name) => name.endsWith('.css')).sort()
  const parts = await Promise.all(names.map((name) => readFile(`${directory}/${name}`, 'utf8')))
  return parts.map((part) => part.trimEnd()).join('\n\n') + '\n'
}

export default defineConfig([
  {
    ...shared,
    entry: { index: 'src/index.ts', pptx: 'src/pptx.ts' },
    async onSuccess() {
      await writeFile('dist/styles.css', await joinStyles('src/styles'))
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
