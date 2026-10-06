/**
 * Document actions in the header, and a zoom menu used by the bottom bar.
 */
import type { ReactElement, ReactNode } from 'react'
import { useCanvas, type CanvasZoom } from './context.js'
import { chevronDownIcon, playIcon } from './icons.js'
import { Popover } from './popover.js'

const ZOOMS: readonly CanvasZoom[] = ['fit', 0.5, 0.75, 1, 1.5, 2]

export interface ViewBarProps {
  readonly actions?: ReactNode
  readonly onPresent?: (index: number) => void
}

export function ZoomMenu({ placement = 'above-end' }: { readonly placement?: 'above-end' | 'below-end' } = {}): ReactElement {
  const { labels, zoom, setZoom, scale } = useCanvas()
  return (
    <Popover
      label={labels.zoom}
      placement={placement}
      button={
        <>
          <span data-rmk-canvas-zoom-value="">{Math.round(scale * 100)}%</span>
          {chevronDownIcon}
        </>
      }
    >
      {(close) => (
        <div role="group" data-rmk-canvas-menu="">
          {ZOOMS.map((choice) => (
            <button
              key={String(choice)}
              type="button"
              aria-pressed={zoom === choice}
              onClick={() => {
                setZoom(choice)
                close()
              }}
            >
              {choice === 'fit' ? labels.fit : `${choice * 100}%`}
            </button>
          ))}
        </div>
      )}
    </Popover>
  )
}

export function ViewBar({ actions, onPresent }: ViewBarProps): ReactElement {
  const { labels, index, count, editable, view, propertiesOpen, setPropertiesOpen, focused, setFocused } = useCanvas()
  return (
    <div role="toolbar" aria-label={labels.view} data-rmk-canvas-island="end">
      {actions === undefined ? null : <span data-rmk-canvas-actions="">{actions}</span>}
      {onPresent === undefined ? null : (
        <button type="button" aria-label={labels.present} title={labels.present} data-rmk-canvas-present="" disabled={count === 0} onClick={() => onPresent(index)}>
          {playIcon}
        </button>
      )}
      {editable ? <button type="button" aria-label={labels.properties} title={labels.properties} aria-pressed={propertiesOpen} disabled={view === 'grid'} onClick={() => setPropertiesOpen(!propertiesOpen)}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/></svg>
      </button> : null}
      <button type="button" aria-label={focused ? labels.exitFocus : labels.focus} title={focused ? labels.exitFocus : labels.focus} aria-pressed={focused} onClick={() => setFocused(!focused)}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /></svg>
      </button>
      <ZoomMenu placement="below-end" />
    </div>
  )
}
