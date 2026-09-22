/**
 * The built-in `flowchart` kind (docs/MERMAID_PLATFORM.md section 4.3).
 *
 * Wraps the tolerant flowchart parser, the static renderer and the writer
 * in the `DiagramKind` contract. The model is `DrawingData`, so the canvas
 * edits it directly. The parser reports what it read through as `retained`
 * lines and what an edit would flatten as `lossy`; the writer re-emits the
 * retained lines and always ends with exactly one layout annotation.
 */
import type { DrawingData } from './drawing-data.js'
import type { DiagramKind, DiagramParse, DiagramParseError } from './kind.js'
import { drawingToMermaid } from './mermaid.js'
import { parseMermaidFlowchart } from './mermaid-parse.js'
import { renderDrawingSvg } from '../svg/render.js'

/** Three boxes joined by a path, 24x24. */
const FLOWCHART_ICON =
  'M3 4h6v5H3zM15 4h6v5h-6zM9 15h6v5H9zM6 9v3h12V9M12 12v3'

const STARTER = 'flowchart LR\n    A[Start] --> B[Next]'

export function flowchart(): DiagramKind<DrawingData> {
  return {
    name: 'flowchart',
    keywords: ['flowchart', 'graph'],
    label: 'Flowchart',
    icon: FLOWCHART_ICON,
    starter: STARTER,
    parse,
    render: (model, { fallbackTitle }) => renderDrawingSvg(model, { fallbackTitle }),
    // The exporter ends with a newline; the fence supplies its own.
    write: (model, { retained }) => drawingToMermaid(model, { retained }).replace(/\n$/, ''),
  }
}

function parse(source: string): DiagramParse<DrawingData> | DiagramParseError {
  const parsed = parseMermaidFlowchart(source)
  if ('error' in parsed) return parsed.line === undefined ? { error: parsed.error } : { error: parsed.error, line: parsed.line }
  return { model: parsed.data, problems: parsed.problems, retained: parsed.retained, lossy: parsed.lossy }
}
