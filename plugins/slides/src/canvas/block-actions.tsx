import type { DragEvent, ReactElement } from 'react'
import { useCanvas } from './context.js'
import { Tools } from './tools.js'

/** Contextual actions appear only while a block is selected or being edited. */
export function BlockActions({ onDragStart, onDragEnd }: {
  readonly onDragStart: (event: DragEvent<HTMLButtonElement>) => void
  readonly onDragEnd: () => void
}): ReactElement | null {
  const canvas = useCanvas()
  const { labels, selectedBlock, editing } = canvas
  const blocks = canvas.source.outline().slides[canvas.index]?.blocks ?? []
  const selected = selectedBlock === undefined ? undefined : blocks[selectedBlock]
  if (editing === undefined && selected === undefined) return null
  return <div data-rmk-canvas-selection-bar="" data-rmk-canvas-context-tools="">
    {editing !== undefined ? <>
      <Tools />
      <button type="button" data-rmk-canvas-done="" onClick={() => canvas.stopEditing()}>{labels.done}</button>
    </> : selected !== undefined && selectedBlock !== undefined ? <>
      <span data-rmk-canvas-selection-label="">{labels.blockKind(selected.kind)}</span>
      <div role="toolbar" aria-label={labels.blockActions} data-rmk-canvas-island="context">
        <button type="button" draggable aria-label={labels.dragBlock} title={labels.dragBlock} onDragStart={onDragStart} onDragEnd={onDragEnd}>⠿</button>
        <button type="button" aria-label={labels.editBlock} onClick={() => canvas.edit({ block: selectedBlock })}>{labels.editBlock}</button>
        <button type="button" aria-label={labels.moveEarlier} title={`${labels.moveEarlier} (Alt + ↑)`} disabled={selectedBlock === 0} onClick={() => canvas.moveBlock(selectedBlock, selectedBlock - 1)}>↑</button>
        <button type="button" aria-label={labels.moveLater} title={`${labels.moveLater} (Alt + ↓)`} disabled={selectedBlock === blocks.length - 1} onClick={() => canvas.moveBlock(selectedBlock, selectedBlock + 1)}>↓</button>
        {canvas.revealSource === undefined ? null : <button type="button" onClick={canvas.revealSource}>{labels.revealSource}</button>}
      </div>
    </> : <span data-rmk-canvas-selection-label="">{canvas.editable ? labels.editHint : labels.markdown}</span>}
  </div>
}
