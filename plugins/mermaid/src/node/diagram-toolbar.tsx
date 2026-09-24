/**
 * `<DiagramToolbar>`: the editor's door to the tool row slot
 * (docs/MERMAID_PLATFORM.md section 9.6). The slot is keyed on the
 * `LexicalEditor`, the scope every block of that editor gives its canvas.
 */
import type { ReactElement, ReactNode } from 'react'
import type { LexicalEditor } from 'lexical'
import { useOptionalMarkdownEditorContext, type MarkdownEditorInstance } from '@react-markdown-kit/editor'
import { ToolbarSlotHost } from '../canvas/toolbar-slot.js'

export interface DiagramToolbarProps {
  /** The editor whose canvases render here. Taken from `<MarkdownEditorProvider>` when omitted. */
  readonly editor?: MarkdownEditorInstance | undefined
  readonly className?: string | undefined
  /** Shown while no canvas of the editor is on screen: the document has none, or every block is edited as text. */
  readonly placeholder?: ReactNode
}

/**
 * The slot the canvases' tool rows render into. Its root carries
 * `rmk-editor`, so the `--rmk-diagram-*` tokens a host maps on that class
 * reach the tools wherever the slot sits, and `rmk-diagram-toolbar-host`;
 * `data-rmk-diagram-toolbar` is `filled` while a canvas owns it and
 * `empty` otherwise.
 */
export function DiagramToolbar({ editor, className, placeholder }: DiagramToolbarProps): ReactElement {
  const context = useOptionalMarkdownEditorContext()
  const instance = editor ?? context
  if (instance === null) {
    throw new Error('<DiagramToolbar> needs an editor: render it inside <MarkdownEditorProvider>, or pass editor={useMarkdownEditor(...)}.')
  }
  // The plugin is the one package that touches Lexical, so the escape hatch is its door.
  const lexical = instance.getNativeEditor() as LexicalEditor
  return <ToolbarSlotHost scope={lexical} className={className} placeholder={placeholder} />
}
