/**
 * Packaging and dependency gates (spec 12.2, 12.3) and the styling contract
 * (docs/STYLING.md).
 *
 * These assert the boundaries that make the split real: the renderer and the
 * editor, and three plugin packages (template, diagrams, slides) that are only ever
 * used through the extension system. They run
 * against manifests and source, and `scripts/pack-check.mjs` runs the heavier
 * tarball-install version in CI.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const readJson = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'))

const renderer = readJson('packages/renderer/package.json')
const editor = readJson('packages/editor/package.json')
const template = readJson('plugins/template/package.json')
const diagrams = readJson('plugins/mermaid/package.json')
const slides = readJson('plugins/slides/package.json')
const PLUGINS = [
  ['template', template],
  ['mermaid', diagrams],
  ['slides', slides],
] as const

/** The factory each plugin's root entry must export. */
const FACTORY_NAME: Record<(typeof PLUGINS)[number][0], string> = { template: 'template', mermaid: 'mermaid', slides: 'slides' }

/** Anything that would force a styling system on a consumer. */
const STYLING_PACKAGES = [
  'tailwindcss',
  '@zuilib/tokens',
  '@zuilib/primitives',
  'styled-components',
  '@emotion/react',
  '@emotion/styled',
  '@mui/material',
  'bootstrap',
  'bulma',
  '@chakra-ui/react',
]

const allDeps = (pkg: Record<string, Record<string, string> | undefined>) => ({
  ...(pkg['dependencies'] ?? {}),
  ...(pkg['peerDependencies'] ?? {}),
})

describe('styling independence (docs/STYLING.md)', () => {
  for (const [name, pkg] of [['renderer', renderer], ['editor', editor], ...PLUGINS] as const) {
    it(`${name} depends on no styling system`, () => {
      const deps = Object.keys(allDeps(pkg))
      for (const styling of STYLING_PACKAGES) {
        expect(deps, `${name} must not depend on ${styling}`).not.toContain(styling)
      }
      expect(deps.filter((d) => d.startsWith('@zuilib/'))).toEqual([])
    })
  }

  it('renderer peers on react only', () => {
    expect(Object.keys(renderer.peerDependencies)).toEqual(['react'])
  })

  it('editor peers on react, react-dom and the renderer only', () => {
    expect(Object.keys(editor.peerDependencies).sort()).toEqual([
      '@react-markdown-kit/renderer',
      'react',
      'react-dom',
    ])
  })

  it('shipped stylesheets are opt-in, not side effects of importing the package', () => {
    // `sideEffects: ["*.css"]` marks only CSS as side-effectful, so a bundler
    // tree-shakes the JS and never auto-injects styles.
    expect(renderer.sideEffects).toEqual(['*.css'])
    expect(editor.sideEffects).toEqual(['*.css'])
  })

  it('stylesheets are a separate export a consumer must ask for', () => {
    expect(renderer.exports['./styles.css']).toBeDefined()
    expect(editor.exports['./styles.css']).toBeDefined()
    // The main entry must not pull CSS in.
    expect(JSON.stringify(renderer.exports['.'])).not.toContain('.css')
  })
})

describe('package boundaries (spec 3.1, 12.3)', () => {
  it('renderer does not depend on the editor', () => {
    const deps = Object.keys(allDeps(renderer))
    expect(deps).not.toContain('@react-markdown-kit/editor')
  })

  it('the renderer and the editor carry no plugin code', () => {
    for (const pkg of [renderer, editor]) {
      expect(pkg.exports['./template']).toBeUndefined()
      expect(pkg.exports['./diagrams']).toBeUndefined()
      expect(pkg.exports['./slides']).toBeUndefined()
      const deps = Object.keys(allDeps(pkg))
      expect(deps).not.toContain('@react-markdown-kit/template')
      expect(deps).not.toContain('@react-markdown-kit/mermaid')
      expect(deps).not.toContain('@react-markdown-kit/slides')
    }
    for (const dir of [
      'packages/renderer/src/template',
      'packages/renderer/src/diagrams',
      'packages/renderer/src/slides',
      'packages/editor/src/template',
      'packages/editor/src/diagrams',
      'packages/editor/src/slides',
    ]) {
      expect(existsSync(join(root, dir)), `${dir} must not exist`).toBe(false)
    }
  })

  for (const [name, pkg] of PLUGINS) {
    it(`${name} is a plugin: React, Lexical, the renderer and the editor are optional peers, never hard dependencies`, () => {
      const hard = Object.keys(pkg.dependencies ?? {})
      expect(hard).not.toContain('react')
      expect(hard.filter((d: string) => d === 'lexical' || d.startsWith('@lexical/'))).toEqual([])
      expect(hard).not.toContain('@react-markdown-kit/renderer')
      expect(hard).not.toContain('@react-markdown-kit/editor')
      for (const optional of ['react', 'lexical', '@react-markdown-kit/editor']) {
        expect(pkg.peerDependenciesMeta?.[optional]?.optional, `${optional} must be optional`).toBe(true)
      }
      expect(pkg.exports['./editor']).toBeDefined()
      expect(pkg.exports['./styles.css']).toBeDefined()
    })

    it(`${name}'s root entry exports extension and kind factories, types, schemas; no standalone API`, () => {
      // Configuration values only: the extension factory and, for mermaid,
      // the diagram kind factories (`flowchart()`, `sequenceDiagram()`) it
      // takes as options, plus types and JSON Schemas. No parser, renderer
      // or writer is reachable on its own.
      const source = readFileSync(join(root, `plugins/${name}/src/index.ts`), 'utf8')
      const named = [...source.matchAll(/^export \{ ([^}]+) \} from/gm)].flatMap((m) => (m[1] as string).split(',').map((s) => s.trim()))
      expect(named).toContain(FACTORY_NAME[name])
      for (const forbidden of ['defineTemplate', 'toMarkdown', 'Template', 'parseDiagram', 'renderDrawingSvg', 'drawingToMermaid']) {
        expect(named, `${forbidden} must not be a public export of ${name}`).not.toContain(forbidden)
      }
    })
  }

  it('renderer has no Lexical anywhere in its dependency list', () => {
    const deps = Object.keys(allDeps(renderer))
    expect(deps.filter((d) => d === 'lexical' || d.startsWith('@lexical/'))).toEqual([])
  })

  it('no published dependency range uses the workspace protocol', () => {
    // `workspace:^` is a pnpm-only spec. It survives `npm pack` verbatim and
    // makes the tarball uninstallable with `npm error EUNSUPPORTEDPROTOCOL`.
    // devDependencies are exempt: a consumer never installs them.
    for (const [name, pkg] of [['renderer', renderer], ['editor', editor], ...PLUGINS] as const) {
      for (const field of ['dependencies', 'peerDependencies'] as const) {
        for (const [dep, range] of Object.entries(pkg[field] ?? {})) {
          expect(String(range), `${name} ${field}.${dep} must be a real semver range`).not.toMatch(
            /^workspace:/,
          )
        }
      }
    }
  })

  it('sibling peer ranges are satisfied by the versions in this repo', () => {
    const versions: Record<string, string> = {
      '@react-markdown-kit/renderer': renderer.version,
      '@react-markdown-kit/editor': editor.version,
      '@react-markdown-kit/template': template.version,
      '@react-markdown-kit/mermaid': diagrams.version,
      '@react-markdown-kit/slides': slides.version,
    }
    for (const pkg of [renderer, editor, template, diagrams, slides]) {
      for (const [dep, range] of Object.entries(pkg.peerDependencies ?? {})) {
        const actual = versions[dep]
        if (actual === undefined) continue
        // A caret range on 0.x only matches the same minor, so keep them aligned.
        expect(String(range).replace(/^[\^~]/, ''), `${pkg.name} peers on ${dep}`).toBe(actual)
      }
    }
  })

  it('every package exports its own package.json for tooling', () => {
    for (const pkg of [renderer, editor, template, diagrams, slides]) {
      expect(pkg.exports['./package.json']).toBe('./package.json')
    }
  })
})

