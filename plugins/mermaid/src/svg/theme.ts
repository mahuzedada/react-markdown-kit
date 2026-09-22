/**
 * Theme tokens for kinds without payload colours (docs/MERMAID_PLATFORM.md
 * section 7). This is the only place the tokens are declared. They are named
 * by role, never by kind, so a new kind reuses roles before adding one.
 * Every fallback is a six-digit hex colour from Mermaid's default theme, so
 * an unstyled document looks like Mermaid and an export can inline it.
 * Renderers write `fill="var(--rmk-diagram-note-fill, #fff5ad)"` through
 * `token`; `styles.css` declares no colour for these, the host maps them.
 */
export const DIAGRAM_TOKEN_PREFIX = '--rmk-diagram-'

export interface DiagramThemeEntry {
  /** The Mermaid theme variable the token stands in for. */
  readonly mermaid: string
  /** Six-digit hex colour from Mermaid's default theme. */
  readonly fallback: string
}

export const DIAGRAM_THEME = {
  'actor-fill': { mermaid: 'actorBkg', fallback: '#ececff' },
  'actor-stroke': { mermaid: 'actorBorder', fallback: '#9370db' },
  'actor-text': { mermaid: 'actorTextColor', fallback: '#333333' },
  line: { mermaid: 'actorLineColor', fallback: '#9370db' },
  signal: { mermaid: 'signalColor', fallback: '#333333' },
  'signal-text': { mermaid: 'signalTextColor', fallback: '#333333' },
  'label-fill': { mermaid: 'labelBoxBkgColor', fallback: '#ececff' },
  'label-stroke': { mermaid: 'labelBoxBorderColor', fallback: '#9370db' },
  'label-text': { mermaid: 'labelTextColor', fallback: '#333333' },
  'note-fill': { mermaid: 'noteBkgColor', fallback: '#fff5ad' },
  'note-stroke': { mermaid: 'noteBorderColor', fallback: '#aaaa33' },
  'note-text': { mermaid: 'noteTextColor', fallback: '#333333' },
  'activation-fill': { mermaid: 'activationBkgColor', fallback: '#f4f4f4' },
  'activation-stroke': { mermaid: 'activationBorderColor', fallback: '#666666' },
  'number-text': { mermaid: 'sequenceNumberColor', fallback: '#ffffff' },
} as const satisfies Readonly<Record<string, DiagramThemeEntry>>

export type DiagramThemeToken = keyof typeof DIAGRAM_THEME

/** The custom property name of a token: `--rmk-diagram-note-fill`. */
export function tokenProperty(name: DiagramThemeToken): string {
  return `${DIAGRAM_TOKEN_PREFIX}${name}`
}

/** The attribute value for a token: `var(--rmk-diagram-note-fill, #fff5ad)`. */
export function token(name: DiagramThemeToken): string {
  return `var(${tokenProperty(name)}, ${DIAGRAM_THEME[name].fallback})`
}
