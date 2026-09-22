/**
 * The built-in `sequenceDiagram` kind (docs/MERMAID_PLATFORM.md section 8).
 *
 * Wires the parser and the static renderer into the `DiagramKind` contract.
 * The model is `SequenceModel`; there is no `write` in this revision, so
 * the editor for this kind is the source editor and edits are text. The
 * factory is a configuration value like `flowchart()`: a consumer lists it
 * in `mermaid({ kinds })` or leaves it out to trim the bundle.
 */
import type { DiagramKind } from '../kind.js'
import { renderSequenceSvg } from '../../svg/sequence-render.js'
import type { SequenceModel } from './model.js'
import { parseSequenceDiagram } from './parse.js'

export type { Activation, Box, Frame, Message, Note, Participant, SequenceItem, SequenceModel } from './model.js'

/** Two lifelines with a message each way, 24x24. */
const SEQUENCE_ICON = 'M6 3v18M18 3v18M4 3h4M16 3h4M8 9h8M13 6l3 3-3 3M16 15H8M11 12l-3 3 3 3'

const STARTER = 'sequenceDiagram\n    Alice->>Bob: Hello Bob\n    Bob-->>Alice: Hi Alice'

export function sequenceDiagram(): DiagramKind<SequenceModel> {
  return {
    name: 'sequenceDiagram',
    keywords: ['sequenceDiagram'],
    label: 'Sequence diagram',
    icon: SEQUENCE_ICON,
    starter: STARTER,
    parse: parseSequenceDiagram,
    render: (model, { fallbackTitle }) => renderSequenceSvg(model, { fallbackTitle }),
  }
}
