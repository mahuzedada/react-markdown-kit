/**
 * Ported from @zuilib/text-editor (MIT). Contextual properties for the
 * selection (or the next shape): colour swatches with custom background and
 * text colours, stroke width and style, corners, arrowheads, connector
 * routing and direction, duplicate and delete. Every option is one Mermaid
 * can write (see core/mermaid.ts).
 */
import { useEffect, useRef, type CSSProperties, type ReactElement } from 'react'
import { COLOR_PRESETS, type ColorName } from '../core/skeleton.js'
import {
  isConnectorType,
  isNodeShapeType,
  STROKE_WIDTHS,
  type ArrowHead,
  type DrawingShape,
  type StrokeStyle,
} from '../core/drawing-data.js'
import { Icon, UI_ICONS } from './icons.js'
import { useDiagramLabels } from './host.js'

export const COLOR_NAMES = Object.keys(COLOR_PRESETS) as ColorName[]

/** An arrowhead choice: a head shape, a chevron (`arrow`), or none (the connector becomes a line) */
export type HeadChoice = ArrowHead | 'arrow' | 'none'

function Swatch({ name, active, onClick }: { name: ColorName; active: boolean; onClick: () => void }): ReactElement {
  const preset = COLOR_PRESETS[name]
  const label = useDiagramLabels().color(name)
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={active ? 'rmk-diagram-swatch is-active' : 'rmk-diagram-swatch'}
      // The palette is content (it lands in the payload), not chrome
      style={{ backgroundColor: preset.fill, borderColor: preset.stroke }}
      onClick={onClick}
    />
  )
}

/**
 * A native colour input dressed as a swatch. Dragging in the picker
 * updates live; `continued` is true for every update after the first of
 * one pick, so the host can fold them into one undo step.
 */
function ColorPick({
  label,
  value,
  kind,
  onPick,
}: {
  label: string
  value: string
  kind: 'fill' | 'text'
  onPick: (color: string, continued: boolean) => void
}): ReactElement {
  const ref = useRef<HTMLInputElement>(null)
  const picking = useRef(false)
  // The native `change` ends a pick (React's onChange fires on every input)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const end = (): void => {
      picking.current = false
    }
    el.addEventListener('change', end)
    return () => el.removeEventListener('change', end)
  }, [])
  return (
    <label
      title={label}
      className={`rmk-diagram-color-pick is-${kind}`}
      // The chosen colour is content, like the palette
      style={{ '--rmk-pick': value } as CSSProperties}
    >
      {kind === 'text' && <span aria-hidden="true">A</span>}
      <input
        ref={ref}
        type="color"
        aria-label={label}
        value={toHex(value)}
        onChange={(e) => {
          onPick(e.target.value, picking.current)
          picking.current = true
        }}
        onBlur={() => {
          picking.current = false
        }}
      />
    </label>
  )
}

/** `#rrggbb` for a colour input: hex colours as they are, anything else as a neutral start */
function toHex(color: string): string {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color)?.[1]
  if (hex === undefined) return color === 'transparent' ? '#ffffff' : '#1e1e1e'
  return hex.length === 3 ? `#${hex.replace(/./g, (c) => c + c)}`.toLowerCase() : `#${hex}`.toLowerCase()
}

function OptionButton({
  label,
  active,
  onClick,
  children,
  className,
}: {
  label: string
  active?: boolean
  onClick: () => void
  children: ReactElement
  className?: string
}): ReactElement {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={['rmk-diagram-tool', active ? 'is-active' : '', className ?? ''].filter(Boolean).join(' ')}
      onClick={onClick}
    >
      <Icon>{children}</Icon>
    </button>
  )
}

/** True when the list is non-empty and every item passes */
function all<T>(items: readonly T[], test: (item: T) => boolean): boolean {
  return items.length > 0 && items.every(test)
}

/**
 * Contextual properties for the current selection (or for the next shape
 * when nothing is selected): one color setting (stroke plus matching
 * fill), custom colours, stroke, corners, connector options, actions.
 */
