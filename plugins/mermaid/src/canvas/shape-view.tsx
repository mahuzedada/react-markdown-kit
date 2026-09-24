/**
 * Ported from @zuilib/text-editor (MIT). One shape on the canvas: outline
 * (clean or ink), its text slots, connector label, and the fat hit area.
 */
import type { ReactElement } from 'react'
import { arrowHeads, connectorMidpoint, polylinePath } from '../core/connectors.js'
import { bbox, textBoxSize, wrapText, type Rect } from '../core/geometry.js'
import { nodeShapeDefinition, type TextField } from '../core/shapes/definitions.js'
import {
  FONT_SIZE,
  isNodeShapeType,
  isConnectorType,
  LINE_HEIGHT,
  SMALL_FONT_SIZE,
  type DrawingShape,
  type Point,
} from '../core/drawing-data.js'
import { BoxGeometry } from './shapes/render.js'
import { InkBoxGeometry, InkConnector } from './shapes/ink-render.js'
import { useDiagramLabels } from './host.js'

export const CONNECTOR_FONT_SIZE = 12
export const CONNECTOR_LABEL_MAX_WIDTH = 160

/** Vertical layout of the three text slots inside a box's text area */
export function slotLayout(shape: DrawingShape): { area: Rect; slots: readonly TextField[] } {
  const def = nodeShapeDefinition(shape)
  return {
    area: def ? def.textArea(shape) : bbox(shape),
    slots: def ? def.textSlots : ['label', 'text', 'footer'],
  }
}

/** Slot under a relative vertical position (0 top … 1 bottom) of the area */
export function slotAt(shape: DrawingShape, y: number): TextField {
  const { area, slots } = slotLayout(shape)
  const rel = (y - area.y) / Math.max(area.h, 1)
  if (rel < 0.3 && slots.includes('label')) return 'label'
  if (rel > 0.7 && slots.includes('footer')) return 'footer'
  return slots.includes('text') ? 'text' : (slots[0] ?? 'text')
}

const textStyle = { userSelect: 'none' as const }

/** Relative luminance of a #rgb/#rrggbb color (1 for anything else) */
function luminance(color: string): number {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color)
  const raw = m?.[1]
  if (raw === undefined) return 1
  const hex = raw.length === 3 ? raw.replace(/./g, (c) => c + c) : raw
  const channel = (i: number): number => parseInt(hex.slice(i, i + 2), 16) / 255
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4)
}

/**
 * Color of a shape's text: its stroke, except on borderless shapes (dark
 * text) and dark-filled ones (light text).
 */
export function textColorFor(shape: DrawingShape): string {
  if (shape.stroke === 'transparent' || shape.stroke === 'none') return '#1e1e1e'
  if (luminance(shape.fill) < 0.35) return '#ffffff'
  return shape.stroke
}
const hintStyle = { userSelect: 'none' as const, pointerEvents: 'none' as const }

/**
 * The text slots of a box, rendered inside the shape's group so they move
 * and resize with it: a small bold label at the top of the text area, main
 * content centered, and a dimmer footer line at the bottom.
 */
export function BoxTexts({
  shape,
  hideField,
  showHints,
}: {
  shape: DrawingShape
  hideField?: TextField | null | undefined
  showHints?: boolean | undefined
}): ReactElement {
  const labels = useDiagramLabels()
  const { area, slots } = slotLayout(shape)
  const cx = area.x + area.w / 2
  const wrapW = Math.max(area.w, 20)
  // Placeholder hints need room, otherwise they pile up on small shapes
  const hints = showHints === true && area.h >= 56 && area.w >= 44
  const mainLines = wrapText(shape.text ?? '', wrapW, FONT_SIZE)
  const labelLines = wrapText(shape.label ?? '', wrapW, SMALL_FONT_SIZE)
  const footerLines = wrapText(shape.footer ?? '', wrapW, SMALL_FONT_SIZE)
  const mainLineH = FONT_SIZE * LINE_HEIGHT
  const smallLineH = SMALL_FONT_SIZE * LINE_HEIGHT
  const mainStart = area.y + area.h / 2 - ((mainLines.length - 1) * mainLineH) / 2 + FONT_SIZE * 0.35
  const common = {
    fill: textColorFor(shape),
    textAnchor: 'middle' as const,
  }
  return (
    <g>
      {slots.includes('label') &&
        hideField !== 'label' &&
        (shape.label
          ? labelLines.map((line, i) => (
              <text
                {...common}
                key={i}
                x={cx}
                y={area.y + SMALL_FONT_SIZE + i * smallLineH}
                fontSize={SMALL_FONT_SIZE}
                fontWeight={600}
                letterSpacing={0.3}
                opacity={0.85}
                style={textStyle}
              >
                {line}
              </text>
            ))
          : hints && (
              <text
                {...common}
                x={cx}
                y={area.y + SMALL_FONT_SIZE}
                fontSize={SMALL_FONT_SIZE}
                opacity={0.3}
                style={hintStyle}
              >
                {labels.labelPlaceholder}
              </text>
            ))}
      {slots.includes('text') &&
        hideField !== 'text' &&
        (shape.text
          ? mainLines.map((line, i) => (
              <text
                {...common}
                key={i}
                x={cx}
                y={mainStart + i * mainLineH}
                fontSize={FONT_SIZE}
                style={textStyle}
              >
                {line}
              </text>
            ))
          : hints && (
              <text {...common} x={cx} y={mainStart} fontSize={FONT_SIZE} opacity={0.3} style={hintStyle}>
                {labels.textPlaceholder}
              </text>
            ))}
      {slots.includes('footer') &&
        hideField !== 'footer' &&
        (shape.footer
          ? footerLines.map((line, i) => (
              <text
                {...common}
                key={i}
                x={cx}
                y={area.y + area.h - 3 - (footerLines.length - 1 - i) * smallLineH}
                fontSize={SMALL_FONT_SIZE}
                opacity={0.65}
                style={textStyle}
              >
                {line}
              </text>
            ))
          : hints && (
              <text
                {...common}
                x={cx}
                y={area.y + area.h - 3}
                fontSize={SMALL_FONT_SIZE}
                opacity={0.3}
                style={hintStyle}
              >
                {labels.footerPlaceholder}
              </text>
            ))}
    </g>
  )
}

