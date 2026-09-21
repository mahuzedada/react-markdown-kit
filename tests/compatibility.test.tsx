/**
 * DX-01 — react-markdown 10.1.0 compatibility matrix.
 *
 * Every case renders the same input through `react-markdown@10.1.0` and
 * through this renderer and compares the normalized HTML. The matrix in
 * `docs/COMPATIBILITY.md` is generated from the observed results, so it cannot
 * drift from the code, and each feature's classification is asserted against
 * what actually happened rather than written by hand.
 *
 * This is a migration aid, not a compatibility promise. Several behaviours
 * differ on purpose; they are labelled `intentionally different` and the reason
 * is recorded next to the evidence.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ComponentProps, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, describe, expect, it } from 'vitest'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Markdown from '@react-markdown-kit/renderer'
import { normalizeHtml } from './helpers/html.js'

type Classification =
  | 'compatible'
  | 'compatible with documented change'
  | 'not supported yet'
  | 'intentionally different'

interface CompatCase {
  readonly name: string
  readonly source: string
  /** Props passed to both renderers. */
  readonly props?: Record<string, unknown>
}

interface Feature {
  readonly feature: string
  readonly classification: Classification
  readonly summary: string
  readonly cases: readonly CompatCase[]
}

// --- shared props used by more than one case -------------------------------

const Heading = ({ children }: { children?: ReactNode }): ReactNode => <h2 data-kit="h">{children}</h2>
const Anchor = (props: ComponentProps<'a'>): ReactNode => <a {...props} rel="noreferrer" />
const Para = ({ children }: { children?: ReactNode }): ReactNode => <p className="prose">{children}</p>

/** A remark plugin that rewrites text, to prove tree transforms still run. */
const remarkShout = () => (tree: { children?: unknown[] }): void => {
  const walk = (node: Record<string, unknown>): void => {
    if (node.type === 'text') node.value = String(node.value).toUpperCase()
    for (const child of (node.children as Record<string, unknown>[] | undefined) ?? []) walk(child)
  }
  walk(tree as Record<string, unknown>)
}

/** A rehype plugin that stamps an attribute on every element. */
const rehypeStamp = () => (tree: Record<string, unknown>): void => {
  const walk = (node: Record<string, unknown>): void => {
    if (node.type === 'element') {
      node.properties = { ...(node.properties as object), 'data-stamped': 'yes' }
    }
    for (const child of (node.children as Record<string, unknown>[] | undefined) ?? []) walk(child)
  }
  walk(tree)
}

const rehypeAddClass = () => (tree: Record<string, unknown>): void => {
  const walk = (node: Record<string, unknown>): void => {
    if (node.type === 'element' && node.tagName === 'p') {
      node.properties = { ...(node.properties as object), className: ['stamped'] }
    }
    for (const child of (node.children as Record<string, unknown>[] | undefined) ?? []) walk(child)
  }
  walk(tree)
}