export function PropertyBar({
  selection,
  stroke,
  fill,
  onColor,
  onCustomFill,
  onCustomText,
  onStrokeWidth,
  onStrokeStyle,
  onCorners,
  onHead,
  onRouting,
  onDirection,
  onDuplicate,
  onDelete,
}: {
  selection: readonly DrawingShape[]
  /** Stroke and fill of the selection (or of the next shape): picks the active swatch */
  stroke: string
  fill: string
  onColor: (name: ColorName) => void
  onCustomFill: (color: string, continued: boolean) => void
  onCustomText: (color: string, continued: boolean) => void
  onStrokeWidth: (width: number) => void
  onStrokeStyle: (style: StrokeStyle | undefined) => void
  onCorners: (sharp: boolean) => void
  onHead: (head: HeadChoice) => void
  onRouting: (elbow: boolean) => void
  onDirection: (bidirectional: boolean) => void
  onDuplicate: () => void
  onDelete: () => void
}): ReactElement {
  const boxes = selection.filter((s) => isNodeShapeType(s.type))
  const texts = selection.filter((s) => s.type === 'text')
  const connectors = selection.filter((s) => isConnectorType(s.type))
  const arrows = selection.filter((s) => s.type === 'arrow')
  const rects = selection.filter((s) => s.type === 'rect')
  const stroked = [...boxes, ...connectors]
  const coloured = [...boxes, ...texts]
  const first = coloured[0]
  const customText = first?.color
  const text = useDiagramLabels()

  const widths = [
    { width: STROKE_WIDTHS.thin, label: text.strokeThin, icon: UI_ICONS.strokeThin },
    { width: STROKE_WIDTHS.medium, label: text.strokeMedium, icon: UI_ICONS.strokeMedium },
    { width: STROKE_WIDTHS.bold, label: text.strokeBold, icon: UI_ICONS.strokeBold },
  ]
  const styles = [
    { style: undefined, label: text.strokeSolid, icon: UI_ICONS.solidLine },
    { style: 'dashed' as const, label: text.strokeDashed, icon: UI_ICONS.dashedLine },
    { style: 'dotted' as const, label: text.strokeDotted, icon: UI_ICONS.dotsLine },
  ]
  const heads: { head: HeadChoice; label: string; icon: ReactElement; is: (s: DrawingShape) => boolean }[] = [
    { head: 'arrow', label: text.arrowheadArrow, icon: UI_ICONS.headOpen, is: (s) => s.type === 'arrow' && s.head === undefined },
    { head: 'circle', label: text.arrowheadCircle, icon: UI_ICONS.headCircle, is: (s) => s.type === 'arrow' && s.head === 'circle' },
    { head: 'cross', label: text.arrowheadCross, icon: UI_ICONS.headCross, is: (s) => s.type === 'arrow' && s.head === 'cross' },
    { head: 'none', label: text.arrowheadNone, icon: UI_ICONS.headNone, is: (s) => s.type === 'line' },
  ]

  return (
    <div className="rmk-diagram-props" onPointerDown={(e) => e.stopPropagation()}>
      <div className="rmk-diagram-props-group" role="radiogroup" aria-label={text.colors}>
        {COLOR_NAMES.map((name) => (
          <Swatch
            key={name}
            name={name}
            active={COLOR_PRESETS[name].stroke === stroke && COLOR_PRESETS[name].fill === fill && customText === undefined}
            onClick={() => onColor(name)}
          />
        ))}
      </div>
      {first !== undefined && (
        <div className="rmk-diagram-props-group" aria-label={text.customColors}>
          {boxes.length > 0 && <ColorPick label={text.customFill} kind="fill" value={boxes[0]?.fill ?? fill} onPick={onCustomFill} />}
          <ColorPick label={text.customText} kind="text" value={customText ?? first.stroke} onPick={onCustomText} />
        </div>
      )}
      {stroked.length > 0 && (
        <div className="rmk-diagram-props-group is-three" aria-label={text.strokeWidth}>
          {widths.map(({ width, label, icon }) => (
            <OptionButton key={width} label={label} active={all(stroked, (s) => s.strokeWidth === width)} onClick={() => onStrokeWidth(width)}>
              {icon}
            </OptionButton>
          ))}
        </div>
      )}
      {stroked.length > 0 && (
        <div className="rmk-diagram-props-group is-three" aria-label={text.strokeStyle}>
          {styles.map(({ style, label, icon }) => (
            <OptionButton key={label} label={label} active={all(stroked, (s) => s.strokeStyle === style)} onClick={() => onStrokeStyle(style)}>
              {icon}
            </OptionButton>
          ))}
        </div>
      )}
      {rects.length > 0 && (
        <div className="rmk-diagram-props-group" aria-label={text.corners}>
          <OptionButton label={text.cornersSharp} active={all(rects, (s) => s.corners === 'sharp')} onClick={() => onCorners(true)}>
            {UI_ICONS.cornersSharp}
          </OptionButton>
          <OptionButton label={text.cornersRound} active={all(rects, (s) => s.corners !== 'sharp')} onClick={() => onCorners(false)}>
            {UI_ICONS.cornersRound}
          </OptionButton>
        </div>
      )}
      {connectors.length > 0 && (
        <div className="rmk-diagram-props-group" aria-label={text.arrowheads}>
          {heads.map(({ head, label, icon, is }) => (
            <OptionButton key={head} label={label} active={all(connectors, is)} onClick={() => onHead(head)}>
              {icon}
            </OptionButton>
          ))}
        </div>
      )}
      {connectors.length > 0 && (
        <div className="rmk-diagram-props-group" aria-label={text.connectorRouting}>
          <OptionButton label={text.straight} active={all(connectors, (s) => s.routing !== 'elbow')} onClick={() => onRouting(false)}>
            {UI_ICONS.straight}
          </OptionButton>
          <OptionButton label={text.elbow} active={all(connectors, (s) => s.routing === 'elbow')} onClick={() => onRouting(true)}>
            {UI_ICONS.elbow}
          </OptionButton>
        </div>
      )}
      {arrows.length > 0 && (
        <div className="rmk-diagram-props-group" aria-label={text.arrowDirection}>
          <OptionButton label={text.oneWay} active={all(arrows, (s) => !s.bidirectional)} onClick={() => onDirection(false)}>
            {UI_ICONS.oneWay}
          </OptionButton>
          <OptionButton label={text.twoWay} active={all(arrows, (s) => s.bidirectional === true)} onClick={() => onDirection(true)}>
            {UI_ICONS.twoWay}
          </OptionButton>
        </div>
      )}
      {selection.length > 0 && (
        <div className="rmk-diagram-props-group">
          <OptionButton label={text.duplicate} onClick={onDuplicate}>
            {UI_ICONS.duplicate}
          </OptionButton>
          <OptionButton
            label={selection.length > 1 ? text.deleteShapes(selection.length) : text.deleteShape}
            className="rmk-diagram-tool-danger"
            onClick={onDelete}
          >
            {UI_ICONS.trash}
          </OptionButton>
        </div>
      )}
    </div>
  )
}
