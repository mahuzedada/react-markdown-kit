/**
 * Ported from @zuilib/text-editor (MIT). JSON Schema (draft-07) of the concrete ```drawing payload.
 */
/**
 * JSON Schema (draft-07) for the payload of a ```drawing fenced block
 * (format version 3).
 *
 * Use it to validate LLM- or tool-generated drawings before embedding them,
 * or pass it as a structured-output / tool schema so a model is forced to
 * emit valid payloads. Kept in sync with `deserializeDrawingData` /
 * `normalizeShape` in types.ts; update both together.
 *
 * For generation prefer the ```diagram skeleton
 * (`DRAWING_SKELETON_JSON_SCHEMA`): it needs no coordinates and expands into
 * this format on import.
 */
export const DRAWING_DATA_JSON_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'DrawingData',
  description:
    'Vector drawing embedded in markdown as a ```drawing fenced code block (format version 3)',
  type: 'object',
  required: ['version', 'canvasHeight', 'shapes'],
  additionalProperties: false,
  properties: {
    version: { const: 3, description: 'Format version; always 3' },
    canvasHeight: {
      type: 'number',
      minimum: 80,
      description:
        'Canvas height in pixels. Make it large enough to contain every shape plus ~20px margin.',
    },
    canvasWidth: {
      type: 'number',
      minimum: 120,
      description:
        'Optional logical canvas width in pixels. When set, the drawing is scaled down to fit narrower layouts (SVG viewBox) so coordinates can assume this width. When omitted the canvas is fluid and coordinates are CSS pixels.',
    },
    width: {
      enum: ['full', 'text', 'content'],
      description:
        'Block width: "full" (default, omit it) spans the editor; "text" aligns the block with the text column (same as "full" unless the app sets a text measure); "content" fits the shapes\' horizontal extent and left-aligns with the text',
    },
    title: {
      type: 'string',
      description: 'Optional accessible name of the drawing, read by screen readers in place of the shapes',
    },
    description: {
      type: 'string',
      description: 'Optional longer accessible description of what the drawing shows',
    },
    shapes: {
      type: 'array',
      items: { $ref: '#/definitions/shape' },
      maxItems: 5000,
      description: 'Render order: later shapes draw on top',
    },
  },
  definitions: {
    point: {
      type: 'object',
      required: ['x', 'y'],
      additionalProperties: false,
      properties: {
        x: { type: 'number', description: 'Absolute canvas x' },
        y: { type: 'number', description: 'Absolute canvas y' },
      },
    },
    binding: {
      type: 'object',
      description:
        'Where a connector endpoint attaches to a box. Omit fixedPoint to let the endpoint auto-aim from the box center at the other end.',
      required: ['id'],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          description: 'Id of the box this endpoint is attached to',
        },
        fixedPoint: {
          type: 'array',
          items: { type: 'number', minimum: 0, maximum: 1 },
          minItems: 2,
          maxItems: 2,
          description:
            'Attach point as a ratio of the box\'s bounding box: [0,0] top-left, [1,1] bottom-right, [0.5,0] top edge midpoint, [1,0.5] right edge midpoint. Omitted: the endpoint auto-aims from the box center at the other end.',
        },
        mode: {
          enum: ['orbit', 'inside'],
          description:
            '"orbit" (default): the endpoint is projected onto the box outline with a 6px gap. "inside": the endpoint sits exactly on the fixed point.',
        },
      },
    },
    shape: {
      type: 'object',
      required: ['id', 'type', 'x', 'y', 'width', 'height', 'stroke', 'fill', 'strokeWidth'],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          description:
            'Unique within the drawing; connector bindings reference it',
        },
        type: {
          enum: [
            'rect',
            'ellipse',
            'diamond',
            'note',
            'cylinder',
            'cloud',
            'queue',
            'actor',
            'arrow',
            'line',
            'text',
          ],
          description:
            'Boxes (cards with label/text/footer slots): rect, ellipse, diamond, note (sticky note with a folded corner), cylinder (database), cloud, queue (horizontal cylinder), actor (stick figure; only the text slot, rendered as a name under the figure). Connectors: arrow (head at the end), line. Free-floating annotation: text.',
        },
        x: {
          type: 'number',
          description:
            'Boxes/text: left edge of the bounding box. Connectors: start point x.',
        },
        y: {
          type: 'number',
          description:
            'Boxes/text: top edge of the bounding box. Connectors: start point y.',
        },
        width: {
          type: 'number',
          description:
            'Boxes/text: width (non-negative). Connectors: delta x to the end point (may be negative).',
        },
        height: {
          type: 'number',
          description:
            'Boxes/text: height (non-negative). Connectors: delta y to the end point (may be negative).',
        },
        stroke: {
          type: 'string',
          description:
            'CSS color of the outline (and of any text). Palette: #1e1e1e (default), #e03131 red, #2f9e44 green, #1971c2 blue, #f08c00 orange, #7048e8 purple.',
        },
        fill: {
          type: 'string',
          description:
            'CSS color of the interior; "transparent" for none. Palette: #ffc9c9 red, #b2f2bb green, #a5d8ff blue, #ffec99 yellow, #d0bfff purple.',
        },
        strokeWidth: { type: 'number', description: 'Outline width: 1 thin, 2 medium (default), 4 bold' },
        strokeStyle: {
          enum: ['dashed', 'dotted'],
          description: 'Boxes and connectors: dashed or dotted outline. Omit for solid.',
        },
        corners: {
          const: 'sharp',
          description: 'Rect only: square corners (Mermaid [text]). Omit for rounded corners (Mermaid (text)).',
        },
        color: {
          type: 'string',
          description: 'Boxes and text: text colour. Omit to derive it from the stroke (light text on dark fills).',
        },
        text: {
          type: 'string',
          description:
            'Standalone text content; center content of a box (the name under an actor); midpoint label of a connector',
        },
        label: {
          type: 'string',
          description: 'Boxes only (not actor): small bold heading at the top',
        },
        footer: {
          type: 'string',
          description: 'Boxes only (not actor): small dim line at the bottom',
        },
        startBinding: {
          $ref: '#/definitions/binding',
          description:
            'Connectors only: box the start point attaches to. The editor re-anchors the endpoint onto that box and keeps it attached as the box moves.',
        },
        endBinding: {
          $ref: '#/definitions/binding',
          description: 'Connectors only: box the end point attaches to',
        },
        bidirectional: {
          type: 'boolean',
          description: 'Arrows only: arrowheads on both ends',
        },
        head: {
          enum: ['circle', 'cross'],
          description: 'Arrows only: head shape, on both ends when bidirectional (Mermaid --o, --x). Omit for a chevron.',
        },
        routing: {
          const: 'elbow',
          description:
            'Connectors only: right-angled auto-routed path. It leaves the box perpendicular to the attach side, avoids every box on the canvas and minimises bends. Ignored when waypoints are present.',
        },
        elbow: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description:
            'Elbow override: position of the middle segment as a fraction of the span. Applied only when the routed path is a simple three-segment Z.',
        },
        waypoints: {
          type: 'array',
          items: { $ref: '#/definitions/point' },
          description:
            'Connectors only: intermediate path points in canvas coordinates, ordered start to end. Takes precedence over routing.',
        },
      },
    },
  },
} as const
