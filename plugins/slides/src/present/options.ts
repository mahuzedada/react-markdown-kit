/**
 * Options of the `/present` entry: the headless options plus what the
 * interactive deck needs. Resolved once, when `slides()` is called, so the
 * deck component never re-reads defaults.
 */
import type { SlidesOptions } from '../extension.js'
import type { SlidesLabels } from './labels.js'
import type { DeckMode } from './use-deck-state.js'

export interface SlidesPresentOptions extends SlidesOptions {
  /** Read `#3` / `#name` on mount and write `#3` while presenting. Default false. */
  readonly hashRouting?: boolean
  /** Open in present or presenter mode as soon as the deck mounts. Default `stack`. */
  readonly initialMode?: DeckMode
  /** Render the control bar (Present, previous, next, ...). Default true. */
  readonly controls?: boolean
  /** Name of a BroadcastChannel that keeps every deck on it at the same slide. Default false. */
  readonly sync?: string | false
  readonly labels?: Partial<SlidesLabels>
  /** Called with the zero-based index whenever the current slide changes. */
  readonly onSlideChange?: (index: number) => void
}

export interface ResolvedPresentOptions {
  readonly hashRouting: boolean
  readonly initialMode: DeckMode
  readonly controls: boolean
  readonly sync: string | false
  readonly labels: Partial<SlidesLabels> | undefined
  readonly onSlideChange: ((index: number) => void) | undefined
}

export function resolvePresentOptions(options: SlidesPresentOptions): ResolvedPresentOptions {
  return {
    hashRouting: options.hashRouting ?? false,
    initialMode: options.initialMode ?? 'stack',
    controls: options.controls ?? true,
    sync: options.sync ?? false,
    labels: options.labels,
    onSlideChange: options.onSlideChange,
  }
}
