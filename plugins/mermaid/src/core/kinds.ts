/**
 * The kind registry (docs/MERMAID_PLATFORM.md section 4.2).
 *
 * `mermaid({ kinds })` takes an ordered list; detection order is registry
 * order. The default list is what the package ships. A list where two kinds
 * claim the same name or keyword cannot detect anything reliably, so it is a
 * configuration error thrown at setup, never a diagnostic on a document.
 */
import { MarkdownConfigurationError } from '@internal/diagnostics/index.js'
import { flowchart } from './flowchart-kind.js'
import type { DiagramKind } from './kind.js'
import { sequenceDiagram } from './sequence/index.js'

export function defaultKinds(): readonly DiagramKind[] {
  return [flowchart(), sequenceDiagram()]
}

/** Throws `DIAGRAM_KINDS_INVALID` when two kinds share a name or a keyword. */
export function validateKinds(kinds: readonly DiagramKind[]): void {
  const names = new Map<string, DiagramKind>()
  const keywords = new Map<string, DiagramKind>()
  for (const kind of kinds) {
    const sameName = names.get(kind.name)
    if (sameName !== undefined) {
      throw new MarkdownConfigurationError('DIAGRAM_KINDS_INVALID', `Two diagram kinds are named "${kind.name}".`)
    }
    names.set(kind.name, kind)
    for (const keyword of kind.keywords) {
      const owner = keywords.get(keyword)
      if (owner !== undefined) {
        throw new MarkdownConfigurationError(
          'DIAGRAM_KINDS_INVALID',
          `Diagram kinds "${owner.name}" and "${kind.name}" both claim keyword "${keyword}".`,
        )
      }
      keywords.set(keyword, kind)
    }
  }
}
