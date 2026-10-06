import type { SlideLayout } from '../deck/directive-keys/layout.js'

/** The canvas's UI strings, overridable through `labels`. */
export interface SlideCanvasLabels {
  /** `aria-label` of the whole canvas */
  readonly canvas: string
  readonly focus: string
  readonly exitFocus: string
  readonly done: string
  readonly moveEarlier: string
  readonly moveLater: string
  readonly dragBlock: string
  readonly blockActions: string
  readonly properties: string
  readonly closeProperties: string
  readonly slide: string
  readonly slideProperties: string
  readonly editBlock: string
  readonly revealSource: string
  readonly blockSource: string
  readonly sourceHint: string
  readonly sourceEditingHint: string
  readonly selectHint: string
  readonly blockHint: string
  readonly newText: string
  readonly sourceLine: (line: number) => string
  readonly blockKind: (kind: string) => string
  readonly untitled: string
  readonly markdown: string
  readonly history: string
  readonly undo: string
  readonly redo: string
  readonly layout: string
  readonly layoutName: (layout: SlideLayout) => string
  readonly previous: string
  readonly next: string
  readonly editing: string
  /** `aria-label` of the insert tools */
  readonly tools: string
  readonly heading: string
  readonly text: string
  readonly bold: string
  readonly italic: string
  readonly bulletList: string
  readonly numberedList: string
  readonly table: string
  readonly codeBlock: string
  readonly image: string
  readonly imageUrl: string
  readonly imageAlt: string
  readonly insert: string
  /** `aria-label` of the view controls */
  readonly view: string
  readonly present: string
  readonly zoom: string
  readonly fit: string
  readonly addSlide: string
  readonly duplicateSlide: string
  readonly deleteSlide: string
  readonly notes: string
  /** Shown in an empty notes field */
  readonly notesPlaceholder: string
  readonly strip: string
  readonly grid: string
  readonly collapse: string
  readonly expand: string
  /** `aria-label` of the slide list */
  readonly slides: string
  /** Shown on the stage when the deck has no slides */
  readonly empty: string
  /** The title a new slide starts with */
  readonly newSlide: string
  /** Tells a reader the slide can be edited in place */
  readonly editHint: string
  /** The `<output>` in the bottom bar: "3 / 7" */
  readonly counter: (current: number, count: number) => string
  /** The parser-notes button: "2 notes" */
  readonly problems: (count: number) => string
  /** Accessible name of a thumbnail */
  readonly thumbnail: (index: number, title: string | undefined) => string
}

export const SLIDE_CANVAS_LABELS: SlideCanvasLabels = {
  canvas: 'Slide editor',
  focus: 'Focus canvas',
  exitFocus: 'Exit focus',
  done: 'Done',
  moveEarlier: 'Move block earlier',
  moveLater: 'Move block later',
  dragBlock: 'Drag to move block',
  blockActions: 'Block actions',
  properties: 'Properties',
  closeProperties: 'Close properties',
  slide: 'Slide',
  slideProperties: 'Slide properties',
  editBlock: 'Edit block',
  revealSource: 'Reveal in source',
  blockSource: 'Block Markdown',
  sourceHint: 'Changes here replace only this block in your Markdown file.',
  sourceEditingHint: 'Finish editing on the slide to edit its Markdown here.',
  selectHint: 'Select a block on the slide to inspect its Markdown.',
  blockHint: 'Enter to edit · Alt + ↑ / ↓ to move · Esc to deselect',
  newText: 'New text',
  sourceLine: (line) => `Markdown · line ${line}`,
  blockKind: (kind) => ({ heading: 'Heading', paragraph: 'Text', list: 'List', table: 'Table', code: 'Code', diagram: 'Diagram', blockquote: 'Quote', thematicBreak: 'Divider' })[kind] ?? 'Block',
  untitled: 'Untitled presentation',
  markdown: 'Markdown presentation',
  history: 'Edit history',
  undo: 'Undo',
  redo: 'Redo',
  layout: 'Layout',
  layoutName: (layout) => ({ default: 'Standard', cover: 'Cover', section: 'Section', center: 'Centered', 'two-cols': 'Two columns', 'image-left': 'Image left', 'image-right': 'Image right', quote: 'Quote', fact: 'Big number' })[layout],
  previous: 'Previous slide',
  next: 'Next slide',
  editing: 'Editing slide · Esc to finish',
  tools: 'Insert',
  heading: 'Heading',
  text: 'Text',
  bold: 'Bold',
  italic: 'Italic',
  bulletList: 'Bulleted list',
  numberedList: 'Numbered list',
  table: 'Table',
  codeBlock: 'Code block',
  image: 'Image',
  imageUrl: 'Image address',
  imageAlt: 'Description',
  insert: 'Insert',
  view: 'View',
  present: 'Present',
  zoom: 'Zoom',
  fit: 'Fit',
  addSlide: 'Add slide',
  duplicateSlide: 'Duplicate slide',
  deleteSlide: 'Delete slide',
  notes: 'Speaker notes',
  notesPlaceholder: 'Speaker notes for this slide',
  strip: 'Filmstrip',
  grid: 'Grid',
  collapse: 'Hide slides',
  expand: 'Show slides',
  slides: 'Slides',
  empty: 'This deck has no slides yet.',
  newSlide: '## New slide',
  editHint: 'Click to select · Double-click to edit',
  counter: (current, count) => `${current} / ${count}`,
  problems: (count) => (count === 1 ? '1 note' : `${count} notes`),
  thumbnail: (index, title) => (title === undefined ? `Slide ${index}` : `Slide ${index}: ${title}`),
}
