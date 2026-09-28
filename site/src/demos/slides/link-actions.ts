/** The two header actions that leave the page through a link: Share and the presenter window. */
import { linkFor } from './url-state'

const PRESENTER_WINDOW = 'rmk-slides-presenter'

export async function shareDeck(encoded: Promise<string>, report: (status: string) => void): Promise<void> {
  const link = linkFor(await encoded, 'present')
  try {
    await navigator.clipboard.writeText(link)
    report('Link copied. It opens this deck in present mode.')
  } catch {
    report('Couldn’t copy the link. The deck is in the address bar, and you can add &view=present to open it in present mode.')
  }
}

export async function openPresenterWindow(encoded: () => Promise<string>, report: (status: string) => void): Promise<void> {
  // Open first, navigate after encoding: a window opened after an await is popup-blocked.
  const popup = window.open('', PRESENTER_WINDOW)
  if (popup === null) {
    report('The browser blocked the presenter window.')
    return
  }
  popup.location.href = linkFor(await encoded(), 'presenter')
  report('Presenter window is open. Press Present here, or open the share link on the projector, and the two windows will stay on the same slide.')
}
