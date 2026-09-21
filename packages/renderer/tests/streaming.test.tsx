/**
 * Streaming input (SEO workplan milestone D item 1).
 *
 * A model writes Markdown a token at a time. The renderer is handed the
 * document again on every token, so every intermediate string is a prefix of
 * the finished one and most of those prefixes are not valid Markdown yet: a
 * fence with no closing fence, one asterisk of a `**strong**` pair, a table
 * row that stops mid cell, a list item that stops mid word.
 *
 * These tests feed each case token by token and assert four properties:
 *
 * 1. no prefix throws,
 * 2. the HTML for the closed prefix (everything before the block still being
 *    written) is byte-identical at every later prefix,
 * 3. nothing from the closed prefix is duplicated,
 * 4. the last prefix renders exactly like the whole document rendered once.
 *
 * The same run is repeated through `compileMarkdown`, and a mounted React root
 * is grown token by token to check that a precompiled document re-renders when
 * the input grows, ending byte-identical to a root that only ever saw the
 * finished document.
 *
 * Two prefixes legitimately rewrite output that already rendered: a paragraph
 * followed by a setext underline, and a GFM autolink whose URL is still being
 * typed. Both are pinned by tests rather than fixed, because both are correct.
 *
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import Markdown, { compileMarkdown, defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'

declare global {
  // eslint-disable-next-line no-var -- React reads this global to allow `act`.
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

/** GFM, because tables are one of the cases a chat assistant streams most. */
const preset = defineMarkdownPreset({ extensions: [gfm()] })

const html = (source: string): string =>
  renderToStaticMarkup(<Markdown preset={preset}>{source}</Markdown>)

const htmlFromDocument = (source: string): string =>
  renderToStaticMarkup(<Markdown preset={preset} document={compileMarkdown(source, { preset })} />)

/**
 * Splits a document the way a token stream arrives: words stay whole, every
 * whitespace character and every punctuation character is its own token. That
 * makes "```" arrive as three separate tokens, which is the interesting case.
 */
function tokenize(source: string): readonly string[] {
  return source.match(/[A-Za-z0-9]+|[\s\S]/g) ?? []
}

/** Every prefix of `source`, one token longer each time, ending in `source`. */
function prefixes(source: string): readonly string[] {
  const grown: string[] = []
  let current = ''
  for (const token of tokenize(source)) {
    current += token
    grown.push(current)
  }
  return grown
}

function occurrences(haystack: string, needle: string): number {
  if (needle === '') return 0
  let count = 0
  let at = haystack.indexOf(needle)
  while (at !== -1) {
    count += 1
    at = haystack.indexOf(needle, at + needle.length)
  }
  return count
}

/**
 * Blocks that are finished before any case starts streaming. Every case is
 * `CLOSED + tail`, so "the closed prefix" is a fixed, known string and its
 * rendered HTML is a fixed, known string.
 */
const CLOSED = [
  '# Streaming renderer',
  '',
  'A finished paragraph with a [link](https://example.com) and `code`.',
  '',
  '> A finished block quote.',
  '',
  '```js',
  'const finished = true',
  '```',
  '',
].join('\n')

const CLOSED_HTML = html(CLOSED)

interface StreamCase {
  /** Test name, also the name quoted in the docs page written from this. */
  readonly name: string
  /** The part that streams in after `CLOSED`. */
  readonly tail: string
}

const CASES: readonly StreamCase[] = [
  {
    name: 'an unclosed code fence',
    tail: ['```ts', 'const partial = {', '  answer: 42,', ''].join('\n'),
  },
  {
    name: 'half-written emphasis and strong',
    tail: 'Tail with *em* then **strong** then _under_ then __bold__.\n',
  },
  {
    name: 'a table mid-row',
    tail: [
      '| package | size |',
      '| --- | ---: |',
      '| renderer | 12 kB |',
      '| editor | 30 kB |',
      '',
    ].join('\n'),
  },
  {
    name: 'a list mid-item',
    tail: ['- first item', '- second item', '- third item', ''].join('\n'),
  },
  {
    name: 'a heading with no trailing newline',
    tail: '## Heading without a newline',
  },
  {
    name: 'a link with an unclosed bracket',
    tail: 'See [the docs](https://docs.example.com/page) and [an unclosed bracket.\n',
  },
  {
    name: 'a fenced block that closes late',
    tail: ['```md', '# not a heading', '', '- not a list', '```', '', 'After the fence.', ''].join(
      '\n',
    ),
  },
]

