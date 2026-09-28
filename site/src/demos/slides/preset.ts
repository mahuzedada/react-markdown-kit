/**
 * One preset for the deck pane: GFM, the Mermaid plugin (diagrams render
 * inside slides) and the `/present` entry's `slides()`. The page drives the
 * deck through `controller` (the header's Present button, the stream
 * replay), and every window of the demo shares one BroadcastChannel so the
 * presenter window drives the audience window. `?view=present` and
 * `?view=presenter` open straight into that mode with deep links on.
 */
import { defineMarkdownPreset, gfm, type MarkdownPreset } from '@react-markdown-kit/renderer'
import { mermaid } from '@react-markdown-kit/mermaid'
import { createDeckController, slides, type DeckController } from '@react-markdown-kit/slides/present'
import type { DemoView } from './url-state'

export const SYNC_CHANNEL = 'rmk-slides-demo'

export interface DeckSetup {
  readonly preset: MarkdownPreset
  readonly controller: DeckController
}

export function createDeckSetup(view: DemoView): DeckSetup {
  const controller = createDeckController()
  const presenting = view !== 'edit'
  const preset = defineMarkdownPreset({
    extensions: [
      gfm(),
      mermaid(),
      slides({
        controller,
        sync: SYNC_CHANNEL,
        hashRouting: presenting,
        initialMode: view === 'edit' ? 'stack' : view,
        follow: true,
      }),
    ],
  })
  return { preset, controller }
}
