/**
 * `@react-markdown-kit/slides/editor` — `slides()` with the authoring half.
 *
 * The same extension as the `/present` entry (same `name`, so it replaces
 * the headless or present one in a preset) plus an `editor` capability:
 * three Lexical nodes (a labelled slide break that the stylesheet numbers,
 * a captioned `???` / `--` divider, a `<!-- key: value -->` chip that edits
 * inline), the block adapters that map the mdast nodes to them and back,
 * the insert commands, the Enter shortcut and the four toolbar buttons.
 * Preview mode renders through the renderer, so it is the interactive deck.
 * This entry loads React and Lexical.
 *
 * It also knows one more mdast node, `slideBreak`: what a break the author
 * inserted exports as until the next load (slide-break-mdast.ts explains
 * why it is not a `thematicBreak`). The syntax adapter writes it as its
 * spelling and the deck root folds it back into a `thematicBreak` before
 * reading the slides, so `getDocument()` still serializes and renders.
 */
import type { MarkdownRoot } from '@internal/document-contracts/index.js'
import type { MarkdownExtension, RendererAdapter, SyntaxAdapter } from '@internal/extension-contracts/index.js'
import { lexicalAdapter } from '@react-markdown-kit/editor/lexical'
import { slides as presentSlides, type SlidesPresentOptions } from './present.js'
import type { HastState } from './hast/deck-to-hast.js'
import { slideBreakAdapter, slideDirectiveAdapter, slideMarkerAdapter } from './editor/adapters.js'
import { SLIDES_EDITOR_LABELS, type SlidesEditorLabels } from './editor/options.js'
import { SLIDES_COMMANDS, createSlidesPlugin } from './editor/plugin.js'
import { SLIDE_BREAK_NODE, restoreSlideBreaks, slideBreakToMarkdown } from './editor/slide-break-mdast.js'
import { SlideBreakNode } from './editor/slide-break-node.js'
import { SlideDirectiveNode } from './editor/slide-directive-node.js'
import { SlideMarkerNode } from './editor/slide-marker-node.js'

export interface SlidesEditorOptions extends SlidesPresentOptions {
  /** Strings of the rich surface's slide nodes (divider captions, accessible names). */
  readonly editorLabels?: Partial<SlidesEditorLabels>
}

export function slides(options: SlidesEditorOptions = {}): MarkdownExtension {
  const present = presentSlides(options)
  const labels: SlidesEditorLabels = { ...SLIDES_EDITOR_LABELS, ...options.editorLabels }
  return {
    ...present,
    capabilities: {
      ...present.capabilities,
      syntax: withSlideBreak(present.capabilities?.syntax),
      ...withRestoredBreaks(present.capabilities?.renderer),
      editor: lexicalAdapter({
        nodes: [SlideBreakNode, SlideMarkerNode, SlideDirectiveNode],
        blocks: [slideBreakAdapter, slideMarkerAdapter, slideDirectiveAdapter],
        plugins: [createSlidesPlugin({ labels })],
        commands: SLIDES_COMMANDS,
      }),
    },
  }
}

/** The syntax adapter plus the fresh break: declared, and written as its spelling. */
function withSlideBreak(syntax: SyntaxAdapter | undefined): SyntaxAdapter {
  return {
    ...syntax,
    toMarkdownExtensions: [...(syntax?.toMarkdownExtensions ?? []), { handlers: { [SLIDE_BREAK_NODE]: slideBreakToMarkdown } }],
    nodeTypes: [...(syntax?.nodeTypes ?? []), SLIDE_BREAK_NODE],
  }
}

type RootHandler = (state: HastState, node: MarkdownRoot, parent: unknown) => unknown

/** The renderer adapter with fresh breaks folded back into `thematicBreak` before the deck root reads them. */
function withRestoredBreaks(renderer: RendererAdapter | undefined): { readonly renderer?: RendererAdapter } {
  const handlers = renderer?.handlers
  const root = handlers?.['root'] as RootHandler | undefined
  if (renderer === undefined || root === undefined) return renderer === undefined ? {} : { renderer }
  const restoringRoot: RootHandler = (state, node, parent) => root(state, restoreSlideBreaks(node), parent)
  return { renderer: { ...renderer, handlers: { ...handlers, root: restoringRoot } } }
}

export type { SlidesPresentOptions, SlidesOptions, SlidesLabels, DeckMode } from './present.js'
export { SLIDES_LABELS } from './present.js'
export { SLIDE_MARKER_NODE, isSlideMarkerNode } from './deck/markers.js'
export type { SlideMarkerNode as SlideMarkerMdastNode, MarkerKind } from './deck/markers.js'
export { SLIDE_DIRECTIVE_NODE, isSlideDirectiveNode } from './deck/directives.js'
export type { SlideDirectiveNode as SlideDirectiveMdastNode, DirectiveKey } from './deck/directives.js'
export { SLIDES_DIAGNOSTIC_CODES } from './deck/diagnostics.js'
export type { SlidesDiagnosticCode } from './deck/diagnostics.js'
export type { DeckModel, SlideModel, SlideAspect } from './deck/model.js'
export type { BreakKind } from './deck/breaks.js'

export { INSERT_SLIDE_COMMAND, INSERT_SLIDE_DIRECTIVE_COMMAND, INSERT_SLIDE_MARKER_COMMAND } from './editor/commands.js'
export { SLIDES_COMMANDS } from './editor/plugin.js'
export { SLIDES_EDITOR_LABELS, SLIDES_EDITOR_LABEL_PREFIX } from './editor/options.js'
export type { SlidesEditorLabels } from './editor/options.js'
export { SlideBreakNode, $isSlideBreakNode, $createSlideBreakNode } from './editor/slide-break-node.js'
export { SLIDE_BREAK_NODE, isSlideBreakMdastNode } from './editor/slide-break-mdast.js'
export type { SlideBreakMdastNode } from './editor/slide-break-mdast.js'
export { SlideMarkerNode, $isSlideMarkerNode, $createSlideMarkerNode } from './editor/slide-marker-node.js'
export { SlideDirectiveNode, $isSlideDirectiveNode, $createSlideDirectiveNode } from './editor/slide-directive-node.js'
