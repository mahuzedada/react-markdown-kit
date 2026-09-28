/**
 * Two windows, one deck: every deck on the same transport follows the
 * others, so a presenter window on the laptop drives the present window on
 * the projector. A deck that opens asks where the deck is; every other deck
 * answers with its position.
 *
 * `sync: 'name'` uses a `BroadcastChannel` of that name (same browser,
 * same origin). Any other reach (a WebSocket, a WebRTC channel, a relay
 * for audience phones) is a `SyncTransport` passed as `sync`: something
 * that posts a message and calls back with the ones it receives.
 */
export interface SyncPosition {
  readonly index: number
  readonly fragment: number
}

export interface SyncTransport {
  /** Sends to every other deck; may throw once closed. */
  post(message: unknown): void
  /** Calls `onMessage` with each message from another deck; returns the unsubscribe. */
  subscribe(onMessage: (message: unknown) => void): () => void
}

export interface SyncChannel {
  post(position: SyncPosition): void
  close(): void
}

function isPosition(data: unknown): data is SyncPosition {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as SyncPosition).index === 'number' &&
    typeof (data as SyncPosition).fragment === 'number'
  )
}

function isAsk(data: unknown): boolean {
  return typeof data === 'object' && data !== null && (data as { ask?: unknown }).ask === true
}

export interface ClosableTransport extends SyncTransport {
  /** Closes the channel; later posts are dropped. */
  close(): void
}

/**
 * A transport over a `BroadcastChannel`; undefined where the browser has
 * none. Any number of subscribers may come and go (StrictMode subscribes
 * twice); only `close` ends the channel, and a deck given a name closes the
 * one it opened when it unmounts.
 */
export function broadcastTransport(name: string): ClosableTransport | undefined {
  if (typeof BroadcastChannel !== 'function') return undefined
  const channel = new BroadcastChannel(name)
  const listeners = new Set<(message: unknown) => void>()
  channel.onmessage = (event: MessageEvent<unknown>) => {
    for (const listener of [...listeners]) listener(event.data)
  }
  return {
    post: (message) => channel.postMessage(message),
    subscribe: (onMessage) => {
      listeners.add(onMessage)
      return () => {
        listeners.delete(onMessage)
      }
    },
    close: () => {
      listeners.clear()
      channel.onmessage = null
      channel.close()
    },
  }
}

export function openSync(
  transport: SyncTransport,
  onPosition: (position: SyncPosition) => void,
  currentPosition: () => SyncPosition,
): SyncChannel {
  const send = (message: SyncPosition | { readonly ask: true }): void => {
    try {
      transport.post(message)
    } catch {
      // A closed transport throws; the deck keeps working alone.
    }
  }
  const unsubscribe = transport.subscribe((data) => {
    if (isPosition(data)) onPosition({ index: data.index, fragment: data.fragment })
    else if (isAsk(data)) send(currentPosition())
  })
  send({ ask: true })
  return { post: send, close: unsubscribe }
}
