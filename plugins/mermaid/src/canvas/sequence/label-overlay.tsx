/**
 * Inline textarea laid over a label of the sequence picture, following the
 * flowchart's `text-edit-overlay`: same font metrics as the SVG text so
 * nothing jumps, native listeners so Lexical never sees a keystroke, a
 * clipboard or a composition event, Enter commits, Escape cancels, blur
 * commits. The value is reported live on every change so the picture
 * follows the typing and the commits merge into one history entry;
 * `onFinish` says how the edit ended, and a cancel is the canvas's to
 * undo, so the field itself never reports the original value back.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react'
import { LINE_HEIGHT } from '../../core/drawing-data.js'
import type { Rect } from '../../core/geometry.js'
import { STOPPED_FIELD_EVENTS } from '../text-edit-overlay.js'

export interface LabelOverlayProps {
  /** Where the field sits, in picture coordinates. */
  readonly rect: Rect
  readonly value: string
  readonly fontSize: number
  readonly align: 'start' | 'center'
  readonly placeholder: string
  readonly onChange: (value: string) => void
  /** The edit ended: `cancelled` when Escape asked for the changes to be taken back. */
  readonly onFinish: (cancelled: boolean) => void
}

export function LabelOverlay({ rect, value: original, fontSize, align, placeholder, onChange, onFinish }: LabelOverlayProps): ReactElement {
  const [value, setValue] = useState(original)
  const ref = useRef<HTMLTextAreaElement>(null)
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish

  // Mount-only: the overlay is keyed by its target, so a new target is a
  // new instance.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.select()
    const onKeyDown = (e: KeyboardEvent): void => {
      e.stopPropagation()
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        onFinishRef.current(false)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onFinishRef.current(true)
      }
    }
    const stop = (e: Event): void => e.stopPropagation()
    el.addEventListener('keydown', onKeyDown)
    for (const name of STOPPED_FIELD_EVENTS) el.addEventListener(name, stop)
    return () => {
      el.removeEventListener('keydown', onKeyDown)
      for (const name of STOPPED_FIELD_EVENTS) el.removeEventListener(name, stop)
    }
  }, [])

  const style: CSSProperties = {
    left: rect.x,
    top: rect.y,
    width: rect.w,
    height: rect.h,
    fontSize,
    lineHeight: LINE_HEIGHT,
    textAlign: align,
    whiteSpace: 'pre-wrap',
  }

  return (
    <textarea
      ref={ref}
      className="rmk-diagram-text-input rmk-sequence-text-input"
      style={style}
      value={value}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(e) => {
        setValue(e.target.value)
        onChange(e.target.value)
      }}
      onBlur={() => onFinish(false)}
      onPointerDown={(e) => e.stopPropagation()}
    />
  )
}
