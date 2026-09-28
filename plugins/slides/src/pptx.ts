/**
 * `@react-markdown-kit/slides/pptx` — a deck as a PowerPoint file.
 *
 * `deckToPptx(compileMarkdown(source, { preset }))` resolves to a .pptx:
 * one slide per deck slide, the first heading as its title, lists, code,
 * tables and pictures in the body, columns and image layouts kept, and the
 * speaker notes as PowerPoint notes. Needs `pptxgenjs` installed; it is
 * loaded on the first call. No React.
 */
export { deckToPptx } from './pptx/deck-to-pptx.js'
export type { CompiledDeck, DeckToPptxOptions, PptxOutput, PptxOutputs } from './pptx/deck-to-pptx.js'
export { defaultResolveUrl } from './pptx/export-context.js'
export type { ResolvePptxUrl } from './pptx/export-context.js'
export { DEFAULT_PPTX_THEME } from './pptx/theme.js'
export type { PptxTheme } from './pptx/theme.js'
