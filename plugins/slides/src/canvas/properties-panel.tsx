import { useState, type ReactElement } from 'react'
import { SLIDE_LAYOUTS, type SlideLayout } from '../deck/directive-keys/layout.js'
import type { SectionElement } from '../present/sections.js'
import { useCanvas } from './context.js'
import { setSlideLayout } from './edits.js'
import { useSlotWriter } from './use-slot-writer.js'

function BlockSource({ block }: { readonly block: number }): ReactElement {
  const canvas = useCanvas()
  const span = canvas.source.outline().slides[canvas.index]!.blocks[block]!.span
  const [text, setText] = useState(() => canvas.source.value().slice(span.start, span.end))
  const write = useSlotWriter(canvas.index, 'body', undefined, block)
  return <textarea aria-label={canvas.labels.blockSource} spellCheck={false} value={text} onChange={(event) => {
    setText(event.target.value)
    canvas.stopEditing()
    write(event.target.value)
    if (event.target.value.trim() === '') canvas.selectBlock(undefined)
  }} />
}

/** Every control maps to an existing Markdown construct; no parallel layout state. */
export function PropertiesPanel({ section }: { readonly section: SectionElement | undefined }): ReactElement {
  const canvas = useCanvas()
  const { labels, source, index, selectedBlock, editing } = canvas
  const block = selectedBlock === undefined ? undefined : source.outline().slides[index]?.blocks[selectedBlock]
  return (
    <aside data-rmk-canvas-properties="" aria-label={labels.properties}>
      <header>
        <strong>{block === undefined ? labels.slide : labels.blockKind(block.kind)}</strong>
        <button type="button" aria-label={labels.closeProperties} onClick={() => canvas.setPropertiesOpen(false)}>×</button>
      </header>
      {block !== undefined && selectedBlock !== undefined ? (
        <>
          <div data-rmk-canvas-property-section="">
            <span data-rmk-canvas-property-caption="">{labels.sourceLine(block.line)}</span>
            <button type="button" data-rmk-canvas-property-action="" onClick={() => canvas.edit({ block: selectedBlock })}>{labels.editBlock}</button>
            {canvas.revealSource === undefined ? null : <button type="button" data-rmk-canvas-property-action="" onClick={canvas.revealSource}>{labels.revealSource}</button>}
          </div>
          <div data-rmk-canvas-property-section="">
            <label>{labels.blockSource}</label>
            {editing === undefined ? <BlockSource key={`${index}:${selectedBlock}:${canvas.revision}`} block={selectedBlock} /> : <p>{labels.sourceEditingHint}</p>}
            <p>{labels.sourceHint}</p>
          </div>
        </>
      ) : (
        <div data-rmk-canvas-property-section="">
          <label>{labels.layout}</label>
          <select aria-label={labels.layout} value={String(section?.props['data-rmk-slide-layout'] ?? 'default')} disabled={section === undefined} onChange={(event) => {
            canvas.stopEditing()
            source.emit(setSlideLayout(source.value(), source.outline(), index, event.target.value as SlideLayout))
          }}>
            {SLIDE_LAYOUTS.map((layout) => <option key={layout} value={layout}>{labels.layoutName(layout)}</option>)}
          </select>
          <p>{labels.selectHint}</p>
        </div>
      )}
      {block === undefined ? null : <button type="button" data-rmk-canvas-property-action="" aria-label={labels.slideProperties} onClick={() => canvas.selectBlock(undefined)}>{labels.slideProperties}</button>}
    </aside>
  )
}
