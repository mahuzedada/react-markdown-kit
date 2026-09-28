/**
 * Sync: follow the transport, and tell it about moves that did not come
 * from it. `synced` is the last position the transport and this deck
 * agreed on (posted or received); a render that lands there is an echo,
 * any other is a local move. It starts at the mount position, so mounting
 * posts nothing, however many times an effect runs.
 */
import { useEffect, useRef } from 'react'
import type { DeckController } from '../state/controller.js'
import { INITIAL_DECK_STATE, type DeckState } from '../state/deck-state.js'
import { broadcastTransport, openSync, type SyncChannel, type SyncPosition, type SyncTransport } from '../sync.js'


export function useDeckSync(sync: string | SyncTransport | false, controller: DeckController, state: DeckState): void {
  const channel = useRef<SyncChannel | undefined>(undefined)
  const synced = useRef<SyncPosition>({ index: INITIAL_DECK_STATE.index, fragment: INITIAL_DECK_STATE.fragment })

  useEffect(() => {
    if (sync === false) return
    // A name opens a channel this deck owns and closes; a transport passed in belongs to the caller.
    const owned = typeof sync === 'string' ? broadcastTransport(sync) : undefined
    const transport = typeof sync === 'string' ? owned : sync
    if (transport === undefined) return
    channel.current = openSync(
      transport,
      (incoming) => {
        synced.current = incoming
        controller.dispatch({ type: 'goto', ...incoming })
      },
      () => ({ index: controller.getState().index, fragment: controller.getState().fragment }),
    )
    return () => {
      channel.current?.close()
      channel.current = undefined
      owned?.close()
    }
  }, [sync, controller])

  useEffect(() => {
    if (synced.current.index === state.index && synced.current.fragment === state.fragment) return
    synced.current = { index: state.index, fragment: state.fragment }
    channel.current?.post(synced.current)
  }, [state.index, state.fragment])
}
