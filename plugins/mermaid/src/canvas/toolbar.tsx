/**
 * Ported from @zuilib/text-editor (MIT). The canvas's own tool row: shape
 * tools, the "more shapes" popover, Copy as Mermaid and the width presets.
 */
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import type { BlockWidth } from '../core/block-width.js'
import type { NodeShapeType, DrawingShapeType } from '../core/drawing-data.js'
import { Icon, SHAPE_ICONS, UI_ICONS } from './icons.js'
import { useDiagramLabels, type DiagramLabelKey } from './labels.js'
import { LAYOUT_OPTIONS, layoutPreset } from './layout-options.js'
import { TOOLBAR_ITEM_ATTRIBUTE, useToolbarKeyboard } from './toolbar-keyboard.js'

export type Tool = 'select' | DrawingShapeType

/** Tools with a dedicated button; the rest live in the "more shapes" popover */
const PRIMARY_TOOLS: ReadonlyArray<{ tool: Tool; label: DiagramLabelKey }> = [
  { tool: 'select', label: 'select' },
  { tool: 'rect', label: 'rect' },
  { tool: 'ellipse', label: 'ellipse' },
  { tool: 'diamond', label: 'diamond' },
  { tool: 'arrow', label: 'arrow' },
  { tool: 'line', label: 'line' },
  { tool: 'text', label: 'text' },
]

const MORE_SHAPES: readonly NodeShapeType[] = ['note', 'cylinder', 'cloud', 'queue', 'actor']

const ITEM = { [TOOLBAR_ITEM_ATTRIBUTE]: '' }

function ToolButton({
  label,
  active,
  onClick,
  children,
  className,
  pressed,
}: {
  label: string
  active?: boolean
  pressed?: boolean
  onClick: () => void
  children: ReactElement
  className?: string
}): ReactElement {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed ?? active}
      className={['rmk-diagram-tool', active ? 'is-active' : '', className ?? ''].filter(Boolean).join(' ')}
      onClick={onClick}
      {...ITEM}
    >
      <Icon>{children}</Icon>
    </button>
  )
}

export function DiagramToolbar({
  tool,
  onToolChange,
  width,
  onWidthChange,
  onCopyMermaid,
  properties,
}: {
  tool: Tool
  onToolChange: (tool: Tool) => void
  width: BlockWidth
  onWidthChange: (width: BlockWidth) => void
  onCopyMermaid: () => Promise<boolean>
  /** Contextual controls rendered inline after the tools */
  properties?: ReactNode
}): ReactElement {
  const [moreOpen, setMoreOpen] = useState(false)
  const [lastMore, setLastMore] = useState<NodeShapeType>('note')
  const [copied, setCopied] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const keyboard = useToolbarKeyboard()
  const text = useDiagramLabels()

  useEffect(() => {
    if (!moreOpen) return
    const close = (e: PointerEvent): void => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false)
    }
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', key)
    }
  }, [moreOpen])

  const moreActive = (MORE_SHAPES as readonly string[]).includes(tool)
  const moreIcon = moreActive ? SHAPE_ICONS[tool] : SHAPE_ICONS[lastMore]

  return (
    <>
      <div className="rmk-diagram-toolbar-group" role="toolbar" aria-label={text.tools} {...keyboard}>
        {PRIMARY_TOOLS.map(({ tool: t, label }) => (
          <ToolButton key={t} label={text[label]} active={tool === t} onClick={() => onToolChange(t)}>
            {SHAPE_ICONS[t]}
          </ToolButton>
        ))}
        <div className="rmk-diagram-more" ref={moreRef}>
          <button
            type="button"
            title={text.moreShapes}
            aria-label={text.moreShapes}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            className={moreActive ? 'rmk-diagram-tool rmk-diagram-tool-more is-active' : 'rmk-diagram-tool rmk-diagram-tool-more'}
            onClick={() => setMoreOpen((open) => !open)}
            {...ITEM}
          >
            <Icon>{moreIcon}</Icon>
            <span className="rmk-diagram-caret" aria-hidden="true" />
          </button>
          {moreOpen && (
            <div className="rmk-diagram-popover" role="menu">
              {MORE_SHAPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  role="menuitemradio"
                  aria-checked={tool === type}
                  className={tool === type ? 'rmk-diagram-popover-item is-active' : 'rmk-diagram-popover-item'}
                  onClick={() => {
                    setLastMore(type)
                    onToolChange(type)
                    setMoreOpen(false)
                  }}
                >
                  <Icon size={18}>{SHAPE_ICONS[type]}</Icon>
                  <span>{text[type]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {properties}
      <div className="rmk-diagram-toolbar-group rmk-diagram-toolbar-group-end">
        <ToolButton
          label={copied ? text.copiedMermaid : text.copyMermaid}
          className={copied ? 'is-success' : ''}
          onClick={() => {
            void onCopyMermaid().then((ok) => {
              if (!ok) return
              setCopied(true)
              setTimeout(() => setCopied(false), 1600)
            })
          }}
        >
          {copied ? UI_ICONS.check : UI_ICONS.mermaid}
        </ToolButton>
        <span className="rmk-diagram-toolbar-divider" />
        {LAYOUT_OPTIONS.map(({ preset, label, icon, width: presetWidth }) => (
          <ToolButton
            key={preset}
            label={text[label]}
            active={layoutPreset(width) === preset}
            onClick={() => onWidthChange(presetWidth)}
          >
            {icon}
          </ToolButton>
        ))}
      </div>
    </>
  )
}
