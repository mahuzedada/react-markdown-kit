/**
 * `<MarkdownEditor>` (spec 7.1) — the batteries-included editor.
 *
 *   <MarkdownEditor value={value} onChange={setValue} />
 *
 * is a complete editor: rich surface, toolbar, shortcuts, source mode and
 * preview. It is assembled from the same public pieces an application would
 * use, so nothing here is reachable only from the default chrome.
 */
import type { CSSProperties, ReactElement } from 'react'
import { editorClass } from '../class-names.js'
import { useMarkdownEditor } from './use-markdown-editor.js'
import { MarkdownEditorProvider } from './context.js'
import { MarkdownEditorContent } from './content.js'
import { MarkdownToolbar } from './toolbar.js'
import { internalsOf } from './internals.js'
import type { MarkdownEditorProps } from '../types.js'

/**
 * Screen-reader-only positioning. Inline because the announcement has to work
 * with no stylesheet loaded, and hiding an element from sight while keeping it
 * in the accessibility tree is function, not appearance (docs/STYLING.md
 * rule 2).
 */
const VISUALLY_HIDDEN: CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  margin: '-1px',
  padding: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

const MODE_ANNOUNCEMENTS: Readonly<Record<string, string>> = {
  rich: 'Rich text editing',
  source: 'Markdown source editing',
  preview: 'Preview',
}

export function MarkdownEditor(props: MarkdownEditorProps): ReactElement {
  const editor = useMarkdownEditor(props)
  const internals = internalsOf(editor)
  const showToolbar = props.toolbar !== false

  return (
    <MarkdownEditorProvider editor={editor}>
      <div
        className={editorClass('root', props.classNames)}
        data-rmk-mode={internals.mode}
        data-rmk-readonly={props.readOnly === true ? '' : undefined}
      >
        {showToolbar ? (
          <MarkdownToolbar
            editor={editor}
            internals={internals}
            render={typeof props.toolbar === 'function' ? props.toolbar : undefined}
          />
        ) : null}
        <div
          role="status"
          aria-live="polite"
          data-rmk-live-region=""
          style={VISUALLY_HIDDEN}
        >
          {props.labels?.[`announce.${internals.mode}`] ?? MODE_ANNOUNCEMENTS[internals.mode]}
        </div>
        <MarkdownEditorContent
          {...(props['aria-label'] === undefined ? {} : { 'aria-label': props['aria-label'] })}
          {...(props['aria-labelledby'] === undefined
            ? {}
            : { 'aria-labelledby': props['aria-labelledby'] })}
          {...(props['aria-describedby'] === undefined
            ? {}
            : { 'aria-describedby': props['aria-describedby'] })}
        />
        {props.children}
      </div>
    </MarkdownEditorProvider>
  )
}

export default MarkdownEditor
