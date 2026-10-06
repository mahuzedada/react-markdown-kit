import { useState, type ReactElement } from 'react'
import { MarkdownTablePicker } from '@react-markdown-kit/editor'
import { useCanvas } from './context.js'
import { textIcon, imageIcon } from './icons.js'
import { Popover } from './popover.js'
import { ViewBar } from './view-bar.js'

/** Small insertion and view islands reserve the stage for the document. */
export function WorkspaceBar({ deck }: { readonly deck: Readonly<Record<string, unknown>> }): ReactElement {
  const canvas = useCanvas()
  const { labels, editable, source, index } = canvas
  const [image, setImage] = useState('')
  const insert = (text: string, edit = false): void => {
    const slide = source.outline().slides[index]
    if (slide === undefined) { canvas.addSlide(); return }
    const selected = canvas.selectedBlock === undefined ? undefined : slide.blocks[canvas.selectedBlock]
    const at = selected?.span.end ?? slide.body.span?.end ?? slide.body.insertAt
    canvas.selectBlock(undefined)
    const value = source.value()
    source.emit(value.slice(0, at) + `\n\n${text}\n\n` + value.slice(at))
    if (edit) canvas.edit({ block: selected === undefined ? slide.blocks.length : canvas.selectedBlock! + 1 })
  }
  return (
    <div data-rmk-canvas-floating-bars="" aria-label={String(deck['data-rmk-deck-title'] ?? labels.untitled)}>
      {editable ? <div role="toolbar" aria-label={labels.insert} data-rmk-canvas-island="start">
        <button type="button" aria-label={labels.text} title={labels.text} onClick={() => insert(labels.newText, true)}>{textIcon}</button>
        <Popover label={labels.image} button={imageIcon} placement="below-start">
          {(close) => <form data-rmk-canvas-form="" onSubmit={(event) => {
            event.preventDefault()
            if (!image.trim()) return
            insert(`![](<${encodeURI(image.trim()).replace(/>/g, '%3E')}>)`)
            setImage('')
            close()
          }}><label>{labels.imageUrl}<input type="url" required value={image} onChange={(event) => setImage(event.target.value)} placeholder="https://" /></label><button type="submit">{labels.insert}</button></form>}
        </Popover>
        <MarkdownTablePicker disabled={canvas.count === 0} onInsert={(rows, columns) => canvas.edit({ command: (commands) => commands.insertTable(rows, columns) })} />
        <span data-rmk-canvas-tool-group="history">
          <button type="button" aria-label={labels.undo} title={labels.undo} disabled={!canvas.canUndo} onClick={canvas.undo}>↶</button>
          <button type="button" aria-label={labels.redo} title={labels.redo} disabled={!canvas.canRedo} onClick={canvas.redo}>↷</button>
        </span>
      </div> : <span />}
      <ViewBar actions={canvas.actions} {...(canvas.onPresent === undefined ? {} : { onPresent: canvas.onPresent })} />
    </div>
  )
}
