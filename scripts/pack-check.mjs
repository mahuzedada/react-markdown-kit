#!/usr/bin/env node
/**
 * Packaged-consumer test (spec 12.2).
 *
 * Packs the real npm tarballs and installs them into clean consumer fixtures,
 * so undeclared dependencies, broken exports, missing types, workspace-path
 * leakage and CSS export mistakes fail here rather than for a user.
 *
 * Usage: node scripts/pack-check.mjs [npm|pnpm|yarn]
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const client = process.argv[2] ?? 'npm'
// npm's noise switches; pnpm 10 rejects options it does not know.
// npm-only flags: pnpm has no audit step here, and yarn classic silently drops
// a tarball spec when they are present.
const quietFlags = client === 'npm' ? ['--no-audit', '--no-fund'] : []
const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' })

const PACKAGES = {
  renderer: 'packages/renderer',
  editor: 'packages/editor',
  template: 'plugins/template',
  mermaid: 'plugins/mermaid',
  slides: 'plugins/slides',
}

// Each journey from spec 3.2, with the import that must resolve and the
// boundary that must hold.
const JOURNEYS = [
  {
    name: 'rendering only',
    install: ['renderer'],
    file: 'check.mjs',
    code: `
import Markdown, { Markdown as Named, compileMarkdown, defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement as h } from 'react'
if (Named !== Markdown) throw new Error('default and named exports differ')
const out = renderToStaticMarkup(h(Markdown, null, '# Hi'))
if (out !== '<h1>Hi</h1>') throw new Error('unexpected output: ' + out)
if (!compileMarkdown('# Hi').tree) throw new Error('no tree')
if (defineMarkdownPreset({ extensions: [gfm()] }).profile !== 'gfm') throw new Error('bad profile')
console.log('ok')
`,
  },
  {
    name: 'template plugin: resolve through compileMarkdown, no Lexical installed',
    install: ['renderer', 'template'],
    noLexical: true,
    file: 'check.mjs',
    code: `
import { compileMarkdown, documentToMarkdown } from '@react-markdown-kit/renderer'
import { template, templateVariables } from '@react-markdown-kit/template'
const doc = compileMarkdown('# Hello {{user.name}}', { extensions: [template({ data: { user: { name: 'Chatis' } } })] })
if (doc.diagnostics.length !== 0) throw new Error('resolve failed: ' + JSON.stringify(doc.diagnostics))
const md = await documentToMarkdown(doc)
if (md.trim() !== '# Hello Chatis') throw new Error('unexpected: ' + md)
if (templateVariables().name !== 'template-variables') throw new Error('bad extension')
console.log('ok')
`,
  },
  {
    name: 'template plugin: personalized React rendering',
    install: ['renderer', 'template'],
    file: 'check.mjs',
    code: `
import { Markdown } from '@react-markdown-kit/renderer'
import { template } from '@react-markdown-kit/template'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement as h } from 'react'
const out = renderToStaticMarkup(h(Markdown, { extensions: [template({ data: { user: { name: 'Acme' } } })] }, '# Hello {{user.name}}'))
if (out !== '<h1>Hello Acme</h1>') throw new Error('unexpected: ' + out)
const failed = renderToStaticMarkup(h(Markdown, { extensions: [template({ data: {} })] }, '# Hello {{user.name}}'))
if (failed !== '') throw new Error('a failed resolution rendered: ' + failed)
console.log('ok')
`,
  },
  {
    name: 'diagrams plugin in the renderer, no Lexical installed',
    install: ['renderer', 'mermaid'],
    noLexical: true,
    file: 'check.mjs',
    code: `
import { Markdown, defineMarkdownPreset } from '@react-markdown-kit/renderer'
import { mermaid } from '@react-markdown-kit/mermaid'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement as h } from 'react'
const preset = defineMarkdownPreset({ extensions: [mermaid()] })
const src = '\`\`\`diagram\\n{"boxes":[{"id":"a","text":"Hello"}]}\\n\`\`\`\\n'
const out = renderToStaticMarkup(h(Markdown, { preset }, src))
if (!out.includes('<figure data-rmk-diagram="diagram">') || !out.includes('<svg')) throw new Error('unexpected: ' + out)
console.log('ok')
`,
  },
  {
    name: 'slides plugin: static deck SSR, no Lexical',
    install: ['renderer', 'slides'],
    noLexical: true,
    file: 'check.mjs',
    code: `
import { readFileSync } from 'node:fs'
import { Markdown, defineMarkdownPreset } from '@react-markdown-kit/renderer'
import { slides } from '@react-markdown-kit/slides'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement as h } from 'react'
const preset = defineMarkdownPreset({ extensions: [slides()] })
const src = '# One\\n\\n---\\n\\n# Two\\n'
const out = renderToStaticMarkup(h(Markdown, { preset }, src))
if (!out.includes('data-rmk-deck=""') || !out.includes('data-rmk-slide="2"')) throw new Error('unexpected: ' + out)
const present = readFileSync('node_modules/@react-markdown-kit/slides/dist/present.js', 'utf8')
if (!present.startsWith("'use client'")) throw new Error('present entry lost its client directive: ' + present.slice(0, 40))
console.log('ok')
`,
  },
  {
    name: 'editor with all plugins',
    install: ['renderer', 'editor', 'template', 'mermaid', 'slides'],
    file: 'check.mjs',
    code: `
import { createMarkdownBridge } from '@react-markdown-kit/editor'
import { templateVariables } from '@react-markdown-kit/template/editor'
import { mermaid } from '@react-markdown-kit/mermaid/editor'
import { slides } from '@react-markdown-kit/slides/editor'
const source = 'Hello {{customer.name}}.\\n\\n\`\`\`diagram\\n{"boxes":[{"id":"a","text":"A"}]}\\n\`\`\`\\n'
const bridge = createMarkdownBridge({ extensions: [templateVariables(), mermaid()], headless: true })
bridge.load(source)
if (bridge.getMarkdown() !== source) throw new Error('round trip changed the source: ' + JSON.stringify(bridge.getMarkdown()))
const deck = '# One\\n\\n<!-- class: center -->\\n\\nHello.\\n\\n???\\n\\nSay this.\\n\\n---\\n\\n# Two\\n'
const deckBridge = createMarkdownBridge({ extensions: [templateVariables(), mermaid(), slides()], headless: true })
deckBridge.load(deck)
if (deckBridge.getMarkdown() !== deck) throw new Error('deck round trip changed the source: ' + JSON.stringify(deckBridge.getMarkdown()))
console.log('ok')
`,
  },
]

console.log(`Packing ${Object.keys(PACKAGES).length} packages...`)
const staging = mkdtempSync(join(tmpdir(), 'rmk-pack-'))
const tarballs = {}
for (const [name, path] of Object.entries(PACKAGES)) {
  const dir = join(root, path)
  run('pnpm', ['build'], dir)
  run('npm', ['pack', '--pack-destination', staging], dir)
  const file = readdirSync(staging).find((f) => f.includes(name) && f.endsWith('.tgz'))
  if (!file) throw new Error(`no tarball produced for ${name}`)
  tarballs[name] = join(staging, file)
  console.log(`  packed ${name}`)
}

let failures = 0
for (const journey of JOURNEYS) {
  const dir = mkdtempSync(join(tmpdir(), 'rmk-consumer-'))
  try {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'consumer', private: true, type: 'module', version: '1.0.0' }, null, 2),
    )
    const specs = journey.install.map((n) => tarballs[n])
    specs.push('react@19', 'react-dom@19')
    // yarn classic rejects `install <pkg>` and wants `add`; npm and pnpm take `install`.
    run(client, [client === 'yarn' ? 'add' : 'install', ...quietFlags, ...specs], dir)
    writeFileSync(join(dir, journey.file), journey.code)
    const output = run('node', [journey.file], dir).trim()
    if (output !== 'ok') throw new Error(output)

    if (journey.noLexical) {
      // A plugin's root entry must never pull the editing engine in.
      const installed = readdirSync(join(dir, 'node_modules'))
      if (installed.some((d) => d === 'lexical' || d === '@lexical')) {
        throw new Error(`${journey.install.join('+')} installed Lexical transitively`)
      }
    }
    console.log(`  PASS  ${journey.name}`)
  } catch (error) {
    failures += 1
    const detail = [error.stderr, error.stdout, error.message].filter((part) => typeof part === 'string' && part.trim() !== '').join('\n')
    console.error(`  FAIL  ${journey.name}\n        ${detail.split('\n').slice(0, 12).join('\n        ')}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

rmSync(staging, { recursive: true, force: true })
if (failures > 0) {
  console.error(`\n${failures} packaged-consumer journey(s) failed.`)
  process.exit(1)
}
console.log(`\nAll ${JOURNEYS.length} packaged-consumer journeys passed with ${client}.`)
