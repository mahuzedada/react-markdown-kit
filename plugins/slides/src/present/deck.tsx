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
 * and `presenter` (present plus the next slide, the notes and a clock).
 *
 * Every browser API is feature-detected and every listener lives on the
 * article element, so two decks on one page are independent and the static
 * stack never captures a key.
 */
import { useEffect, useMemo, useRef, useState, type HTMLAttributes, type ReactElement, type ReactNode } from 'react'
import type { DeckControlAction } from './controls.js'
import { Controls } from './controls.js'
import { exitFullscreen, fullscreenSupported, toggleFullscreen } from './fullscreen.js'
import { currentHash, slideFromHash, writeSlideHash } from './hash.js'
import { attachKeyboard, type KeyCommand } from './keyboard.js'
import { resolveLabels } from './labels.js'
import type { ResolvedPresentOptions } from './options.js'
import { IDLE_MS, attachIdle, attachPointer } from './pointer.js'
import { PresenterPanel } from './presenter-panel.js'
import { collectSections, fragmentCount, presentSection, slideName, type SlideState } from './sections.js'
import { openSync, type SyncChannel, type SyncPosition } from './sync.js'
import { INITIAL_DECK_STATE, atEnd, atStart, useDeckState, type DeckAction, type DeckShape } from './use-deck-state.js'

export interface DeckProps {
  /** The static article's attributes, as the renderer passed them */
  readonly attributes: HTMLAttributes<HTMLElement>
  readonly options: ResolvedPresentOptions
  readonly children?: ReactNode
}

function slideStateOf(index: number, current: number): SlideState {
  return index < current ? 'past' : index === current ? 'current' : 'future'
}

/** True while the focus is inside the deck and on a slide that can hold it (not an inert one). */
function holdsFocus(element: HTMLElement): boolean {
  const active = document.activeElement
  return active !== null && element.contains(active) && active.closest('[inert]') === null
}

