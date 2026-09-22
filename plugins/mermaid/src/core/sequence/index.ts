/**
 * The built-in `sequenceDiagram` kind (docs/MERMAID_PLATFORM.md section 8).
 *
 * Wires the parser, the static renderer and the writer into the
 * `DiagramKind` contract. The model is `SequenceModel`; `write` is the
 * canonical source for it, so the sequence canvas edits the model and
 * commits text, and the writer's escaping (`escapeStatementText`) is what
 * keeps `parse(write(m))` equal to `m`. The factory is a configuration
 * value like `flowchart()`: a consumer lists it in `mermaid({ kinds })` or
 * leaves it out to trim the bundle.
 */
import type { DiagramKind } from '../kind.js'
import { renderSequenceSvg } from '../../svg/sequence-render.js'
import type { SequenceModel } from './model.js'
import { parseSequenceDiagram } from './parse.js'
import { writeSequenceDiagram } from './write.js'

export type { Activation, Box, Frame, Message, Note, Participant, SequenceItem, SequenceModel } from './model.js'
export { flattenItems } from './model.js'
export { LOSSY_CREATE_DESTROY, parseSequenceDiagram, SEQUENCE_PROBLEM_CODES } from './parse.js'
export { writeSequenceDiagram } from './write.js'
export type { SequenceWriteOptions } from './write.js'
export { escapeStatementText } from '../text.js'

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
    write: (model, { retained }) => writeSequenceDiagram(model, { retained }),
  }
}
