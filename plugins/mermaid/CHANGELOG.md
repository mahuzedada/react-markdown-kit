# Changelog

## 0.2.0 (2026-09-22)

- Ink style redrawn: one marker stroke of uniform width per shape, sides bowed gently, corners meeting exactly, a closing overlap tail, and a faint pencil under-drawing. Fills follow the stroke, connectors are bowed lines with open chevron heads, and the Recursive face is a little bolder.
- Diagram kinds: every ```mermaid fence is a `diagram` node with a `kind` and a `support` level. `flowchart()` and `sequenceDiagram()` are built in, `mermaid({ kinds })` sets the registry, and other Mermaid types render as source.
- `sequenceDiagram`: participants, boxes, all message arrows, activation, notes, frames (`loop`, `alt`, `opt`, `par`, `critical`, `break`, `rect`), `autonumber` and titles as static SVG, with a writer that emits plain Mermaid. `create` and `destroy` are dropped and reported as lossy.
- Sequence canvas: participants, messages, notes and frames are added, edited inline, reordered by dragging and wrapped or unwrapped, each gesture one undo step.
- Tolerant flowchart parser: spacing variants, `flowchart-elk`, hyphenated ids, `classDef`, `class`, `click`, comments and directives are kept and re-emitted; unknown statements are problems, not failures.
- Editor: the block header shows kind and support, flowcharts and sequence diagrams toggle between canvas and text, other kinds get a source editor with live preview, and `mermaid({ editors })` maps a kind to its own editor component.
- `@react-markdown-kit/mermaid/client`: `diagramFallback({ render })` draws unsupported kinds with a host renderer after mount.
- Fifteen `--rmk-diagram-*` colour tokens for kinds without payload colours, with Mermaid default fallbacks.
- New diagnostics `DIAGRAM_KIND_UNKNOWN`, `DIAGRAM_KIND_UNSUPPORTED`, `DIAGRAM_SYNTAX_INVALID` and `DIAGRAM_SYNTAX_IGNORED`.

## 0.1.0 (2026-09-20)

First release. `mermaid()` turns ```mermaid flowcharts into static SVG with no Mermaid.js at runtime; the `/editor` entry adds a drawing canvas that writes edits back as Mermaid plus one `%% rmk-layout v1` annotation (see `LAYOUT_ANNOTATION.md`). Flowcharts only.