/** Connector label: text on a small backing plate at the path's midpoint */
export function ConnectorLabel({
  shape,
  points,
}: {
  shape: DrawingShape
  points: readonly Point[]
}): ReactElement {
  const text = shape.text ?? ''
  const lines = wrapText(text, CONNECTOR_LABEL_MAX_WIDTH, CONNECTOR_FONT_SIZE)
  const size = textBoxSize(lines.join('\n'), CONNECTOR_FONT_SIZE)
  const { x: midX, y: midY } = connectorMidpoint(points)
  const lineH = CONNECTOR_FONT_SIZE * LINE_HEIGHT
  const startY = midY - ((lines.length - 1) * lineH) / 2 + CONNECTOR_FONT_SIZE * 0.35
  return (
    <g>
      <rect
        x={midX - size.w / 2 - 5}
        y={midY - size.h / 2 - 3}
        width={size.w + 10}
        height={size.h + 6}
        rx={5}
        className="rmk-diagram-label-plate"
        opacity={0.94}
      />
      {lines.map((line, i) => (
        <text
          key={i}
          x={midX}
          y={startY + i * lineH}
          fill={shape.stroke}
          fontSize={CONNECTOR_FONT_SIZE}
          textAnchor="middle"
          style={textStyle}
        >
          {line}
        </text>
      ))}
    </g>
  )
}

export function ShapeView({
  shape,
  points,
  hideField,
  showHints,
  ink = false,
}: {
  shape: DrawingShape
  /** Path vertices for connectors */
  points?: readonly Point[] | undefined
  hideField?: TextField | null | undefined
  showHints?: boolean | undefined
  /** Render with the ink style (see core/ink.ts) */
  ink?: boolean
}): ReactElement | null {
  const stroke = {
    stroke: shape.stroke,
    strokeWidth: shape.strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  if (isNodeShapeType(shape.type)) {
    return (
      <g>
        {ink ? <InkBoxGeometry shape={shape} /> : <BoxGeometry shape={shape} stroke={stroke} />}
        <BoxTexts shape={shape} hideField={hideField} showHints={showHints} />
      </g>
    )
  }
  if (isConnectorType(shape.type)) {
    const pts = points ?? [
      { x: shape.x, y: shape.y },
      { x: shape.x + shape.width, y: shape.y + shape.height },
    ]
    return (
      <g>
        {ink ? (
          <InkConnector shape={shape} points={pts} />
        ) : (
          <>
            <path {...stroke} d={polylinePath(pts)} fill="none" />
            {arrowHeads(shape, pts).map((d, i) => (
              <path key={i} {...stroke} d={d} fill="none" />
            ))}
          </>
        )}
        {shape.text && hideField !== 'text' && <ConnectorLabel shape={shape} points={pts} />}
      </g>
    )
  }
  return (
    <text
      x={shape.x}
      y={shape.y + FONT_SIZE}
      fill={shape.stroke}
      fontSize={FONT_SIZE}
      style={{ userSelect: 'none', whiteSpace: 'pre' }}
    >
      {(shape.text ?? '').split('\n').map((line, i) => (
        <tspan key={i} x={shape.x} dy={i === 0 ? 0 : FONT_SIZE * LINE_HEIGHT}>
          {line}
        </tspan>
      ))}
    </text>
  )
}

/** Fat invisible hit areas so thin strokes and small shapes are easy to grab */
export function HitArea({
  shape,
  points,
}: {
  shape: DrawingShape
  points?: readonly Point[] | undefined
}): ReactElement {
  if (isConnectorType(shape.type) && points) {
    return <path d={polylinePath(points)} fill="none" stroke="transparent" strokeWidth={16} />
  }
  const b = bbox(shape)
  return (
    <rect
      x={b.x - 2}
      y={b.y - 2}
      width={Math.max(b.w, 8) + 4}
      height={Math.max(b.h, 8) + 4}
      fill="transparent"
      stroke="none"
    />
  )
}
