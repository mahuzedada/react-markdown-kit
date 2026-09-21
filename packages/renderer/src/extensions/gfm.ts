/**
 * Native GFM extension: tables, task lists, strikethrough, autolinks and
 * footnotes. Equivalent to the documented `remark-gfm` route (spec 6.5); both
 * are fixture-tested to agree.
 */
import { gfmFromMarkdown, gfmToMarkdown } from 'mdast-util-gfm'
import { gfm as micromarkGfm } from 'micromark-extension-gfm'
import type { MarkdownExtension } from '@internal/extension-contracts/index.js'

export interface GfmOptions {
  /**
   * Whether a single tilde opens strikethrough. Default true, which is what
   * GitHub, cmark-gfm, micromark and `remark-gfm` all do: `~x~` is struck
   * through. Set false to require `~~x~~`. Defaulting this to false would make
   * the "GFM" extension disagree with GFM and with the `remark-gfm` route
   * (spec 6.5), so it is not the default.
   */
  readonly singleTilde?: boolean
}

export function gfm(options: GfmOptions = {}): MarkdownExtension {
  const singleTilde = options.singleTilde ?? true
  return {
    name: 'gfm',
    version: '1',
    contractVersion: 1,
    capabilities: {
      syntax: {
        micromarkExtensions: [micromarkGfm({ singleTilde })],
        fromMarkdownExtensions: [gfmFromMarkdown()],
        toMarkdownExtensions: [gfmToMarkdown({ tableCellPadding: true, tablePipeAlign: true })],
        nodeTypes: ['table', 'tableRow', 'tableCell', 'delete', 'footnoteDefinition', 'footnoteReference'],
      },
      template: {
        // A footnote definition's label is an identifier, not prose.
        literalNodeTypes: [],
      },
    },
  }
}
