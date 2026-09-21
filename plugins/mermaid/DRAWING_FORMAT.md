# The `mermaid`, `drawing` and `diagram` block formats

`@react-markdown-kit/mermaid` documents are plain markdown. Diagrams are
embedded as fenced code blocks. Three languages exist:

- ```` ```mermaid ```` holds a Mermaid **flowchart**. This is what the editor
  writes, and what generators should emit today: it renders anywhere Mermaid
  does. Geometry Mermaid cannot express (positions, sizes, stroke widths,
  elbow routing, waypoints, free text, unbound connectors) travels in one
  `%% rmk-layout v1 {…}` comment on the last line, specified in
  `LAYOUT_ANNOTATION.md`. Other renderers ignore the comment. A flowchart
  without it is auto-laid out like a `diagram` skeleton. See
  [Mermaid](#mermaid) at the end.

The two JSON languages below are read for compatibility with
`@zuilib/text-editor` and are rewritten as ```` ```mermaid ```` on the first
edit:

- ```` ```diagram ```` holds a **skeleton**: boxes, connectors and colors, no
  coordinates. The editor lays it out and expands it into a full drawing on
  import. **Generators should emit this one.** See
  [Prefer the ```diagram skeleton](#prefer-the-diagram-skeleton).
- ```` ```drawing ```` holds the **concrete format** (version 3): every shape
  with its position, size and style. This is what the editor stores once a
  drawing has been edited.

````md
```drawing
{"version":3,"canvasHeight":320,"shapes":[ ... ]}
```
````

This document is the authoritative spec of both payloads. It is written so
it can be handed to a program or an LLM that needs to **generate or edit
drawings**. Machine-readable JSON Schemas of the same rules are exported
from the package as `DRAWING_DATA_JSON_SCHEMA` (concrete) and
`DRAWING_SKELETON_JSON_SCHEMA` (skeleton).

Malformed payloads never crash the editor: anything that fails validation
degrades to an empty canvas (invalid shapes are dropped individually).

The editor writes version 3. Version 2 (identical except shape sizes were
spelled `w`/`h`) is migrated on read, so persisted drawings keep loading;
the editor re-serializes them as version 3. Payloads with any other
`version` (or none) render as an empty canvas. Convenience spellings such
as `side` exist only in the ```diagram skeleton, which is a separate block
type.

## Coordinate system

- Origin `(0,0)` is the canvas's top-left; x grows right, y grows down.
- Units are CSS pixels.
- `canvasHeight` is the canvas height in pixels (minimum 80; 300 to 400 is
  typical).
- `canvasWidth` is optional. When set, the drawing is scaled down to fit
  narrower layouts (SVG viewBox), so coordinates can assume that width.
  When omitted the canvas is fluid and as wide as the editor; keep shapes
  within roughly x in [0, 700] to be safe on typical layouts.
- `width` is the block's horizontal sizing in the page, independent of the
  coordinates: `"full"` (default, omit it) spans the editor pane;
  `"text"` aligns the block with the text column (the same as `"full"`
  unless the app sets a text measure); `"content"` sizes the block to fit
  the rightmost shape (plus a margin), left-aligned with the text. Use
  `"content"` for small diagrams that should not stretch across the page.
  Unknown values are ignored (treated as `"full"`).

## Top-level object

| Field          | Type      | Notes                                                        |
|----------------|-----------|--------------------------------------------------------------|
| `version`      | `3`       | Literal `3` (`2` accepted on read: shape `w`/`h` migrate to `width`/`height`) |
| `canvasHeight` | `number`  | Canvas height in px (min 80)                                 |
| `canvasWidth`  | `number`  | Optional logical width in px (min 120); scales to fit when set |
| `width`        | `"full"` \| `"text"` \| `"content"` | Optional; default `"full"`. `"text"` aligns with the text column, `"content"` fits the shapes' extent |
| `shapes`       | `Shape[]` | Render order: later shapes draw on top                       |

## Shape object

All shapes share these required fields:

| Field         | Type     | Meaning                                                            |
|---------------|----------|--------------------------------------------------------------------|
| `id`          | `string` | Unique within the drawing; bindings reference it                   |
| `type`        | `string` | One of the types below                                             |
| `x`, `y`      | `number` | Boxes/text: top-left of the bounding box. Connectors: start point. |
| `width`, `height` | `number` | Boxes/text: size (non-negative). Connectors: delta to the end point (`end = (x+width, y+height)`; may be negative). |
| `stroke`      | `string` | CSS color of the outline and of all text on the shape              |
| `fill`        | `string` | CSS color of the interior; `"transparent"` for none                |
| `strokeWidth` | `number` | Use `2`                                                            |

### Shape types

| Type       | Kind      | Default size | Notes                                                        |
|------------|-----------|--------------|--------------------------------------------------------------|
| `rect`     | box       | 160 x 90     | Rectangle; the general-purpose card                          |
| `ellipse`  | box       | 160 x 90     | Ellipse inscribed in the bounding box                        |
| `diamond`  | box       | 170 x 100    | Decision; text area is the inner half                        |
| `note`     | box       | 160 x 110    | Sticky note with a folded bottom-right corner; default fill `#ffec99` |
| `cylinder` | box       | 140 x 110    | Database; text sits below the top ellipse                    |
| `cloud`    | box       | 180 x 110    | Cloud; outline is an ellipse for binding purposes            |
| `queue`    | box       | 180 x 80     | Horizontal cylinder (queue, stream, pipe)                    |
| `actor`    | box       | 90 x 120     | Stick figure; `text` only, rendered as a name under the figure |
| `arrow`    | connector |              | Head at the end; `bidirectional` for both ends               |
| `line`     | connector |              | No arrowhead                                                 |
| `text`     | free text |              | Floating annotation                                          |

### Boxes ("cards")

Boxes are card-like: they can carry up to three text slots that render
inside the shape and move, resize and wrap with it:

| Field    | Renders as                                    |
|----------|-----------------------------------------------|
| `label`  | Small bold heading at the top of the box      |
| `text`   | Main content, centered                        |
| `footer` | Small dim line at the bottom                  |

Text wraps automatically to the box's text area; `\n` forces a line break.
The text area is smaller than the bounding box for non-rectangular shapes
(diamond, ellipse, cloud, cylinder), so give those a little more room.
`actor` has only the `text` slot: it is drawn under the figure and may be
wider than the box; `label` and `footer` are dropped. Prefer slots over
floating `text` shapes; slot text is attached to the card.

### `text`: free-floating annotation

`text` holds the content. `width`/`height` are advisory (the editor recomputes them
from the content); position is the top-left of the first line. Use only for
annotations that belong to no box (the editor deletes a text shape when its
content is emptied).

### Connectors (`arrow`, `line`)

Geometry: from `(x, y)` to `(x+width, y+height)`. `arrow` has a head at the end;
`line` has none.

| Field           | Type       | Meaning                                                                 |
|-----------------|------------|-------------------------------------------------------------------------|
| `text`          | `string`   | Label rendered at the path midpoint on a small backing plate            |
| `bidirectional` | `boolean`  | Arrows only: heads on both ends                                         |
| `startBinding`  | `Binding`  | Box the start attaches to (see below)                                   |
| `endBinding`    | `Binding`  | Box the end attaches to                                                 |
| `routing`       | `"elbow"`  | Right-angled auto-routed path                                           |
| `elbow`         | `number`   | 0 to 1: override of the middle segment, only for a simple three-segment Z |
| `waypoints`     | `Point[]`  | Explicit intermediate path points (`{x,y}`), ordered start to end       |

## Bindings

A binding attaches a connector endpoint to a box and keeps it attached as
the box moves:

```json
{ "id": "<box id>", "fixedPoint": [fx, fy], "mode": "orbit" }
```

| Field        | Type                     | Meaning                                                                 |
|--------------|--------------------------|-------------------------------------------------------------------------|
| `id`         | `string`                 | Required. Id of a box shape (bindings to unknown or non-box ids are dropped) |
| `fixedPoint` | `[number, number]`       | Optional. Attach point as a ratio of the box's bounding box: `[0,0]` top-left, `[1,1]` bottom-right, `[0.5,0]` top edge midpoint. Values are clamped to 0 to 1 |
| `mode`       | `"orbit"` \| `"inside"`  | Optional, default `"orbit"`                                             |

- **Omit `fixedPoint`** when you do not care where the connector attaches:
  the endpoint auto-aims from the box center at the other end of the
  connector, so the line always meets the outline on the facing side.
- **Set `fixedPoint` to an edge midpoint** when the attach edge matters (a
  decision's "yes" leaves at the bottom `[0.5,1]`, "no" at the right
  `[1,0.5]`). In the ```diagram skeleton the same thing is spelled
  `"side":"bottom"`.
- `mode: "orbit"` (default) projects the endpoint onto the box outline with
  a 6px gap. `mode: "inside"` pins the endpoint exactly on the fixed point
  (useful for lines that end inside a shape).

Bound endpoints are re-anchored by the editor, so the connector's own
`x`/`y`/`width`/`height` only need to be approximately right: place them near the
intended boxes and the resolver snaps them. Don't bind both ends of one
connector to the same box.

## Routing

Omit `routing` for a straight (possibly diagonal) connector.

`"routing":"elbow"` renders an auto-routed orthogonal path: it leaves the
box perpendicular to the attach side, avoids every box on the canvas, and
uses as few bends as possible. `elbow` (0 to 1) is an optional override of
the middle segment's position along the span; it is applied only when the
routed path is a simple three-segment Z, and ignored otherwise.

If `waypoints` is non-empty it defines the path (`start, waypoints..., end`)
and `routing`/`elbow` are ignored. Waypoints are absolute canvas
coordinates; align consecutive points on x or y to get right angles.

## Recommended colors

Any CSS color works; the editor's palette (dark-mode safe, the canvas
inverts colors Excalidraw-style in dark themes):

| Name   | Stroke    | Fill          |
|--------|-----------|---------------|
| plain  | `transparent` (no outline) | `#f1f3f5` |
| black  | `#1e1e1e` | `#1e1e1e` (text renders white) |
| gray   | `#1e1e1e` | `transparent` |
| red    | `#e03131` | `#ffc9c9`     |
| green  | `#2f9e44` | `#b2f2bb`     |
| blue   | `#1971c2` | `#a5d8ff`     |
| orange | `#f08c00` | `#ffec99`     |
| purple | `#7048e8` | `#d0bfff`     |

Pair a colored stroke with its pastel fill. `note` defaults to the yellow
fill `#ffec99`.

## Prefer the ```diagram skeleton

A fenced block with language `diagram` holds a skeleton: what the boxes are
and how they connect. The editor expands it into a full ```drawing block
on import (auto layout, default sizes, palette colors). The expansion is
one-way: once opened, the document stores the concrete ```drawing block.

```
{
  "direction"?: "right" | "down",          // auto-layout flow, default right
  "canvasWidth"?: n, "canvasHeight"?: n, "width"?: "full" | "text" | "content",
  "boxes": [ { "id", "type"?: <box type, default rect>, "label"?, "text"?, "footer"?,
               "x"?, "y"?,            // omitted: auto layout by connector rank
               "w"?, "h"?,            // omitted: sized to fit the text
               "color"?: "plain"|"black"|"gray"|"red"|"green"|"blue"|"orange"|"purple",  // outline + fill preset
               "stroke"?, "fill"? } ],
  "connectors"?: [ { "id"?, "type"?: "arrow"|"line", "from": "<id>" | {"id","side"?}, "to": same,
                     "text"?, "bidirectional"?, "routing"?: "elbow"|"straight", "color"?, "stroke"? } ],
  "texts"?: [ { "x", "y", "text", "color"? } ]
}
```

Rules:

- `boxes` is required; every box needs a unique `id`. `type` is any box
  type from the table above (default `rect`).
- `from`/`to` are box ids, or `{"id","side"}` to pick the attach edge.
- `color` picks a palette pair (stroke plus pastel fill) from the table
  above. `stroke`/`fill` override it with explicit CSS colors. On
  connectors only the stroke applies.

- Auto layout: boxes are ranked along `direction` by the longest path from
  the sources (cycles are broken). Ranks are 90px apart, boxes within a
  rank 40px apart, starting at (32,32). Boxes with explicit `x`/`y` keep
  them. Boxes without `w`/`h` are sized to fit their text. `canvasHeight`
  is computed when omitted.
- `texts` are free annotations and need explicit coordinates.
- `width` is copied to the expanded drawing (see [Coordinate
  system](#coordinate-system)); omit it for `"full"`.

A three-box flow:

````md
```diagram
{"boxes":[
  {"id":"web","label":"CLIENT","text":"Web App","footer":"React","color":"blue"},
  {"id":"api","label":"SERVICE","text":"API","footer":"Kotlin","color":"green"},
  {"id":"db","type":"cylinder","text":"Postgres"}
],"connectors":[
  {"from":"web","to":"api","text":"REST"},
  {"from":"api","to":"db"}
]}
```
````

A decision with attach sides and elbow routing, flowing down:

````md
```diagram
{"direction":"down","boxes":[
  {"id":"user","type":"actor","text":"User"},
  {"id":"check","type":"diamond","text":"Valid?"},
  {"id":"save","text":"Save","color":"green"},
  {"id":"err","type":"note","text":"Show error","color":"red"}
],"connectors":[
  {"from":"user","to":"check"},
  {"from":{"id":"check","side":"bottom"},"to":"save","text":"yes","routing":"elbow"},
  {"from":{"id":"check","side":"right"},"to":{"id":"err","side":"left"},"text":"no","routing":"elbow"}
]}
```
````

Programmatic use: `parseDrawingSkeleton(json)` parses a skeleton,
`expandDrawingSkeleton(skeleton)` returns `DrawingData`, and
`DRAWING_SKELETON_JSON_SCHEMA` is the JSON Schema. Types: `DrawingSkeleton`,
`SkeletonBox`, `SkeletonConnector`.

## Concrete examples

Two bound cards with a labeled arrow:

````md
```drawing
{"version":3,"canvasHeight":260,"shapes":[
  {"id":"web","type":"rect","x":40,"y":70,"width":170,"height":100,"stroke":"#1971c2","fill":"#a5d8ff","strokeWidth":2,"label":"CLIENT","text":"Web App","footer":"React"},
  {"id":"api","type":"rect","x":330,"y":70,"width":170,"height":100,"stroke":"#2f9e44","fill":"#b2f2bb","strokeWidth":2,"label":"SERVICE","text":"API","footer":"Kotlin"},
  {"id":"e1","type":"arrow","x":216,"y":120,"width":108,"height":0,"stroke":"#1e1e1e","fill":"transparent","strokeWidth":2,"startBinding":{"id":"web"},"endBinding":{"id":"api"},"text":"REST"}
]}
```
````

An elbow arrow with attach sides, a database, and a hand-routed multi-bend
line:

````md
```drawing
{"version":3,"canvasHeight":300,"canvasWidth":640,"shapes":[
  {"id":"a","type":"rect","x":40,"y":40,"width":150,"height":80,"stroke":"#1e1e1e","fill":"transparent","strokeWidth":2,"text":"A"},
  {"id":"b","type":"cylinder","x":420,"y":180,"width":140,"height":110,"stroke":"#7048e8","fill":"#d0bfff","strokeWidth":2,"text":"B"},
  {"id":"e1","type":"arrow","x":190,"y":80,"width":300,"height":100,"stroke":"#1e1e1e","fill":"transparent","strokeWidth":2,"startBinding":{"id":"a","fixedPoint":[1,0.5]},"endBinding":{"id":"b","fixedPoint":[0.5,0]},"routing":"elbow"},
  {"id":"e2","type":"line","x":115,"y":126,"width":375,"height":54,"stroke":"#1971c2","fill":"transparent","strokeWidth":2,"startBinding":{"id":"a"},"endBinding":{"id":"b"},"waypoints":[{"x":115,"y":260},{"x":490,"y":260}]}
]}
```
````

## Mermaid export

The canvas has a **Copy as Mermaid** button. Programmatically,
`drawingToMermaid(data, { direction?: 'LR' | 'TD' })` returns a
`flowchart`:

- one node per box, in shape order: `rect` and `note` `["…"]`, `ellipse`
  `(["…"])`, `diamond` `{"…"}`, `cylinder` `[("…")]`, `cloud` and `actor`
  `(("…"))`, `queue` `[["…"]]`; node text joins `label`, `text` and
  `footer`
- one edge per connector bound at both ends: `-->`, `<-->` (bidirectional),
  `---` (line); connector `text` becomes `|text|`. Unbound connectors are
  dropped
- a `style` line for every box with a non-default stroke or fill
- free `text` shapes as `%% note:` comments

When `direction` is omitted it is `LR` if most edges run horizontally,
otherwise `TD`.

## Generation checklist

1. Prefer a ```diagram skeleton. Fall back to ```drawing only when you edit
   an existing concrete payload or need exact positions.
2. One JSON object per fence, no comments or trailing commas.
3. Every `id` unique; every binding references an existing box id.
4. Concrete boxes: at least 120 x 70 when they carry text slots (use the
   default sizes from the table); leave about 60px between cards for
   connectors and labels.
5. Box text goes in `label`/`text`/`footer`, not in floating `text` shapes.
   `actor` only has `text`.
6. Connectors between cards bind both ends as objects (`{"id":"web"}`).
   Add an edge-midpoint `fixedPoint` when the attach edge matters; omit it
   otherwise.
7. Use `"routing":"elbow"` for flowcharts; leave `elbow` and `waypoints`
   out unless you need to override the router.
8. `canvasHeight` large enough to contain every shape plus ~20px margin.

## Mermaid

The plugin reads the flowchart subset of Mermaid: a `flowchart` or `graph`
header with an optional direction (`TB`, `TD`, `BT`, `LR`, `RL`), optional
`---\ntitle: …\n---` front matter, node declarations with the bracket shapes
`[ ]` rect, `( )` rect, `([ ])` ellipse, `(( ))` ellipse, `{ }` diamond,
`{{ }}` diamond, `[( )]` cylinder, `[[ ]]` queue and `> ]` note, edges
`-->`, `---`, `-.->`, `==>` and `<-->` with labels as `-->|text|` or
`-- text -->`, chains, `&` groups, `subgraph … end` (grouping ignored),
`style id fill:…,stroke:…` and `%%` comments. `classDef`, `class`, `click`
and `linkStyle` are ignored. Quoted text may use `#quot;`, `#lt;`, `#gt;`,
`#124;` and `<br/>`.

The layout annotation, `%% rmk-layout v1 {…}`, carries what the syntax
cannot: canvas size and block width, node positions, sizes and stroke
widths, which text slots a node fills, edge geometry, routing, waypoints and
attach points, free text and loose connectors. It is specified in
`LAYOUT_ANNOTATION.md` (grammar, payload, validation, versioning) with
`LAYOUT_ANNOTATION_JSON_SCHEMA` as the machine-readable form. The syntax
stays authoritative for nodes, edges, text, direction and colours.
