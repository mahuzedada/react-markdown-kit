/**
 * Contextual properties of the sequence canvas's selection
 * (docs/MERMAID_PLATFORM.md section 9.5): participant or actor for a
 * column; line, head, two-way, activation suffix and swapped ends for a
 * message; placement and the second participant for a note; "Wrap in" for
 * a message or note; a new section or unwrap for a frame; delete for all.
 * Each control is one operation on the model; an operation Mermaid.js
 * would reject (a `-` that deactivates nothing) is disabled, never
 * performed.
 */
import type { ReactElement, ReactNode } from 'react'
import { flattenItems, type Message, type SequenceModel } from '../../core/sequence/model.js'
import { canDeactivate, SECTIONED_FRAME_KINDS, type FrameKind, type NotePlacement } from '../../core/sequence/operations.js'
import { Icon, SHAPE_ICONS, UI_ICONS } from '../icons.js'
import { useDiagramLabels, type DiagramLabelKey, type DiagramLabels } from '../labels.js'
import type { SequenceSelection } from './selection.js'

export interface SequencePropertyActions {
  readonly onParticipantKind: (kind: 'participant' | 'actor') => void
  readonly onLine: (line: Message['line']) => void
  readonly onHead: (head: Message['head']) => void
  readonly onTwoWay: (bidirectional: boolean) => void
  readonly onActivation: (suffix: Message['activate'] | undefined) => void
  readonly onSwapEnds: () => void
  readonly onNotePlacement: (placement: NotePlacement, second?: string) => void
  readonly onWrap: (kind: FrameKind) => void
  readonly onAddSection: () => void
  readonly onUnwrap: () => void
  readonly onDelete: () => void
}

const FRAME_KINDS: readonly { readonly kind: FrameKind; readonly label: DiagramLabelKey }[] = [
  { kind: 'loop', label: 'wrapLoop' },
  { kind: 'alt', label: 'wrapAlt' },
  { kind: 'opt', label: 'wrapOpt' },
  { kind: 'par', label: 'wrapPar' },
  { kind: 'critical', label: 'wrapCritical' },
  { kind: 'break', label: 'wrapBreak' },
  { kind: 'rect', label: 'wrapRect' },
]

function OptionButton({
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
    >
      {children}
    </button>
  )
}

