/**
 * JSON Schema (draft-07) of the payload of a version 1 layout annotation,
 * the object after `%% rmk-layout v1` in a ```mermaid fence. Prose spec:
 * LAYOUT_ANNOTATION.md. Kept in sync with the validator in
 * layout-annotation.ts; update both together.
 *
 * The schema describes what a conforming writer emits, so it forbids unknown
 * members. A reader ignores unknown members (see the spec's compatibility
 * rules), which lets a minor revision add fields without a version bump.
 */
import { DRAWING_DATA_JSON_SCHEMA } from './schema.js'

const { shape, binding, point } = DRAWING_DATA_JSON_SCHEMA.definitions

export const LAYOUT_ANNOTATION_JSON_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'RmkLayoutAnnotation',
  description:
    'Payload of the "%% rmk-layout v1 {…}" comment in a ```mermaid flowchart: the geometry the Mermaid syntax cannot express. Every member is optional; anything missing falls back to the automatic layout. The syntax is authoritative for nodes, edges, text, direction and colours; the annotation never repeats them.',
  type: 'object',
  additionalProperties: false,
  properties: {
    canvasHeight: { type: 'number', minimum: 80, description: 'Canvas height in CSS pixels' },
    canvasWidth: {
      type: 'number',
      minimum: 120,
      description: 'Optional logical canvas width in pixels; the drawing scales down to fit narrower layouts when set',
    },
    width: {
      enum: ['full', 'text', 'content'],
      description: 'Block width in the page: "full" (default), "text" (the text column) or "content" (fit the shapes)',
    },
    description: { type: 'string', description: 'Accessible description of the drawing. The title is the Mermaid front matter.' },
    nodes: {
      type: 'object',
      description: 'Geometry per node, keyed by the Mermaid node id. Entries for ids not in the graph are ignored.',
      additionalProperties: { $ref: '#/definitions/node' },
    },
    edges: {
      type: 'object',
      description:
        'Geometry per edge, keyed "from->to" for the first edge between two nodes in statement order, "from->to#2" for the second, and so on. Entries for keys not in the graph are ignored.',
      additionalProperties: { $ref: '#/definitions/edge' },
    },
    texts: {
      type: 'array',
      items: { allOf: [{ $ref: '#/definitions/shape' }, { properties: { type: { const: 'text' } } }] },
      description: 'Free-floating text shapes, which Mermaid has no syntax for, as full drawing shapes',
    },
    loose: {
      type: 'array',
      items: { allOf: [{ $ref: '#/definitions/shape' }, { properties: { type: { enum: ['arrow', 'line'] } } }] },
      description: 'Connectors not bound to a node at both ends, which Mermaid cannot express, as full drawing shapes',
    },
  },
  definitions: {
    shape,
    binding,
    point,
    node: {
      type: 'object',
      additionalProperties: false,
      properties: {
        x: { type: 'number', description: 'Left edge of the bounding box' },
        y: { type: 'number', description: 'Top edge of the bounding box' },
        width: { type: 'number', minimum: 0 },
        height: { type: 'number', minimum: 0 },
        strokeWidth: { type: 'number', minimum: 0, description: 'Outline width; a stroke-width in the node\'s style line wins' },
        slots: {
          type: 'array',
          items: { enum: ['label', 'text', 'footer'] },
          uniqueItems: true,
          description:
            'Which card slots the node text fills. The exporter joins label, text and footer with <br/>; the reader hands the first line to "label" and the last to "footer" when listed, the rest to "text". Omitted: all text is "text".',
        },
        type: {
          enum: ['cloud', 'actor'],
          description: 'The shape when Mermaid has no bracket for it; the syntax carries every other shape',
        },
      },
    },
    edge: {
      type: 'object',
      additionalProperties: false,
      properties: {
        id: { type: 'string', description: 'The connector shape id; generated when omitted' },
        x: { type: 'number', description: 'Start point x. Approximate: bound endpoints are re-anchored to their node' },
        y: { type: 'number', description: 'Start point y' },
        width: { type: 'number', description: 'Delta x to the end point; may be negative' },
        height: { type: 'number', description: 'Delta y to the end point; may be negative' },
        stroke: { type: 'string', description: 'CSS colour of the connector and its label' },
        fill: { type: 'string', description: 'CSS colour of the arrowhead interior; "transparent" for none' },
        strokeWidth: { type: 'number', minimum: 0, description: 'Stroke width. The link token wins its class: a thick link (==>) reads a width under 3 as 4, a normal one a width of 3 or more as 2' },
        strokeStyle: { enum: ['dashed', 'dotted'], description: 'Pattern of a dotted link token (-.->); a solid token ignores it' },
        routing: { const: 'elbow', description: 'Right-angled auto-routed path. Omit for a straight connector.' },
        elbow: { type: 'number', minimum: 0, maximum: 1, description: 'Middle segment position for a three-segment elbow' },
        waypoints: { type: 'array', items: { $ref: '#/definitions/point' }, description: 'Explicit path; takes precedence over routing' },
        start: { $ref: '#/definitions/anchor', description: 'How the start attaches to the "from" node' },
        end: { $ref: '#/definitions/anchor', description: 'How the end attaches to the "to" node' },
      },
    },
    anchor: {
      type: 'object',
      additionalProperties: false,
      description: 'A binding without its node id, which the edge key already names',
      properties: {
        fixedPoint: binding.properties.fixedPoint,
        mode: binding.properties.mode,
      },
    },
  },
} as const
