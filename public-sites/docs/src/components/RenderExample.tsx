import { useState, type ReactNode } from 'react'
import Markdown, { defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'
import { ActivityScope } from '@zuilib/primitives/activity'
import { cn } from '@zuilib/primitives/lib/cn'
import { CAPTION, EXAMPLE, NOTE, OUTPUT, PANE_LABEL, SOURCE, SPLIT } from './exampleStyles'

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
    <ActivityScope feature="render-example" as="figure" className={EXAMPLE}>
      {title !== undefined && <figcaption className={CAPTION}>{title}</figcaption>}
      <div className={SPLIT}>
        <div>
          <div className={PANE_LABEL}>
            {editable ? 'Markdown (edit me)' : 'Markdown'}
          </div>
          {editable ? (
            <textarea
              className={cn(SOURCE, 'min-h-32 resize-y -outline-offset-2')}
              value={source}
              spellCheck={false}
              onChange={(event) => setSource(event.target.value)}
              aria-label="Markdown source"
              data-zui-tag="source"
            />
          ) : (
            <pre className={cn(SOURCE, 'min-h-32')}>{markdown}</pre>
          )}
        </div>
        <div>
          <div className={PANE_LABEL}>Rendered</div>
          <div className={cn(OUTPUT, 'rmk-document')}>
            <Markdown
              {...(useGfm ? { preset: gfmPreset } : {})}
              {...(rendererProps as Record<string, never>)}
            >
              {value}
            </Markdown>
          </div>
        </div>
      </div>
      {children !== undefined && <div className={NOTE}>{children}</div>}
    </ActivityScope>
  )
}
