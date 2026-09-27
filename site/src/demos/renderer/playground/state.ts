/** What the reader changes: the document, and which view of the output is open. */
import { SAMPLE } from './samples'

export type OutputTab = 'rendered' | 'html' | 'tree' | 'code'

export interface PlaygroundState {
  readonly source: string
  readonly tab: OutputTab
}

export const DEFAULT_STATE: PlaygroundState = { source: SAMPLE, tab: 'rendered' }
