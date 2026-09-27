import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'
import { createMarkdownBridge } from '@react-markdown-kit/editor'
import { ActivityScope } from '@zuilib/primitives/activity'
import Text from '@zuilib/primitives/text'
import Textarea from '@zuilib/primitives/textarea'
import { diffLines, hunks, summarize, type DiffRow } from './diff'
import { sites } from '../../sites'

/*
 * The round-trip panel (docs/SEO_WORKPLAN.md, milestone D item 5 and 3.2).
 *
 * Paste Markdown; the kit opens it and saves it back, and the panel shows a
 * line diff between the two. The round trip runs through the same headless
 * bridge as `packages/editor/tests/roundtrip.test.ts`, with the same GFM
 * preset, so what this panel shows is what that suite asserts.
 */

const ROUNDTRIP_TEST = `${sites.github}/blob/main/packages/editor/tests/roundtrip.test.ts`

/** The preset the round-trip suite uses. */
const preset = defineMarkdownPreset({ extensions: [gfm()] })

/** How long after the last keystroke the document is opened and saved again. */
const RUN_DEBOUNCE_MS = 300

/** How many unchanged lines are shown around each change. */
const CONTEXT = 2

/**
 * Constructs the audit in `docs/AUDIT.md` found corrupted by another editor:
 * a setext heading, a list that does not start at 1, a nested quote, double
 * backtick code, underscore emphasis and a reference link.
 */
const SAMPLE = `Title
=====

3. three
4. four

> a
>
> > b

Use \`\` a \` b \`\` here.

_em_ and __strong__

See [text][ref].

[ref]: https://example.com
`

/** Opens `source` in a headless editor and saves it straight back. */
function roundTrip(source: string): string {
  const bridge = createMarkdownBridge({ preset, headless: true })
  bridge.load(source)
  return bridge.getMarkdown()
}

interface Outcome {
  readonly saved: string
  readonly rows: readonly DiffRow[]
  readonly removed: number
  readonly added: number
}

type Result = { readonly kind: 'ok'; readonly outcome: Outcome } | { readonly kind: 'failed'; readonly message: string }

function run(source: string): Result {
  try {
    const saved = roundTrip(source)
    const rows = diffLines(source, saved)
    const { removed, added } = summarize(rows)
    return { kind: 'ok', outcome: { saved, rows, removed, added } }
  } catch (error) {
    return { kind: 'failed', message: error instanceof Error ? error.message : String(error) }
  }
}

const characters = (text: string): string => `${text.length} character${text.length === 1 ? '' : 's'}`

const lineWord = (count: number): string => `${count} line${count === 1 ? '' : 's'}`

const MARK: Record<DiffRow['kind'], string> = { same: ' ', removed: '-', added: '+' }

/** Each row tinted by what happened to its line. */
const ROW: Record<DiffRow['kind'], string> = {
  same: '',
  removed: 'bg-danger/12 text-danger-text',
  added: 'bg-success/12 text-success-text',
}

/** The two line-number columns. */
const NUMBER = 'w-10 px-1.5 text-right text-muted-foreground select-none'

function Row({ row }: { readonly row: DiffRow }): ReactNode {
  return (
    <tr className={ROW[row.kind]}>
      <td className={NUMBER}>{row.left ?? ''}</td>
      <td className={NUMBER}>{row.right ?? ''}</td>
      <td className="w-4 p-0 text-center select-none" aria-hidden="true">
        {MARK[row.kind]}
      </td>
      <td className="pr-2 pl-1 break-words whitespace-pre-wrap">{row.text === '' ? ' ' : row.text}</td>
    </tr>
  )
}

/**
 * The live proof behind the round-trip claim. Nothing is uploaded: the
 * editor bridge runs in this page, on the text in the box.
 */
export default function RoundTrip(): ReactNode {
  const [pasted, setPasted] = useState(SAMPLE)
  const [result, setResult] = useState<Result | undefined>(undefined)

  useEffect(() => {
    setResult(undefined)
    const timer = setTimeout(() => setResult(run(pasted)), RUN_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [pasted])

  const groups = useMemo(
    () => (result?.kind === 'ok' ? hunks(result.outcome.rows, CONTEXT) : []),
    [result],
  )

  const identical = result?.kind === 'ok' && groups.length === 0

  return (
    <ActivityScope feature="round-trip">
      <div className="mb-6 flex flex-col gap-3 rounded-md border border-border bg-card p-3.5">
        <label className="flex flex-col gap-1.5">
          <Text as="span" size="sm" weight="medium">
            Paste Markdown
          </Text>
          <Textarea
            track="pasted-markdown"
            fullWidth
            resize="vertical"
            textareaClassName="font-mono text-sm leading-normal"
            value={pasted}
            spellCheck={false}
            rows={12}
            onChange={(event) => setPasted(event.target.value)}
          />
        </label>

        <div className="flex min-h-12 flex-col gap-2.5" aria-live="polite">
          {result === undefined ? (
            <Text muted className="m-0">
              Opening and saving…
            </Text>
          ) : result.kind === 'failed' ? (
            <Text tone="danger" className="m-0">
              The editor could not open this document: {result.message}
            </Text>
          ) : identical ? (
            <Text tone="success" weight="semibold" className="m-0">
              Identical. {characters(pasted)} in, {characters(result.outcome.saved)} out, 0 lines changed.
            </Text>
          ) : (
            <>
              <Text tone="warning" weight="semibold" className="m-0">
                {lineWord(result.outcome.removed)} removed, {lineWord(result.outcome.added)} added.{' '}
                {characters(pasted)} in, {characters(result.outcome.saved)} out.
              </Text>
              <div className="max-h-96 overflow-auto rounded-md border border-border">
                <table className="w-full border-collapse font-mono text-xs leading-normal">
                  <caption className="border-b border-border px-2.5 py-1.5 text-left font-sans text-sm text-muted-foreground">
                    Pasted on the left, saved on the right, with {CONTEXT} lines of context.
                  </caption>
                  {groups.map((group, index) => (
                    <tbody
                      key={`${index}-${group[0]?.text ?? ''}`}
                      className="[&+&]:border-t [&+&]:border-border"
                    >
                      {group.map((row, position) => (
                        <Row key={`${row.kind}-${row.left ?? ''}-${row.right ?? ''}-${position}`} row={row} />
                      ))}
                    </tbody>
                  ))}
                </table>
              </div>
            </>
          )}
        </div>

        <Text className="m-0 [&_a]:text-primary-text [&_code]:font-mono [&_code]:text-[0.9em]">
          The document is opened and saved by the same headless bridge as{' '}
          <a href={ROUNDTRIP_TEST} data-zui-tag="roundtrip-test-link">
            <code>packages/editor/tests/roundtrip.test.ts</code>
          </a>
          , with the same GFM preset. That suite runs 22 audited documents in CI and expects every one of
          them back byte for byte. Everything here runs in the page, and nothing is uploaded.
        </Text>
      </div>
    </ActivityScope>
  )
}
