/**
 * Inline textarea laid over a label of the sequence picture, following the
 * flowchart's `text-edit-overlay`: same font metrics as the SVG text so
 * nothing jumps, native key listeners so Lexical never sees a keystroke,
 * Enter commits, Escape cancels, blur commits. The value is reported live
 * on every change so the picture follows the typing and the commits merge
 * into one history entry; `onFinish` says how the edit ended.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react'
import { LINE_HEIGHT } from '../../core/drawing-data.js'
import type { Rect } from '../../core/geometry.js'

export interface LabelOverlayProps {
  /** Where the field sits, in picture coordinates. */
  readonly rect: Rect
  readonly value: string
  readonly fontSize: number
  readonly align: 'start' | 'center'
  readonly placeholder: string
  readonly onChange: (value: string) => void
  /** The edit ended: `cancelled` when Escape restored the original value. */
  readonly onFinish: (cancelled: boolean) => void
}

export function LabelOverlay({ rect, value: original, fontSize, align, placeholder, onChange, onFinish }: LabelOverlayProps): ReactElement {
  const [value, setValue] = useState(original)
  const ref = useRef<HTMLTextAreaElement>(null)
  const originalRef = useRef(original)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
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
        onChangeRef.current(originalRef.current)
        onFinishRef.current(true)
      }
    }
    const stop = (e: Event): void => e.stopPropagation()
    el.addEventListener('keydown', onKeyDown)
    el.addEventListener('keyup', stop)
    el.addEventListener('keypress', stop)
    el.addEventListener('beforeinput', stop)
    el.addEventListener('paste', stop)
    return () => {
      el.removeEventListener('keydown', onKeyDown)
      el.removeEventListener('keyup', stop)
      el.removeEventListener('keypress', stop)
      el.removeEventListener('beforeinput', stop)
      el.removeEventListener('paste', stop)
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
