/**
 * `slides()` — the headless extension.
 *
 * One object, four capabilities, no React and no Lexical:
 *
 *   syntax    after parsing, front matter found at byte 0 of the source
 *             becomes a `yaml` node, `<!-- key: value -->` comments become
 *             `slideDirective` nodes and `???` / `--` paragraphs become
 *             `slideMarker` nodes, every one of which serializes back to
 *             its spelling. No micromark construct: the front-matter one
 *             breaks the parse of a deck that opens with a bare `---`;
 *   renderer  the root handler groups the flat tree into <section>s inside
 *             one <article data-rmk-deck>, and the re-typed nodes render as
 *             nothing;
 *   template  markers and directives are literal, so `{{...}}` inside a
 *             directive argument is never data;
 *   editor    absent here. `@react-markdown-kit/slides/editor` adds it, and
 *             `/present` adds the interactive deck; only those load React.
 *
 * DIALECT.md is the dialect this reads and writes.
 */
import { frontmatterToMarkdown } from 'mdast-util-frontmatter'
import type { MarkdownRoot } from '@internal/document-contracts/index.js'
import type { MarkdownExtension } from '@internal/extension-contracts/index.js'
import { SLIDE_DIRECTIVE_NODE } from './deck/directives.js'
import { SLIDE_MARKER_NODE } from './deck/markers.js'
import type { SlideAspect } from './deck/model.js'
import { transformDeck } from './transform.js'
import { joinDirectives, slideDirectiveToMarkdown, slideMarkerToMarkdown, thematicBreakToMarkdown } from './markdown/to-markdown.js'
import { deckRoot, type HastState } from './hast/deck-to-hast.js'

export interface SlidesOptions {
  /** Aspect ratio for decks whose front matter sets none. Default `16:9`. */
  readonly aspect?: SlideAspect
  /** Emit speaker notes as a hidden <aside>. Default true; false omits them. */
  readonly notes?: boolean
  /** Read `---` front matter at the top of the deck. Default true. */
  readonly frontMatter?: boolean
  /** Accessible name prefix for a slide with no heading: "Slide 3". Default "Slide". */
  readonly slideLabel?: string
}

export function slides(options: SlidesOptions = {}): MarkdownExtension {
  const aspect = options.aspect ?? '16:9'
  const notes = options.notes ?? true
  const frontMatter = options.frontMatter ?? true
  const slideLabel = options.slideLabel ?? 'Slide'
  const render = { aspect, notes, slideLabel }
  return {
    name: 'slides',
    version: '1',
    contractVersion: 1,
    capabilities: {
      syntax: {
        toMarkdownExtensions: [
          frontmatterToMarkdown(['yaml']),
          {
            handlers: {
              [SLIDE_MARKER_NODE]: slideMarkerToMarkdown,
              [SLIDE_DIRECTIVE_NODE]: slideDirectiveToMarkdown,
              thematicBreak: thematicBreakToMarkdown,
            },
            join: [joinDirectives],
          },
        ],
        nodeTypes: [SLIDE_MARKER_NODE, SLIDE_DIRECTIVE_NODE],
        transform: (tree, context) => transformDeck(tree, context, { frontMatter }),
      },
      renderer: {
        handlers: {
          root: (state: HastState, node: MarkdownRoot) => deckRoot(state, node, render),
          [SLIDE_MARKER_NODE]: (): undefined => undefined,
          [SLIDE_DIRECTIVE_NODE]: (): undefined => undefined,
          yaml: (): undefined => undefined,
        },
      },
      template: { literalNodeTypes: [SLIDE_MARKER_NODE, SLIDE_DIRECTIVE_NODE] },
    },
  }
}
