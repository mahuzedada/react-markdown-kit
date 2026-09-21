/**
 * The headline gate (spec 7.13, docs/AUDIT.md G4).
 *
 * Every case in `fixtures/editor-roundtrip/corruption.json` is a construct the
 * prior editor corrupted on save. Import each one into the editor, export it
 * straight back, and require the bytes to be identical.
 *
 * Runs headless: this is a bridge property, not a DOM property.
 */
import { describe, expect, it } from 'vitest'
import { createMarkdownBridge } from '@react-markdown-kit/editor'
import { defineMarkdownPreset, gfm, type MarkdownPreset } from '@react-markdown-kit/renderer'
import corruption from '../../../fixtures/editor-roundtrip/corruption.json' with { type: 'json' }

interface CorruptionCase {
  readonly name: string
  readonly source: string
  readonly why: string
}

const cases = corruption.cases as readonly CorruptionCase[]
const gfmPreset = defineMarkdownPreset({ extensions: [gfm()] })

function roundTrip(source: string, preset?: MarkdownPreset): string {
  const bridge = createMarkdownBridge(preset ? { preset, headless: true } : { headless: true })
  bridge.load(source)
  return bridge.getMarkdown()
}

describe('corruption corpus', () => {
  it('covers all 22 audited cases', () => {
    expect(cases).toHaveLength(22)
  })

  for (const testCase of cases) {
    it(`${testCase.name} round-trips byte-identically (${testCase.why})`, () => {
      expect(roundTrip(testCase.source, gfmPreset)).toBe(testCase.source)
    })
  }

  for (const testCase of cases) {
    it(`${testCase.name} round-trips byte-identically without GFM`, () => {
      expect(roundTrip(testCase.source)).toBe(testCase.source)
    })
  }
})

describe('round-trip beyond the corpus', () => {
  const extra: readonly [string, string][] = [
    ['atx heading', '# Title\n'],
    ['nested list', '- a\n  - b\n  - c\n- d\n'],
    ['task list', '- [ ] todo\n- [x] done\n'],
    ['table', '| a | b |\n| - | -: |\n| 1 | 2 |\n'],
    ['strikethrough', 'a ~~b~~ c\n'],
    ['footnote', 'Text[^1]\n\n[^1]: Note.\n'],
    ['front matter-ish html', '<!-- x -->\n\n# H\n\n<div>y</div>\n'],
    ['hard break with spaces', 'a  \nb\n'],
    ['link with title', '[a](b "c")\n'],
    ['nested emphasis', '_**a**_ and **_b_**\n'],
    ['code with meta', '```js title="x"\nconst a = 1\n```\n'],
    ['no trailing newline', '# Title'],
    ['leading blank lines', '\n\n# Title\n'],
    ['empty document', ''],
    ['escaped characters', 'a \\* b \\_ c\n'],
    ['numbered list with paren', '1) a\n2) b\n'],
  ]
  for (const [name, source] of extra) {
    it(`${name} round-trips byte-identically`, () => {
      expect(roundTrip(source, gfmPreset)).toBe(source)
    })
  }
})
