/**
 * The deck's UI strings, with defaults, overridable through the present
 * entry's `labels` option. `counter` is a function so a locale can put the
 * total first or spell the separator its own way.
 */
export interface SlidesLabels {
  /** The button in the stack that opens present mode */
  readonly present: string
  readonly previous: string
  readonly next: string
  /** Toggles the presenter view: next slide, notes and a clock */
  readonly presenter: string
  readonly fullscreen: string
  readonly exit: string
  /** The `<output>` between previous and next: "3 / 7" */
  readonly counter: (current: number, count: number) => string
  /** `aria-label` of the toolbar */
  readonly controls: string
  /** Caption of the next-slide preview in the presenter view */
  readonly preview: string
  /** Caption of the notes column in the presenter view */
  readonly notes: string
}

export const SLIDES_LABELS: SlidesLabels = {
  present: 'Present',
  previous: 'Previous slide',
  next: 'Next slide',
  presenter: 'Presenter view',
  fullscreen: 'Full screen',
  exit: 'Exit',
  counter: (current, count) => `${current} / ${count}`,
  controls: 'Slide controls',
  preview: 'Next slide',
  notes: 'Speaker notes',
}

export function resolveLabels(overrides: Partial<SlidesLabels> | undefined): SlidesLabels {
  return overrides === undefined ? SLIDES_LABELS : { ...SLIDES_LABELS, ...overrides }
}
