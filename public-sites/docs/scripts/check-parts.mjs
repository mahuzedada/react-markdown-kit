/*
 * The Styling page enumerates every `classNames` part the renderer and the
 * editor accept. This checks those lists against the unions in
 * internal/styling/index.ts, the styling contract, so a part added there
 * (`diagram`, `deck`, `slide`, `slideNotes`, …) cannot go undocumented.
 *
 *   node scripts/check-parts.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const contract = read('../../../internal/styling/index.ts')
const page = read('../docs/styling.mdx')

const unionMembers = name => {
  const body = contract.match(new RegExp(`export type ${name} =([^]*?)\\n\\n`))?.[1]
  if (!body) throw new Error(`${name} is not in internal/styling/index.ts`)
  return [...body.matchAll(/'([A-Za-z]+)'/g)].map(m => m[1])
}
const documented = heading => {
  const list = page.match(new RegExp(`${heading} parts:([^]*?)\\n\\n`))?.[1]
  if (!list) throw new Error(`"${heading} parts:" is not in docs/styling.mdx`)
  return new Set([...list.matchAll(/`([A-Za-z]+)`/g)].map(m => m[1]))
}

const missing = [
  ...unionMembers('RendererPart').filter(p => !documented('Renderer').has(p)).map(p => `Renderer parts: ${p}`),
  ...unionMembers('EditorPart').filter(p => !documented('Editor').has(p)).map(p => `Editor parts: ${p}`),
]
if (missing.length > 0) {
  console.error('docs/styling.mdx omits these classNames parts:\n  ' + missing.join('\n  '))
  process.exit(1)
}
console.log('docs/styling.mdx lists every RendererPart and EditorPart')
