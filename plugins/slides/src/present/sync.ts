/**
 * Two windows, one deck: with `sync: 'name'` every deck on that
 * `BroadcastChannel` follows the others, so a presenter window on the laptop
 * drives the present window on the projector. A window that opens asks where
 * the deck is; every other window answers with its position. Without
 * `BroadcastChannel` there is no channel and nothing to do.
 */
export interface SyncPosition {
  readonly index: number
  readonly fragment: number
}

export interface SyncChannel {
  post(position: SyncPosition): void
  close(): void
}

type SyncMessage = SyncPosition | { readonly ask: true }

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

export function openSync(
  name: string,
  onPosition: (position: SyncPosition) => void,
  currentPosition: () => SyncPosition,
): SyncChannel | undefined {
  if (typeof BroadcastChannel !== 'function') return undefined
  const channel = new BroadcastChannel(name)
  const send = (message: SyncMessage): void => {
    try {
      channel.postMessage(message)
    } catch {
      // A closed channel throws; the deck keeps working alone.
    }
  }
  channel.onmessage = (event: MessageEvent<unknown>) => {
    if (isPosition(event.data)) onPosition(event.data)
    else if (isAsk(event.data)) send(currentPosition())
  }
  send({ ask: true })
  return {
    post: send,
    close: () => {
      channel.onmessage = null
      channel.close()
    },
  }
}