const FEATURES: readonly Feature[] = [
  {
    feature: 'children',
    classification: 'compatible',
    summary: 'A Markdown string as children renders the same tree.',
    cases: [
      { name: 'headings and emphasis', source: '# Title\n\nSome *em* and **strong** text.' },
      { name: 'lists, code and quotes', source: '- a\n- b\n\n```js\nconst x = 1\n```\n\n> quoted' },
      { name: 'links, reference links and hard breaks', source: 'See [a](/x) and [b][r].\n\n[r]: /y\n\nline  \nbreak' },
      { name: 'empty string', source: '' },
    ],
  },
  {
    feature: 'components',
    classification: 'compatible',
    summary: 'Element-name keys map to React components; the same props arrive.',
    cases: [
      { name: 'heading override', source: '## Hello', props: { components: { h2: Heading } } },
      { name: 'anchor override receives href', source: '[x](https://example.com)', props: { components: { a: Anchor } } },
      { name: 'paragraph override', source: 'one\n\ntwo', props: { components: { p: Para } } },
      {
        name: 'several overrides at once',
        source: '# T\n\n[l](/u)\n\ntext',
        props: { components: { h2: Heading, a: Anchor, p: Para } },
      },
    ],
  },
  {
    feature: 'remarkPlugins',
    classification: 'compatible',
    summary: 'Both tree-transforming plugins and dialect plugins (remark-gfm) behave the same.',
    cases: [
      { name: 'remark-gfm tables', source: '| a | b |\n| - | - |\n| 1 | 2 |', props: { remarkPlugins: [remarkGfm] } },
      { name: 'remark-gfm task list and strikethrough', source: '- [x] done ~~old~~', props: { remarkPlugins: [remarkGfm] } },
      { name: 'remark-gfm autolinks and footnotes', source: 'www.example.com[^1]\n\n[^1]: note', props: { remarkPlugins: [remarkGfm] } },
      { name: 'custom mdast transform', source: 'hello *world*', props: { remarkPlugins: [remarkShout] } },
    ],
  },
  {
    feature: 'rehypePlugins',
    classification: 'compatible',
    summary: 'hast plugins run after mdast->hast and before the content policy.',
    cases: [
      { name: 'attribute stamping', source: '# T\n\ntext', props: { rehypePlugins: [rehypeStamp] } },
      { name: 'class injection', source: 'para one\n\npara two', props: { rehypePlugins: [rehypeAddClass] } },
      { name: 'plugin plus components', source: '## H', props: { rehypePlugins: [rehypeStamp], components: { h2: Heading } } },
    ],
  },
  {
    feature: 'remarkRehypeOptions',
    classification: 'compatible',
    summary: 'Options reach remark-rehype, including footnote labels and clobber prefixes.',
    cases: [
      {
        name: 'footnote label',
        source: 'a[^1]\n\n[^1]: n',
        props: { remarkPlugins: [remarkGfm], remarkRehypeOptions: { footnoteLabel: 'Notes' } },
      },
      {
        name: 'clobber prefix',
        source: 'a[^1]\n\n[^1]: n',
        props: { remarkPlugins: [remarkGfm], remarkRehypeOptions: { clobberPrefix: 'x-' } },
      },
      {
        name: 'footnote back-label',
        source: 'a[^1]\n\n[^1]: n',
        props: { remarkPlugins: [remarkGfm], remarkRehypeOptions: { footnoteBackLabel: 'go back' } },
      },
    ],
  },
  {
    feature: 'allowedElements',
    classification: 'compatible',
    summary: 'Only the listed tag names survive; children of a removed element go with it.',
    cases: [
      { name: 'paragraphs only', source: '# T\n\ntext\n\n- a', props: { allowedElements: ['p'] } },
      { name: 'headings and text', source: '# T\n\ntext', props: { allowedElements: ['h1'] } },
      { name: 'nothing allowed', source: '# T\n\ntext', props: { allowedElements: [] } },
      { name: 'inline allowed inside removed block', source: 'a *b* c', props: { allowedElements: ['em'] } },
    ],
  },
  {
    feature: 'disallowedElements',
    classification: 'compatible',
    summary: 'The listed tag names are removed, everything else stays.',
    cases: [
      { name: 'drop headings', source: '# T\n\ntext', props: { disallowedElements: ['h1'] } },
      { name: 'drop emphasis', source: 'a *b* c', props: { disallowedElements: ['em'] } },
      { name: 'drop lists', source: '- a\n- b\n\npara', props: { disallowedElements: ['ul'] } },
    ],
  },
  {
    feature: 'allowElement',
    classification: 'compatible',
    summary: 'The predicate receives (element, index, parent) and removing is the same decision.',
    cases: [
      {
        name: 'reject by tag name',
        source: '# T\n\ntext',
        props: { allowElement: (element: { tagName: string }) => element.tagName !== 'h1' },
      },
      {
        name: 'reject by index',
        source: 'a\n\nb\n\nc',
        props: { allowElement: (_e: unknown, index: number) => index !== 1 },
      },
      {
        name: 'reject by parent tag',
        source: '- a\n- b',
        props: {
          allowElement: (_e: unknown, _i: number, parent: { tagName?: string } | undefined) =>
            parent?.tagName !== 'ul',
        },
      },
    ],
  },
  {
    feature: 'unwrapDisallowed',
    classification: 'compatible',
    summary: 'A removed element is replaced by its children rather than dropped.',
    cases: [
      { name: 'unwrap emphasis', source: 'a *b* c', props: { disallowedElements: ['em'], unwrapDisallowed: true } },
      { name: 'unwrap heading', source: '# T', props: { disallowedElements: ['h1'], unwrapDisallowed: true } },
      {
        name: 'unwrap via allowElement',
        source: '- a\n- b',
        props: {
          allowElement: (element: { tagName: string }) => element.tagName !== 'li',
          unwrapDisallowed: true,
        },
      },
    ],
  },
  {
    feature: 'urlTransform',
    classification: 'compatible',
    summary: 'Runs on every URL attribute; returning an empty string blanks it. The default algorithm is the same one react-markdown ships.',
    cases: [
      { name: 'rewrite href', source: '[a](/x)', props: { urlTransform: (url: string) => `https://cdn.test${url}` } },
      { name: 'blank everything', source: '[a](/x) and ![i](/y)', props: { urlTransform: () => '' } },
      { name: 'default blocks javascript:', source: '[a](javascript:alert(1))' },
      { name: 'default keeps mailto:', source: '[a](mailto:x@y.z)' },
    ],
  },
  {
    feature: 'skipHtml',
    classification: 'compatible',
    summary:
      'Same meaning and the same default. Both packages default to `false`, rendering raw HTML as visible escaped text rather than executing it; `skipHtml: true` removes it in both. An earlier revision of this renderer defaulted to `true`, which was the only behavioural difference on this prop and amounted to silently dropping content the author wrote. Neither package executes raw HTML without an explicit rehype-raw opt-in.',
    cases: [
      { name: 'default (unset)', source: '<b>bold</b> and text' },
      { name: 'skipHtml true', source: '<b>bold</b> and text', props: { skipHtml: true } },
      { name: 'skipHtml false', source: '<b>bold</b> and text', props: { skipHtml: false } },
      { name: 'dangerous html, default', source: '<img src=x onerror="alert(1)">\n\ntext' },
    ],
  },
]