export function Deck({ attributes, options, children }: DeckProps): ReactElement {
  const ref = useRef<HTMLElement>(null)
  const sections = useMemo(() => collectSections(children), [children])
  const shape = useMemo<DeckShape>(() => ({ count: sections.length, fragments: sections.map(fragmentCount) }), [sections])
  const [state, dispatch] = useDeckState(shape)
  const [mounted, setMounted] = useState(false)
  const [idle, setIdle] = useState(false)
  const labels = useMemo(() => resolveLabels(options.labels), [options.labels])
  const live = state.mode !== 'stack'

  // Mount: from now on the controls render (for a deck with slides); a deep link or `initialMode` opens the deck.
  const namesRef = useRef<readonly (string | undefined)[]>([])
  namesRef.current = sections.map(slideName)
  useEffect(() => {
    setMounted(true)
    const linked = options.hashRouting ? slideFromHash(currentHash(), namesRef.current) : undefined
    const opening = options.initialMode === 'stack' ? undefined : options.initialMode
    if (linked !== undefined) dispatch({ type: 'enter', mode: opening ?? 'present', index: linked })
    else if (opening !== undefined) dispatch({ type: 'enter', mode: opening })
  }, [dispatch, options.hashRouting, options.initialMode])

  // The sections changed under the deck: keep the position inside the new bounds.
  useEffect(() => {
    dispatch({ type: 'clamp' })
  }, [dispatch, shape])

  // Keys and pointer, only while presenting and only on this element.
  useEffect(() => {
    const element = ref.current
    if (!live || element === null) return
    const onKey = (command: KeyCommand): void => {
      if (command === 'fullscreen') toggleFullscreen(element)
      else if (command === 'presenter') dispatch({ type: 'toggle-presenter' })
      else dispatch({ type: command })
    }
    const detachKeys = attachKeyboard(element, onKey)
    const detachPointer = attachPointer(element, {
      next: () => dispatch({ type: 'next' }),
      previous: () => dispatch({ type: 'previous' }),
    })
    return () => {
      detachKeys()
      detachPointer()
    }
  }, [live, dispatch])

  // Where the deck is, readable from effects that must not re-run on every move.
  const position = useRef<SyncPosition>({ index: state.index, fragment: state.fragment })
  position.current = { index: state.index, fragment: state.fragment }

  // Entering takes focus so the keys work at once; leaving gives fullscreen back, scrolls to the slide
  // and keeps the focus in the deck (the Exit button that held it is gone from the DOM).
  useEffect(() => {
    const element = ref.current
    if (!live || element === null) return
    element.focus({ preventScroll: true })
    return () => {
      exitFullscreen(element)
      if (element.isConnected && !holdsFocus(element)) element.focus({ preventScroll: true })
      const slide = element.querySelector<HTMLElement>(`[data-rmk-slide="${position.current.index + 1}"]`)
      if (slide !== null && typeof slide.scrollIntoView === 'function') slide.scrollIntoView({ block: 'nearest' })
    }
  }, [live])

  // Moving off a slide that held the focus makes that slide inert, and the browser drops the focus
  // onto the body; the deck takes it back so the keys keep working.
  useEffect(() => {
    const element = ref.current
    if (live && element !== null && !holdsFocus(element)) element.focus({ preventScroll: true })
  }, [live, state.index])

  // The controls fade after a still pointer, in plain present mode only.
  useEffect(() => {
    const element = ref.current
    if (state.mode !== 'present' || element === null) {
      setIdle(false)
      return
    }
    return attachIdle(element, IDLE_MS, setIdle)
  }, [state.mode])

  // Deep links follow the deck while it presents.
  useEffect(() => {
    if (options.hashRouting && live) writeSlideHash(state.index)
  }, [options.hashRouting, live, state.index])

  // Sync: follow the channel, and tell it about moves that did not come from it. `synced` is the
  // last position the channel and this deck agreed on (posted or received); a render that lands
  // there is an echo, any other is a local move. It starts at the mount position, so mounting
  // posts nothing, however many times an effect runs.
  const channel = useRef<SyncChannel | undefined>(undefined)
  const synced = useRef<SyncPosition>({ index: INITIAL_DECK_STATE.index, fragment: INITIAL_DECK_STATE.fragment })
  useEffect(() => {
    if (options.sync === false) return
    channel.current = openSync(
      options.sync,
      (incoming) => {
        synced.current = incoming
        dispatch({ type: 'goto', ...incoming })
      },
      () => position.current,
    )
    return () => {
      channel.current?.close()
      channel.current = undefined
    }
  }, [options.sync, dispatch])
  useEffect(() => {
    if (synced.current.index === state.index && synced.current.fragment === state.fragment) return
    synced.current = { index: state.index, fragment: state.fragment }
    channel.current?.post(synced.current)
  }, [state.index, state.fragment])

  // The consumer's callback, on a change only.
  const onSlideChange = options.onSlideChange
  const reported = useRef(state.index)
  useEffect(() => {
    if (reported.current === state.index) return
    reported.current = state.index
    onSlideChange?.(state.index)
  }, [state.index, onSlideChange])

  const onAction = (action: DeckControlAction): void => {
    if (action === 'present') dispatch({ type: 'enter', mode: 'present' })
    else if (action === 'fullscreen') {
      if (ref.current !== null) toggleFullscreen(ref.current)
    } else if (action === 'presenter') dispatch({ type: 'toggle-presenter' })
    else dispatch({ type: action } as DeckAction)
  }

  // The stack renders the children untouched; presenting re-dresses the sections (same keys, same DOM nodes).
  const rendered = live
    ? sections.map((section, index) => presentSection(section, slideStateOf(index, state.index), state.fragment))
    : children

  return (
    <article
      ref={ref}
      {...attributes}
      {...(mounted ? { 'data-rmk-deck-mode': state.mode, tabIndex: -1 } : {})}
      {...(idle ? { 'data-rmk-deck-idle': '' } : {})}
    >
      {mounted && options.controls && shape.count > 0 ? (
        <Controls
          mode={state.mode}
          current={Math.min(state.index + 1, shape.count)}
          count={shape.count}
          atStart={atStart(state)}
          atEnd={atEnd(state, shape)}
          fullscreen={fullscreenSupported(ref.current)}
          labels={labels}
          onAction={onAction}
        />
      ) : null}
      {rendered}
      {state.mode === 'presenter' ? (
        <PresenterPanel next={sections[state.index + 1]} current={sections[state.index]} labels={labels} />
      ) : null}
    </article>
  )
}
