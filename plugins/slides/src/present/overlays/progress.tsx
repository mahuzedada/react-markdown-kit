/** A thin bar along the bottom edge: how far through the deck the talk is. Decorative; the counter says it in words. */
import type { ReactElement } from 'react'

export function Progress({ current, count }: { readonly current: number; readonly count: number }): ReactElement {
  const ratio = count <= 1 ? 1 : current / (count - 1)
  return <div data-rmk-deck-progress="" aria-hidden="true" style={{ '--rmk-deck-progress': String(ratio) } as Record<string, string>} />
}
