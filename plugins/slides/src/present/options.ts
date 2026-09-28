/**
 * Options of the `/present` entry: the headless options plus what the
 * interactive deck needs. Resolved once, when `slides()` is called, so the
 * deck component never re-reads defaults.
 */
import type { ComponentType } from 'react'
import type { SlidesOptions } from '../extension.js'
import type { DeckControlsProps } from './controls.js'
import type { SlidesLabels } from './labels.js'
import type { DeckController } from './state/controller.js'
import type { DeckMode } from './state/deck-state.js'
import type { SyncTransport } from './sync.js'

export interface SlidesPresentOptions extends SlidesOptions {
  /** Read `#3`, `#3.2` or `#name` on mount and write `#3` / `#3.2` while presenting. Default false. */
  readonly hashRouting?: boolean
  /** Open in present or presenter mode as soon as the deck mounts. Default `stack`. */
  readonly initialMode?: DeckMode
  /** The control bar: `true` for the built-in one, `false` for none, or your own component. Default true. */
  readonly controls?: boolean | ComponentType<DeckControlsProps>
  /** A BroadcastChannel name, or any transport, that keeps every deck on it at the same step. Default false. */
  readonly sync?: string | SyncTransport | false
  readonly labels?: Partial<SlidesLabels>
  /** Called with the zero-based index whenever the current slide changes. */
  readonly onSlideChange?: (index: number) => void
  /** Drive and read the deck from outside: `createDeckController()`. One deck per controller. */
  readonly controller?: DeckController
  /** While presenting the last slide, jump to the newest slide when more are appended (a deck streaming in). Default false. */
  readonly follow?: boolean
  /** Print every reveal step of a slide as its own page, not only the finished slide. Default false. */
  readonly printSteps?: boolean
  /** Where the `c` key's synced window opens. Default: this page's URL. Needs `sync`. */
  readonly cloneUrl?: string | ((index: number) => string)
}

export interface ResolvedPresentOptions {
  readonly hashRouting: boolean
  readonly initialMode: DeckMode
  readonly controls: boolean | ComponentType<DeckControlsProps>
  readonly sync: string | SyncTransport | false
  readonly labels: Partial<SlidesLabels> | undefined
  readonly onSlideChange: ((index: number) => void) | undefined
  readonly controller: DeckController | undefined
  readonly follow: boolean
  readonly printSteps: boolean
  readonly cloneUrl: string | ((index: number) => string) | undefined
}

export function resolvePresentOptions(options: SlidesPresentOptions): ResolvedPresentOptions {
  return {
    hashRouting: options.hashRouting ?? false,
    initialMode: options.initialMode ?? 'stack',
    controls: options.controls ?? true,
    sync: options.sync ?? false,
    labels: options.labels,
    onSlideChange: options.onSlideChange,
    controller: options.controller,
    follow: options.follow ?? false,
    printSteps: options.printSteps ?? false,
    cloneUrl: options.cloneUrl,
  }
}
