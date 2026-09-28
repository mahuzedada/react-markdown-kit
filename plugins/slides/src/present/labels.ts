/**
 * The deck's UI strings, with defaults, overridable through the present
 * entry's `labels` option. The functions let a locale order the numbers
 * its own way.
 */
export interface SlidesLabels {
  /** The button in the stack that opens present mode */
  readonly present: string
  readonly previous: string
  readonly next: string
  readonly first: string
  readonly last: string
  /** Toggles the presenter view: next step, notes, timer and clock */
  readonly presenter: string
  readonly fullscreen: string
  readonly exit: string
  readonly overview: string
  /** Toggles the keyboard shortcut list */
  readonly help: string
  readonly blackout: string
  readonly draw: string
  readonly laser: string
  readonly clearDrawing: string
  readonly resetTimer: string
  /** Opens another window of the same deck, kept on the same slide */
  readonly clone: string
  readonly notesLarger: string
  readonly notesSmaller: string
  /** The `<output>` between previous and next: "3 / 7" */
  readonly counter: (current: number, count: number) => string
  /** `aria-label` of the toolbar */
  readonly controls: string
  /** Caption of the next-step preview in the presenter view */
  readonly preview: string
  /** Caption of the notes column in the presenter view */
  readonly notes: string
  /** Shown in the notes column when the slide has none */
  readonly noNotes: string
  /** Shown in the preview when the deck is at its last step */
  readonly endOfDeck: string
  /** The presenter's elapsed time */
  readonly elapsed: string
  /** Heading of the shortcut list */
  readonly shortcuts: string
  /** The jump typed so far: "Go to 12" */
  readonly goto: (typed: string) => string
  /** Help text for typing a number then Enter */
  readonly gotoHelp: string
  /** What a screen reader hears on each slide change */
  readonly announce: (current: number, count: number, title: string | undefined) => string
}

export const SLIDES_LABELS: SlidesLabels = {
  present: 'Present',
  previous: 'Previous slide',
  next: 'Next slide',
  first: 'First slide',
  last: 'Last slide',
  presenter: 'Presenter view',
  fullscreen: 'Full screen',
  exit: 'Exit',
  overview: 'Overview',
  help: 'Keyboard shortcuts',
  blackout: 'Black screen',
  draw: 'Draw on the slide',
  laser: 'Laser pointer',
  clearDrawing: 'Clear drawing',
  resetTimer: 'Reset timer',
  clone: 'Open a synced window',
  notesLarger: 'Larger notes',
  notesSmaller: 'Smaller notes',
  counter: (current, count) => `${current} / ${count}`,
  controls: 'Slide controls',
  preview: 'Next',
  notes: 'Speaker notes',
  noNotes: 'No notes for this slide.',
  endOfDeck: 'End of the deck',
  elapsed: 'Elapsed',
  shortcuts: 'Keyboard shortcuts',
  goto: (typed) => `Go to ${typed}`,
  gotoHelp: 'Go to slide: type its number, then Enter',
  announce: (current, count, title) => (title === undefined ? `Slide ${current} of ${count}` : `Slide ${current} of ${count}: ${title}`),
}

export function resolveLabels(overrides: Partial<SlidesLabels> | undefined): SlidesLabels {
  return overrides === undefined ? SLIDES_LABELS : { ...SLIDES_LABELS, ...overrides }
}