/**
 * Rows that are not a prop comparison: things react-markdown has that this
 * renderer does not, or handles differently. Each is proved by a test below,
 * so the matrix cannot claim parity the code does not have.
 */
interface ExtraRow {
  readonly feature: string
  readonly classification: Classification
  readonly summary: string
  readonly evidence: string
}

const EXTRA_ROWS: readonly ExtraRow[] = [
  {
    feature: 'className',
    classification: 'intentionally different',
    summary:
      'react-markdown 10 throws `Unexpected `className` prop, remove it`. This renderer has no `className` prop either, but ignores it at runtime rather than throwing; TypeScript rejects it. Use `components` or the opt-in `classNames` hooks. Migrating JavaScript code that still passes `className` will lose the wrapper silently instead of failing loudly.',
    evidence: 'react-markdown throws / this renderer ignores',
  },
  {
    feature: 'MarkdownAsync, MarkdownHooks',
    classification: 'not supported yet',
    summary:
      'react-markdown 10 exports `MarkdownAsync` and `MarkdownHooks` for plugins that need async work. This renderer is synchronous only; there is no equivalent export, and an async remark/rehype plugin will not work.',
    evidence: 'exports are absent from @react-markdown-kit/renderer',
  },
  {
    feature: 'remarkPlugins on a precompiled document',
    classification: 'compatible with documented change',
    summary:
      'react-markdown only ever takes a string, so every plugin runs at parse time. This renderer also accepts an already-compiled `MarkdownDocument`, and a plugin that changes the *dialect* (`remark-gfm` and anything else registering micromark extensions) cannot apply to text that has already been parsed. Tree-transforming plugins still run. Compile with the same extensions you render with, or pass the string.',
    evidence: 'remark-gfm produces a table from a string but not from a document compiled without it',
  },
]

