/**
 * Every slide as a thumbnail: a strip under the stage, or a grid in its
 * place. The thumbnails are the rendered sections at a small width (the
 * slide scales itself), inert so nothing on them takes focus. A listbox:
 * arrows move the selection, Alt with an arrow moves the slide, and a
 * thumbnail can be dragged to a new place.
 */
import { Fragment, useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type ReactElement } from 'react'
import { INERT, slideTitle, type SectionElement } from '../present/sections.js'
import { useCanvas, type CanvasView } from './context.js'

export interface SlideListProps {
  readonly deck: Readonly<Record<string, unknown>>
  readonly sections: readonly SectionElement[]
  readonly layout: CanvasView
}

/** Spread, as `present-section.ts` passes it: React 18 types have no `inert`. */
const THUMB_INERT = { inert: INERT } as Record<string, unknown>

const NEXT_KEYS: Readonly<Record<string, number>> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

export function SlideList({ deck, sections, layout }: SlideListProps): ReactElement {
  const canvas = useCanvas()
  const { labels, index, editable } = canvas
  const list = useRef<HTMLDivElement>(null)
  const [dragged, setDragged] = useState<number | undefined>(undefined)
  const [target, setTarget] = useState<number | undefined>(undefined)

  useEffect(() => {
    const container = list.current
    const selected = container?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (container == null || selected == null) return
    // Scroll only the slide list; scrollIntoView also jumps the host page.
    const bounds = container.getBoundingClientRect()
    const item = selected.getBoundingClientRect()
    if (layout === 'strip') {
      if (item.left < bounds.left) container.scrollLeft -= bounds.left - item.left + 8
      else if (item.right > bounds.right) container.scrollLeft += item.right - bounds.right + 8
    } else {
      if (item.top < bounds.top) container.scrollTop -= bounds.top - item.top + 8
      else if (item.bottom > bounds.bottom) container.scrollTop += item.bottom - bounds.bottom + 8
    }
  }, [index, layout])

  const choose = (next: number): void => {
    canvas.select(next)
    if (layout === 'grid') canvas.setView('strip')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = NEXT_KEYS[event.key]
    const last = sections.length - 1
    let next: number | undefined
    if (step !== undefined) next = Math.min(Math.max(index + step, 0), last)
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    else if ((event.key === 'Enter' || event.key === ' ') && layout === 'grid') {
      event.preventDefault()
      return choose(index)
    }
    if (next === undefined) return
    event.preventDefault()
    event.stopPropagation()
    if (event.altKey && editable) canvas.moveSlide(index, next)
    else canvas.select(next)
    setTimeout(() => list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus(), 0)
  }

  const drop = (event: DragEvent<HTMLDivElement>, at: number): void => {
    event.preventDefault()
    if (dragged !== undefined && dragged !== at) {
      canvas.moveSlide(dragged, at)
    }
    setDragged(undefined)
    setTarget(undefined)
  }

  return (
    <div ref={list} role="listbox" aria-label={labels.slides} aria-orientation={layout === 'strip' ? 'horizontal' : undefined} data-rmk-canvas-slides={layout} onKeyDown={onKeyDown}>
      {sections.map((section, position) => (
        <Fragment key={position}>
        {layout === 'grid' && section.props['data-rmk-slide-layout'] === 'section' ? <div role="presentation" data-rmk-canvas-group-title="">{slideTitle(section) ?? labels.thumbnail(position + 1, undefined)}</div> : null}
        <div
          key={position}
          role="option"
          aria-selected={position === index}
          aria-label={labels.thumbnail(position + 1, slideTitle(section))}
          tabIndex={position === index ? 0 : -1}
          data-rmk-canvas-thumb=""
          data-rmk-canvas-drop={target === position && dragged !== position ? (dragged !== undefined && dragged < position ? 'after' : 'before') : undefined}
          draggable={editable}
          onClick={() => choose(position)}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', String(position + 1))
            setDragged(position)
          }}
          onDragOver={(event) => {
            if (dragged === undefined) return
            event.preventDefault()
            setTarget(position)
          }}
          onDrop={(event) => drop(event, position)}
          onDragEnd={() => {
            setDragged(undefined)
            setTarget(undefined)
          }}
        >
          <div className="rmk-document" data-rmk-canvas-thumb-slide="" {...THUMB_INERT}>
            <article {...deck} data-rmk-deck-mode="canvas">
              {section}
            </article>
          </div>
          <span data-rmk-canvas-thumb-number="" aria-hidden="true">
            {String(position + 1).padStart(2, '0')}
          </span>
          <span data-rmk-canvas-thumb-title="" aria-hidden="true">{slideTitle(section) ?? labels.thumbnail(position + 1, undefined)}</span>
        </div>
        </Fragment>
      ))}
    </div>
  )
}
