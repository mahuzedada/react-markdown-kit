/**
 * The sequence canvas's tool row (docs/MERMAID_PLATFORM.md section 9.5):
 * add a participant or an actor, the autonumber toggle, Copy as Mermaid,
 * and the contextual property bar inline after them, in the idiom of the
 * flowchart's tool row so both canvases read the same.
 */
import { useState, type ReactElement, type ReactNode } from 'react'
import { Icon, SHAPE_ICONS, UI_ICONS } from '../icons.js'
import { useCanvasHost, useDiagramLabels } from '../host.js'
import { TOOLBAR_ITEM_ATTRIBUTE, useToolbarKeyboard } from '../toolbar-keyboard.js'

const ITEM = { [TOOLBAR_ITEM_ATTRIBUTE]: '' }

export function ToolButton({
  label,
  active,
  disabled,
  className,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  className?: string
  onClick: () => void
  children: ReactNode
}): ReactElement {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      className={['rmk-diagram-tool', active ? 'is-active' : '', className ?? ''].filter(Boolean).join(' ')}
      onClick={onClick}
      {...ITEM}
    >
      {children}
    </button>
  )
}

export function SequenceToolbar({
  numbering,
  onAddParticipant,
  onAddActor,
  onNumbering,
  onCopyMermaid,
  properties,
}: {
  numbering: boolean
  onAddParticipant: () => void
  onAddActor: () => void
  onNumbering: (on: boolean) => void
  onCopyMermaid: () => Promise<boolean>
  /** Contextual controls rendered inline after the tools */
  properties?: ReactNode
}): ReactElement {
  const [copied, setCopied] = useState(false)
  const keyboard = useToolbarKeyboard(useCanvasHost().toolbarOrientation)
  const text = useDiagramLabels()
  return (
    <>
      <div className="rmk-diagram-toolbar-group" role="toolbar" aria-label={text.sequenceTools} {...keyboard}>
        <ToolButton label={text.addParticipant} className="rmk-sequence-add-participant" onClick={onAddParticipant}>
          <Icon>{UI_ICONS.participant}</Icon>
        </ToolButton>
        <ToolButton label={text.addActor} className="rmk-sequence-add-actor" onClick={onAddActor}>
          <Icon>{SHAPE_ICONS.actor}</Icon>
        </ToolButton>
        <span className="rmk-diagram-toolbar-divider" />
        <ToolButton label={text.autonumber} className="rmk-sequence-autonumber" active={numbering} onClick={() => onNumbering(!numbering)}>
          <Icon>{UI_ICONS.autonumber}</Icon>
        </ToolButton>
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
          <Icon>{copied ? UI_ICONS.check : UI_ICONS.mermaid}</Icon>
        </ToolButton>
      </div>
    </>
  )
}