describe('server compatibility (spec 6.8)', () => {
  const rendererSources = [
    'packages/renderer/src/index.ts',
    'packages/renderer/src/markdown.tsx',
    'packages/renderer/src/compile.ts',
    'packages/renderer/src/policy.ts',
    'packages/renderer/src/gfm.ts',
  ]

  it('no renderer module carries a "use client" directive', () => {
    for (const file of rendererSources) {
      const source = readFileSync(join(root, file), 'utf8')
      expect(source.slice(0, 200), `${file} must stay server-renderable`).not.toMatch(
        /^\s*['"]use client['"]/m,
      )
    }
  })

  it('no renderer module imports the editor, Lexical or a browser global', () => {
    for (const file of rendererSources) {
      const source = readFileSync(join(root, file), 'utf8')
      expect(source).not.toMatch(/from\s+['"]lexical['"]/)
      expect(source).not.toMatch(/from\s+['"]@lexical\//)
      expect(source).not.toMatch(/from\s+['"]@react-markdown-kit\/editor['"]/)
      expect(source).not.toMatch(/\bdocument\.(getElementById|createElement|querySelector)\b/)
      expect(source).not.toMatch(/\bwindow\./)
    }
  })
})

/** Follows the import graph from `rootEntry`, staying inside its package, and asserts every specifier is headless. */
function expectHeadless(rootEntry: string): void {
  const seen = new Set<string>()
  const visit = (relative: string): void => {
    if (seen.has(relative)) return
    seen.add(relative)
    const path = join(root, relative)
    if (!existsSync(path)) return
    // Type-only imports are erased at build time and pull nothing in.
    const source = readFileSync(path, 'utf8').replace(/import\s+type\s[\s\S]*?from\s+['"][^'"]+['"]/g, '')
    for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const specifier = match[1]!
      expect(specifier, `${relative} must stay headless`).not.toBe('react')
      expect(specifier).not.toMatch(/^react($|\/)/)
      expect(specifier).not.toMatch(/^react-dom/)
      expect(specifier).not.toMatch(/^@?lexical/)
      expect(specifier).not.toBe('@react-markdown-kit/renderer')
      expect(specifier).not.toBe('@react-markdown-kit/editor')
      if (specifier.startsWith('.')) {
        const dir = relative.slice(0, relative.lastIndexOf('/'))
        visit(normalize(`${dir}/${specifier.replace(/\.js$/, '.ts')}`))
      } else if (specifier.startsWith('@internal/')) {
        visit(`internal/${specifier.slice('@internal/'.length).replace(/\.js$/, '.ts')}`)
      }
    }
  }
  visit(rootEntry)
  expect(seen.size).toBeGreaterThan(0)
}

describe('plugin root entries are headless (spec 8.20 gate 1)', () => {
  it('the template root entry imports no React, renderer, editor or Lexical', () => {
    expectHeadless('plugins/template/src/index.ts')
  })
  it('the diagrams root entry imports no React, renderer, editor or Lexical (the canvas lives on /editor)', () => {
    expectHeadless('plugins/mermaid/src/index.ts')
  })
  it('the slides root entry imports no React, renderer, editor or Lexical (the deck component lives on /present)', () => {
    expectHeadless('plugins/slides/src/index.ts')
  })
})

function normalize(path: string): string {
  const parts: string[] = []
  for (const part of path.split('/')) {
    if (part === '.' || part === '') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return parts.join('/')
}
