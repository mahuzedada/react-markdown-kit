/**
 * Ported from @zuilib/text-editor (MIT). Contextual properties for the
 * selection (or the next shape): colour swatches, connector routing and
 * direction, delete.
 */
import type { ReactElement } from 'react'
import { COLOR_PRESETS, type ColorName } from '../core/skeleton.js'
import { isConnectorType, type DrawingShape } from '../core/drawing-data.js'
import { Icon, UI_ICONS } from './icons.js'
import { useDiagramLabels } from './labels.js'

export const COLOR_NAMES = Object.keys(COLOR_PRESETS) as ColorName[]

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

/**
 * Contextual properties for the current selection (or for the next shape
 * when nothing is selected): one color setting (stroke plus matching
 * fill), connector options, delete.
 */
export function PropertyBar({
  selection,
  stroke,
  fill,
  onColor,
  onRouting,
  onDirection,
  onDelete,
}: {
  selection: readonly DrawingShape[]
  /** Stroke and fill of the selection (or of the next shape): picks the active swatch */
  stroke: string
  fill: string
  onColor: (name: ColorName) => void
  onRouting: (elbow: boolean) => void
  onDirection: (bidirectional: boolean) => void
  onDelete: () => void
}): ReactElement {
  const connectors = selection.filter((s) => isConnectorType(s.type))
  const arrows = selection.filter((s) => s.type === 'arrow')
  const allElbow = connectors.length > 0 && connectors.every((s) => s.routing === 'elbow')
  const allStraight = connectors.length > 0 && connectors.every((s) => s.routing !== 'elbow')
  const allTwoWay = arrows.length > 0 && arrows.every((s) => s.bidirectional)
  const allOneWay = arrows.length > 0 && arrows.every((s) => !s.bidirectional)
  const text = useDiagramLabels()

  return (
    <div className="rmk-diagram-props" onPointerDown={(e) => e.stopPropagation()}>
      <div className="rmk-diagram-props-group" role="radiogroup" aria-label={text.colors}>
        {COLOR_NAMES.map((name) => (
          <Swatch
            key={name}
            name={name}
            active={COLOR_PRESETS[name].stroke === stroke && COLOR_PRESETS[name].fill === fill}
            onClick={() => onColor(name)}
          />
        ))}
      </div>
      {connectors.length > 0 && (
        <div className="rmk-diagram-props-group" aria-label={text.connectorRouting}>
          <OptionButton label={text.straight} active={allStraight} onClick={() => onRouting(false)}>
            {UI_ICONS.straight}
          </OptionButton>
          <OptionButton label={text.elbow} active={allElbow} onClick={() => onRouting(true)}>
            {UI_ICONS.elbow}
          </OptionButton>
        </div>
      )}
      {arrows.length > 0 && (
        <div className="rmk-diagram-props-group" aria-label={text.arrowDirection}>
          <OptionButton label={text.oneWay} active={allOneWay} onClick={() => onDirection(false)}>
            {UI_ICONS.oneWay}
          </OptionButton>
          <OptionButton label={text.twoWay} active={allTwoWay} onClick={() => onDirection(true)}>
            {UI_ICONS.twoWay}
          </OptionButton>
        </div>
      )}
      {selection.length > 0 && (
        <div className="rmk-diagram-props-group">
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
