/**
 * Stream: replays the deck into the right pane a few characters at a time,
 * the way a model's reply arrives, and presents it as it grows. The deck's
 * `follow` option moves to each new slide as it appears, and a comment that
 * is still being written renders as nothing until it closes.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { DeckController } from '@react-markdown-kit/slides/present'

/** About 500 characters a second, the pace of a fast model. */
const CHARS_PER_MS = 0.5
const TICK_MS = 35

export interface StreamReplay {
  /** The prefix on screen while streaming; undefined when not streaming. */
  readonly shown: string | undefined
  readonly start: () => void
  readonly stop: () => void
}

export function useStreamReplay(source: string, controller: DeckController): StreamReplay {
  const [shown, setShown] = useState<string | undefined>(undefined)
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  // Set once the replay has put the deck in present mode, so leaving it can end the replay.
  const entered = useRef(false)

  const stop = useCallback(() => {
    if (timer.current !== undefined) clearInterval(timer.current)
    timer.current = undefined
    entered.current = false
    setShown(undefined)
  }, [])

  const start = useCallback(() => {
    stop()
    const started = performance.now()
    setShown('')
    // The length follows the clock, so a throttled background tab catches up instead of crawling.
    timer.current = setInterval(() => {
      const length = Math.min(source.length, Math.round((performance.now() - started) * CHARS_PER_MS))
      setShown(source.slice(0, length))
      if (length === source.length) {
        // Done: the deck renders the source itself again and stays where it is.
        clearInterval(timer.current)
        timer.current = undefined
        entered.current = false
        setShown(undefined)
      }
    }, TICK_MS)
  }, [source, stop])

  // Present as soon as the first slide exists; leaving present mode ends the replay and shows the source again.
  useEffect(() => {
    if (shown === undefined || entered.current || controller.getShape().count === 0) return
    entered.current = true
    // Enter on the newest slide, so `follow` keeps the deck on the one being written.
    controller.dispatch({ type: 'enter', mode: 'present', index: controller.getShape().count - 1 })
  }, [shown, controller])
  useEffect(
    () =>
      controller.subscribe(() => {
        // A deck with no slides for a moment (the front matter just closed) leaves present mode on its own; only the reader's exit ends the replay.
        if (entered.current && controller.getState().mode === 'stack' && controller.getShape().count > 0) stop()
        else if (controller.getShape().count === 0) entered.current = false
      }),
    [controller, stop],
  )
  useEffect(() => stop, [stop])

  return { shown, start, stop }
}
