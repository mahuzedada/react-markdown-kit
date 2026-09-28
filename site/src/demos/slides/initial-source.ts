/** Where the deck on screen comes from at load: `?d=` first, then what this browser saved last time, then the sample. */
import { SAMPLE_DECK } from './sample-deck'
import { decodeSource, readSourceParam, readStoredSource } from './url-state'

export interface InitialSource {
  readonly source: string
  readonly notice?: string
  /** The deck came from this browser's storage, not the link or the sample. */
  readonly fromStorage: boolean
}

export async function loadInitialSource(): Promise<InitialSource> {
  const param = readSourceParam(location.search)
  const stored = readStoredSource()
  const fromStorage = stored !== undefined && stored !== SAMPLE_DECK
  if (param === null) return { source: stored ?? SAMPLE_DECK, fromStorage }
  const decoded = await decodeSource(param)
  if (decoded !== undefined) return { source: decoded, fromStorage: false }
  return {
    source: stored ?? SAMPLE_DECK,
    fromStorage,
    notice: fromStorage
      ? 'This browser couldn’t read the deck in the link (compressed links need the streams API), so you’re seeing the last deck you edited.'
      : 'This browser couldn’t read the deck in the link (compressed links need the streams API), so you’re seeing the sample deck.',
  }
}
