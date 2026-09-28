/**
 * The interactive deck. It is reached only through <Markdown>: the renderer
 * calls `components.article` with the static deck's attributes and its
 * sections as children, and this component wraps them in state.
 *
 * The first render is the static markup, attribute for attribute: no mode,
 * no controls, no tabIndex. Everything interactive appears in an effect, so
 * server output and the client's first render agree and hydration is clean.
 * From then on the deck is in one of three modes: `stack` (the page as
 * rendered, plus a Present button), `present` (fixed, one slide at a time)
 * and `presenter` (present plus the next step, the notes and the timers),
 * with at most one overlay (overview, help, blackout) and one pointer tool
 * (draw, laser) on top.
 *
 * This file wires the parts together; each concern is a hook in `hooks/`
 * or a component beside it. Every browser API is feature-detected and every
 * listener lives on the article element, so two decks on one page are
 * independent and the static stack never captures a key.
 */
import { useEffect, useMemo, useRef, useState, type HTMLAttributes, type ReactElement, type ReactNode } from 'react'
import { cloneOpener } from './clone-window.js'
import type { CommandContext } from './commands/command.js'
import { isAvailable, runCommand } from './commands/registry.js'
import { Controls } from './controls.js'
import { useDeckController } from './hooks/use-deck-controller.js'
import { useDeckFocus } from './hooks/use-deck-focus.js'
import { useDeckInput } from './hooks/use-deck-input.js'
import { useDeckSync } from './hooks/use-deck-sync.js'
import { useDrawings } from './hooks/use-drawings.js'
import { useIdle } from './hooks/use-idle.js'
import { useHashWriting, useOpening } from './hooks/use-opening.js'
import { usePresentationClock } from './hooks/use-presentation-clock.js'
import { useFollow, useSlideChange } from './hooks/use-slide-change.js'
import { resolveLabels } from './labels.js'
import { SlideLayers } from './layers/slide-layers.js'
import type { ResolvedPresentOptions } from './options.js'
import { Announcer } from './overlays/announcer.js'
import { OVERLAY_VIEWS } from './overlays/registry.js'
import { Progress } from './overlays/progress.js'
import { presentSection, slideStateOf } from './present-section.js'
import { PresenterPanel } from './presenter/presenter-panel.js'
import { withPrintSteps } from './print-steps.js'
import { collectSections, fragmentCount, slideName, slideTitle } from './sections.js'
import { atEnd, atStart } from './state/position.js'
import type { DeckShape } from './state/deck-state.js'

export interface DeckProps {
  /** The static article's attributes, as the renderer passed them */
  readonly attributes: HTMLAttributes<HTMLElement>
  readonly options: ResolvedPresentOptions
  readonly children?: ReactNode
}

const NOTES_SCALES = [0.75, 0.875, 1, 1.25, 1.5, 1.75, 2] as const

export function Deck({ attributes, options, children }: DeckProps): ReactElement {
  const ref = useRef<HTMLElement>(null)
  const sections = useMemo(() => collectSections(children), [children])
  const shape = useMemo<DeckShape>(() => ({ count: sections.length, fragments: sections.map(fragmentCount) }), [sections])
  const names = useMemo(() => sections.map(slideName), [sections])
  const [controller, state] = useDeckController(options.controller, shape)
  const [mounted, setMounted] = useState(false)
  const [typed, setTyped] = useState('')
  const [notesScale, setNotesScale] = useState(2)
  const labels = useMemo(() => resolveLabels(options.labels), [options.labels])
  const live = state.mode !== 'stack'
  const clock = usePresentationClock(live)
  const drawings = useDrawings()
  const idle = useIdle(ref, state.mode)

  const context: CommandContext = {
    controller,
    state,
    get element() {
      return ref.current
    },
    resetTimer: clock.reset,
    clearDrawing: () => drawings.clear(state.index),
    scaleNotes: (step) => setNotesScale((scale) => Math.min(Math.max(scale + step, 0), NOTES_SCALES.length - 1)),
    clone: cloneOpener(options, state.index),
  }
  const run = (command: Parameters<typeof runCommand>[0]): boolean => runCommand(command, context)
  const current = sections[state.index]
  const OverlayView = live && state.overlay !== undefined ? OVERLAY_VIEWS[state.overlay] : undefined

  useEffect(() => setMounted(true), [])
  useOpening(options, controller, names)
  useHashWriting(options.hashRouting, state)
  useDeckInput(ref, controller, state, { run, setTyped })
  useDeckFocus(ref, live, state.index)
  useDeckSync(options.sync, controller, state)
  useSlideChange(options.onSlideChange, state.index)
  useFollow(options.follow, controller, state, shape.count)

  const ControlBar = options.controls === true ? Controls : options.controls === false ? undefined : options.controls
  const rendered = live
    ? sections.map((section, index) =>
        presentSection(section, {
          state: slideStateOf(index, state.index),
          fragment: state.fragment,
          overview: state.overlay === 'overview',
          ...(index === state.index ? { layers: <SlideLayers state={state} drawings={drawings} /> } : {}),
        }),
      )
    : mounted && options.printSteps
      ? withPrintSteps(children)
      : children

  return (
    <article
      ref={ref}
      {...attributes}
      {...(mounted ? { 'data-rmk-deck-mode': state.mode, tabIndex: -1 } : {})}
      {...(live ? { 'data-rmk-deck-direction': state.direction } : {})}
      {...(live && state.overlay !== undefined ? { 'data-rmk-deck-overlay': state.overlay } : {})}
      {...(live && state.tool !== undefined ? { 'data-rmk-deck-tool': state.tool } : {})}
      {...(idle ? { 'data-rmk-deck-idle': '' } : {})}
    >
      {mounted && ControlBar !== undefined && shape.count > 0 ? (
        <ControlBar
          state={state}
          count={shape.count}
          atStart={atStart(state)}
          atEnd={atEnd(state, shape)}
          typed={typed}
          labels={labels}
          available={(command) => isAvailable(command, context)}
          run={(command) => void run(command)}
        />
      ) : null}
      {rendered}
      {live ? <Progress current={state.index} count={shape.count} /> : null}
      {mounted ? <Announcer message={live ? labels.announce(state.index + 1, shape.count, current === undefined ? undefined : slideTitle(current)) : ''} /> : null}
      {OverlayView === undefined ? null : <OverlayView labels={labels} context={context} onClose={() => ref.current?.focus({ preventScroll: true })} />}
      {state.mode === 'presenter' ? (
        <PresenterPanel
          sections={sections}
          index={state.index}
          fragment={state.fragment}
          labels={labels}
          startedAt={clock.startedAt}
          notesScale={NOTES_SCALES[notesScale]!}
          onResetTimer={clock.reset}
          onScaleNotes={context.scaleNotes}
        />
      ) : null}
    </article>
  )
}
