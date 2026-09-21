#!/usr/bin/env node
/**
 * Enforces the styling contract (docs/STYLING.md) on every shipped stylesheet:
 * no global selectors, no `!important`, no hard-coded colour outside a
 * `--rmk-*` custom property declaration.
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCOPES = ['.rmk-document', '.rmk-editor']
const files = [
  'packages/renderer/src/styles.css',
  'packages/editor/src/styles.css',
  'plugins/template/src/styles.css',
  'plugins/mermaid/src/styles.css',
  'plugins/slides/src/styles.css',
]

const COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|color-mix)\(/
const problems = []

for (const relative of files) {
  const path = join(root, relative)
  if (!existsSync(path)) continue
  const css = readFileSync(path, 'utf8')
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')

  if (withoutComments.includes('!important')) {
    problems.push(`${relative}: uses !important`)
  }

  // Colours are only allowed while defining a --rmk-* custom property.
  for (const [index, line] of withoutComments.split('\n').entries()) {
    const declaration = line.trim()
    if (COLOR.test(declaration) && !declaration.startsWith('--rmk-')) {
      problems.push(`${relative}:${index + 1}: hard-coded colour outside a --rmk-* property: ${declaration}`)
    }
  }

  // Every rule must be scoped. A selector list is checked selector by selector.
  const blocks = withoutComments.matchAll(/(^|\})([^{}@]+)\{/g)
  for (const block of blocks) {
    const selectorList = block[2].trim()
    if (selectorList === '' || selectorList.startsWith('@')) continue
    for (const selector of selectorList.split(',')) {
      const trimmed = selector.trim()
      if (trimmed === '') continue
      const scoped = SCOPES.some((scope) => trimmed === scope || trimmed.startsWith(`${scope} `) || trimmed.startsWith(`${scope}.`) || trimmed.startsWith(`${scope}:`) || trimmed.startsWith(`${scope}>`))
      if (!scoped) problems.push(`${relative}: unscoped selector \`${trimmed}\``)
    }
  }
}

if (problems.length > 0) {
  console.error('Styling contract violations:\n' + problems.map((p) => `  - ${p}`).join('\n'))
  process.exit(1)
}
console.log(`Styling contract OK (${files.filter((f) => existsSync(join(root, f))).length} stylesheets checked)`)
