/** Edit a single source block in the rendered flow. Siblings keep their markup. */
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { MarkdownEditorContent, MarkdownEditorProvider, useMarkdownEditor } from '@react-markdown-kit/editor'
import { useCanvas } from './context.js'
import { placeCaretAt, placeCaretAtEnd } from './caret.js'
import { useSlotWriter } from './use-slot-writer.js'
import { useTextBoxEnter } from './use-text-box-enter.js'

export function BlockEditor({ block }: { readonly block: number }): ReactElement {
  const canvas = useCanvas()
  const write = useSlotWriter(canvas.index, 'body', undefined, block)
  const [initial] = useState(() => {
    const span = canvas.source.outline().slides[canvas.index]?.blocks[block]?.span
    return span === undefined ? '' : canvas.source.value().slice(span.start, span.end)
  })
  const editor = useMarkdownEditor({ defaultValue: initial, onChange: write,
    ...(canvas.preset === undefined ? {} : { preset: canvas.preset }),
    ...(canvas.extensions === undefined ? {} : { extensions: canvas.extensions }),
  })
  useTextBoxEnter(editor)
  const root = useRef<HTMLDivElement>(null)
  const { setEditor } = canvas
  useEffect(() => { setEditor(editor); return () => setEditor(undefined) }, [editor, setEditor])
  useEffect(() => {
    const timer = setTimeout(() => {
      const field = root.current?.querySelector<HTMLElement>('[contenteditable="true"]')
      if (field == null) return
      const point = canvas.editing?.point
      if (point === undefined || !placeCaretAt(field, editor.getNativeEditor(), point.x, point.y)) placeCaretAtEnd(field, editor.getNativeEditor())
      canvas.editing?.command?.(editor.commands)
    }, 0)
    return () => clearTimeout(timer)
  }, [editor])
  return (
    <div ref={root} data-rmk-canvas-block-editor="" onKeyDown={(event) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      canvas.stopEditing()
      event.currentTarget.closest<HTMLElement>('[data-rmk-canvas-frame]')?.focus({ preventScroll: true })
    }}>
      <MarkdownEditorProvider editor={editor}>
        <MarkdownEditorContent aria-label={canvas.labels.editBlock} />
      </MarkdownEditorProvider>
    </div>
  )
}
