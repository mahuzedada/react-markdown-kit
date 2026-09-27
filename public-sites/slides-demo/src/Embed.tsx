import { useEffect, useState, type ReactNode } from 'react'
import { Markdown, defineMarkdownPreset, gfm, type MarkdownPreset } from '@react-markdown-kit/renderer'
import { slides } from '@react-markdown-kit/slides/present'
import { SAMPLE_DECK } from './sample-deck'
import { decodeSource, fullDemoLink, readSourceParam } from './url-state'

import '@react-markdown-kit/renderer/styles.css'
import '@react-markdown-kit/slides/styles.css'

/**
 * `?embed=1`: the deck alone, for an iframe in a blog post or a docs page.
 * Nothing else is on the page, so the deck is exactly as large as the frame
 * the host gave it.
 *
 * This is the `/present` entry, not the `/editor` one, so the chunk carries
 * the renderer and the deck and no editor. The deck opens in present mode:
 * its keys and its clicks are bound to the article element, so they work
 * inside the frame as soon as the frame has the focus. There is no
 * BroadcastChannel and no hash routing here; an embedded deck must not move
 * another window's deck or write to an address bar it does not own.
 */
const PRESET: MarkdownPreset = defineMarkdownPreset({
  extensions: [gfm(), slides({ initialMode: 'present' })],
})

/** The deck in `?d=`, or the sample when the link holds none or cannot be read here. */
async function loadSource(): Promise<string> {
  const param = readSourceParam(location.search)
  if (param === null) return SAMPLE_DECK
  return (await decodeSource(param)) ?? SAMPLE_DECK
}

export default function Embed(): ReactNode {
  const [source, setSource] = useState<string | undefined>(undefined)
  const [link] = useState(() => fullDemoLink())

  useEffect(() => {
    let cancelled = false
    void loadSource().then((loaded) => {
      if (!cancelled) setSource(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-background">
      {source === undefined ? (
        <div className="min-h-0 flex-1 overflow-auto" aria-busy="true" />
      ) : (
        <div className="rmk-document min-h-0 flex-1 overflow-auto">
          <Markdown preset={PRESET}>{source}</Markdown>
        </div>
      )}
      {/* Above the deck, which is z-index 1000 while it presents, and in the corner away from its control bar. */}
      <a
        className="fixed top-2 right-2 z-1001 rounded-(--radius) border border-border bg-card/88 px-2 py-[0.2rem] text-xs text-foreground no-underline opacity-75 hover:bg-card hover:opacity-100 focus-visible:bg-card focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        data-zui-tag="embed:open-full-demo"
      >
        Open in React Markdown Kit
      </a>
    </div>
  )
}
