/**
 * What a canvas component needs from whatever mounts it (docs/MERMAID_PLATFORM.md
 * section 9.7): the block options, the UI strings, the scope its tool row
 * slot is keyed on, and the three things only the host can do (report
 * focus, undo, name the chrome it sits in). The editor's block provides one
 * built from the `LexicalEditor`; the standalone `<MermaidCanvas>` provides
 * one of its own. A canvas never imports Lexical or the editor package, so
 * the `/canvas` entry loads neither.
 */
import { createContext, useContext, type ReactElement, type ReactNode } from 'react'
import { DIAGRAM_LABELS, type DiagramLabels } from './labels.js'
import { DEFAULT_CANVAS_OPTIONS, type DiagramCanvasOptions } from './options.js'

/**
 * `block`: the canvas is one block in a document, with its width presets.
 * `app`: the canvas is the page (the standalone component), so a block's
 * width has no meaning and its tools float over the surface.
 */
export type DiagramCanvasChrome = 'block' | 'app'

export interface DiagramCanvasHost {
  /** Keys the tool row slot: the `LexicalEditor` in a document, the component instance standalone. */
  readonly scope: object
  readonly options: DiagramCanvasOptions
  readonly labels: DiagramLabels
  readonly chrome: DiagramCanvasChrome
  /** How the tool row runs: along the top of a block, or down a floating island. */
  readonly toolbarOrientation: 'horizontal' | 'vertical'
  /** The canvas `id` gained focus, or (`null`) the focused one lost it. */
  readonly onFocusChange: (id: string | null) => void
  /** Takes back the last committed change, the way the host's undo would. */
  readonly undo: () => void
}

const FALLBACK: DiagramCanvasHost = {
  scope: {},
  options: DEFAULT_CANVAS_OPTIONS,
  labels: DIAGRAM_LABELS,
  chrome: 'block',
  toolbarOrientation: 'horizontal',
  onFocusChange: () => undefined,
  undo: () => undefined,
}

const HostContext = createContext<DiagramCanvasHost>(FALLBACK)

export function DiagramCanvasHostProvider({ host, children }: { host: DiagramCanvasHost; children: ReactNode }): ReactElement {
  return <HostContext.Provider value={host}>{children}</HostContext.Provider>
}

export function useCanvasHost(): DiagramCanvasHost {
  return useContext(HostContext)
}

/** The UI strings of the host the canvas is mounted in. */
export function useDiagramLabels(): DiagramLabels {
  return useContext(HostContext).labels
}
