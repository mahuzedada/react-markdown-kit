/**
 * The control bar. In the stack it is one Present button; while presenting
 * it is previous, the "3 / 7" counter, next, the presenter toggle,
 * fullscreen (when the browser has it) and exit. Every button carries
 * `data-rmk-deck-action` so a stylesheet or a test can find it, and the bar
 * itself `data-rmk-deck-controls`; the stylesheet positions it in the deck's
 * bottom row wherever it sits in the DOM.
 */
import type { ReactElement } from 'react'
import type { SlidesLabels } from './labels.js'
import type { DeckMode } from './use-deck-state.js'

export type DeckControlAction = 'present' | 'previous' | 'next' | 'presenter' | 'fullscreen' | 'exit'

export interface ControlsProps {
  readonly mode: DeckMode
  /** One-based, for the counter */
  readonly current: number
  readonly count: number
  readonly atStart: boolean
  readonly atEnd: boolean
  readonly fullscreen: boolean
  readonly labels: SlidesLabels
  readonly onAction: (action: DeckControlAction) => void
}

interface ButtonProps {
  readonly action: DeckControlAction
  readonly label: string
  readonly disabled?: boolean
  readonly pressed?: boolean
  readonly onAction: (action: DeckControlAction) => void
}

function Button({ action, label, disabled, pressed, onAction }: ButtonProps): ReactElement {
  return (
    <button
      type="button"
      data-rmk-deck-action={action}
      aria-label={label}
      title={label}
      {...(disabled === undefined ? {} : { disabled })}
      {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
      onClick={() => onAction(action)}
    >
      {label}
    </button>
  )
}

export function Controls(props: ControlsProps): ReactElement {
  const { mode, labels, onAction } = props
  return (
    <div data-rmk-deck-controls="" role="toolbar" aria-label={labels.controls}>
      {mode === 'stack' ? (
        <Button action="present" label={labels.present} onAction={onAction} />
      ) : (
        <>
          <Button action="previous" label={labels.previous} disabled={props.atStart} onAction={onAction} />
          <output data-rmk-deck-counter="">{labels.counter(props.current, props.count)}</output>
          <Button action="next" label={labels.next} disabled={props.atEnd} onAction={onAction} />
          <Button action="presenter" label={labels.presenter} pressed={mode === 'presenter'} onAction={onAction} />
          {props.fullscreen ? <Button action="fullscreen" label={labels.fullscreen} onAction={onAction} /> : null}
          <Button action="exit" label={labels.exit} onAction={onAction} />
        </>
      )}
    </div>
  )
}
