/**
 * Spec 8.1 / 8.20 — "the template plugin has no React or Lexical requirement".
 *
 * The root entry must load in a worker, a CLI or an email job that compiles
 * with `compileMarkdown` and never renders, so its module graph is asserted
 * to be free of React, Lexical and the editor. `/editor` is the one entry
 * that may import them.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src')
const FORBIDDEN = ['react', 'react-dom', 'react/jsx-runtime', '@react-markdown-kit/renderer', '@react-markdown-kit/editor', 'lexical', '@lexical/utils']

const IMPORT_PATTERN = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]/g
const BARE_IMPORT_PATTERN = /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g

function importsOf(file: string): string[] {
  // Type-only imports are erased at build time and pull nothing in.
  const code = readFileSync(file, 'utf8').replace(/import\s+type\s[\s\S]*?from\s+['"][^'"]+['"]/g, '')
  const found: string[] = []
  for (const pattern of [IMPORT_PATTERN, BARE_IMPORT_PATTERN]) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(code)) !== null) found.push(match[1] as string)
  }
  return found
}

function toPath(specifier: string, from: string): string | undefined {
  if (specifier.startsWith('.')) return resolve(dirname(from), specifier.replace(/\.js$/, '.ts'))
  if (specifier.startsWith('@internal/')) {
    return resolve(SRC, '../../../internal', specifier.slice('@internal/'.length).replace(/\.js$/, '.ts'))
  }
  return undefined
}

function moduleGraph(entry: string): { files: string[]; bare: Map<string, string[]> } {
  const files: string[] = []
  const bare = new Map<string, string[]>()
  const queue = [entry]
  const seen = new Set<string>()
  while (queue.length > 0) {
    const file = queue.pop() as string
    if (seen.has(file)) continue
    seen.add(file)
    files.push(file)
    for (const specifier of importsOf(file)) {
      const next = toPath(specifier, file)
      if (next === undefined) bare.set(specifier, [...(bare.get(specifier) ?? []), file])
      else queue.push(next)
    }
  }
  return { files, bare }
}

describe('the root entry is headless (spec 8.1)', () => {
  const graph = moduleGraph(resolve(SRC, 'index.ts'))

  it('reaches more than one module, so the walk is really happening', () => {
    expect(graph.files.length).toBeGreaterThan(8)
  })

  it.each(FORBIDDEN)('never imports %s', (specifier) => {
    const importers = graph.bare.get(specifier)
    expect(importers, `${specifier} is reachable from src/index.ts via ${importers?.join(', ')}`).toBeUndefined()
  })

  it('never reaches the editor entry or its nodes', () => {
    const reachable = graph.files.map((file) => file.replace(`${SRC}/`, ''))
    expect(reachable).not.toContain('editor.ts')
    expect(reachable.filter((file) => file.startsWith('editor/'))).toEqual([])
  })

  it('depends only on Markdown tooling', () => {
    const allowed = ['mdast-util-from-markdown', 'mdast', 'hast']
    for (const specifier of graph.bare.keys()) {
      expect(allowed, `unexpected dependency: ${specifier}`).toContain(specifier)
    }
  })

  it('exposes no standalone engine: the public surface is the two extensions', () => {
    const code = readFileSync(resolve(SRC, 'index.ts'), 'utf8')
    for (const removed of ['defineTemplate', 'toMarkdown', 'Template', 'resolve(']) {
      expect(code, `${removed} must not be exported`).not.toContain(`export { ${removed}`)
    }
    expect(code).toContain("export { template } from './extension.js'")
  })
})

describe('the editor entry is the only React-aware one', () => {
  it('editor.ts imports the editor package, and the root entry does not', () => {
    expect(importsOf(resolve(SRC, 'editor.ts'))).toContain('@react-markdown-kit/editor/lexical')
    expect(importsOf(resolve(SRC, 'index.ts'))).not.toContain('@react-markdown-kit/editor/lexical')
  })
})
