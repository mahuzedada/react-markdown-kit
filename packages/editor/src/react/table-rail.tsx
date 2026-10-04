import { useEffect, useId, useRef, useState, type CSSProperties, type ReactElement } from 'react'

export interface TableLane { start: number; size: number }
export interface TableBox { top: number; left: number; width: number; height: number; rtl: boolean }
export type TableAxis = 'row' | 'column'
type Handle = { mode: 'insert' | 'delete'; index: number }

interface Props {
  axis: TableAxis
  box: TableBox
  lanes: readonly TableLane[]
  current: number
  onAction: (mode: Handle['mode'], index: number) => void
}

/** One moving control per edge: insert at a boundary, delete at a lane's center. */
export function TableRail({ axis, box, lanes, current, onAction }: Props): ReactElement | null {
  const rail = useRef<HTMLDivElement>(null)
  const hint = useId()
  const [pointer, setPointer] = useState<number | null>(null)
  const [pinned, setPinned] = useState(false)
  const [keyboard, setKeyboard] = useState<Handle | null>(null)
  const pinClick = useRef(false)
  const vertical = axis === 'row'
  const thickness = vertical ? 28 : 24
  const reversed = !vertical && box.rtl
  const canDelete = lanes.length > 1
  // Markdown requires the header to remain first; no insertion before it.
  const insertable = Array.from({ length: lanes.length + (vertical ? 0 : 1) }, (_, i) => i + (vertical ? 1 : 0))
  const boundary = (index: number): number => {
    const lane = lanes[index] ?? lanes[lanes.length - 1]
    if (!lane) return 0
    return lane.start + ((index === lanes.length) !== reversed ? lane.size : 0)
  }
  useEffect(() => {
    setPointer(null); setPinned(false); setKeyboard(null)
  }, [box.top, box.left, lanes.length])
  if (!lanes.length) return null

  const handle = ((): Handle => {
    if (keyboard && (keyboard.mode === 'insert' ? insertable.includes(keyboard.index) : canDelete && keyboard.index < lanes.length)) return keyboard
    if (pointer === null) return { mode: 'insert', index: lanes.length }
    let nearest = lanes.length, distance = Infinity
    for (const index of insertable) {
      const delta = Math.abs(boundary(index) - pointer)
      if (delta < distance) { nearest = index; distance = delta }
    }
    const under = lanes.findIndex(lane => pointer >= lane.start && pointer < lane.start + lane.size)
    const lane = lanes[under]
    return !canDelete || !lane || distance <= Math.min(10, lane.size * .3)
      ? { mode: 'insert', index: nearest }
      : { mode: 'delete', index: under }
  })()
  const position = (target: Handle): number => target.mode === 'insert'
    ? boundary(target.index)
    : lanes[target.index]!.start + lanes[target.index]!.size / 2
  const at = (value: number): CSSProperties => vertical ? { top: value } : { left: value }
  const across: CSSProperties = vertical
    ? { left: box.rtl ? -box.width : thickness, width: box.width }
    : { top: thickness, height: box.height }
  const targetLane = lanes[handle.index]
  const preview: CSSProperties = handle.mode === 'insert'
    ? { ...at(boundary(handle.index)), ...across }
    : { ...at(targetLane!.start), ...across, ...(vertical ? { height: targetLane!.size } : { width: targetLane!.size }) }
  const marker = lanes[current] ?? lanes[0]!
  const label = handle.mode === 'delete' ? `Delete ${axis} ${handle.index + 1}`
    : handle.index === lanes.length ? `Add ${axis}` : `Insert ${axis} before ${handle.index + 1}`
  const point = (event: { clientX: number; clientY: number }): number => {
    const rect = rail.current!.getBoundingClientRect()
    return vertical ? event.clientY - rect.top : event.clientX - rect.left
  }

  return <div ref={rail} className={`rmk-table-rail rmk-table-rail-${axis}`} role="group" aria-label={`${vertical ? 'Row' : 'Column'} controls`}
    data-preview={pointer !== null || keyboard !== null} data-mode={handle.mode} data-rtl={box.rtl}
    style={vertical
      ? { top: box.top, left: box.rtl ? box.left + box.width : box.left - thickness, width: thickness, height: box.height }
      : { top: box.top - thickness, left: box.left, width: box.width, height: thickness }}
    onPointerMove={event => {
      if (event.pointerType === 'touch') return
      setKeyboard(null); setPointer(point(event))
    }}
    onPointerDown={event => {
      pinClick.current = false
      if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return
      if ((event.target as Element).closest('button')) return
      setKeyboard(null); setPointer(point(event)); setPinned(true)
      // The gesture that exposes a touch preview cannot activate that preview.
      pinClick.current = true
    }}
    onClickCapture={event => {
      if (pinClick.current) { pinClick.current = false; event.preventDefault(); event.stopPropagation() }
    }}
    onPointerLeave={() => { if (!pinned) setPointer(null) }}>
    <span className="rmk-table-rail-marker" aria-hidden="true" style={vertical
      ? { top: marker.start + 4, height: Math.max(0, marker.size - 8) }
      : { left: marker.start + 4, width: Math.max(0, marker.size - 8) }}/>
    <button type="button" className="rmk-table-rail-handle" style={at(position(handle))} title={label} aria-label={label} aria-describedby={hint} aria-keyshortcuts={vertical ? 'Alt+F10' : undefined}
      onMouseDown={event => event.preventDefault()}
      onBlur={() => setKeyboard(null)}
      onKeyDown={event => {
        const forward = event.key === (vertical ? 'ArrowDown' : 'ArrowRight')
        const backward = event.key === (vertical ? 'ArrowUp' : 'ArrowLeft')
        if (!forward && !backward && event.key !== 'Home' && event.key !== 'End') return
        event.preventDefault()
        const stops: Handle[] = insertable.map(index => ({ mode: 'insert', index }))
        if (canDelete) lanes.forEach((_, index) => stops.push({ mode: 'delete', index }))
        stops.sort((a, b) => position(a) - position(b))
        const index = stops.findIndex(item => item.mode === handle.mode && item.index === handle.index)
        setKeyboard(stops[event.key === 'Home' ? 0 : event.key === 'End' ? stops.length - 1 : Math.max(0, Math.min(stops.length - 1, index + (forward ? 1 : -1)))]!)
      }}
      onClick={() => { onAction(handle.mode, handle.index); setPinned(false); setPointer(null); setKeyboard(null) }}>
      <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
        <path d={handle.mode === 'insert' ? 'M6 2.5v7M2.5 6h7' : 'M2.5 6h7'}/>
      </svg>
    </button>
    <span className="rmk-table-rail-preview" style={preview} aria-hidden="true"/>
    <span id={hint} className="rmk-table-sr-only">Use {vertical ? 'Up and Down' : 'Left and Right'} arrow keys to choose where to insert or delete. Press Enter to apply, or Escape to return to the table.</span>
  </div>
}
