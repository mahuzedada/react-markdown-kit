import { useState, type ReactNode } from 'react'
import Markdown, { defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'
import styles from './Example.module.css'

const gfmPreset = defineMarkdownPreset({ extensions: [gfm()] })

export interface RenderExampleProps {
  /** Markdown source. Shown on the left, rendered on the right. */
  readonly markdown: string
  /** Turn on GFM (tables, task lists, strikethrough, autolinks, footnotes). */
  readonly gfm?: boolean
  /** Let the reader edit the source and watch the output follow. */
  readonly editable?: boolean
  readonly title?: string
  /** Props forwarded to `<Markdown>`, so a page can demo a real option. */
  readonly rendererProps?: Record<string, unknown>
  readonly children?: ReactNode
}

/**
 * Source on the left, live output on the right.
 *
 * This is the renderer rendering itself: the right-hand pane is a real
 * `<Markdown>` from `@react-markdown-kit/renderer`, not a screenshot and not a
 * second implementation. It needs no browser, so it server-renders with the
 * rest of the page and is visible before hydration.
 */
export default function RenderExample({
  markdown,
  gfm: useGfm = false,
  editable = false,
  title,
  rendererProps = {},
  children,
}: RenderExampleProps): ReactNode {
  const [source, setSource] = useState(markdown)
  const value = editable ? source : markdown

  return (
    <figure className={styles.example}>
      {title !== undefined && <figcaption className={styles.caption}>{title}</figcaption>}
      <div className={styles.split}>
        <div className={styles.pane}>
          <div className={styles.paneLabel}>
            {editable ? 'Markdown (edit me)' : 'Markdown'}
          </div>
          {editable ? (
            <textarea
              className={styles.source}
              value={source}
              spellCheck={false}
              onChange={(event) => setSource(event.target.value)}
              aria-label="Markdown source"
            />
          ) : (
            <pre className={styles.source}>{markdown}</pre>
          )}
        </div>
        <div className={styles.pane}>
          <div className={styles.paneLabel}>Rendered</div>
          <div className={`${styles.output} rmk-document`}>
            <Markdown
              {...(useGfm ? { preset: gfmPreset } : {})}
              {...(rendererProps as Record<string, never>)}
            >
              {value}
            </Markdown>
          </div>
        </div>
      </div>
      {children !== undefined && <div className={styles.note}>{children}</div>}
    </figure>
  )
}
