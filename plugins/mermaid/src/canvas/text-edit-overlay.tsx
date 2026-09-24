/**
 * Ported from @zuilib/text-editor (MIT). Inline textarea laid over a shape's
 * text slot, with the same font metrics as the SVG text so nothing jumps on
 * commit. Native listeners keep the field's keystrokes, clipboard and
 * composition events from Lexical's root, which owns the same events for
 * the document (a `cut` there removes the document selection).
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react'
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
import { useDiagramLabels } from './host.js'
import { linesSize, useTextMeasure } from './text-measure.js'
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
  onChange,
  onCommit,
}: {
  shape: DrawingShape
  field: TextField
  points?: readonly Point[] | undefined
  /** The value as typed, before it commits */
  onChange?: ((text: string) => void) | undefined
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
    el.focus({ preventScroll: true })
    el.select()
    // Native listener so the keystrokes never reach Lexical's root handlers
    // (which would otherwise hijack Home/End/arrows and Enter)
    // Excalidraw's keys: Enter is a new line; Escape, Cmd/Ctrl+Enter and a
    // click away (blur) all keep the text
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
      if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault()
        onCommit(shape.id, field, valueRef.current)
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

  const text = useDiagramLabels()
  const placeholder =
    field === 'label' ? text.labelPlaceholder : field === 'footer' ? text.footerPlaceholder : text.textPlaceholder

  // The field grows with its text like Excalidraw's: free text and
  // connector labels widen to their longest line, every field is as tall
  // as its lines, measured from the rendered font rather than estimated
  const [fit, setFit] = useState<{ w: number; h: number } | null>(null)
  const measure = useTextMeasure()
  const isFreeText = shape.type === 'text'
  const isConnector = isConnectorType(shape.type)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let w = el.offsetWidth
    if (isFreeText || isConnector) {
      const fontSize = isConnector ? CONNECTOR_FONT_SIZE : FONT_SIZE
      const widest = linesSize((value || placeholder).split('\n'), fontSize, measure).w
      w = Math.ceil(isConnector ? Math.min(widest, CONNECTOR_LABEL_MAX_WIDTH) : widest) + CARET_ROOM
      el.style.width = `${w}px`
    }
    const height = el.style.height
    el.style.height = '0px'
    const h = el.scrollHeight
    el.style.height = height
    setFit((prev) => (prev?.w === w && prev.h === h ? prev : { w, h }))
  }, [value, placeholder, isFreeText, isConnector, measure])

  const style: CSSProperties = {
    color: textColorFor(shape),
    fontFamily: 'var(--rmk-diagram-font)',
    lineHeight: LINE_HEIGHT,
    // `pre` would keep the lines, but Chrome ignores Home/End in a
    // `white-space: pre` textarea; the width tracks the content anyway
    whiteSpace: 'pre-wrap',
  }

  if (isFreeText) {
    const size = textBoxSize(value || placeholder)
    Object.assign(style, {
      left: shape.x,
      top: shape.y,
      fontSize: FONT_SIZE,
      width: fit?.w ?? size.w + CARET_ROOM,
      height: fit?.h ?? size.h,
    })
  } else if (isConnector) {
    const lines = wrapText(value || placeholder, CONNECTOR_LABEL_MAX_WIDTH, CONNECTOR_FONT_SIZE)
    const size = textBoxSize(lines.join('\n'), CONNECTOR_FONT_SIZE)
    const width = fit?.w ?? size.w + CARET_ROOM
    const height = fit?.h ?? size.h
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
    })
  } else {
    const { area } = slotLayout(shape)
    const fontSize = field === 'text' ? FONT_SIZE : SMALL_FONT_SIZE
    const width = Math.max(area.w, 40)
    const boxH = fit?.h ?? wrapText(value, width, fontSize).length * fontSize * LINE_HEIGHT
    const top =
      field === 'label'
        ? area.y
        : field === 'footer'
          ? area.y + area.h - boxH
          : area.y + area.h / 2 - boxH / 2
    Object.assign(style, {
      left: area.x + area.w / 2 - width / 2,
      top,
      width,
      height: boxH,
      fontSize,
      ...(field === 'label' ? { fontWeight: 600, letterSpacing: 0.3 } : {}),
      opacity: field === 'text' ? 1 : field === 'label' ? 0.85 : 0.65,
      textAlign: 'center' as const,
    })
  }

  return (
    <textarea
      ref={ref}
      className={isConnector ? 'rmk-diagram-text-input is-connector' : 'rmk-diagram-text-input'}
      style={style}
      value={value}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(e) => {
        setValue(e.target.value)
        onChange?.(e.target.value)
      }}
      onBlur={() => onCommit(shape.id, field, value)}
      onPointerDown={(e) => e.stopPropagation()}
    />
  )
}

/** Room for the caret past the longest line, so typing never wraps early */
const CARET_ROOM = 6
