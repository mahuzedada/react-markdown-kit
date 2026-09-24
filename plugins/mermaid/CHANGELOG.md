# Changelog

## 0.3.0 (unreleased)

- `@react-markdown-kit/mermaid/canvas`: the flowchart and sequence canvases without a Markdown editor. `<MermaidCanvas value onChange />` fills its container, floats the tools over the drawing as an island down the left edge (`toolbar="left"`, default) or along the top (`"top"`), keeps its own undo history (Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z, Ctrl+Y), takes `zoom`, `drawingStyle`, `align` (default `center`), `readOnly`, `labels`, `kinds` and `editors`, and shows other kinds through their static render or as source. `createMermaidCanvas(container, options)` mounts it into any element and returns `{ getValue, setValue, update, destroy }`. The entry loads React and ReactDOM but neither Lexical nor the editor package.
- Multi-selection on the flowchart canvas, modelled on Excalidraw: every selected shape gets a thin outline and the selection a dashed frame with handles. A corner handle scales the whole selection evenly from the opposite corner, a side handle along one axis, Alt from the centre; bound connectors follow. A drag anywhere inside the frame moves the selection, a click on one member narrows the selection to it, and the arrow keys nudge it by 1px (10px with Shift) in one merged undo step.
- The flowchart canvas no longer writes on a click that moves nothing, so selecting a shape leaves hand-written source as it is, and a release always lands at the release point even when the last pointer move had not been drawn yet.
- The canvases read their options, labels, focus reporting and undo from a canvas host (`canvas/host.tsx`) instead of Lexical; the editor's block provides one. `DiagramKindEditorProps.nodeKey` is typed `string`. The tool row slot is keyed on any scope object, so `<DiagramToolbar>` behaves as before.

## 0.2.0 (2026-09-22)

- Ink style redrawn: one marker stroke of uniform width per shape, sides bowed gently, corners meeting exactly, a closing overlap tail, and a faint pencil under-drawing. Fills follow the stroke, connectors are bowed lines with open chevron heads, and the Recursive face is a little bolder.
- Diagram kinds: every ```mermaid fence is a `diagram` node with a `kind` and a `support` level. `flowchart()` and `sequenceDiagram()` are built in, `mermaid({ kinds })` sets the registry, and other Mermaid types render as source.
- `sequenceDiagram`: participants, boxes, all message arrows, activation, notes, frames (`loop`, `alt`, `opt`, `par`, `critical`, `break`, `rect`), `autonumber` and titles as static SVG, with a writer that emits plain Mermaid. `create` and `destroy` are dropped and reported as lossy.
- Sequence canvas: participants, messages, notes and frames are added, edited inline, reordered by dragging and wrapped or unwrapped, each gesture one undo step.
- Tolerant flowchart parser: spacing variants, `flowchart-elk`, hyphenated ids, `classDef`, `class`, `click`, comments and directives are kept and re-emitted; unknown statements are problems, not failures.
- Editor: the block header shows kind and support, flowcharts and sequence diagrams toggle between canvas and text, other kinds get a source editor with live preview, and `mermaid({ editors })` maps a kind to its own editor component.
- `mermaid({ align: 'center' })` on the editor entry: the flowchart canvas shows a drawing in the middle of the room it has, on both axes, and scales one taller than that room down to fit, the way a page-as-canvas editor shows a diagram; the sequence canvas fits a taller picture the same way and leaves its placement to the host's CSS. The drawing's coordinates are not moved, and a gesture never re-centres the drawing under the pointer. The default, `start`, is the top-left placement a block has in a document.
- `<DiagramToolbar>` on the editor entry: a slot a host mounts anywhere in its own chrome, and the flowchart and sequence canvases render their tool rows into it instead of along their top edge, the way a custom formatting toolbar sits outside the text surface. The slot shows the tools of the canvas that last had focus, with a `placeholder` while no canvas is on screen.
- `@react-markdown-kit/mermaid/client`: `diagramFallback({ render })` draws unsupported kinds with a host renderer after mount.
- Fifteen `--rmk-diagram-*` colour tokens for kinds without payload colours, with Mermaid default fallbacks.
- New diagnostics `DIAGRAM_KIND_UNKNOWN`, `DIAGRAM_KIND_UNSUPPORTED`, `DIAGRAM_SYNTAX_INVALID` and `DIAGRAM_SYNTAX_IGNORED`.

## 0.1.0 (2026-09-20)

First release. `mermaid()` turns ```mermaid flowcharts into static SVG with no Mermaid.js at runtime; the `/editor` entry adds a drawing canvas that writes edits back as Mermaid plus one `%% rmk-layout v1` annotation (see `LAYOUT_ANNOTATION.md`). Flowcharts only.
