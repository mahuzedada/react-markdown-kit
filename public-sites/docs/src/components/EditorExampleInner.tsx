import { useState, type ReactNode } from 'react'
import {
  MarkdownEditor,
  type EditorClassNames,
  type MarkdownEditorMode,
  type MarkdownExtension,
} from '@react-markdown-kit/editor'
import { defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'
import styles from './Example.module.css'

import '@react-markdown-kit/editor/styles.css'
import '@react-markdown-kit/renderer/styles.css'

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
    <figure className={styles.example}>
      {title !== undefined && <figcaption className={styles.caption}>{title}</figcaption>}
      <div className={styles.editorShell} style={{ minHeight: height }}>
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
        <div className={styles.pane}>
          <div className={styles.paneLabel}>
            Saved Markdown{' '}
            <span className={untouched ? styles.badgeOk : styles.badgeEdit}>
              {untouched ? 'unchanged' : 'edited'}
            </span>
          </div>
          <pre className={styles.source}>{value}</pre>
        </div>
      )}
    </figure>
  )
}
