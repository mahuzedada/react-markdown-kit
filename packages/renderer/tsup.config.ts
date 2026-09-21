import { defineConfig } from 'tsup'
import { cp, mkdir, chmod } from 'node:fs/promises'

export default defineConfig({
  entry: { index: 'src/index.ts', gfm: 'src/gfm.ts' },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: true,
  external: ['react', 'react/jsx-runtime'],
  // `@internal/*` is build-time shared source: it compiles into each package so
  // no third public package exists (spec 3.3).
  tsconfig: 'tsconfig.json',
  async onSuccess() {
    await cp('src/styles.css', 'dist/styles.css')
    // The migration CLIs ship as plain ESM: they are run once by a human with
    // npx, so bundling them would only make the output harder to audit.
    await mkdir('dist/codemod', { recursive: true })
    for (const file of ['migrate.mjs', 'compare.mjs']) {
      await cp(`src/codemod/${file}`, `dist/codemod/${file}`)
      await chmod(`dist/codemod/${file}`, 0o755)
    }
  },
})
