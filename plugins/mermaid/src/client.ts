/**
 * `@react-markdown-kit/mermaid/client` — the host fallback (spec 6.1).
 *
 * `mermaid()` renders the kinds it knows as static SVG and shows every
 * other ```mermaid fence as source. `diagramFallback({ render })` is how a
 * host fills that gap: it registers one renderer component, the <figure>,
 * that passes a static diagram through unchanged and, for a fence shown as
 * source, asks the host's `render` for SVG after mount and swaps it in. The
 * host decides how the SVG is made (Mermaid.js, Kroki, a server); this
 * package never depends on Mermaid.js. List it after `mermaid()`. This entry
 * loads React and is built with the `'use client'` banner.
 */
import type { MarkdownExtension } from '@internal/extension-contracts/index.js'
import { createDiagramFigure, type DiagramFallbackOptions } from './client/diagram-fallback.js'

export function diagramFallback(options: DiagramFallbackOptions): MarkdownExtension {
  return {
    name: 'mermaid-fallback',
    version: '1',
    contractVersion: 1,
    capabilities: { renderer: { components: { figure: createDiagramFigure(options) } } },
  }
}

export type { DiagramFallbackOptions } from './client/diagram-fallback.js'
