/**
 * The stage: the current slide, fitted to the space (or at a fixed zoom),
 * on the canvas backdrop. Click selects a Markdown block; double-click opens
 * its inline editor. A click on the backdrop closes it.
 * Scaling is the slide's own: its type is in `cqw`, so the frame only sets
 * a width.
 */
import { cloneElement, isValidElement, useEffect, useRef, useState, type ReactNode, type CSSProperties, type DragEvent, type MouseEvent, type PointerEvent, type ReactElement, type RefObject } from 'react'
import { slideTitle, type SectionElement } from '../present/sections.js'
import { useCanvas } from './context.js'
import { plusIcon } from './icons.js'
import { BlockActions } from './block-actions.js'
import { BlockSection } from './block-section.js'
import { SlideEditor } from './slide-editor.js'

/** The width the slide's type is designed for: 1.72cqw is 22px here. */
export const DESIGN_WIDTH = 1280

export interface StageProps {
  readonly deck: Readonly<Record<string, unknown>>
  readonly sections: readonly SectionElement[]
}

function useMeasuredScale(frame: RefObject<HTMLElement | null>, report: (scale: number) => void): void {
  useEffect(() => {
    const element = frame.current
    if (element === null || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => report(element.offsetWidth / DESIGN_WIDTH))
    observer.observe(element)
    return () => observer.disconnect()
  }, [frame, report])
}

export function Stage({ deck, sections }: StageProps): ReactElement {
  const canvas = useCanvas()
  const { labels, editable, editing, zoom, index } = canvas
  const frame = useRef<HTMLDivElement>(null)
  const dragged = useRef<number | undefined>(undefined)
  const [dropTarget, setDropTarget] = useState<number | undefined>(undefined)
  useMeasuredScale(frame, canvas.setScale)
  const section = sections[Math.min(index, sections.length - 1)]

  if (section === undefined) {
    return (
      <div data-rmk-canvas-stage="">
        <div data-rmk-canvas-empty="">
          <p>{labels.empty}</p>
          {editable ? (
            <button type="button" onClick={canvas.addSlide}>
              {plusIcon}
              {labels.addSlide}
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  const blocks = canvas.source.outline().slides[index]?.blocks ?? []
  const decorate = (node: ReactNode): ReactNode => {
    if (Array.isArray(node)) return node.map(decorate)
    if (!isValidElement<Record<string, unknown>>(node)) return node
    const start = node.props['data-rmk-canvas-block']
    const block = start === undefined ? -1 : blocks.findIndex((item) => item.span.start === Number(start))
    return cloneElement(node, block < 0 || !editable ? {} : {
      tabIndex: 0,
      draggable: canvas.selectedBlock === block,
      onDragStart: (event: DragEvent<HTMLElement>) => {
        dragged.current = block
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', String(block))
      },
      onDragEnd: () => { dragged.current = undefined; setDropTarget(undefined) },
      'data-rmk-canvas-block-drop': dropTarget === block ? '' : undefined,
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (dragged.current === undefined || dragged.current === block) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setDropTarget(block)
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        if (dragged.current === undefined) return
        event.preventDefault()
        canvas.moveBlock(dragged.current, block)
        dragged.current = undefined
        setDropTarget(undefined)
      },
      'data-rmk-canvas-selected': canvas.selectedBlock === block ? '' : undefined,
      onFocus: () => { if (canvas.selectedBlock !== block) canvas.selectBlock(block) },
    }, node.props.children === undefined ? undefined : decorate(node.props.children as ReactNode))
  }
  const style = {
    '--rmk-canvas-aspect': deck['data-rmk-deck-aspect'] === '4:3' ? 4 / 3 : 16 / 9,
    ...(zoom === 'fit' ? {} : { '--rmk-canvas-zoom': zoom }),
  } as CSSProperties

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (editing === undefined) return
    if (!(event.target as Element).closest('[data-rmk-canvas-editor], [data-rmk-canvas-block-editor], [data-rmk-canvas-context-tools]')) canvas.stopEditing()
  }
  const onClick = (event: MouseEvent<HTMLDivElement>): void => {
    const target = event.target as Element
    if (target.closest('[data-rmk-canvas-editor], [data-rmk-canvas-block-editor], [data-rmk-canvas-context-tools]') || !editable) return
    event.preventDefault()
    const element = target.closest('[data-rmk-canvas-block]')
    const block = element === null ? -1 : blocks.findIndex((item) => item.span.start === Number(element.getAttribute('data-rmk-canvas-block')))
    canvas.selectBlock(block < 0 ? undefined : block)
  }
  const onDoubleClick = (event: MouseEvent<HTMLDivElement>): void => {
    const target = event.target as Element
    if (target.closest('[data-rmk-canvas-editor], [data-rmk-canvas-block-editor], [data-rmk-canvas-context-tools]') || !frame.current?.contains(target) || !editable) return
    event.preventDefault()
    const element = target.closest('[data-rmk-canvas-block]')
    const block = element === null ? -1 : blocks.findIndex((item) => item.span.start === Number(element.getAttribute('data-rmk-canvas-block')))
    if (block >= 0) canvas.edit({ block, point: { x: event.clientX, y: event.clientY } })
    else {
      const column = target.closest('[data-rmk-slide-column]')?.getAttribute('data-rmk-slide-column')
      canvas.edit({ ...(column == null ? {} : { column: column === '2' ? 1 : 0 }) })
    }
  }

  return (
    <>
    <BlockActions onDragStart={(event) => {
      dragged.current = canvas.selectedBlock
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', String(canvas.selectedBlock))
    }} onDragEnd={() => { dragged.current = undefined; setDropTarget(undefined) }} />
    <div data-rmk-canvas-stage="" onPointerDown={onPointerDown} onClick={onClick} onDoubleClick={onDoubleClick}>
      <div
        ref={frame}
        tabIndex={editing === undefined ? 0 : -1}
        aria-label={editable ? `${labels.thumbnail(index + 1, slideTitle(section))}. ${labels.editHint}` : labels.thumbnail(index + 1, slideTitle(section))}
        className="rmk-document"
        data-rmk-canvas-frame={zoom === 'fit' ? 'fit' : 'zoom'}
        data-rmk-canvas-edit={editing === undefined || editing.block !== undefined ? undefined : canvas.source.outline().slides[index]?.columns === undefined ? 'body' : String(editing.column ?? 0)}
        style={style}
        title={editable && editing === undefined ? labels.editHint : undefined}
      >
        <article {...deck} data-rmk-deck-mode="canvas">
          {editing?.block !== undefined
            ? <BlockSection key={`${index}:${canvas.revision}:${editing.block}`} section={section} block={editing.block} start={blocks[editing.block]?.span.start ?? -1} />
            : decorate(section)}
        </article>
        {editing === undefined || editing.block !== undefined ? null : <SlideEditor key={`${index}:${canvas.revision}:${editing.column ?? 0}`} index={index} section={section} deck={deck} request={editing} />}
      </div>
      <div data-rmk-canvas-stage-caption="" aria-hidden="true">{editing === undefined ? (editable && canvas.selectedBlock !== undefined ? labels.blockHint : slideTitle(section)) : ''}</div>
    </div>
    </>
  )
}
