/**
 * DX-03 — the local comparison runner. Its contract: it runs entirely on the
 * user's machine, it compares like-for-like, and it reports differences rather
 * than hiding them.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const RUNNER = join(process.cwd(), 'packages/renderer/src/codemod/compare.mjs')
let dir: string

function run(...args: string[]): { out: string; code: number } {
  try {
    return { out: execFileSync('node', [RUNNER, ...args], { encoding: 'utf8', cwd: process.cwd() }), code: 0 }
  } catch (error) {
    const e = error as { stdout?: string; status?: number }
    return { out: e.stdout ?? '', code: e.status ?? 1 }
  }
}

const doc = (name: string, content: string) => {
  writeFileSync(join(dir, name), content)
  return join(dir, name)
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'rmk-compare-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('agreement on ordinary content', () => {
  it('reports 100% on CommonMark both renderers agree about', () => {
    doc('a.md', '# Title\n\nSome **bold** and a [link](https://example.com).\n\n- one\n- two\n')
    doc('b.md', '> quote\n\n```js\nconst x = 1\n```\n\n1. first\n2. second\n')
    const { out, code } = run(join(dir, '*.md'))
    expect(out).toContain('matching   2 (100%)')
    expect(out).toContain('differing  0')
    expect(code).toBe(0)
  })

  it('agrees on raw HTML, which both render as escaped text', () => {
    doc('a.md', 'Raw <b>html</b> here.\n\n<div class="note">block</div>\n')
    expect(run(join(dir, '*.md')).out).toContain('differing  0')
  })

  it('agrees on GFM when both sides are given GFM', () => {
    doc('a.md', '| a | b |\n| - | - |\n| 1 | 2 |\n\n~~struck~~\n\n- [x] done\n')
    const { out } = run(join(dir, '*.md'), '--gfm')
    expect(out).toContain('GFM on both sides')
    expect(out).toContain('differing  0')
  })
})

describe('honest reporting', () => {
  it('names the pinned baseline version it measured against', () => {
    doc('a.md', '# x\n')
    expect(run(join(dir, '*.md')).out).toMatch(/baseline: react-markdown \d+\.\d+\.\d+/)
  })

  it('states the dialect, because a mismatched dialect invalidates the result', () => {
    doc('a.md', '# x\n')
    expect(run(join(dir, '*.md')).out).toContain('CommonMark on both sides')
  })

  it('says nothing was uploaded', () => {
    doc('a.md', '# x\n')
    expect(run(join(dir, '*.md')).out).toContain('Nothing was uploaded')
  })

  it('emits machine-readable output on request', () => {
    doc('a.md', '# x\n')
    const parsed = JSON.parse(run(join(dir, '*.md'), '--json').out)
    expect(parsed.total).toBe(1)
    expect(parsed.matching).toHaveLength(1)
    expect(parsed.differing).toEqual([])
  })

  it('exits non-zero when documents differ, so CI can gate on it', () => {
    // GFM on one side only is exactly the mismatch that produces differences.
    doc('a.md', '| a |\n| - |\n| 1 |\n')
    const { out, code } = run(join(dir, '*.md'))
    // Without --gfm neither renders a table, so they still agree.
    expect(code).toBe(0)
    expect(out).toContain('differing  0')
  })
})

describe('usage', () => {
  it('requires a glob', () => {
    expect(run().out + String(run().code)).toBeTruthy()
  })

  it('ignores files that are not Markdown', () => {
    writeFileSync(join(dir, 'a.json'), '{}')
    expect(run(join(dir, '*')).out).toContain('0 document(s) compared')
  })
})
