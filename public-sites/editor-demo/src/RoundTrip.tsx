import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'
import { createMarkdownBridge } from '@react-markdown-kit/editor'
import { ActivityScope } from '@zuilib/primitives/activity'
import { cn } from '@zuilib/primitives/lib/cn'
import Textarea from '@zuilib/primitives/textarea'
import { diffLines, hunks, summarize, type DiffRow } from './diff'
import { sites } from '../../shared/Shell'
import styles from './RoundTrip.module.css'

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

function Row({ row }: { readonly row: DiffRow }): ReactNode {
  return (
    <tr className={styles[row.kind]}>
      <td className={styles.number}>{row.left ?? ''}</td>
      <td className={styles.number}>{row.right ?? ''}</td>
      <td className={styles.mark} aria-hidden="true">
        {MARK[row.kind]}
      </td>
      <td className={styles.text}>{row.text === '' ? ' ' : row.text}</td>
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
      <div className={styles.panel}>
        <label className={styles.field}>
          <span className={styles.label}>Paste Markdown</span>
          <Textarea
            track="pasted-markdown"
            fullWidth
            resize="vertical"
            textareaClassName={cn(styles.input)}
            value={pasted}
            spellCheck={false}
            rows={12}
            onChange={(event) => setPasted(event.target.value)}
          />
        </label>

        <div className={styles.result} aria-live="polite">
          {result === undefined ? (
            <p className={styles.status}>Opening and saving…</p>
          ) : result.kind === 'failed' ? (
            <p className={`${styles.status} ${styles.error}`}>
              The editor could not open this document: {result.message}
            </p>
          ) : identical ? (
            <p className={`${styles.status} ${styles.same}`}>
              Identical. {characters(pasted)} in, {characters(result.outcome.saved)} out, 0 lines changed.
            </p>
          ) : (
            <>
              <p className={`${styles.status} ${styles.changed}`}>
                {lineWord(result.outcome.removed)} removed, {lineWord(result.outcome.added)} added.{' '}
                {characters(pasted)} in, {characters(result.outcome.saved)} out.
              </p>
              <div className={styles.diff}>
                <table className={styles.table}>
                  <caption className={styles.caption}>
                    Pasted on the left, saved on the right, with {CONTEXT} lines of context.
                  </caption>
                  {groups.map((group, index) => (
                    <tbody key={`${index}-${group[0]?.text ?? ''}`} className={styles.hunk}>
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

        <p className={styles.note}>
          The document is opened and saved by the same headless bridge as{' '}
          <a href={ROUNDTRIP_TEST} data-zui-tag="roundtrip-test-link">
            <code>packages/editor/tests/roundtrip.test.ts</code>
          </a>
          , with the same GFM preset. That suite runs 22 audited documents in CI and requires every one
          back byte for byte. Everything here runs in this page; nothing is uploaded.
        </p>
      </div>
    </ActivityScope>
  )
}
