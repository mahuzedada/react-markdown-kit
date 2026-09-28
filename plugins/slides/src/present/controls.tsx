/**
 * The built-in control bar. In the stack it is one Present button; while
 * presenting it is the buttons in `BAR`, the "3 / 7" counter and, while
 * digits are being typed, the jump they spell. Every button carries
 * `data-rmk-deck-action` (the command id) so a stylesheet or a test can
 * find it; its label is its accessible name and hidden text beside the
 * icon. The `controls` option can replace this whole component: it
 * receives the same props.
 */
import type { ReactElement } from 'react'
import { commandSpec, type DeckCommand } from './commands/registry.js'
import type { SlidesLabels } from './labels.js'
import type { DeckState } from './state/deck-state.js'

export interface DeckControlsProps {
  readonly state: DeckState
  readonly count: number
  readonly atStart: boolean
  readonly atEnd: boolean
  /** Digits typed toward a jump; '' when none */
  readonly typed: string
  readonly labels: SlidesLabels
  readonly available: (command: DeckCommand) => boolean
  readonly run: (command: DeckCommand) => void
}

interface BarItem {
  readonly command: DeckCommand
  readonly disabled?: (props: DeckControlsProps) => boolean
  readonly pressed?: (state: DeckState) => boolean
}

/** The bar while presenting, in order; the counter sits after `previous`. */
const BAR: readonly BarItem[] = [
  { command: 'previous', disabled: (props) => props.atStart },
  { command: 'next', disabled: (props) => props.atEnd },
  { command: 'overview', pressed: (state) => state.overlay === 'overview' },
  { command: 'presenter', pressed: (state) => state.mode === 'presenter' },
  { command: 'draw', pressed: (state) => state.tool === 'draw' },
  { command: 'laser', pressed: (state) => state.tool === 'laser' },
  { command: 'fullscreen' },
  { command: 'help', pressed: (state) => state.overlay === 'help' },
  { command: 'exit' },
]

function Button({ item, props }: { readonly item: BarItem; readonly props: DeckControlsProps }): ReactElement {
  const spec = commandSpec(item.command)
  const label = spec.label(props.labels)
  const disabled = item.disabled?.(props)
  const pressed = item.pressed?.(props.state)
  return (
    <button
      type="button"
      data-rmk-deck-action={item.command}
      aria-label={label}
      title={label}
      {...(disabled === undefined ? {} : { disabled })}
      {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
      onClick={() => props.run(item.command)}
    >
      {spec.icon}
      <span data-rmk-deck-action-label="">{label}</span>
    </button>
  )
}

export function Controls(props: DeckControlsProps): ReactElement {
  const { state, labels } = props
  if (state.mode === 'stack') {
    return (
      <div data-rmk-deck-controls="" role="toolbar" aria-label={labels.controls}>
        <button type="button" data-rmk-deck-action="present" aria-label={labels.present} title={labels.present} onClick={() => props.run('present')}>
          {labels.present}
        </button>
      </div>
    )
  }
  const items = BAR.filter((item) => props.available(item.command))
  return (
    <div data-rmk-deck-controls="" role="toolbar" aria-label={labels.controls}>
      {items.map((item) => (
        <BarEntry key={item.command} item={item} props={props} />
      ))}
      {props.typed === '' ? null : <output data-rmk-deck-goto="">{labels.goto(props.typed)}</output>}
    </div>
  )
}

/** A bar button, preceded by the counter when it is the Previous button. */
function BarEntry({ item, props }: { readonly item: BarItem; readonly props: DeckControlsProps }): ReactElement {
  if (item.command !== 'previous') return <Button item={item} props={props} />
  return (
    <>
      <Button item={item} props={props} />
      <output data-rmk-deck-counter="" aria-live="off">{props.labels.counter(Math.min(props.state.index + 1, props.count), props.count)}</output>
    </>
  )
}