const render = (Component: typeof Markdown | typeof ReactMarkdown, source: string, props: Record<string, unknown>) =>
  renderToStaticMarkup(
    // Both components take the same prop shape; widening to a plain record
    // keeps the matrix honest by refusing to special-case either side.
    <Component {...(props as Record<string, unknown>)}>{source}</Component>,
  )

interface Observation {
  readonly feature: string
  readonly name: string
  readonly matches: boolean
  readonly ours: string
  readonly theirs: string
}

const observations: Observation[] = []

describe('react-markdown 10.1.0 compatibility (DX-01)', () => {
  for (const feature of FEATURES) {
    describe(feature.feature, () => {
      it('covers at least three inputs', () => {
        expect(feature.cases.length).toBeGreaterThanOrEqual(3)
      })

      it.each(feature.cases.map((entry) => [entry.name, entry] as const))('%s', (_name, entry) => {
        const props = entry.props ?? {}
        const ours = render(Markdown, entry.source, props)
        const theirs = render(ReactMarkdown, entry.source, props)
        const matches = normalizeHtml(ours) === normalizeHtml(theirs)
        observations.push({ feature: feature.feature, name: entry.name, matches, ours, theirs })

        if (feature.classification === 'compatible') {
          expect(
            normalizeHtml(ours),
            `${feature.feature} / ${entry.name} is declared compatible but differs`,
          ).toBe(normalizeHtml(theirs))
        }
      })

      it('classification matches the evidence', () => {
        const scoped = observations.filter((entry) => entry.feature === feature.feature)
        expect(scoped.length, 'cases must run before this assertion').toBe(feature.cases.length)
        const allMatch = scoped.every((entry) => entry.matches)
        if (feature.classification === 'compatible') {
          expect(allMatch).toBe(true)
        } else {
          // A feature may only claim to differ if it actually differs, so the
          // matrix cannot hedge its way out of a real compatibility problem.
          expect(allMatch, `${feature.feature} is declared "${feature.classification}" but matches everywhere`)
            .toBe(false)
        }
      })
    })
  }

  describe('beyond the prop surface', () => {
    it('className: react-markdown throws, this renderer ignores it', () => {
      expect(() => render(ReactMarkdown, 'hi', { className: 'x' })).toThrow(/className/)
      expect(render(Markdown, 'hi', { className: 'x' })).toBe('<p>hi</p>')
    })

    it('MarkdownAsync and MarkdownHooks have no equivalent here', async () => {
      const theirs = await import('react-markdown')
      const ours = await import('@react-markdown-kit/renderer')
      expect(Object.keys(theirs)).toEqual(expect.arrayContaining(['MarkdownAsync', 'MarkdownHooks']))
      expect(Object.keys(ours)).not.toContain('MarkdownAsync')
      expect(Object.keys(ours)).not.toContain('MarkdownHooks')
    })

    it('dialect plugins apply to a string but not to a precompiled document', async () => {
      const { compileMarkdown } = await import('@react-markdown-kit/renderer')
      const source = '| a | b |\n| - | - |\n| 1 | 2 |'

      const fromString = render(Markdown, source, { remarkPlugins: [remarkGfm] })
      expect(fromString).toContain('<table>')
      expect(normalizeHtml(fromString)).toBe(
        normalizeHtml(render(ReactMarkdown, source, { remarkPlugins: [remarkGfm] })),
      )

      const fromDocument = renderToStaticMarkup(
        <Markdown document={compileMarkdown(source)} remarkPlugins={[remarkGfm]} />,
      )
      expect(fromDocument, 'parsing already happened, so the dialect cannot change').not.toContain('<table>')

      // Tree-transforming plugins are unaffected by the document input.
      const shouted = renderToStaticMarkup(
        <Markdown document={compileMarkdown('hello')} remarkPlugins={[remarkShout]} />,
      )
      expect(shouted).toContain('HELLO')
    })

    it('defaultUrlTransform is exported by both and agrees', async () => {
      const theirs = await import('react-markdown')
      const ours = await import('@react-markdown-kit/renderer')
      for (const url of [
        'https://ok',
        'http://ok',
        'mailto:a@b.c',
        'javascript:alert(1)',
        'data:text/html,<script>',
        '/relative',
        './rel',
        '#hash',
        'a?b:c',
        'vbscript:x',
      ]) {
        expect(ours.defaultUrlTransform(url), url).toBe(theirs.defaultUrlTransform(url))
      }
    })
  })

  it('does not claim to be a drop-in replacement anywhere', () => {
    const forbidden = /drop-?in replacement/i
    for (const feature of [...FEATURES, ...EXTRA_ROWS]) expect(forbidden.test(feature.summary)).toBe(false)
  })
})

