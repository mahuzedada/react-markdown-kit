/**
 * The current slide's speaker notes, as plain Markdown. Typing into an
 * empty field on a slide without notes adds the `???` marker for it.
 */
import { useState, type ReactElement } from 'react'
import { useCanvas } from './context.js'
import { readSlot } from './edits.js'
import { useSlotWriter } from './use-slot-writer.js'

function NotesField({ index }: { readonly index: number }): ReactElement {
  const { source, labels, editable } = useCanvas()
  const write = useSlotWriter(index, 'notes')
  const [text, setText] = useState(() => {
    const slide = source.outline().slides[index]
    return slide === undefined ? '' : readSlot(source.value(), slide.notes)
  })
  return (
    <textarea
      aria-label={labels.notes}
      placeholder={labels.notesPlaceholder}
      value={text}
      readOnly={!editable}
      spellCheck
      onChange={(event) => {
        setText(event.target.value)
        write(event.target.value)
      }}
    />
  )
}

export function NotesPanel(): ReactElement {
  const { index, revision } = useCanvas()
  return (
    <div data-rmk-canvas-notes="">
      <NotesField key={`${index}:${revision}`} index={index} />
    </div>
  )
}
