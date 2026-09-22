# Changelog

## Unreleased

- Diagram kinds. Every ```mermaid fence becomes a `diagram` node with a `kind` and a `support` level. `flowchart()` and `sequenceDiagram()` are the built-in kinds; `mermaid({ kinds })` sets the registry, and the `DiagramKind` types are exported for kinds of your own. Every other Mermaid type is detected by keyword (`MERMAID_KEYWORDS`) and rendered as source inside the figure, with `data-rmk-diagram-kind` and `data-rmk-diagram-support` on it.
- `sequenceDiagram`: participants and actors, boxes, the ten message arrows, activation, notes, `loop`, `alt`/`else`, `opt`, `par`/`and`, `critical`/`option`, `break`, `rect`, `autonumber` and titles, rendered as static SVG from a deterministic layout. A writer emits the model as plain Mermaid with every retained line; `create` and `destroy` are dropped and named `create-destroy` under `lossy`.
- Tolerant flowchart parser: arrows with or without spaces, `flowchart-elk`, ids with hyphens, `classDef`, `class`, `click`, comments and directives kept as retained lines the writer re-emits; a statement it cannot model is a problem, not a failure. Valid Mermaid ids are written back unchanged.
- `@react-markdown-kit/mermaid/client`: `diagramFallback({ render })` lets a host draw the kinds shown as source with its own renderer after mount.
- Colour tokens `--rmk-diagram-actor-fill` and fourteen more for kinds without payload colours, each with a fallback from Mermaid's default theme.
- New diagnostics `DIAGRAM_KIND_UNKNOWN`, `DIAGRAM_KIND_UNSUPPORTED`, `DIAGRAM_SYNTAX_INVALID` and `DIAGRAM_SYNTAX_IGNORED`, with ranges narrowed to the fence line.
- Sequence canvas: a sequence diagram is edited on its rendered picture. Participants and actors are added, renamed inline and reordered by dragging; a message is drawn from lifeline to lifeline and reordered by dragging; the property bar sets line, head, two-way, activation and swaps the ends; notes come from a "+" on a lifeline gap and move between `left of`, `right of` and `over`; items wrap in `loop`, `alt`, `opt`, `par`, `critical`, `break` or `rect`, with sections, unwrap and a draggable bottom edge; `autonumber` toggles from the tool row. Each gesture is one undo step; inline typing merges under the 300 ms rule.
- Editor: the block header shows the kind and support level; flowcharts and sequence diagrams toggle between the canvas and text; other kinds open in a source editor with a live preview and the problems listed; one insert button per kind (`diagram`, `diagram-<kind>`); a lossy diagram mounts read-only until acknowledged. `mermaid({ editors })` maps a kind name to the component that edits it (`DiagramKindEditor`, given `DiagramKindEditorProps`), so a kind of your own gets a canvas and a built-in one can be replaced.

## 0.1.0 (2026-09-20)

First release. `mermaid()` turns ```mermaid flowcharts into static SVG with no Mermaid.js at runtime; the `/editor` entry adds a drawing canvas that writes edits back as Mermaid plus one `%% rmk-layout v1` annotation (see `LAYOUT_ANNOTATION.md`). Flowcharts only.