describe.each(CASES)('streaming $name', ({ name, tail }) => {
  const document = CLOSED + tail
  const grown = prefixes(document)

  it(`renders every prefix of ${name} without throwing`, () => {
    for (const prefix of grown) {
      expect(() => html(prefix), `prefix ${JSON.stringify(prefix)}`).not.toThrow()
    }
  })

  it(`keeps the closed prefix byte-identical while ${name} streams`, () => {
    for (const prefix of grown) {
      if (prefix.length < CLOSED.length) continue
      expect(html(prefix).slice(0, CLOSED_HTML.length), `prefix ${JSON.stringify(prefix)}`).toBe(
        CLOSED_HTML,
      )
    }
  })

  it(`never duplicates a closed node while ${name} streams`, () => {
    for (const prefix of grown) {
      const rendered = html(prefix)
      if (prefix.length < CLOSED.length) continue
      expect(occurrences(rendered, CLOSED_HTML), `prefix ${JSON.stringify(prefix)}`).toBe(1)
      expect(occurrences(rendered, '<h1>Streaming renderer</h1>')).toBe(1)
      expect(occurrences(rendered, '<code class="language-js">const finished = true\n</code>')).toBe(
        1,
      )
    }
  })

  it(`ends at the one-shot render of ${name}`, () => {
    expect(grown.at(-1)).toBe(document)
    expect(html(grown.at(-1) as string)).toBe(html(document))
  })
})

describe('streaming markup that only looks like markup', () => {
  const document =
    CLOSED + ['```md', '# not a heading', '', '- not a list', '```', '', 'After the fence.', ''].join('\n')

  it('does not leak the contents of an open fence as markup', () => {
    const opened = document.indexOf('```md')
    for (const prefix of prefixes(document)) {
      if (prefix.length <= opened) continue
      const rendered = html(prefix)
      expect(rendered, `prefix ${JSON.stringify(prefix)}`).not.toContain('<h1>not a heading</h1>')
      expect(rendered).not.toContain('<li>not a list</li>')
    }
  })

  it('renders the paragraph after a late fence only once the fence has closed', () => {
    const closedAt = document.indexOf('```\n\nAfter') + 3
    for (const prefix of prefixes(document)) {
      const rendered = html(prefix)
      if (prefix.length <= closedAt) {
        expect(rendered, `prefix ${JSON.stringify(prefix)}`).not.toContain('<p>After the fence.</p>')
      }
    }
    expect(html(document)).toContain('<p>After the fence.</p>')
  })
})

describe('partial constructs that degrade to text rather than throwing', () => {
  // Each half-written construct renders as the literal characters typed so
  // far. Nothing is dropped and nothing is invented.
  it.each([
    ['*em', '<p>*em</p>'],
    ['**str', '<p>**str</p>'],
    ['_u', '<p>_u</p>'],
    ['~~str', '<p>~~str</p>'],
    ['`code', '<p>`code</p>'],
    ['[text', '<p>[text</p>'],
    ['[text](', '<p>[text](</p>'],
    ['![alt](x.p', '<p>![alt](x.p</p>'],
    ['# head', '<h1>head</h1>'],
    ['- item\n- ha', '<ul>\n<li>item</li>\n<li>ha</li>\n</ul>'],
    ['1. one\n2. tw', '<ol>\n<li>one</li>\n<li>tw</li>\n</ol>'],
    ['> quote\n> mo', '<blockquote>\n<p>quote\nmo</p>\n</blockquote>'],
    ['```ts\nconst x', '<pre><code class="language-ts">const x\n</code></pre>'],
  ])('renders %j as %j', (source, expected) => {
    expect(html(source)).toBe(expected)
  })

  it('shows a table as a paragraph until the delimiter row is complete', () => {
    // The flip from paragraph to table happens inside the block still being
    // written, so no already-finished block is disturbed.
    expect(html('| a | b |\n| - ')).toBe('<p>| a | b |\n| -</p>')
    expect(html('| a | b |\n| - | - |\n| 1 ')).toBe(
      '<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td><td></td></tr></tbody></table>',
    )
  })
})

describe('the two prefixes where already rendered output changes', () => {
  /**
   * These are CommonMark and GFM behaving correctly, not renderer bugs, but a
   * streaming UI sees them as content that rewrites itself. They are pinned
   * here so a change in either is a test failure and not a surprise.
   */
  it('turns a finished paragraph into a heading when the next line starts a setext underline', () => {
    expect(html('Paragraph text')).toBe('<p>Paragraph text</p>')
    expect(html('Paragraph text\n-')).toBe('<h2>Paragraph text</h2>')
    expect(html('Paragraph text\n---\n')).toBe('<h2>Paragraph text</h2>')
    // A paragraph is therefore only settled once a line arrives that cannot
    // underline it.
    expect(html('Paragraph text\n\n')).toBe('<p>Paragraph text</p>')
  })

  it('links a half-typed URL to the truncated host while it streams', () => {
    expect(html('http://ex')).toBe('<p><a href="http://ex">http://ex</a></p>')
    expect(html('http://example.com/pa')).toBe(
      '<p><a href="http://example.com/pa">http://example.com/pa</a></p>',
    )
  })
})

describe('streaming a document that is never valid on its own', () => {
  // Every prefix of this one is broken in some way: an open fence inside an
  // open list inside an open quote.
  const document = '> - item one\n>   ```\n>   code line\n>   ```\n> - item two\n'

  it('renders every prefix of nested unclosed constructs without throwing', () => {
    for (const prefix of prefixes(document)) {
      expect(() => html(prefix), `prefix ${JSON.stringify(prefix)}`).not.toThrow()
    }
  })
})

