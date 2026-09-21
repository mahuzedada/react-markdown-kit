#!/usr/bin/env node
/**
 * DX-02 — migration codemod from react-markdown to @react-markdown-kit/renderer.
 *
 * Design rules from spec 13.3, in order of importance:
 *   - dry run by DEFAULT; writing requires --write.
 *   - never silently remove security behaviour. If a file relies on a default
 *     we do not share, the codemod reports it instead of rewriting it.
 *   - preserve aliases, default/named import style, and quote style.
 *   - flag what it cannot handle rather than guessing.
 *
 * Usage:
 *   npx rmk-migrate 'src/<glob>.tsx'            dry run
 *   npx rmk-migrate 'src/<glob>.tsx' --write    apply
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { globSync } from 'node:fs'

const args = process.argv.slice(2)
const write = args.includes('--write')
const patterns = args.filter((a) => !a.startsWith('--'))

if (patterns.length === 0) {
  console.error('usage: rmk-migrate <glob...> [--write]')
  process.exit(1)
}

const SUPPORTED_RANGE = /^1[0-9]\./ // react-markdown 10.x is the pinned baseline

/** Props we accept with identical meaning. */
const COMPATIBLE_PROPS = new Set([
  'children', 'components', 'remarkPlugins', 'rehypePlugins', 'remarkRehypeOptions',
  'allowedElements', 'disallowedElements', 'allowElement', 'skipHtml',
  'unwrapDisallowed', 'urlTransform', 'key', 'ref',
])

/** Things we cannot take over. Reported, never rewritten. */
const UNSUPPORTED = {
  MarkdownAsync: 'MarkdownAsync has no equivalent yet. Leave this import on react-markdown.',
  MarkdownHooks: 'MarkdownHooks has no equivalent yet. Leave this import on react-markdown.',
  defaultUrlTransform: 'Import defaultUrlTransform from @react-markdown-kit/renderer instead; verify behaviour first.',
}

const report = { files: 0, changed: 0, rewrites: [], flags: [] }

function detectVersion() {
  try {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    const spec = pkg.dependencies?.['react-markdown'] ?? pkg.devDependencies?.['react-markdown']
    if (spec === undefined) return { found: false }
    const bare = spec.replace(/^[\^~>=<\s]+/, '')
    return { found: true, spec, supported: SUPPORTED_RANGE.test(bare) }
  } catch {
    return { found: false }
  }
}

function migrateSource(source, file) {
  let next = source
  const fileFlags = []
  let changed = false

  // 1. Imports. Preserve the alias and the quote style the file already uses.
  const importRe = /import\s+([^'"]+?)\s+from\s+(['"])react-markdown\2/g
  next = next.replace(importRe, (match, clause, quote) => {
    const unsupported = Object.keys(UNSUPPORTED).filter((name) =>
      new RegExp(`\\b${name}\\b`).test(clause),
    )
    if (unsupported.length > 0) {
      for (const name of unsupported) fileFlags.push({ file, level: 'blocked', message: UNSUPPORTED[name] })
      return match // leave the import alone
    }
    changed = true
    return `import ${clause} from ${quote}@react-markdown-kit/renderer${quote}`
  })

  // 2. Subpath imports that have no equivalent.
  if (/from\s+['"]react-markdown\/lib\//.test(next)) {
    fileFlags.push({
      file,
      level: 'blocked',
      message: 'Imports from react-markdown/lib/* reach into internals and have no equivalent. Rewrite by hand.',
    })
  }

  // 3. Props the kit does not accept. `className` is the common one:
  //    react-markdown throws on it, so code in the wild rarely has it, but if
  //    it does the author expects a wrapper.
  if (/<(Markdown|ReactMarkdown)\b[^>]*\sclassName=/s.test(next)) {
    fileFlags.push({
      file,
      level: 'review',
      message: 'className on the component: wrap it in an element instead. The kit ignores className rather than throwing.',
    })
  }

  // 4. Security-relevant: rehype-raw without a sanitizer.
  if (/rehypeRaw|rehype-raw/.test(next) && !/rehypeSanitize|rehype-sanitize/.test(next)) {
    fileFlags.push({
      file,
      level: 'review',
      message: 'rehype-raw is used without rehype-sanitize. This executes author HTML. The codemod does not change it, but review it.',
    })
  }

  // 5. skipHtml. Defaults now match, so nothing to rewrite; say so only if set.
  if (/\sskipHtml\b/.test(next)) {
    fileFlags.push({
      file,
      level: 'info',
      message: 'skipHtml is set explicitly. Behaviour is identical in both packages; no change needed.',
    })
  }

  return { next, changed, fileFlags }
}

const version = detectVersion()
if (version.found && !version.supported) {
  console.warn(
    `warning: react-markdown ${version.spec} is outside the tested 10.x baseline. ` +
      'Review every rewrite; the compatibility matrix covers 10.1.0 only.\n',
  )
}

let files = []
for (const pattern of patterns) {
  try {
    files.push(...globSync(pattern))
  } catch {
    files.push(pattern)
  }
}
files = [...new Set(files)].filter((f) => /\.(t|j)sx?$/.test(f))

for (const file of files) {
  let source
  try {
    source = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  if (!source.includes('react-markdown')) continue
  report.files += 1

  const { next, changed, fileFlags } = migrateSource(source, file)
  report.flags.push(...fileFlags)

  if (changed) {
    report.changed += 1
    report.rewrites.push(file)
    if (write) writeFileSync(file, next)
  }
}

const mode = write ? 'WROTE' : 'DRY RUN (pass --write to apply)'
console.log(`rmk-migrate — ${mode}`)
console.log(`${report.files} file(s) reference react-markdown; ${report.changed} import site(s) rewritten.\n`)

if (report.rewrites.length > 0) {
  console.log('Rewritten imports:')
  for (const file of report.rewrites) console.log(`  ${file}`)
  console.log()
}

const byLevel = (level) => report.flags.filter((f) => f.level === level)
for (const [level, label] of [
  ['blocked', 'Left unchanged, needs a manual decision'],
  ['review', 'Rewritten, but review these'],
  ['info', 'For information'],
]) {
  const items = byLevel(level)
  if (items.length === 0) continue
  console.log(`${label}:`)
  for (const item of items) console.log(`  ${item.file}\n    ${item.message}`)
  console.log()
}

console.log('The codemod changes imports only. It never edits props, plugin lists or')
console.log('security settings. See docs/COMPATIBILITY.md before shipping the result.')
