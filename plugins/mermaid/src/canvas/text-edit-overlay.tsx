/**
 * Ported from @zuilib/text-editor (MIT). Inline textarea laid over a shape's
 * text slot, with the same font metrics as the SVG text so nothing jumps on
 * commit. Native listeners keep the field's keystrokes, clipboard and
 * composition events from Lexical's root, which owns the same events for
 * the document (a `cut` there removes the document selection).
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react'
import { connectorMidpoint } from '../core/connectors.js'
import { textBoxSize, wrapText } from '../core/geometry.js'
import type { TextField } from '../core/shapes/definitions.js'
import {
  FONT_SIZE,
  isConnectorType,
  LINE_HEIGHT,
  SMALL_FONT_SIZE,
  type DrawingShape,
  type Point,
} from '../core/drawing-data.js'
import { useDiagramLabels } from './labels.js'
import { CONNECTOR_FONT_SIZE, CONNECTOR_LABEL_MAX_WIDTH, slotLayout, textColorFor } from './shape-view.js'

/**
 * Events of an inline field that must never reach Lexical's root listeners,
 * the list the source textarea stops. `keydown` is handled by each field,
 * and `input` bubbles on: React's delegated `onChange` is that event, and
 * Lexical's own `input` handler returns for a decorator's field.
 */
export const STOPPED_FIELD_EVENTS = [
  'keyup',
  'keypress',
  'beforeinput',
  'paste',
  'cut',
  'copy',
  'drop',
  'compositionstart',
  'compositionupdate',
  'compositionend',
] as const

export function TextEditOverlay({
  shape,
  field,
  points,
  onCommit,
}: {
  shape: DrawingShape
  field: TextField
  points?: readonly Point[] | undefined
  onCommit: (id: string, field: TextField, text: string) => void
}): ReactElement {
  const original = shape[field] ?? ''
  const [value, setValue] = useState(original)
  const ref = useRef<HTMLTextAreaElement>(null)

  const valueRef = useRef(value)
  valueRef.current = value

  // Mount-only: the overlay is keyed by shape and field, so a new slot is a
  // new instance and the closure over `shape`, `field` and `original` holds.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.select()
    // Native listener so the keystrokes never reach Lexical's root handlers
    // (which would otherwise hijack Home/End/arrows and Enter)
    const onKeyDown = (e: KeyboardEvent): void => {
      e.stopPropagation()
      if ((e.key === 'Home' || e.key === 'End') && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        const text = el.value
        const caret = e.key === 'Home' ? el.selectionStart : el.selectionEnd
        const pos =
          e.key === 'Home'
            ? text.lastIndexOf('\n', caret - 1) + 1
            : (text.indexOf('\n', caret) + 1 || text.length + 1) - 1
        el.setSelectionRange(pos, pos)
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        onCommit(shape.id, field, valueRef.current)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onCommit(shape.id, field, original)
      }
    }
    const stop = (e: Event): void => e.stopPropagation()
    el.addEventListener('keydown', onKeyDown)
    for (const name of STOPPED_FIELD_EVENTS) el.addEventListener(name, stop)
    return () => {
      el.removeEventListener('keydown', onKeyDown)
      for (const name of STOPPED_FIELD_EVENTS) el.removeEventListener(name, stop)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const style: CSSProperties = {
    color: textColorFor(shape),
    fontFamily: 'var(--rmk-diagram-font)',
    lineHeight: LINE_HEIGHT,
  }

  if (shape.type === 'text') {
    const size = textBoxSize(value || ' ')
    Object.assign(style, {
      left: shape.x,
      top: shape.y,
      fontSize: FONT_SIZE,
      width: Math.max(80, size.w + 20),
      height: size.h + 2,
      // `pre` would keep the lines, but Chrome ignores Home/End in a
      // `white-space: pre` textarea; the width tracks the content anyway
      whiteSpace: 'pre-wrap' as const,
    })
  } else if (isConnectorType(shape.type)) {
    const lines = wrapText(value, CONNECTOR_LABEL_MAX_WIDTH, CONNECTOR_FONT_SIZE)
    const size = textBoxSize(lines.join('\n') || ' ', CONNECTOR_FONT_SIZE)
    const width = Math.max(70, size.w + 16)
    const height = size.h + 4
    const mid = connectorMidpoint(
      points ?? [
        { x: shape.x, y: shape.y },
        { x: shape.x + shape.width, y: shape.y + shape.height },
      ],
    )
    Object.assign(style, {
      left: mid.x - width / 2,
      top: mid.y - height / 2,
      width,
      height,
      fontSize: CONNECTOR_FONT_SIZE,
      textAlign: 'center' as const,
      whiteSpace: 'pre-wrap' as const,
    })
  } else {
    const { area } = slotLayout(shape)
    const fontSize = field === 'text' ? FONT_SIZE : SMALL_FONT_SIZE
    const width = Math.max(area.w, 40)
    const lines = wrapText(value, width, fontSize).length
    const boxH = lines * fontSize * LINE_HEIGHT + 2
    const top =
      field === 'label'
        ? area.y - 1
        : field === 'footer'
          ? area.y + area.h - boxH + 1
          : area.y + area.h / 2 - boxH / 2
    Object.assign(style, {
      left: area.x,
      top,
      width,
      height: boxH,
      fontSize,
      ...(field === 'label' ? { fontWeight: 600, letterSpacing: 0.3 } : {}),
      opacity: field === 'text' ? 1 : field === 'label' ? 0.85 : 0.65,
      textAlign: 'center' as const,
      whiteSpace: 'pre-wrap' as const,
    })
  }

  const text = useDiagramLabels()
  const placeholder =
    field === 'label' ? text.labelPlaceholder : field === 'footer' ? text.footerPlaceholder : text.textPlaceholder

  return (
    <textarea
      ref={ref}
      className="rmk-diagram-text-input"
      style={style}
      value={value}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onCommit(shape.id, field, value)}
      onPointerDown={(e) => e.stopPropagation()}
    />
  )
}
