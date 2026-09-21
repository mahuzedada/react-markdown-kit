/**
 * DX-02 — the migration codemod. Its contract is that it is conservative:
 * dry run by default, imports only, and it never quietly changes a security
 * posture.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CODEMOD = join(process.cwd(), 'packages/renderer/src/codemod/migrate.mjs')
let dir: string

const run = (...args: string[]) =>
  execFileSync('node', [CODEMOD, ...args], { cwd: dir, encoding: 'utf8' })

const file = (name: string, content: string) => writeFileSync(join(dir, name), content)
const read = (name: string) => readFileSync(join(dir, name), 'utf8')

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'rmk-codemod-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('dry run is the default', () => {
  it('reports without touching the file', () => {
    file('a.tsx', "import Markdown from 'react-markdown'\n")
    const out = run('*.tsx')
    expect(out).toContain('DRY RUN')
    expect(read('a.tsx')).toContain("from 'react-markdown'")
  })

  it('writes only with --write', () => {
    file('a.tsx', "import Markdown from 'react-markdown'\n")
    run('*.tsx', '--write')
    expect(read('a.tsx')).toBe("import Markdown from '@react-markdown-kit/renderer'\n")
  })
})

describe('preserves the author style', () => {
  it('keeps a custom alias', () => {
    file('a.tsx', "import ReactMarkdown from 'react-markdown'\n")
    run('*.tsx', '--write')
    expect(read('a.tsx')).toContain('import ReactMarkdown from')
  })

  it('keeps double quotes', () => {
    file('a.tsx', 'import Markdown from "react-markdown"\n')
    run('*.tsx', '--write')
    expect(read('a.tsx')).toBe('import Markdown from "@react-markdown-kit/renderer"\n')
  })

  it('keeps a named import clause', () => {
    file('a.tsx', "import { Markdown } from 'react-markdown'\n")
    run('*.tsx', '--write')
    expect(read('a.tsx')).toContain('import { Markdown } from')
  })

  it('leaves unrelated imports alone', () => {
    file('a.tsx', "import x from 'remark-gfm'\nimport Markdown from 'react-markdown'\n")
    run('*.tsx', '--write')
    expect(read('a.tsx')).toContain("import x from 'remark-gfm'")
  })
})

describe('refuses what it cannot do', () => {
  it('leaves MarkdownAsync on react-markdown and says why', () => {
    file('a.tsx', "import { MarkdownAsync } from 'react-markdown'\n")
    const out = run('*.tsx', '--write')
    expect(read('a.tsx')).toContain("from 'react-markdown'")
    expect(out).toContain('MarkdownAsync has no equivalent yet')
    expect(out).toContain('Left unchanged')
  })

  it('leaves MarkdownHooks alone', () => {
    file('a.tsx', "import { MarkdownHooks } from 'react-markdown'\n")
    run('*.tsx', '--write')
    expect(read('a.tsx')).toContain("from 'react-markdown'")
  })

  it('flags reaching into react-markdown internals', () => {
    file('a.tsx', "import x from 'react-markdown/lib/ast-to-react'\n")
    const out = run('*.tsx')
    expect(out).toContain('no equivalent')
  })
})

describe('never quietly changes a security posture', () => {
  it('flags rehype-raw used without a sanitizer', () => {
    file(
      'a.tsx',
      "import Markdown from 'react-markdown'\nimport rehypeRaw from 'rehype-raw'\n",
    )
    const out = run('*.tsx')
    expect(out).toContain('rehype-raw is used without rehype-sanitize')
    expect(out).toContain('executes author HTML')
  })

  it('does not flag rehype-raw when a sanitizer is present', () => {
    file(
      'a.tsx',
      "import Markdown from 'react-markdown'\nimport rehypeRaw from 'rehype-raw'\nimport rehypeSanitize from 'rehype-sanitize'\n",
    )
    expect(run('*.tsx')).not.toContain('without rehype-sanitize')
  })

  it('edits no prop, only imports', () => {
    const source =
      "import Markdown from 'react-markdown'\n" +
      'export const A = () => <Markdown skipHtml={false} urlTransform={(u) => u}>{x}</Markdown>\n'
    file('a.tsx', source)
    run('*.tsx', '--write')
    const after = read('a.tsx')
    expect(after).toContain('skipHtml={false}')
    expect(after).toContain('urlTransform={(u) => u}')
    expect(after.split('\n')[1]).toBe(source.split('\n')[1])
  })
})

describe('reporting', () => {
  it('ignores files that never mention react-markdown', () => {
    file('a.tsx', "import { useState } from 'react'\n")
    expect(run('*.tsx')).toContain('0 file(s) reference react-markdown')
  })
})
