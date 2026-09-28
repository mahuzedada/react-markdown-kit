/**
 * Where the deck is: which mode, which slide, how many fragments of it are
 * shown, and what is layered over it. Plain data; `reduce-deck.ts` is the
 * only thing that makes a new one.
 *
 * The bounds (slide count, fragments per slide) come from the rendered
 * sections and are passed with every action rather than stored, so a deck
 * whose Markdown changes under it stays consistent without a state reset.
 */
export type DeckMode = 'stack' | 'present' | 'presenter'

/** What covers the slide: the grid of every slide, the shortcut list, or a black screen. */
export type DeckOverlay = 'overview' | 'help' | 'blackout'

/** What the pointer does on the slide instead of navigating. */
export type DeckTool = 'draw' | 'laser'

export interface DeckState {
  readonly mode: DeckMode
  /** Zero-based slide index */
  readonly index: number
  /** Fragments of the current slide already revealed */
  readonly fragment: number
  readonly overlay?: DeckOverlay
  readonly tool?: DeckTool
  /** Which way the last slide change went; transitions read it. */
  readonly direction: 'forward' | 'backward'
}

export interface DeckShape {
  readonly count: number
  /** Fragment count per slide, same order as the sections */
  readonly fragments: readonly number[]
}

export type DeckAction =
  | { readonly type: 'enter'; readonly mode: 'present' | 'presenter'; readonly index?: number; readonly fragment?: number }
  | { readonly type: 'exit' }
  | { readonly type: 'toggle-presenter' }
  | { readonly type: 'next' }
  | { readonly type: 'previous' }
  | { readonly type: 'first' }
  | { readonly type: 'last' }
  | { readonly type: 'goto'; readonly index: number; readonly fragment?: number }
  /** Re-clamps after the sections changed */
  | { readonly type: 'clamp' }
  | { readonly type: 'toggle-overlay'; readonly overlay: DeckOverlay }
  /** Goes to a slide picked in the overview and closes it */
  | { readonly type: 'choose'; readonly index: number }
  | { readonly type: 'toggle-tool'; readonly tool: DeckTool }

export type DeckActionType = DeckAction['type']

export type ActionOf<Type extends DeckActionType> = Extract<DeckAction, { readonly type: Type }>

export type DeckReducer<Type extends DeckActionType> = (state: DeckState, action: ActionOf<Type>, shape: DeckShape) => DeckState

export const INITIAL_DECK_STATE: DeckState = { mode: 'stack', index: 0, fragment: 0, direction: 'forward' }
