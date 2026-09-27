import { useState, type ReactNode } from 'react'
import {
  MarkdownEditor,
  type EditorClassNames,
  type MarkdownEditorMode,
  type MarkdownExtension,
} from '@react-markdown-kit/editor'
import { defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'
import Badge from '@zuilib/primitives/badge'
import { cn } from '@zuilib/primitives/lib/cn'
import { CAPTION, EXAMPLE, PANE_LABEL, SOURCE } from './exampleStyles'

import '@react-markdown-kit/editor/styles.css'

const gfmPreset = defineMarkdownPreset({ extensions: [gfm()] })

export interface EditorExampleProps {
  readonly markdown: string
  readonly height?: number
  readonly toolbar?: boolean
  readonly gfm?: boolean
  readonly title?: string
  /** Show the saved Markdown underneath, so the round trip is visible. */
  readonly showSource?: boolean
  readonly defaultMode?: MarkdownEditorMode
  /**
   * Extensions passed to `<MarkdownEditor>` after the preset, so a page can
   * demo a plugin's `/editor` entry. Build the array once, at module level:
   * a plugin created inside render would remount its React parts every time.
   */
  readonly extensions?: readonly MarkdownExtension[]
  /** Forwarded to `<MarkdownEditor>`, so a page can demo a class recipe. */
  readonly classNames?: EditorClassNames
}

/**
 * The real editor, with the saved Markdown shown underneath.
 *
 * Showing the source is the point of most of these examples: the reader edits
 * in rich mode and watches what actually gets persisted, which is the claim
 * the package makes.
 */
export default function EditorExampleInner({
  markdown,
  height = 320,
  toolbar = true,
  gfm: useGfm = true,
  title,
  showSource = true,
  defaultMode = 'rich',
  extensions,
  classNames,
}: EditorExampleProps): ReactNode {
  const [value, setValue] = useState(markdown)
  const untouched = value === markdown

  return (
    <figure className={EXAMPLE}>
      {title !== undefined && <figcaption className={CAPTION}>{title}</figcaption>}
      <div className="border-b border-border" style={{ minHeight: height }}>
        <MarkdownEditor
          value={value}
          onChange={setValue}
          toolbar={toolbar}
          defaultMode={defaultMode}
          {...(useGfm ? { preset: gfmPreset } : {})}
          {...(extensions !== undefined ? { extensions } : {})}
          {...(classNames !== undefined ? { classNames } : {})}
        />
      </div>
      {showSource && (
        <div className="min-w-0">
          <div className={PANE_LABEL}>
            Saved Markdown
            <Badge variant="subtle" tone={untouched ? 'success' : 'warning'} size="sm">
              {untouched ? 'unchanged' : 'edited'}
            </Badge>
          </div>
          <pre className={cn(SOURCE, 'min-h-32')}>{value}</pre>
        </div>
      )}
    </figure>
  )
}