afterAll(() => {
  writeCompatibilityDoc()
})

function writeCompatibilityDoc(): void {
  const rows = FEATURES.map((feature) => {
    const scoped = observations.filter((entry) => entry.feature === feature.feature)
    const matching = scoped.filter((entry) => entry.matches).length
    return { feature, scoped, matching }
  })

  const counts = new Map<Classification, number>()
  for (const { feature } of rows) counts.set(feature.classification, (counts.get(feature.classification) ?? 0) + 1)
  for (const row of EXTRA_ROWS) counts.set(row.classification, (counts.get(row.classification) ?? 0) + 1)

  const lines: string[] = [
    '# react-markdown compatibility',
    '',
    '<!-- Generated by tests/compatibility.test.tsx. Do not edit by hand. -->',
    '',
    'This renderer is **not** a drop-in replacement for `react-markdown`. It is a',
    'different package with a compatible surface for the props people actually',
    'migrate: same prop names, same meanings, and the same default URL policy.',
    'Where behaviour differs, the difference is listed below rather than smoothed',
    'over.',
    '',
    `Measured against \`react-markdown@10.1.0\` by rendering identical input through`,
    `both packages and comparing normalized HTML. ${observations.length} comparisons across`,
    `${FEATURES.length} props; ${observations.filter((entry) => entry.matches).length} produce identical markup.`,
    '',
    '## Matrix',
    '',
    '| Prop | Status | Cases matching | Evidence |',
    '| --- | --- | --- | --- |',
  ]

  for (const { feature, scoped, matching } of rows) {
    lines.push(
      `| \`${feature.feature}\` | ${feature.classification} | ${matching}/${scoped.length} | \`tests/compatibility.test.tsx\` › ${feature.feature} |`,
    )
  }

  for (const row of EXTRA_ROWS) {
    lines.push(
      `| \`${row.feature}\` | ${row.classification} | — | \`tests/compatibility.test.tsx\` › beyond the prop surface (${row.evidence}) |`,
    )
  }

  lines.push('', '## Counts', '')
  for (const [classification, count] of counts) lines.push(`- **${classification}**: ${count}`)

  lines.push('', '## Notes', '')
  for (const { feature, scoped } of rows) {
    lines.push(`### \`${feature.feature}\` — ${feature.classification}`, '', feature.summary, '')
    lines.push('Inputs compared:', '')
    for (const entry of scoped) {
      lines.push(`- ${entry.matches ? 'identical' : '**differs**'} — ${entry.name}`)
    }
    lines.push('')
    const differing = scoped.filter((entry) => !entry.matches)
    if (differing.length > 0) {
      lines.push('Observed difference:', '', '```diff')
      for (const entry of differing.slice(0, 2)) {
        lines.push(`  case: ${entry.name}`, `- react-markdown: ${entry.theirs.replace(/\n/g, '\\n')}`, `+ this renderer: ${entry.ours.replace(/\n/g, '\\n')}`)
      }
      lines.push('```', '')
    }
  }

  for (const row of EXTRA_ROWS) {
    lines.push(`### \`${row.feature}\` — ${row.classification}`, '', row.summary, '', `Evidence: ${row.evidence}.`, '')
  }

  lines.push(
    '## What is not covered here',
    '',
    'Everything outside the prop surface — bundle size, the `MarkdownDocument`',
    'input, presets, extensions, the editor and template packages — has no',
    'react-markdown equivalent and is not a compatibility question.',
    '',
  )

  const target = fileURLToPath(new URL('../docs/COMPATIBILITY.md', import.meta.url))
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, lines.join('\n'))
}
