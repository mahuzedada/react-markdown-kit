/**
 * The renderer's configuration for the demo. Plain data: `buildProps` turns
 * it into the props of the live `<Markdown>` and into the code shown in the
 * Code tab, so the two can never disagree.
 */
import { SAMPLE } from './samples'

export type PolicyMode = 'default' | 'textOnly' | 'noImages'
export type StylingMode = 'showcase' | 'none' | 'kit' | 'utility'
export type OutputTab = 'rendered' | 'html' | 'tree' | 'code'
export type FontChoice = 'sans' | 'serif' | 'mono'

export interface Overrides {
  readonly links: boolean
  readonly images: boolean
  readonly code: boolean
  readonly headings: boolean
}

export interface Theme {
  readonly link: string
  readonly measure: number
  readonly radius: number
  readonly font: FontChoice
}

export interface PlaygroundState {
  readonly source: string
  readonly gfm: boolean
  readonly diagrams: boolean
  readonly singleTilde: boolean
  readonly skipHtml: boolean
  readonly policy: PolicyMode
  readonly unwrapDisallowed: boolean
  readonly extraSchemes: boolean
  readonly overrides: Overrides
  readonly styling: StylingMode
  readonly theme: Theme
  readonly tab: OutputTab
}

export const DEFAULT_THEME: Theme = { link: '#0f6f6b', measure: 68, radius: 4, font: 'sans' }

export const DEFAULT_STATE: PlaygroundState = {
  source: SAMPLE.source,
  gfm: SAMPLE.gfm,
  diagrams: false,
  singleTilde: true,
  skipHtml: false,
  policy: 'default',
  unwrapDisallowed: true,
  extraSchemes: false,
  overrides: { links: false, images: false, code: false, headings: false },
  styling: 'showcase',
  theme: DEFAULT_THEME,
  tab: 'rendered',
}