describe('streaming through compileMarkdown', () => {
  const document = CLOSED + CASES.map((one) => one.tail).join('\n')

  it('compiles every prefix without throwing', () => {
    for (const prefix of prefixes(document)) {
      expect(() => compileMarkdown(prefix, { preset }), `prefix ${JSON.stringify(prefix)}`).not.toThrow()
    }
  })

  it('renders a precompiled prefix exactly like the same prefix as a string', () => {
    for (const prefix of prefixes(document)) {
      expect(htmlFromDocument(prefix), `prefix ${JSON.stringify(prefix)}`).toBe(html(prefix))
    }
  })

  it('keeps the closed prefix byte-identical for precompiled documents', () => {
    for (const prefix of prefixes(document)) {
      if (prefix.length < CLOSED.length) continue
      expect(
        htmlFromDocument(prefix).slice(0, CLOSED_HTML.length),
        `prefix ${JSON.stringify(prefix)}`,
      ).toBe(CLOSED_HTML)
    }
  })
})

/**
 * A mounted React root, grown token by token.
 *
 * Server markup and client DOM are not byte-identical for every attribute
 * (jsdom re-serializes `style` with a space and a semicolon), so every
 * comparison here is DOM against DOM: the streamed root against a throwaway
 * root that rendered the same source in one shot.
 */
let root: Root | undefined
let container: HTMLDivElement | undefined

afterEach(() => {
  if (root !== undefined) act(() => root?.unmount())
  container?.remove()
  root = undefined
  container = undefined
})

const markdown = (source: string): ReactElement => (
  <Markdown preset={preset} document={compileMarkdown(source, { preset })} />
)

const mount = (element: ReactElement): HTMLDivElement => {
  container = window.document.createElement('div')
  window.document.body.append(container)
  const created = createRoot(container)
  root = created
  act(() => created.render(element))
  return container
}

const update = (element: ReactElement): void => {
  act(() => root?.render(element))
}

/** Renders `source` once into a throwaway root and returns the DOM it produced. */
function oneShotDom(source: string): string {
  const scratch = window.document.createElement('div')
  window.document.body.append(scratch)
  const scratchRoot = createRoot(scratch)
  act(() => scratchRoot.render(markdown(source)))
  const rendered = scratch.innerHTML
  act(() => scratchRoot.unmount())
  scratch.remove()
  return rendered
}

describe('a mounted root fed a precompiled document that grows', () => {
  it('re-renders when the precompiled document grows token by token', () => {
    const document = CLOSED + '| package | size |\n| --- | ---: |\n| renderer | 12 kB |\n'
    const grown = prefixes(document)
    const first = grown[0] as string

    const node = mount(markdown(first))
    expect(node.innerHTML).toBe(oneShotDom(first))

    const seen: string[] = [node.innerHTML]
    for (const prefix of grown.slice(1)) {
      update(markdown(prefix))
      expect(node.innerHTML, `prefix ${JSON.stringify(prefix)}`).toBe(oneShotDom(prefix))
      seen.push(node.innerHTML)
    }

    // The DOM actually moved: it is not stuck on the first document.
    expect(new Set(seen).size).toBeGreaterThan(1)
    expect(node.innerHTML).toBe(oneShotDom(document))
    expect(node.innerHTML.startsWith(CLOSED_HTML)).toBe(true)
    expect(node.querySelectorAll('h1')).toHaveLength(1)
    expect(node.querySelectorAll('table')).toHaveLength(1)
  })

  it('reuses the heading element across growth instead of recreating it', () => {
    const document = CLOSED + 'A tail paragraph that keeps growing one word at a time.\n'
    const grown = prefixes(document)

    const node = mount(markdown(CLOSED))
    const heading = node.querySelector('h1')
    expect(heading).not.toBeNull()

    for (const prefix of grown) {
      if (prefix.length < CLOSED.length) continue
      update(markdown(prefix))
      expect(node.querySelector('h1'), `prefix ${JSON.stringify(prefix)}`).toBe(heading)
    }
  })
})

/**
 * The real "final render equals the one-shot render" check. Comparing
 * `html(document)` with itself proves nothing; streaming the document into a
 * live root and then comparing that root against a root that never saw a
 * partial prefix does, because stale memoisation of the closed prefix would
 * show up here and nowhere else.
 */
describe.each(CASES)('a mounted root streaming $name', ({ name, tail }) => {
  it(`ends byte-identical to a one-shot render of ${name}`, () => {
    const document = CLOSED + tail
    const grown = prefixes(document)
    const node = mount(markdown(grown[0] as string))
    for (const prefix of grown.slice(1)) {
      update(markdown(prefix))
    }
    expect(node.innerHTML).toBe(oneShotDom(document))
    expect(node.querySelectorAll('h1')).toHaveLength(1)
    expect(node.querySelectorAll('blockquote')).toHaveLength(1)
  })
})
