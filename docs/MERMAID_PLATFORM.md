# Mermaid diagram platform

> Status: Accepted, implementation in progress. Prepared 2026-09-22, revised the same day after review.
> Package: `@react-markdown-kit/mermaid`. Companion specs: `plugins/mermaid/LAYOUT_ANNOTATION.md`, `plugins/mermaid/DRAWING_FORMAT.md`, `docs/STYLING.md`.
> Scope of this revision: the diagram-kind platform, the `sequenceDiagram` kind, uniform editing, the host fallback, the Mermaid demo. No version bump and no release.

The key words MUST, MUST NOT, SHOULD and MAY are to be read as in RFC 2119.

## 1. Decision

Mermaid source is the document format. The plugin understands every ```` ```mermaid ```` fence, renders some diagram kinds as static SVG, edits fewer on a canvas, and hands the rest to the host through a documented fallback. Diagram kinds are a public extension point. Every kind is tested against Mermaid's own documentation examples and against Mermaid.js. One theme contract serves all kinds.

Reasons:

- Enterprises paste any Mermaid. A fence that silently becomes a code block loses to a host that runs Mermaid.js.
- Hand-written parsers per kind are the price of static, script-free, server-rendered SVG. The platform bounds that price: one detection algorithm, one node, one figure, one theme, one test harness, an explicit unsupported path.
- `sequenceDiagram` is the first kind after flowcharts. Azure DevOps wiki lists it first among its supported types, and it is the second most used Mermaid type on GitHub and Confluence.

## 2. Terms

- **Kind**: one Mermaid diagram type, named by Mermaid's keyword: `flowchart`, `sequenceDiagram`, `classDiagram`. `flowchart` covers the `flowchart`, `graph` and `flowchart-elk` headers.
- **Support level**: `static` when a registered kind parses and renders the fence; `source` otherwise.
- **Model**: the parsed, kind-specific value a kind produces from source. `DrawingData` is the flowchart model.
- **Retained lines**: lines a parser reads through without modelling. A kind's `write` re-emits them.
- **Problem**: a statement a kind could not model. `ignored` when Mermaid.js accepts it, `invalid` when Mermaid.js would reject it.

## 3. Detection

`detectDiagramKind(source, kinds)` in `core/detect.ts` mirrors Mermaid's `detectType`:

1. Strip front matter with `splitFrontMatter` (section 4.4).
2. Strip `%%{ … }%%` directives.
3. Strip `%%` comment lines.
4. The leading word is `/^\s*([A-Za-z][A-Za-z0-9-]*)/` on the remaining text. A registered kind matches when one of its `keywords` equals the word, or the word is the keyword followed by `-` and more characters (`flowchart-elk`). Matching is case-sensitive. Kinds are tried in registration order. `graphTD` matches nothing.
5. No registered match: the word is looked up, exactly, in `MERMAID_KEYWORDS`: `flowchart`, `graph`, `flowchart-elk`, `sequenceDiagram`, `classDiagram`, `classDiagram-v2`, `stateDiagram`, `stateDiagram-v2`, `erDiagram`, `journey`, `gantt`, `pie`, `quadrantChart`, `requirementDiagram`, `requirement`, `gitGraph`, `C4Context`, `C4Container`, `C4Component`, `C4Dynamic`, `C4Deployment`, `mindmap`, `timeline`, `zenuml`, `sankey-beta`, `sankey`, `xychart-beta`, `xychart`, `block-beta`, `block`, `packet-beta`, `packet`, `kanban`, `architecture-beta`, `architecture`, `radar-beta`, `treemap-beta`, `treemap`, `info`. A hit gives that `kind` and support `source`. The built-in kinds' keywords are in the table so that a registry without one of them still names its fences.
6. Otherwise `kind` is `unknown`, support `source`. When the word equals a registered keyword or a `MERMAID_KEYWORDS` entry case-insensitively, the result carries `hint` with the correct spelling.

Result: `{ kind: string; support: 'static' | 'source'; registered?: DiagramKind; hint?: string }`. Front matter, directives and comments never fail detection. Text still starting with `---` after step 1 is `unknown`.

## 4. Diagram kinds

### 4.1 Contract

`plugins/mermaid/src/core/kind.ts`:

```ts
export interface DiagramProblem {
  /** SCREAMING_SNAKE, prefixed with the kind name upper-cased: FLOWCHART_…, SEQUENCE_DIAGRAM_…. Unique within the kind. */
  readonly code: string
  /** 'ignored': Mermaid.js accepts the statement, this kind does not model it. 'invalid': Mermaid.js rejects the fence or throws at render. */
  readonly severity: 'ignored' | 'invalid'
  /** Names a line number and an identifier at most; never a full line of author content. */
  readonly message: string
  /** 1-based line inside the fence body. */
  readonly line?: number
  /** JSON path inside an annotation or payload, when the problem is about a value. */
  readonly path?: string
}

