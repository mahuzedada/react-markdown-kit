/**
 * The inline editor: the current slide's body as rich text, laid over the
 * rendered slide in a copy of its article and section, so the slide's
 * layout, class and type apply to what is being typed. The rendered body
 * underneath is hidden while this is open; its background, picture and
 * footer stay. Directives and speaker notes are not in the editor: it
 * writes the body's span only.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type ReactElement } from 'react'
import { MarkdownEditorContent, MarkdownEditorProvider, useMarkdownEditor } from '@react-markdown-kit/editor'
import type { SectionElement } from '../present/sections.js'
import { placeCaretAt, placeCaretAtEnd } from './caret.js'
import { useCanvas, type EditRequest } from './context.js'
import { readSlot } from './edits.js'
import { useSlotWriter } from './use-slot-writer.js'
import { useTextBoxEnter } from './use-text-box-enter.js'

export interface SlideEditorProps {
  readonly index: number
  readonly section: SectionElement
  readonly deck: Readonly<Record<string, unknown>>
  readonly request: EditRequest
}

/** How long to wait for the editor to draw the slide before placing the caret anyway. */
const MAX_FRAMES = 10
const FRAME_MS = 16

/** The section's `data-rmk-slide*` attributes: what the stylesheet reads. */
function slideAttributes(section: SectionElement): Record<string, unknown> {
  const attributes: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(section.props)) if (key.startsWith('data-rmk-slide')) attributes[key] = value
  return attributes
}

export function SlideEditor({ index, section, deck, request }: SlideEditorProps): ReactElement {
  const canvas = useCanvas()
  const column = canvas.source.outline().slides[index]?.columns === undefined ? undefined : request.column ?? 0
  const write = useSlotWriter(index, 'body', column)
  const [initial] = useState(() => {
    const slide = canvas.source.outline().slides[index]
    return slide === undefined ? '' : readSlot(canvas.source.value(), column === undefined ? slide.body : slide.columns![column])
  })
  const editor = useMarkdownEditor({
    defaultValue: initial,
    onChange: write,
    ...(canvas.preset === undefined ? {} : { preset: canvas.preset }),
    ...(canvas.extensions === undefined ? {} : { extensions: canvas.extensions }),
  })
  useTextBoxEnter(editor)
  const surface = useRef<HTMLDivElement>(null)
  const { setEditor, stopEditing, labels } = canvas

  useEffect(() => {
    setEditor(editor)
    return () => setEditor(undefined)
  }, [editor, setEditor])

  // Once the editor has drawn the slide's text: the caret where the click was (or at the end), then the tool that opened it.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let tries = 0
    const settle = (): void => {
      const editable = surface.current?.querySelector<HTMLElement>('[contenteditable="true"]')
      if ((editable == null || editable.childElementCount === 0) && tries < MAX_FRAMES) {
        tries += 1
        timer = setTimeout(settle, FRAME_MS)
        return
      }
      const placed = editable != null && request.point !== undefined && placeCaretAt(editable, editor.getNativeEditor(), request.point.x, request.point.y)
      if (!placed && editable != null) placeCaretAtEnd(editable, editor.getNativeEditor())
      else if (!placed) editor.focus()
      request.command?.(editor.commands)
    }
    // A timer rather than animation frames: a background window may never paint, and the caret must still land.
    timer = setTimeout(settle, 0)
    return () => clearTimeout(timer)
    // The request is read once, when the editor opens.
  }, [editor])

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    stopEditing()
    event.currentTarget.closest<HTMLElement>('[data-rmk-canvas-frame]')?.focus({ preventScroll: true })
  }

  return (
    <article {...deck} data-rmk-canvas-editing="" onKeyDown={onKeyDown}>
      <section {...slideAttributes(section)}>
        <div data-rmk-slide-body="" data-rmk-slide-columns={column === undefined ? undefined : '2'}>
          <MarkdownEditorProvider editor={editor}>
            <div data-rmk-canvas-editor="" ref={surface} style={column === undefined ? undefined : { gridColumn: column + 1, gridRow: 1 }}>
              <MarkdownEditorContent aria-label={labels.thumbnail(index + 1, section.props['data-rmk-slide-title'] as string | undefined)} />
            </div>
          </MarkdownEditorProvider>
        </div>
      </section>
    </article>
  )
}