export function SequencePropertyBar({
  model,
  selection,
  actions,
}: {
  model: SequenceModel
  selection: SequenceSelection | null
  actions: SequencePropertyActions
}): ReactElement | null {
  const text = useDiagramLabels()
  if (selection === null) return null
  if (selection.kind === 'participant') {
    const participant = model.participants[selection.column]
    if (participant === undefined) return null
    return (
      <div className="rmk-diagram-props" onPointerDown={(e) => e.stopPropagation()}>
        <div className="rmk-diagram-props-group" role="radiogroup" aria-label={text.participantKind}>
          <OptionButton label={text.participantType} active={participant.kind === 'participant'} onClick={() => actions.onParticipantKind('participant')}>
            <Icon>{UI_ICONS.participant}</Icon>
          </OptionButton>
          <OptionButton label={text.actorType} active={participant.kind === 'actor'} onClick={() => actions.onParticipantKind('actor')}>
            <Icon>{SHAPE_ICONS.actor}</Icon>
          </OptionButton>
        </div>
        <DeleteGroup label={text.deleteParticipant} onDelete={actions.onDelete} />
      </div>
    )
  }
  const item = flattenItems(model.items)[selection.index]
  if (item === undefined) return null
  if (item.type === 'message') {
    return (
      <div className="rmk-diagram-props" onPointerDown={(e) => e.stopPropagation()}>
        <div className="rmk-diagram-props-group" role="radiogroup" aria-label={text.messageLine}>
          <OptionButton label={text.solidLine} active={item.line === 'solid'} onClick={() => actions.onLine('solid')}>
            <Icon>{UI_ICONS.solidLine}</Icon>
          </OptionButton>
          <OptionButton label={text.dottedLine} active={item.line === 'dotted'} onClick={() => actions.onLine('dotted')}>
            <Icon>{UI_ICONS.dottedLine}</Icon>
          </OptionButton>
        </div>
        <div className="rmk-diagram-props-group" role="radiogroup" aria-label={text.messageHead}>
          <OptionButton label={text.headArrow} active={item.head === 'arrow'} onClick={() => actions.onHead('arrow')}>
            <Icon>{UI_ICONS.headArrow}</Icon>
          </OptionButton>
          <OptionButton label={text.headOpen} active={item.head === 'open'} onClick={() => actions.onHead('open')}>
            <Icon>{UI_ICONS.headOpen}</Icon>
          </OptionButton>
          <OptionButton label={text.headCross} active={item.head === 'cross'} onClick={() => actions.onHead('cross')}>
            <Icon>{UI_ICONS.headCross}</Icon>
          </OptionButton>
          <OptionButton label={text.headNone} active={item.head === 'none'} onClick={() => actions.onHead('none')}>
            <Icon>{UI_ICONS.headNone}</Icon>
          </OptionButton>
        </div>
        <div className="rmk-diagram-props-group" role="radiogroup" aria-label={text.arrowDirection}>
          <OptionButton label={text.oneWay} active={!item.bidirectional} onClick={() => actions.onTwoWay(false)}>
            <Icon>{UI_ICONS.oneWay}</Icon>
          </OptionButton>
          <OptionButton label={text.twoWay} active={item.bidirectional} onClick={() => actions.onTwoWay(true)}>
            <Icon>{UI_ICONS.twoWay}</Icon>
          </OptionButton>
        </div>
        <div className="rmk-diagram-props-group" role="radiogroup" aria-label={text.activation}>
          <OptionButton label={text.activateReceiver} active={item.activate === '+'} onClick={() => actions.onActivation('+')}>
            <Icon>{UI_ICONS.activate}</Icon>
          </OptionButton>
          <OptionButton
            label={text.deactivateSender}
            active={item.activate === '-'}
            disabled={!canDeactivate(model, selection.index)}
            onClick={() => actions.onActivation('-')}
          >
            <Icon>{UI_ICONS.deactivate}</Icon>
          </OptionButton>
          <OptionButton label={text.noActivation} active={item.activate === undefined} onClick={() => actions.onActivation(undefined)}>
            <Icon>{UI_ICONS.headNone}</Icon>
          </OptionButton>
        </div>
        <div className="rmk-diagram-props-group">
          <OptionButton label={text.swapEnds} onClick={actions.onSwapEnds}>
            <Icon>{UI_ICONS.swap}</Icon>
          </OptionButton>
        </div>
        <WrapGroup text={text} onWrap={actions.onWrap} />
        <DeleteGroup label={text.deleteMessage} onDelete={actions.onDelete} />
      </div>
    )
  }
  if (item.type === 'note') {
    const first = item.participantIds[0] ?? ''
    const second = item.participantIds[1] ?? ''
    return (
      <div className="rmk-diagram-props" onPointerDown={(e) => e.stopPropagation()}>
        <div className="rmk-diagram-props-group" role="radiogroup" aria-label={text.notePlacement}>
          <OptionButton label={text.noteLeft} active={item.placement === 'left'} onClick={() => actions.onNotePlacement('left')}>
            <Icon>{UI_ICONS.noteLeft}</Icon>
          </OptionButton>
          <OptionButton label={text.noteRight} active={item.placement === 'right'} onClick={() => actions.onNotePlacement('right')}>
            <Icon>{UI_ICONS.noteRight}</Icon>
          </OptionButton>
          <OptionButton label={text.noteOver} active={item.placement === 'over'} onClick={() => actions.onNotePlacement('over', second || undefined)}>
            <Icon>{UI_ICONS.noteOver}</Icon>
          </OptionButton>
        </div>
        {item.placement === 'over' && (
          <div className="rmk-diagram-props-group">
            <select
              className="rmk-sequence-select"
              aria-label={text.noteSecond}
              value={second}
              onChange={(e) => actions.onNotePlacement('over', e.target.value === '' ? undefined : e.target.value)}
            >
              <option value="">{text.noteSecondNone}</option>
              {model.participants
                .filter((p) => p.id !== first)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
            </select>
          </div>
        )}
        <WrapGroup text={text} onWrap={actions.onWrap} />
        <DeleteGroup label={text.deleteNote} onDelete={actions.onDelete} />
      </div>
    )
  }
  return (
    <div className="rmk-diagram-props" onPointerDown={(e) => e.stopPropagation()}>
      <div className="rmk-diagram-props-group">
        {SECTIONED_FRAME_KINDS.includes(item.kind) && (
          <OptionButton label={text.addSection} className="rmk-sequence-add-section" onClick={actions.onAddSection}>
            <Icon>{UI_ICONS.section}</Icon>
          </OptionButton>
        )}
        <OptionButton label={text.unwrapFrame} className="rmk-sequence-unwrap" onClick={actions.onUnwrap}>
          <Icon>{UI_ICONS.unwrap}</Icon>
        </OptionButton>
      </div>
    </div>
  )
}

function WrapGroup({ text, onWrap }: { text: DiagramLabels; onWrap: (kind: FrameKind) => void }): ReactElement {
  return (
    <div className="rmk-diagram-props-group rmk-sequence-wrap" role="group" aria-label={text.wrapIn}>
      <Icon>{UI_ICONS.wrap}</Icon>
      {FRAME_KINDS.map(({ kind, label }) => (
        <OptionButton key={kind} label={text[label]} className="rmk-sequence-chip" onClick={() => onWrap(kind)}>
          {kind}
        </OptionButton>
      ))}
    </div>
  )
}

function DeleteGroup({ label, onDelete }: { label: string; onDelete: () => void }): ReactElement {
  return (
    <div className="rmk-diagram-props-group">
      <OptionButton label={label} className="rmk-diagram-tool-danger" onClick={onDelete}>
        <Icon>{UI_ICONS.trash}</Icon>
      </OptionButton>
    </div>
  )
}
