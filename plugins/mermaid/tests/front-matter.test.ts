/**
 * The shared helpers (docs/MERMAID_PLATFORM.md section 4.4): front matter is
 * split the way Mermaid splits it, and text entities decode the same way
 * for every kind.
 */
import { describe, expect, it } from 'vitest'
import { readFrontMatterTitle, splitFrontMatter, writeFrontMatterTitle } from '../src/core/front-matter.js'
import { flowchart } from '../src/core/flowchart-kind.js'
import { sequenceDiagram } from '../src/core/sequence/index.js'
import { decodeText } from '../src/core/text.js'

describe('splitFrontMatter', () => {
  it('returns the whole source as body when there is no front matter', () => {
    expect(splitFrontMatter('flowchart LR\n A --> B')).toEqual({ body: 'flowchart LR\n A --> B', bodyOffset: 0 })
    expect(splitFrontMatter('')).toEqual({ body: '', bodyOffset: 0 })
  })

  it('splits a block between two --- lines and reports where the body starts', () => {
    const source = '---\ntitle: Hello\nconfig:\n  theme: base\n---\nflowchart LR\n A'
    const split = splitFrontMatter(source)
    expect(split.frontMatter).toBe('title: Hello\nconfig:\n  theme: base')
    expect(split.body).toBe('flowchart LR\n A')
    expect(source.slice(split.bodyOffset)).toBe(split.body)
  })

  it('eats blank lines after the closing fence, as Mermaid does', () => {
    const split = splitFrontMatter('---\ntitle: x\n---\n\n\nflowchart LR')
    expect(split.body).toBe('flowchart LR')
    expect(split.bodyOffset).toBe('---\ntitle: x\n---\n\n\n'.length)
  })

  it('accepts a common indent on both fences and trailing spaces after ---', () => {
    const split = splitFrontMatter('  ---  \n  title: x\n  ---\nflowchart LR')
    expect(split.frontMatter).toBe('  title: x')
    expect(split.body).toBe('flowchart LR')
  })

  it('accepts CRLF line endings', () => {
    const split = splitFrontMatter('---\r\ntitle: x\r\n---\r\nflowchart LR')
    expect(split.body).toBe('flowchart LR')
    expect(readFrontMatterTitle(split.frontMatter)).toBe('x')
  })

  it('leaves an unclosed block, a mismatched indent and a closing fence at end of text as content', () => {
    for (const source of ['---\ntitle: x\nflowchart LR', '---\ntitle: x\n  ---\nflowchart LR', '---\ntitle: x\n---', '\n---\ntitle: x\n---\nflowchart']) {
      expect(splitFrontMatter(source), source).toEqual({ body: source, bodyOffset: 0 })
    }
  })

  it('needs at least one line between the fences', () => {
    expect(splitFrontMatter('---\n---\nflowchart LR')).toEqual({ body: '---\n---\nflowchart LR', bodyOffset: 0 })
  })
})

describe('readFrontMatterTitle', () => {
  it('reads the title, unquoted and trimmed', () => {
    expect(readFrontMatterTitle('title: Hello world')).toBe('Hello world')
    expect(readFrontMatterTitle('title:   "Quoted: yes"  ')).toBe('Quoted: yes')
    expect(readFrontMatterTitle('config:\n  theme: base\ntitle: Later')).toBe('Later')
  })

  it('is undefined without a title or without front matter', () => {
    expect(readFrontMatterTitle('config:\n  theme: base')).toBeUndefined()
    expect(readFrontMatterTitle(undefined)).toBeUndefined()
    expect(readFrontMatterTitle('')).toBeUndefined()
  })

  it('unescapes a double-quoted value as YAML does, and a single-quoted one (C3, C8)', () => {
    expect(readFrontMatterTitle('title: "a: b"')).toBe('a: b')
    expect(readFrontMatterTitle('title: "say \\"hi\\" \\\\ there"')).toBe('say "hi" \\ there')
    expect(readFrontMatterTitle('title: "[draft] flow"')).toBe('[draft] flow')
    expect(readFrontMatterTitle('title: "tab\\tnew\\u00e9"')).toBe('tab\tnewé')
    expect(readFrontMatterTitle("title: 'it''s: here'")).toBe("it's: here")
    // A YAML-only escape keeps the raw text rather than failing.
    expect(readFrontMatterTitle('title: "back\\ slash"')).toBe('back\\ slash')
  })

  it('writes a title as a JSON-quoted scalar and reads it back exactly (C3, C8)', () => {
    for (const title of ['Flow', 'a: b', '[draft] plan', '*', 'C# x # y', 'say "hi" \\ there', "it's", 'Пользователь ♥', '- item', '#tag']) {
      const line = writeFrontMatterTitle(title)
      expect(line.startsWith('title: "')).toBe(true)
      expect(readFrontMatterTitle(line)).toBe(title)
    }
  })
})

describe('decodeText', () => {
  it('decodes Mermaid entities, HTML entities and line breaks', () => {
    expect(decodeText('a<br/>b<br>c<BR />d')).toBe('a\nb\nc\nd')
    expect(decodeText('#quot;x#quot; &quot;y&quot;')).toBe('"x" "y"')
    expect(decodeText('#lt;a#gt; &lt;b&gt;')).toBe('<a> <b>')
    expect(decodeText('a#124;b')).toBe('a|b')
    expect(decodeText('#59; #9829;')).toBe('; ♥')
  })

  it('leaves plain text alone', () => {
    expect(decodeText('Hello, world')).toBe('Hello, world')
  })

  it('decodes #35;, #37; and #38; last, so escaped entities stay text (C7)', () => {
    expect(decodeText('#35;quot; #35;124; #38;quot; #37;#37;{')).toBe('#quot; #124; &quot; %%{')
    expect(decodeText('PR #35;42; merged')).toBe('PR #42; merged')
  })

  it('never throws on an out-of-range entity and never yields a non-XML character (C1, C6, C22)', () => {
    expect(decodeText('#9999999999;')).toBe('\uFFFD')
    expect(decodeText('#1114112;')).toBe('\uFFFD')
    expect(decodeText('#1;#0;#27;')).toBe('\uFFFD\uFFFD\uFFFD')
    expect(decodeText('#65534; #65535; #55296;')).toBe('\uFFFD \uFFFD \uFFFD')
    expect(decodeText('#9;#10;#13;#32;#65533;#128512;')).toBe('\t\n\r \uFFFD\u{1F600}')
    expect(() => sequenceDiagram().parse('sequenceDiagram\n    A->>B: #9999999999;')).not.toThrow()
    expect(() => sequenceDiagram().parse('sequenceDiagram\n    participant A as #2000000;')).not.toThrow()
    expect(() => flowchart().parse('flowchart LR\n    A["#9999999999;"] --> B')).not.toThrow()
    const rendered = flowchart().render!(
      (flowchart().parse('flowchart LR\n    A["#1;#0;"] --> B') as { model: Parameters<NonNullable<ReturnType<typeof flowchart>['render']>>[0] }).model,
      { fallbackTitle: 'D' },
    )
    expect(JSON.stringify(rendered)).not.toMatch(/\\u000[01]/)
  })
})