export interface RetainedLine {
  /** 1-based line inside the fence body. */
  readonly line: number
  /** The line, byte for byte. */
  readonly text: string
  /** Where `write` re-emits it: 'frontMatter' inside the leading --- block, 'body' after the statements. */
  readonly place: 'frontMatter' | 'body'
}

export interface DiagramParse<Model> {
  readonly model: Model
  readonly problems: readonly DiagramProblem[]
  /** Lines read through without modelling, in source order. Handed back to `write` unchanged. */
  readonly retained: readonly RetainedLine[]
  /** Features the kind's editor cannot preserve on edit, as fixed strings. Empty for kinds without `write`. */
  readonly lossy: readonly string[]
}

export interface DiagramParseError {
  readonly error: string
  readonly line?: number
}

export interface DiagramRenderOptions {
  readonly fallbackTitle: string
}

export interface DiagramWriteOptions {
  readonly retained: readonly RetainedLine[]
}

export interface DiagramKind<Model = unknown> {
  /** Mermaid keyword id: 'flowchart', 'sequenceDiagram'. Unique per registry. */
  readonly name: string
  /** Detection keywords: ['flowchart', 'graph']. */
  readonly keywords: readonly string[]
  /** Human label: 'Flowchart'. */
  readonly label: string
  /** SVG path data for the insert button, 24x24 viewBox. */
  readonly icon?: string
  /** Source inserted by the editor's insert command. Valid Mermaid. */
  readonly starter: string
  parse(source: string): DiagramParse<Model> | DiagramParseError
  /** Static SVG as hast. Absent means support level 'source'. */
  render?(model: Model, options: DiagramRenderOptions): Element
  /** Canonical source for `model`. Absent means no editor writes the model; the source editor writes text. */
  write?(model: Model, options: DiagramWriteOptions): string
}
```

Rules:

- `parse` MUST NOT throw. The only `DiagramParseError` is a fence whose first statement is not the kind's header.
- `parse` MUST accept everything Mermaid accepts for the documented subset and MUST be tolerant outside it: a statement the kind does not model is a problem and a retained line, never an error.
- For every kind, `%%{ … }%%` directives, `%%` comments and front-matter keys other than `title` are retained lines and never problems. The `%% rmk-layout` annotation line is never retained; the flowchart writer always emits exactly one.
- A model is a plain JSON-compatible object: no class instances, functions or cycles. When it has a string `title`, `toFigure` uses it as the caption and `render` as the SVG's accessible name; otherwise `render` uses `options.fallbackTitle` and there is no caption.
- `render` returns one `svg` element with `role="img"` and a `title` child, as `renderDrawingSvg` does. No `script`, no `foreignObject`, no URLs. Colours are attributes. Theme colours use `var(--rmk-diagram-<token>, #rrggbb)` per section 7.
- `write` MUST re-emit every retained line exactly once and MUST NOT depend on anything else from the previous source. `write` is a fixed point: `write(parse(write(m, o)).model, o) === write(m, o)`, and `parse(write(m, o)).model` deep-equals `m` when every number in `m` has at most two decimals. Its output MUST be accepted by Mermaid.js.
- The editor side of a kind is the source editor of section 9. The canvas is the built-in flowchart editor and is not configurable per kind in this revision.

### 4.2 Registry

`mermaid({ kinds })` takes an ordered list. Default `[flowchart(), sequenceDiagram()]`. A consumer trims the bundle with `mermaid({ kinds: [flowchart()] })` or adds a kind of its own. Detection order is registry order.

Kind factories are configuration values like `gfm()`. The root entry exports `flowchart`, `sequenceDiagram`, `MERMAID_KEYWORDS` and the types `DiagramKind`, `DiagramParse`, `DiagramParseError`, `DiagramProblem`, `DiagramRenderOptions`, `DiagramWriteOptions`, `RetainedLine`. No parser, renderer or writer function is exported on its own. `tests/packaging.test.ts` keeps its forbidden-name list and its comment reads: extension and kind factories, types, schemas; no standalone API.

Two kinds sharing a name or a keyword make `mermaid()` throw `MarkdownConfigurationError('DIAGRAM_KINDS_INVALID', 'Diagram kinds "a" and "b" both claim keyword "x".')`.

### 4.3 Built-in kinds

**`flowchart`**: keywords `flowchart`, `graph`. Model `DrawingData`. `render` is `renderDrawingSvg`. Editor: canvas.

`parse` is `parseMermaidFlowchart` made tolerant:

- An id token ends before `--`, `-.`, `==`, `~~~`, `@{`, `@-`, `<-`, `-->`, so `A-->B`, `A---B`, `A-.->B`, `A==>B` read as edges with and without spaces. Ids MAY contain `-` between alphanumerics (`my-box`).
- The header regex accepts `flowchart`, `graph`, `flowchart-elk` and any direction, case-sensitive on the keyword. `Flowchart LR` is `DIAGRAM_KIND_UNKNOWN` with a hint, by detection, before parse runs.
- A statement the parser cannot read is problem `FLOWCHART_UNKNOWN_STATEMENT` (`invalid`, line N) and a retained line.
- `@{ … }` node config, `e1@` edge ids, `~~~` invisible links, `click`, `classDef`, `class`, comments and directives are retained lines. `click`, `classDef` and `class` are not problems. `@{ … }`, `e1@` and `~~~` are `FLOWCHART_SYNTAX_IGNORED` (`ignored`).
- A `:::cls` suffix becomes a retained body line `class <id> cls`.
- A rejected layout annotation is problem `FLOWCHART_LAYOUT_INVALID` (`invalid`) with the validator's `path` and message; the model is auto-laid out.
- `lossy` names, fixed strings: `subgraph`, `edge-style` (dotted, thick, invisible, circle and cross heads, long arrows), `shape` (a bracket written back as another shape: `[/ /]`, `[\ \]`, `{{ }}`, `((( )))`, `( )`, `(( ))`, since the writer emits `[ ]` and `([ ])`), `linkStyle`, `style-property` (a `style` declaration other than fill or stroke). `linkStyle` lines are not retained.
- The parser rounds all geometry to two decimals, so the fixed-point rule (`parse(write(parse(x))) = parse(write(x))`) holds for auto layout as well as for annotated diagrams.

`write` is `drawingToMermaid` and emits, in order: one `---` block holding `title:` and the retained front-matter lines (omitted when both are empty); the header; node lines; edge lines; `style` lines; the retained body lines in original order; the `%% rmk-layout v1` line last. Ids the parser accepted are written unchanged; only ids that are not valid Mermaid ids (`/^[A-Za-z0-9_]+(-[A-Za-z0-9_]+)*$/`) are rewritten, and canvas-created ids are always valid. Retained lines are re-emitted verbatim; a reference in them to an id that no longer exists is valid Mermaid and not reported. `LAYOUT_ANNOTATION.md` section 8 is updated to match.

**`sequenceDiagram`**: keyword `sequenceDiagram`. Model `SequenceModel` (section 8). No `write` in this revision. Editor: source.

### 4.4 Shared helpers

`core/front-matter.ts` exports `splitFrontMatter(source): { frontMatter?: string; body: string; bodyOffset: number }` using Mermaid's regex `^([^\S\n\r]*)-{3}\s*[\n\r](.*?)[\n\r]\1-{3}\s*[\n\r]+` with the `s` flag, and `readFrontMatterTitle`. `core/text.ts` exports `decodeText` (`#NN;`, `#quot;`, `#lt;`, `#gt;`, `<br/>`). Detection and every parser use them.

## 5. The mdast node

One node type, `diagram`, for every kind. One block adapter and one Lexical node dispatch on `kind`.

```ts
export interface DiagramNode extends MarkdownNode {
  readonly type: 'diagram'
  /** Fence: 'mermaid', or the legacy JSON fences 'diagram' and 'drawing'. */
  readonly format: DiagramFormat
  /** Kind name from detection; 'flowchart' for the legacy fences; 'unknown' when undetected. */
  readonly kind: string
  readonly support: 'static' | 'source'
  /** Fence body, byte for byte. This is what serializes. */
  readonly value: string
  readonly meta?: string
  readonly model?: unknown
  readonly error?: string
  readonly problems?: readonly DiagramProblem[]
  readonly retained?: readonly RetainedLine[]
  readonly lossy?: readonly string[]
}
```

- Every ```` ```mermaid ```` fence is lifted. No fence stays a `code` node.
- `position` is copied from the code node. The editor's raw-source contract depends on it.
- `value` and `meta` serialize back to the same fence with the existing backtick-run rule.
- `template.literalNodeTypes` stays `['diagram']`.
- `diagramNodeFrom(value, format, kinds, extra?)` in `extension.ts` builds the node; the syntax transform and the editor's block adapter both use it.

Diagnostics live in `plugins/mermaid/src/diagnostics.ts` on the slides pattern: a code table, a severity table, a message table, `diagramDiagnostic(code, range, detail?)`. The `error` string of a `DiagramParseError` goes into the node, never into a message.

| Code | Severity | When | Message |
| --- | --- | --- | --- |
| `DIAGRAM_INVALID` | warning | A registered kind returned `DiagramParseError`. | "The <label> block could not be read and is shown as source (line N)." |
| `DIAGRAM_KIND_UNKNOWN` | warning | `kind` is `unknown`. | "The mermaid block does not start with a Mermaid diagram keyword." With a hint: "Mermaid keywords are case-sensitive; expected `sequenceDiagram`." |
| `DIAGRAM_KIND_UNSUPPORTED` | info | Support is `source` and `kind` is not `unknown`. | "<kind> diagrams are shown as source." |
| `DIAGRAM_LAYOUT_INVALID` | warning | A problem with code `FLOWCHART_LAYOUT_INVALID`. Carries that problem's `path`. | Unchanged. |
| `DIAGRAM_SYNTAX_INVALID` | warning | Each `invalid` problem, at most 20 per fence. | "Line N: <problem message>" |
| `DIAGRAM_SYNTAX_IGNORED` | info | Each `ignored` problem, at most 20 per fence. | "Line N: <problem message>" |

Per-problem diagnostics narrow `range` to the fence line the problem names (fence start line plus `problem.line`; the opening fence is the start line), or the whole fence when `line` is absent. `path` is set only for `DIAGRAM_LAYOUT_INVALID`.

## 6. Rendering

`toFigure` emits, for every kind:

```html
<figure data-rmk-diagram="mermaid" data-rmk-diagram-kind="sequenceDiagram" data-rmk-diagram-support="static">
  <svg …>…</svg>
  <figcaption>title</figcaption>
</figure>
```

`data-rmk-diagram` carries the node's `format` (`mermaid`, `diagram`, `drawing`), unchanged from today. Support `source`, or a parse error:

```html
<figure data-rmk-diagram="mermaid" data-rmk-diagram-kind="classDiagram" data-rmk-diagram-support="source">
  <pre><code class="language-mermaid">…</code></pre>
</figure>
```

A parse error adds `data-rmk-diagram-error`. The code class is `language-<format>`. The `diagram` class hook and the stylesheet apply unchanged because the element stays `figure[data-rmk-diagram]`.

### 6.1 Host fallback

Entry `@react-markdown-kit/mermaid/client`, built with the `'use client'` banner. Exports:

```ts
export function diagramFallback(options: {
  /** SVG markup for a fence the plugin shows as source. The host decides how: Mermaid.js, Kroki, a server. */
  render: (source: string, kind: string) => Promise<string>
}): MarkdownExtension
```

It returns `{ name: 'mermaid-fallback', version: '1', contractVersion: 1, capabilities: { renderer: { components: { figure } } } }`, listed after `mermaid()`. The component passes every figure through unchanged unless `data-rmk-diagram-support="source"` or `data-rmk-diagram-error` is present. It reads the body from the `code` element's text child of the hast `node` prop. The first client render equals the server markup. After a `mounted` effect resolves `render`, a `div[data-rmk-diagram-fallback]` with `dangerouslySetInnerHTML` replaces the `pre`; the host chose the renderer and owns its output, the kit's policy does not run on it. Failure keeps the source. The plugin never depends on Mermaid.js.

Build: `tsup.config.ts` becomes two configs as in `plugins/slides`: `{ index }` with `treeshake: true`, and `{ client, editor }` with `banner: { js: "'use client';" }`, `splitting: true`, `treeshake: false`; both `clean: false`; the `build` script empties `dist` first. `pack-check` asserts `dist/client.js` and `dist/editor.js` start with the banner. `tsconfig.json` paths and `vitest.config.ts` aliases gain `@react-markdown-kit/mermaid/client`, listed before the package root.

## 7. Theme

Kinds without payload colours take colours from custom properties. `svg/theme.ts` is the only place tokens are declared. Tokens are named by role, never by kind; a new kind reuses roles before adding one. Every fallback is a six-digit hex colour taken from Mermaid's default theme, so an unstyled document looks like Mermaid and the demo's export can inline it.

| Token | Mermaid variable | Fallback |
| --- | --- | --- |
| `--rmk-diagram-actor-fill` | actorBkg | `#ececff` |
| `--rmk-diagram-actor-stroke` | actorBorder | `#9370db` |
| `--rmk-diagram-actor-text` | actorTextColor | `#333333` |
| `--rmk-diagram-line` | actorLineColor | `#9370db` |
| `--rmk-diagram-signal` | signalColor | `#333333` |
| `--rmk-diagram-signal-text` | signalTextColor | `#333333` |
| `--rmk-diagram-label-fill` | labelBoxBkgColor | `#ececff` |
| `--rmk-diagram-label-stroke` | labelBoxBorderColor | `#9370db` |
| `--rmk-diagram-label-text` | labelTextColor | `#333333` |
| `--rmk-diagram-note-fill` | noteBkgColor | `#fff5ad` |
| `--rmk-diagram-note-stroke` | noteBorderColor | `#aaaa33` |
| `--rmk-diagram-note-text` | noteTextColor | `#333333` |
| `--rmk-diagram-activation-fill` | activationBkgColor | `#f4f4f4` |
| `--rmk-diagram-activation-stroke` | activationBorderColor | `#666666` |
| `--rmk-diagram-number-text` | sequenceNumberColor | `#ffffff` |

The autonumber badge fill is `--rmk-diagram-signal`. Attributes are written as `fill="var(--rmk-diagram-note-fill, #fff5ad)"`. `styles.css` declares no colour for these tokens; `public-sites/shared/kit.css` maps them for both colour modes, on both `.rmk-document` and `.rmk-editor`, and narrows its dark-mode invert filter to `[data-rmk-diagram-kind='flowchart'] svg` so token-coloured kinds are not inverted; `mermaid.mdx` documents them. Front-matter `config.theme` and `themeVariables` are retained lines, not read.

## 8. The `sequenceDiagram` kind

### 8.1 Model

```ts
interface Participant { id: string; label: string; kind: 'participant' | 'actor' }
interface Box { label?: string; participantIds: string[] }
interface Message {
  type: 'message'; from: string; to: string
  line: 'solid' | 'dotted'; head: 'none' | 'arrow' | 'open' | 'cross'; bidirectional: boolean
  text: string; activate?: '+' | '-'
}
interface Note { type: 'note'; placement: 'left' | 'right' | 'over'; participantIds: string[]; text: string }
interface Frame { type: 'frame'; kind: 'loop' | 'alt' | 'opt' | 'par' | 'critical' | 'break' | 'rect'; sections: { label: string; items: SequenceItem[] }[] }
type SequenceItem = Message | Note | Frame
interface Activation { participantId: string; start: number; end: number }
interface SequenceModel {
  title?: string
  participants: Participant[]
  boxes: Box[]
  items: SequenceItem[]
  /** Indices into the depth-first flattening of `items`. */
  activations: Activation[]
  numbering?: { start: number; step: number }
}
```

### 8.2 Subset

Statements, case-insensitive on the keyword, terminated by newline or `;`. The parser splits a line at `;` before tokenising, as Mermaid does; an empty statement is ignored.

| Construct | Source | Notes |
| --- | --- | --- |
| Participant | `participant A`, `participant A as Label`, `actor A`, `actor A as Label` | declaration order; undeclared ids are appended on first use |
| Box | `box [colour] [label]` … `end` | colour is retained in the label as Mermaid does; boxes hold participant statements only, and any other statement inside one is `SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT` |
| Message | `A->B: text` with `->`, `-->`, `->>`, `-->>`, `<<->>`, `<<-->>`, `-x`, `--x`, `-)`, `--)` | `+`/`-` after the arrow sets `activate` |
| Activation | `activate A`, `deactivate A` | `Activation.start`/`end` are flattened item indices; an activation still open at the end ends at the last index and is an `ignored` problem |
| Note | `Note left of A: t`, `Note right of A: t`, `Note over A: t`, `Note over A,B: t` | |
| Frame | `loop t`, `alt t`/`else t`, `opt t`, `par t`/`and t`, `critical t`/`option t`, `break t`, `rect colour` … `end` | nested arbitrarily; `par_over t` opens a `par` frame; `rect`'s colour is its section label |
| Autonumber | `autonumber`, `autonumber N`, `autonumber N M` | before the first message; later forms and `autonumber off` are retained and `ignored` |
| Title | front matter `title:`, `title X`, `title: X` | a body `title` statement overrides the front-matter title |
| Text | `<br/>`, `#NN;` | decoded with `decodeText` |

`invalid` problems: `SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT` (message adds "use #59; for a semicolon in text" when the residue follows a `;`), `SEQUENCE_DIAGRAM_DEACTIVATE_INACTIVE`, `SEQUENCE_DIAGRAM_END_WITHOUT_OPENER`, `SEQUENCE_DIAGRAM_SECTION_OUTSIDE_FRAME` (`else`, `and`, `option` outside `alt`, `par`, `critical`), `SEQUENCE_DIAGRAM_FRAME_UNCLOSED`.

`ignored` problems, all retained: `SEQUENCE_DIAGRAM_STATEMENT_IGNORED` for `link`, `links`, `properties`, `details`, `create`, `destroy`, `accTitle`, `accDescr`, half-arrows, `()` connections, `@{ … }` participant config, `autonumber off`; `SEQUENCE_DIAGRAM_ACTIVATION_UNCLOSED` (Mermaid.js accepts it; the bar is drawn to the last item).

`problems` is what keeps LLM-written diagrams readable: a statement the kind does not model degrades the rendering, never the document, and an `invalid` problem tells the author that Mermaid.js itself would reject the fence.

### 8.3 Layout

Deterministic, needs no annotation. `core/sequence/layout.ts` is pure.

- Participants are columns in declaration order. Column width is the wider of the label's text box plus padding and 100. The gap between two columns grows to fit the widest message or note text between them.
- Participant boxes at top and, mirrored, at bottom. `actor` draws the stick figure; `participant` draws a rectangle.
- Each message, note and frame boundary takes one row at a fixed pitch. Message text sits above its line. A self message draws a right-hand loop.
- Activation bars are rectangles centred on the lifeline, offset by nesting depth.
- Frames are rectangles spanning the leftmost to the rightmost participant they touch, with a label tab at top left; sections split with a dashed line and a bracketed label.
- Autonumber badges are circles at the message start.

### 8.4 Rendering

`svg/sequence-render.ts` emits hast through the existing `h`, `text`, `n` helpers and the section 7 tokens. Colours come only from tokens, so a `rect` frame draws as a filled rectangle using the label tokens at reduced opacity, and a box likewise; the colour named in the source is not read. Dotted lines use `stroke-dasharray`. Arrowheads: filled triangle (`arrow`), open chevron (`open`), cross (`cross`). Fonts follow `drawing-data.ts` constants.

## 9. Editing

### 9.1 Source of truth

The Lexical `DiagramNode` stores the fence body and its kind. It no longer stores drawing JSON. Parsing happens outside the node.

```ts
class DiagramNode extends DecoratorNode {
  __source: string                     // fence body, or the edited text
  __kind: string
  __format: DiagramFormat              // fence it came from; 'mermaid' once edited
  __raw: string | null                 // exact block bytes from import, fence included; null once edited
  __origin: DiagramMdastNode | null    // untouched import; null once edited
  __meta: string | null                // fence meta from import, so an edited export keeps it
  getSource(): string
  getKind(): string
  getRaw(): string | null
  getOrigin(): DiagramMdastNode | null
  setSource(next: string, kinds: readonly DiagramKind[]): void   // re-detects kind; nulls __raw and __origin; __format = 'mermaid'
}
```

- `getType()` stays `rmk-diagram`.
- `kinds`, `sourceEditor` and `fallbackTitle` reach components through `DiagramCanvasOptions`, published by `createDiagramPlugin` with `setDiagramOptions`. Nothing about kinds is module state. The block adapter is created per registry by `createDiagramBlockAdapter(kinds)` and the toolbar contributions by `diagramCommands(kinds)`; both are internal to the editor entry. `parseDiagramSource(kinds, kind, source)` is memoised on `(kinds, kind, source)` in a bounded cache, as drawing JSON is today.
- Legacy fences: on import of a `diagram` or `drawing` fence, `__source` is `flowchart.write(model)` (or of `EMPTY_DRAWING` when the payload did not parse), `__kind` is `flowchart`, `__format` is the legacy name, `__raw` and `__origin` hold the import. Byte-exact write-back comes from `__raw` while untouched, so the conversion is invisible until the first edit, after which the block is written as ```` ```mermaid ````.
- Serialized node version 2: `{ source, kind, format }`. Version 1 payloads (`data` JSON) import by converting with `flowchart.write`. Both produce edited nodes.
- Clipboard: `exportDOM` writes `pre[data-rmk-mermaid][data-rmk-diagram-kind]` with the body, so a pasted block renders on GitHub and Azure DevOps. `importDOM` accepts `pre[data-rmk-mermaid]` and, for older clipboards, `pre[data-rmk-drawing]` converted with `flowchart.write`.
- The block adapter's `$import(node, source)` stores `origin.value` as `__source` and `source === '' ? null : source` as `__raw`. `$export` returns `{ node: origin, raw: getRaw() }` while `__origin !== null`, else `{ node: diagramNodeFrom(source, 'mermaid', kinds, { meta }), raw: null }` with `meta` read from `__meta`, which holds the origin's `meta` when present.

### 9.2 The block

`decorate` renders `DiagramBlock`, which owns the mode state and renders a header row and one editing component.

Header row: kind label, support badge, and for a canvas kind a "Text"/"Canvas" toggle. In read-only editors the header shows label and badge only, and the block renders the kind's `render` output or the source `pre`.

Mode: canvas when the format is legacy or the kind is the built-in `flowchart` and `sourceMode` is off; source otherwise. `sourceMode` is component state set by the toggle. The kind is re-detected on every `setSource` and the badge updates immediately, but the editing component never changes while the block's textarea has focus; a mode change implied by a new kind takes effect on blur or on the toggle. The toggle is disabled, with the parse error as its title, while the source does not parse.

**Canvas.** The existing `DiagramCanvas`. Its input is the model from `parseDiagramSource`. On change it computes `written = flowchart.write(payload, { retained })`, sets `lastCommittedRef` to `serializeDrawingData(flowchart.parse(written).model)`, then calls `setSource(written, kinds)`. While `lossy` is non-empty and unacknowledged, the canvas mounts read-only, with no tool row, no pointer editing and no height grip, behind a notice that lists the lossy features by name and offers "Edit on canvas" (acknowledges for this block, in component state) and "Edit as text" (sets `sourceMode`). The first commit can only happen after "Edit on canvas".

**Source.** A monospace `textarea` (Tab inserts two spaces, Shift+Tab removes up to two leading spaces, Enter is native, Escape moves focus to the header row), the live preview above it rendered by the kind's `render` through `hast-util-to-jsx-runtime` with `react/jsx-runtime`, and the problems list under it with line numbers, `invalid` problems first with the prefix "Mermaid rejects:". Kinds without `render` show the unsupported notice instead of a preview. When `DiagramCanvasOptions.sourceEditor` is `false` the textarea is absent and the block shows preview and problems only. Without a textarea, a kind without `render` shows the source `pre` under the notice. Native listeners on the textarea call `stopPropagation` for `keydown`, `keyup`, `keypress`, `beforeinput`, `input`, `paste`, `cut`, `copy`, `drop`, `compositionstart`, `compositionupdate` and `compositionend`, following `canvas/text-edit-overlay.tsx`.

History: the textarea is controlled by a local draft. Each change commits `setSource(draft, kinds)` in `editor.update(…, { discrete: true })` with the `history-merge` tag when the previous commit from this block was less than 300 ms ago, otherwise as a new history entry. Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl+Y inside the textarea are prevented and dispatched as Lexical `UNDO_COMMAND`/`REDO_COMMAND`. When the node's source changes and differs from the last value this block committed, the draft is replaced and the caret placed at the end; a change equal to the last commit is ignored.

### 9.3 Insert

`INSERT_DIAGRAM_COMMAND` payload gains `kind?: string`, default `flowchart`. A kind not in the registry makes the handler return `false` without inserting. The toolbar contributes one button per registered kind with a `starter`: id `diagram` for the flowchart (legacy id, so existing label overrides keep working) and `diagram-<kind>` for the others, group `diagram`, icon from the kind. The `diagram.` prefix stays reserved for canvas labels. The insert writes the kind's `starter` verbatim. After insertion the block receives focus: the canvas root for the flowchart, the textarea with the caret at the end for source kinds.

### 9.4 Mistake-proofing

- A fence is never lost: parse errors keep the source in the node, the document and the rendered figure.
- A canvas edit never destroys what it cannot draw: retained lines are re-emitted, and lossy features block editing until acknowledged.
- Parsers are tolerant: keywords case-insensitive where Mermaid is, trailing `;` accepted, both `graph` and `flowchart`, arrows with or without spaces, directives and unknown front-matter keys retained, unknown statements retained and reported.
- A case slip in the keyword is named as such, with the expected spelling.
- Source mode never blocks a keystroke and never rewrites text; it signals. `invalid` problems appear while typing and reach hosts as `DIAGRAM_SYNTAX_INVALID` after save. The claim that written output is accepted by Mermaid.js applies to kinds with `write`.
- Problems surface where the mistake is: in the source editor with line numbers, and in compile diagnostics with a narrowed range.

## 10. Tests

### 10.1 Unit

- `detect.test.ts`: every keyword in `MERMAID_KEYWORDS`, with and without front matter, directives and comments; `flowchart-elk`; `graphTD`; malformed front matter; `unknown`; case hints.
- `mermaid-parse.test.ts` gains: every arrow spelling in Mermaid's flowchart docs table with and without spaces parses to the same model; unknown statements become problems and retained lines; `:::cls` becomes a retained `class` line; ids with hyphens survive `write`.
- `mermaid.test.ts` gains: write order with retained front-matter and body lines; the fixed-point rule; exactly one annotation line.
- `sequence-parse.test.ts`: every construct in 8.2, `;` splitting, retained lines, every problem code with its line, activation balance, nested frames, model snapshots for the corpus.
- `sequence-render.test.ts`: hast for the corpus, no `script` or `foreignObject`, every colour attribute matches `/^var\(--rmk-diagram-[a-z-]+, #[0-9a-f]{6}\)$/`, one `svg[role=img]` with a `title`.
- `theme.test.ts`: every fallback is six-digit hex.
- `extension.test.tsx`: the test "leaves other Mermaid diagram types as ordinary code blocks" is replaced by "renders a class diagram as a source figure with DIAGRAM_KIND_UNSUPPORTED"; a sequence fence renders static; a parse error keeps source; `data-rmk-diagram-kind` and `-support` on the figure; the four exact `<figure data-rmk-diagram="…">` strings become attribute regexes; `DIAGRAM_KIND_UNKNOWN` with hint for `SequenceDiagram`.
- `editor-bridge.test.tsx`: untouched flowchart, sequence and class fences round-trip byte for byte; legacy fences still round-trip and still convert on first edit; a canvas edit re-emits retained lines; a source edit writes the text; version 1 node JSON imports; `meta` survives an edit.
- `editor-source.test.tsx`: source mode renders a preview, lists problems with `invalid` first, stops key propagation, keeps its component while focused and switches on blur, coalesces three quick keystrokes into one undo step, routes Ctrl+Z to Lexical, `sourceEditor: false` hides the textarea.
- `editor-canvas.test.tsx` gains: a lossy flowchart mounts read-only behind the notice until acknowledged.

### 10.2 Conformance

`plugins/mermaid/tests/corpus/<kind>/*.mmd` holds the examples from the syntax documentation of the installed Mermaid version, verbatim. An example that `mermaid.parse` rejects at that version is left out and listed in `corpus/README.md` with the version that adds it. For each file: the kind's `parse` returns a model with no `invalid` problem, and for kinds with `write`, `write(parse(x))` parses to an equal model and contains every retained line.

`mermaid` (11.x, the version already in `pnpm-lock.yaml`) is added to the root `package.json` `devDependencies` only, never to a package's `dependencies` or `peerDependencies`. `plugins/mermaid/tests/conformance.dom.test.ts` runs under jsdom by its name, imports Mermaid.js unconditionally, and asserts `mermaid.parse(text, { suppressErrors: false })` resolves for every corpus file and every `write` output. The test never skips. `tests/packaging.test.ts` checks `dependencies` and `peerDependencies` only, so the root devDependency does not touch the headless gate.

### 10.3 Existing guards

`tests/packaging.test.ts` keeps the root entry headless and its forbidden-name list. `scripts/pack-check.mjs`'s diagram journey matches `/<figure data-rmk-diagram="diagram"[^>]*>/` and gains the `dist/client.js` banner check. `check-css-scope` passes. `published-figures` passes with no new numbers. `tests/mermaid-share.test.ts` is unchanged.

## 11. Demo

`public-sites/mermaid-demo`:

- The preset is `mermaid({ style: 'ink', sourceEditor: false })`. The left code pane stays the source editor.
- Status chip reads the lifted node: "Flowchart · auto layout", "Flowchart · rmk-layout v1", "Sequence diagram · static", "Class diagram · source only", "Not Mermaid" for `unknown` with the hint as its message. The "Not a flowchart" state is removed. `invalid` problems show as "Mermaid rejects line N".
- Samples are grouped: Flowcharts (the existing eight) and Sequence diagrams (sign-in with alt/else, API call with activation and notes, parallel work, loop with autonumber). Every sample compiles with no diagnostic. No sample contains a raw `;` in text.
- Code-pane highlighting takes its keyword set from the detected kind.
- The right pane shows the block: canvas for flowcharts, preview and problems for sequence diagrams, the unsupported notice over the source `pre` for source-only kinds. The demo CSS generalises its `.rmk-diagram*` selectors so every mode fills the pane.
- Export works for every static kind.
- Landing copy, meta description, FAQ, `index.html` and `public-sites/shared/llms/llms.txt` say flowcharts and sequence diagrams; every measured figure stays verbatim; the SEO surface test stays green.
- `tests/mermaid-demo.dom.test.tsx` is committed with the change: "has nothing to export for a diagram type the canvas does not open" becomes "exports an SVG for the sequence sample"; the sample loop asserts no diagnostics for every sample.

## 12. Docs and package

- `public-sites/docs/docs/mermaid.mdx`: the kinds table, support levels, the fallback entry, the theme tokens, the sequence subset, the problem codes.
- `plugins/mermaid/README.md`: replaces "Flowcharts only" with the kinds table. `README.md` at the repo root and `llms.txt` follow.
- `plugins/mermaid/CHANGELOG.md`: an `Unreleased` section. `version` stays `0.1.0`.
- `plugins/mermaid/package.json`: exports gain `./client`; `dependencies` gain `hast-util-to-jsx-runtime` at the renderer's range; `build` becomes the slides form.
- `plugins/mermaid/LAYOUT_ANNOTATION.md` section 8: id rewriting now applies only to ids that are not valid Mermaid ids.

## 13. Out of scope for this revision

- A scene layer shared by the flowchart and sequence renderers.
- Structured, non-text editing of sequence diagrams, and a per-kind editor component on `DiagramKind`.
- `stateDiagram`, `gantt`, `erDiagram` kinds. `stateDiagram` maps onto the flowchart model and canvas and is the cheapest next kind.
- Canvas theming through the section 7 tokens. The canvas keeps its white surface and dark filter.
- Honouring `config.theme` and `themeVariables`.
- A `dialect` write option for hosts whose Mermaid is older (Azure DevOps `graph` header).
- A line-number gutter on the source textarea and auto-collapsing the source editor behind the preview.
