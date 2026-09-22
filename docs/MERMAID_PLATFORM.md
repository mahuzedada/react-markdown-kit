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
  /**
   * The line, byte for byte, when none of its statements was modelled. For a `%%` comment after a statement on the same line, the comment text from `%%` to the end of the line.
   * When some statements of a line were modelled, the statements that were not, joined by `; ` and without the indentation, so a modelled statement is never re-emitted.
   */
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
- For every kind, `%%{ … }%%` directives, `%%` comments and front-matter keys other than `title` are retained lines and never problems. The `%% rmk-layout` annotation is read wherever it appears (on its own line, after a statement, or inside a run of lines that is otherwise retained) and is never retained; the flowchart writer always emits exactly one.
- A model is a plain JSON-compatible object: no class instances, functions or cycles. When it has a string `title`, `toFigure` uses it as the caption and `render` as the SVG's accessible name; otherwise `render` uses `options.fallbackTitle` and there is no caption.
- `render` returns one `svg` element with `role="img"` and a `title` child, as `renderDrawingSvg` does. No `script`, no `foreignObject`, no URLs. Colours are attributes. Theme colours use `var(--rmk-diagram-<token>, #rrggbb)` per section 7.
- `write` MUST re-emit every retained line exactly once and MUST NOT depend on anything else from the previous source. `write` is a fixed point: `write(parse(write(m, o)).model, o) === write(m, o)`, and `parse(write(m, o)).model` deep-equals `m` when every number in `m` has at most two decimals. Its output MUST be accepted by Mermaid.js.
- The editor side of a kind is the source editor of section 9, or, when the kind has `write` and the editor entry maps its name to a `DiagramKindEditor` (9.2), that canvas component. The built-in map holds the flowchart canvas and the sequence canvas.

### 4.2 Registry

`mermaid({ kinds })` takes an ordered list. Default `[flowchart(), sequenceDiagram()]`. A consumer trims the bundle with `mermaid({ kinds: [flowchart()] })` or adds a kind of its own. Detection order is registry order.

Kind factories are configuration values like `gfm()`. The root entry exports `flowchart`, `sequenceDiagram`, `MERMAID_KEYWORDS` and the types `DiagramKind`, `DiagramParse`, `DiagramParseError`, `DiagramProblem`, `DiagramRenderOptions`, `DiagramWriteOptions`, `RetainedLine`. No parser, renderer or writer function is exported on its own. `tests/packaging.test.ts` keeps its forbidden-name list and its comment reads: extension and kind factories, types, schemas; no standalone API.

Two kinds sharing a name or a keyword make `mermaid()` throw `MarkdownConfigurationError('DIAGRAM_KINDS_INVALID', 'Diagram kinds "a" and "b" both claim keyword "x".')`.

### 4.3 Built-in kinds

**`flowchart`**: keywords `flowchart`, `graph`. Model `DrawingData`. `render` is `renderDrawingSvg`. Editor: canvas.

`parse` is `parseMermaidFlowchart` made tolerant:

- An id token ends before `--`, `-.`, `==`, `~~~`, `@{`, `@-`, `<-`, `-->`, so `A-->B`, `A---B`, `A-.->B`, `A==>B` read as edges with and without spaces. An id is Unicode letters, digits and `_` with a single `-`, `.` or `:` between them (`my-box`, `api.gateway`, `svc:4`, `Пользователь`), matching Mermaid's lexer. The keywords `end`, `subgraph`, `graph`, `flowchart`, `style`, `classDef`, `class`, `click` and `linkStyle` are never ids: a statement naming one is problem `FLOWCHART_RESERVED_ID` (`invalid`, line N, message naming the id) and a retained line. `End`, `END`, `direction` and `default` are ids, as Mermaid accepts them.
- The header regex accepts `flowchart`, `graph`, `flowchart-elk` and any direction, case-sensitive on the keyword. `Flowchart LR` is `DIAGRAM_KIND_UNKNOWN` with a hint, by detection, before parse runs. When the keyword is right but the direction is not (`graph td`, `flowchart Td`), the `DiagramParseError` reads `Unknown direction "td" after "graph"; Mermaid directions are TB, TD, BT, LR, RL (case-sensitive).`
- A statement the parser cannot read is problem `FLOWCHART_UNKNOWN_STATEMENT` (`invalid`, line N) and a retained line. A `;` inside a `#NN;` entity or inside a `|label|` does not end a statement. A quoted label may run onto following lines; the lines are joined with a line break and read as one statement. A quoted label of the form `` "`…`" `` is a markdown string: the backticks and the `**`, `*` and `_` emphasis markers are dropped, line breaks are kept, and `markdown-string` is named in `lossy`. A quoted edge label may hold `--` and `|`. An `end` outside a subgraph is `FLOWCHART_UNKNOWN_STATEMENT` and retained. A `@{` config or quoted label left unclosed ends at the next blank or `%%` line.
- Labels Mermaid rejects stay in the model and are reported so the written source, which quotes them, is valid: an unquoted bracket label holding `(`, `)`, `[`, `]`, `{`, `}`, `"` or `|`, an unquoted `|label|` holding `(`, `)`, `[`, `]`, `{`, `}` or `"`, or a `-- text -->` label holding `"`, is `FLOWCHART_LABEL_NEEDS_QUOTES` (`invalid`, line N, message naming the node id or the link's source id); an empty label (`A[]`, `A[""]`, `A()`, `|` `|`) is `FLOWCHART_LABEL_EMPTY` (`invalid`) and the node keeps no text; `A[ ]` and `| |` are accepted as Mermaid accepts them. A `%%` comment after a statement or after the header is `FLOWCHART_TRAILING_COMMENT` (`invalid`, on the comment's line); the statement is still read, the code is retained without the comment when the line is kept, and the comment becomes its own retained line so the written source is valid.
- `@{ … }` node config, `e1@` edge ids, `~~~` invisible links, `click`, `classDef`, `class`, comments and directives are retained lines. `click`, `classDef` and `class` are not problems. `@{ … }`, `e1@` and `~~~` are `FLOWCHART_SYNTAX_IGNORED` (`ignored`). A top-level `direction TB|TD|BT|LR|RL` before the first node sets the direction; after a node it is retained and `FLOWCHART_SYNTAX_IGNORED`. `style` lines are applied after every node is known, so they may precede the nodes they colour, and `style a,b …` lists are read; a `style` line naming a node that never appears is retained and `FLOWCHART_SYNTAX_IGNORED`; `style` with no properties is `FLOWCHART_UNKNOWN_STATEMENT`.
- A `:::cls` suffix becomes a retained body line `class <id> cls`.
- A rejected layout annotation is problem `FLOWCHART_LAYOUT_INVALID` (`invalid`) with the validator's `path` and message; the model is auto-laid out.
- `lossy` names, fixed strings: `subgraph`, `edge-style` (dotted, thick, invisible, circle and cross heads, long arrows), `shape` (a bracket written back as another shape: `[/ /]`, `[\ \]`, `{{ }}`, `((( )))`, `( )`, `(( ))`, since the writer emits `[ ]` and `([ ])`), `linkStyle`, `style-property` (a `style` declaration other than fill or stroke), `markdown-string` (a backtick label whose emphasis markers the drawing cannot show). `linkStyle` lines are not retained.
- The parser rounds all geometry to two decimals, so the fixed-point rule (`parse(write(parse(x))) = parse(write(x))`) holds for auto layout as well as for annotated diagrams.

`write` is `drawingToMermaid` and emits, in order: one `---` block holding `title:` as a JSON-quoted YAML scalar (`title: "a: b"`) and the retained front-matter lines (omitted when both are empty); the header; node lines; edge lines; `style` lines; the retained body lines in original order; the `%% rmk-layout v1` line last. Ids the parser accepted are written unchanged; only ids that are not valid Mermaid ids (`/^[\p{L}\p{N}_]+(?:[-.:][\p{L}\p{N}_]+)*$/u` and not a reserved keyword) are rewritten; a keyword gets a trailing `_`, and canvas-created ids are always valid. Retained lines are re-emitted verbatim; a reference in them to an id that no longer exists is valid Mermaid and not reported. Text is escaped as `#35;` for `#` (before every other entity), `#38;` for `&`, `#37;` for `%`, `#quot;`, `#lt;`, `#gt;`, `#124;` for `|` in edge labels, and `<br/>` for a line break; an edge label holding `(`, `)`, `[`, `]`, `{` or `}` is written quoted. `LAYOUT_ANNOTATION.md` section 8 is updated to the same id rule.

**`sequenceDiagram`**: keyword `sequenceDiagram`. Model `SequenceModel` (section 8). `render` is the sequence renderer. Editor: the sequence canvas (section 9.5).

`write` emits, in order: one `---` block holding the JSON-quoted `title:` and the retained front-matter lines (omitted when both are empty); the header `sequenceDiagram`; `autonumber`, `autonumber N` or `autonumber N M` when `numbering` is set; a declaration for every participant in the shortest prefix of `participants` that reproduces the column order, as `participant id` or `actor id` with ` as Label` when the label differs from the id, each box written as `box <label>` … `end` where its first participant sits with its participants indented one more level (declaration order is kept, not boxes first, so the canvas's column reorder round-trips); the retained body lines (`link`, `links`, `properties`, `details`, `accTitle`, `accDescr`, directives, comments), which attach to participants or to the diagram and are position-independent (a retained later `autonumber N` is the one exception: Mermaid applies it from its position, so writing it after the participants may turn numbering on; rare and accepted); then the items depth first, indented four spaces per nesting level: a message as `from<arrow>[+|-]to: text` (a bare `:` for empty text), a note as `Note left of|right of|over A[,B]: text`, a frame as `<kind> <label>` with its sections split by `else`, `and` or `option` lines and closed by `end`.

A participant needs a declaration when it has an alias, is an actor, sits in a box, is named by no item, or precedes a participant that needs one or whose first use in the body comes earlier. First use in the body is counted over the retained `@{ }` declarations, then each item in order (a message's `from` before its `to`, a note's ids in order) with the activation statements written after it. The remaining participants are introduced by the body in that order, as Mermaid appends undeclared ids on first use after the declared ones, so a hand-written diagram that declares nothing stays that way and a redundant `participant X` line an author wrote is dropped on the first canvas write. An id holding `@` cannot be declared (Mermaid rejects it) and is never written as a declaration, so its alias, kind, box membership and activation statements have no spelling; a box naming no declarable participant is not written.

`activations` is the source of truth for the bars; a `+` or `-` on a message is only the spelling of a span that starts or ends there. A span whose messages do not carry `+` and `-` is written as `activate X` and `deactivate X` statements after the items where it starts and ends (after the opener line when the index is a frame); at one index the writer closes, then opens longest first, then self-closes; a `+` on a message where no span of its `to` starts, and a `-` on a message where no span of its `from` ends, are dropped, since they would spell a bar the model does not hold or one Mermaid.js rejects; a `-` before a `to` id starting with `x` or `X`, which Mermaid lexes as the `-x` arrow, is written as a `deactivate` statement after the message instead; a span still open is closed at the last item. Text goes through the shared `escapeStatementText` of `core/text.ts` (`escapeText` plus `;` as `#59;`, since sequence text is unquoted), so `;` becomes `#59;` and `#` becomes `#35;`; leading and trailing whitespace in text and labels, and a leading `wrap:` or `nowrap:`, are written as `#NN;` entities so the round trip is exact. Ids are written verbatim. A two-way message is only spelled for `head: 'arrow'`; with another head the one-way spelling is written. `create` and `destroy` statements cannot keep their position relative to the messages, so the parser names `create-destroy` in `lossy` and the writer drops them; the canvas lock of section 9.2 shows the notice before the first edit. The fixed-point rule of 4.1 holds for every corpus file.

### 4.4 Shared helpers

`core/front-matter.ts` exports `splitFrontMatter(source): { frontMatter?: string; body: string; bodyOffset: number }` using Mermaid's regex `^([^\S\n\r]*)-{3}\s*[\n\r](.*?)[\n\r]\1-{3}\s*[\n\r]+` with the `s` flag, and `readFrontMatterTitle`. `core/text.ts` exports `escapeText` (the flowchart entity set of 4.3, as one pass over a table so an entity is never re-escaped, shared by both writers), `escapeStatementText` (`escapeText` plus `;` as `#59;`, for the unquoted text of sequence statements) and `decodeText` (`#NN;`, `#quot;`, `#lt;`, `#gt;`, `#124;`, `<br/>`); numeric entities are decoded last, a code point that is not an XML character (controls other than tab, newline and return; surrogates; U+FFFE, U+FFFF; above U+10FFFF) becomes U+FFFD, and the function never throws. `core/front-matter.ts` also exports `writeFrontMatterTitle(title)`, and `readFrontMatterTitle` unescapes a double-quoted value through JSON string syntax and a single-quoted value through `''`. Detection and every parser use them.

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
  /** Indices into the depth-first flattening of `items` (a frame counts as one index before its sections' items). Sorted by start ascending, end descending, then participantId: the parser's order, which the fixed-point rule of 4.1 needs and every operation restores. */
  activations: Activation[]
  numbering?: { start: number; step: number }
}
```

### 8.2 Subset

Statements, case-insensitive on the keyword, terminated by newline or `;`. The header is the leading `sequenceDiagram` token (case-sensitive); the rest of its line is the first statement, so `sequenceDiagram A->>B: hi` is one message. The parser splits a line at `;` before tokenising, as Mermaid does; an empty statement is ignored. A `%%` comment is recognised where a statement starts or after the header, `end` or `autonumber`, runs to the end of the line and is retained as a body line holding the comment text; inside message text, labels and ids `%%` is text, as in Mermaid. A `%%{ … }%%` directive may span lines: every physical line up to `}%%`, or to the end of the body when it never closes, is retained. A bare `#` starts a comment to the end of the line where a token starts (a statement start, after an arrow and its suffix, after `,` or a note placement, after a declaring keyword), inside message and note text and inside labels; inside an actor id of a message or note, and inside a declared id, it is part of the id (`A->>#B: x` is unknown, `A#1->>B: x` names `A#1`), as Mermaid lexes it. `#NN;` and `#name;` entities are text.

| Construct | Source | Notes |
| --- | --- | --- |
| Participant | `participant A`, `participant A as Label`, `actor A`, `actor A as Label` | declaration order; undeclared ids are appended on first use; an id may not hold `< > : , ; @` (`participant a@b` is `SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT`, as Mermaid rejects it, while `a@b` is a valid message actor); `@{ … }` is participant config only directly after a whitespace-free id, and ` as Label` may follow the config; after ` as ` the rest is the alias, so `participant shapex as @{shape: x}` has label `@{shape: x}` |
| Box | `box [colour] [label]` … `end` | colour is retained in the label as Mermaid does; boxes hold participant statements only, and any other statement inside one is `SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT` |
| Message | `A->B: text` with `->`, `-->`, `->>`, `-->>`, `<<->>`, `<<-->>`, `-x`, `--x`, `-)`, `--)` | `+`/`-` after the arrow sets `activate`; actor names are Mermaid's actor token: never `+ < > : , ;`, never starting with `-`, a `-` inside them never followed by `-`, `x`, `)` or a half-arrow bar (`A-xray`, `A--1`, `B-` are not ids), `#` allowed inside them (`A#1`), spaces, `(` and `)` allowed, and the target cannot start with `(`; a `-` after the arrow before an id starting with `x` or `X` is the `-x` arrow, not the suffix, so `A-->>-Xavier: y` is `SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT`; `-X` and `--X` are the cross arrows |
| Activation | `activate A`, `deactivate A` | `Activation.start`/`end` are flattened item indices; an activation still open at the end ends at the last index and is an `ignored` problem; the id may not hold `< > : , ; @` |
| Note | `Note left of A: t`, `Note right of A: t`, `Note over A: t`, `Note over A,B: t` | |
| Frame | `loop t`, `alt t`/`else t`, `opt t`, `par t`/`and t`, `critical t`/`option t`, `break t`, `rect colour` … `end` | nested arbitrarily; `par_over t` opens a `par` frame; `rect`'s colour is its section label |
| Autonumber | `autonumber`, `autonumber N`, `autonumber N M` | before the first message; later forms and `autonumber off` are retained and `ignored` |
| Title | front matter `title:`, `title X`, `title: X` | a body `title` statement overrides the front-matter title |
| Text | `<br/>`, `#NN;` | decoded with `decodeText` |

`invalid` problems: `SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT` (when the residue follows a `;` the message names the entity codes: `";" ends a statement, so write #59; for a semicolon in text and #38;, #lt;, #gt; instead of &amp;, &lt;, &gt;`), `SEQUENCE_DIAGRAM_DEACTIVATE_INACTIVE`, `SEQUENCE_DIAGRAM_END_WITHOUT_OPENER`, `SEQUENCE_DIAGRAM_SECTION_OUTSIDE_FRAME` (`else`, `and`, `option` outside `alt`, `par`, `critical`), `SEQUENCE_DIAGRAM_FRAME_UNCLOSED`, `SEQUENCE_DIAGRAM_RESERVED_ID` (a message end or note target whose id starts with a sequence keyword at a word boundary, case-insensitively: `end`, `loop`, `alt`, `else`, `opt`, `par`, `par_over`, `and`, `critical`, `option`, `break`, `rect`, `note`, `box`, `participant`, `actor`, `activate`, `deactivate`, `autonumber`, `links`, `link`, `properties`, `details`, `create`, `destroy`, `over`, `left of`, `right of`, `off`, `sequenceDiagram`; `title` before whitespace or `: `; `accTitle`/`accDescr` before `:`; Mermaid.js lexes the id as the keyword there. Declarations (`participant`, `actor`, `create`, `activate`, `deactivate`, inside `box`) take any id without `< > : , ; @`, as Mermaid's id state does; one holding `@` is `SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT`. The message or note is still modelled and the line is not retained.)

`ignored` problems, all retained: `SEQUENCE_DIAGRAM_STATEMENT_IGNORED` for `link`, `links`, `properties`, `details`, `create`, `destroy`, `accTitle`, `accDescr`, half-arrows, `()` connections, `@{ … }` participant config, `autonumber off`; `SEQUENCE_DIAGRAM_ACTIVATION_UNCLOSED` (Mermaid.js accepts it; the bar is drawn to the last item).

A parse reports at most one problem per code and line; a line with several residues after `;` yields one `SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT` and one retained fragment holding the residues joined by `; `, while a line none of whose statements was modelled is retained whole. So `A->>B: Hello; how are you?` models the message and retains `how are you?`, `A->>B: Tom &amp; Jerry` retains `Jerry`, and `loop x; garbage` retains `garbage`; the written text holds each statement once and does not grow per edit.

`problems` is what keeps LLM-written diagrams readable: a statement the kind does not model degrades the rendering, never the document, and an `invalid` problem tells the author that Mermaid.js itself would reject the fence.

### 8.3 Layout

Deterministic, needs no annotation. `core/sequence/layout.ts` is pure.

- Participants are columns in declaration order. Column width is the wider of the label's text box plus padding and 100. The gap between two columns grows to fit the widest message or note text between them.
- Participant boxes at top and, mirrored, at bottom. `actor` draws the stick figure; `participant` draws a rectangle.
- Each message, note and frame boundary takes one row at a fixed pitch. Message text sits above its line. A self message draws a right-hand loop.
- Activation bars are rectangles centred on the lifeline, offset by nesting depth.
- Frames are rectangles spanning the leftmost to the rightmost participant they touch, with a label tab at top left; sections split with a dashed line and a bracketed label.
- Autonumber badges are circles at the message start.
- `sectionAt(layout, y)` gives the innermost frame section holding `y` (its trail of frame flat index and section number, outermost first) and whether `y` is under every row of that section, always true for an empty one; `insertionAt(layout, y)` turns that into the flat row or the section end a drawn item goes to (`Insertion` of `operations.ts`). Only `y` counts, as for `rowAt`.

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

Mode: canvas when the registered kind has `write` (read at render time) and the editor entry has a canvas component for its name, or the format is legacy, and `sourceMode` is off; source otherwise. The built-in canvas components are `DiagramCanvas` for `flowchart` and `SequenceCanvas` for `sequenceDiagram`, composed in the editor entry. The editor entry's `mermaid({ editors })` option maps a kind name to a `DiagramKindEditor` component so a third-party kind can bring its own canvas; a built-in name in the map replaces the built-in component. `DiagramCanvasOptions.editors` holds the merged map and defaults to `{}`, so with no extension registered every block is text. The lossy lock, the notice with "Edit on canvas" and "Edit as text", and the read-only rules live in `DiagramBlock` and apply to every canvas kind alike. The acknowledgement is keyed on the lossy set (`lossy.join(', ')`), so it survives commits and Text/Canvas toggles for the same loss but locks again when the text gains a loss the author has not accepted.

```ts
export interface DiagramKindEditorProps {
  readonly nodeKey: NodeKey
  readonly kind: DiagramKind
  readonly source: string
  readonly parse: DiagramParse<unknown>
  /** True while the block locks the canvas behind the lossy notice: the source holds a feature the writer cannot keep and the author has not acknowledged the loss. A read-only editor never mounts the component; the block renders the kind's `render` output there instead. */
  readonly readOnly: boolean
  /** Writes `source` to the node in a discrete update. `merge` coalesces with the previous commit under the 300 ms rule. */
  readonly commit: (source: string, options?: { readonly merge?: boolean }) => void
}
export type DiagramKindEditor = ComponentType<DiagramKindEditorProps>
export type DiagramKindEditors = Readonly<Record<string, DiagramKindEditor>>
```

The three types live in `canvas/options.ts`, the home of the `editors` map, and are re-exported as types from the editor entry. `DiagramBlock` owns `commit`, `lastCommittedRef` (the source string it last wrote) and the history-merge window for every canvas kind; a canvas receives the parse and writes back source. `commit(source, { merge: true })` adds the `history-merge` tag only when the previous commit from this block was under 300 ms ago and the node still holds it; a change of the node from outside the block ends the burst. The built-in canvases are adapted to this contract directly. A canvas component's focusable root carries the class `rmk-diagram-canvas` or the attribute `data-rmk-diagram-focus`, which is where the insert of 9.3 puts focus. `sourceMode` is component state set by the toggle. The kind is re-detected on every `setSource` and the badge updates immediately, but the editing component never changes while the block's textarea has focus; the hold is released on blur, on the toggle, and when the textarea unmounts without a blur (the editor turning read-only), so a mode change implied by a new kind takes effect at the first of those. The toggle is disabled, with the parse error as its title, while the source does not parse.

**Canvas.** The existing `DiagramCanvas`. Its input is `parse.model` and `parse.retained`. On change it computes `written = flowchart.write(payload, { retained })`, remembers `serializeDrawingData(flowchart.parse(written).model)` as its own echo so the block's echo of the commit never resets it, then calls `commit(written)`; the block sets `lastCommittedRef` and calls `setSource(written, kinds)` in `editor.update(…, { discrete: true })`, so the document holds the gesture when the handler returns, like every other editing path of the package. "Copy as Mermaid" in the tool row writes the current canvas state through the same `flowchart.write` with the same `retained` lines, so the clipboard holds exactly what a commit would put in the document: title, description, width and retained lines included. While `lossy` is non-empty and unacknowledged, the canvas mounts read-only, with no tool row, no pointer editing and no height grip, behind a notice that lists the lossy features by name and offers "Edit on canvas" (acknowledges for this block, in component state) and "Edit as text" (sets `sourceMode`). The first commit can only happen after "Edit on canvas".

**Source.** A monospace `textarea` (Tab inserts two spaces, Shift+Tab removes up to two leading spaces, Enter is native, Escape moves focus to the header row), the live preview above it rendered by the kind's `render` through `hast-util-to-jsx-runtime` with `react/jsx-runtime`, and the problems list under it with line numbers, `invalid` problems first with the prefix "Mermaid rejects:". Kinds without `render` show the unsupported notice instead of a preview. When `DiagramCanvasOptions.sourceEditor` is `false` the textarea is absent and the block shows preview and problems only. Without a textarea, a kind without `render` shows the source `pre` under the notice. Native listeners on the textarea call `stopPropagation` for `keydown`, `keyup`, `keypress`, `beforeinput`, `input`, `paste`, `cut`, `copy`, `drop`, `compositionstart`, `compositionupdate` and `compositionend`: the `STOPPED_FIELD_EVENTS` list of `canvas/text-edit-overlay.tsx` plus `keydown` and `input`.

History: the textarea is controlled by a local draft. Each change commits `setSource(draft, kinds)` in `editor.update(…, { discrete: true })` with the `history-merge` tag when the previous commit from this block was less than 300 ms ago and the node still holds that commit, otherwise as a new history entry. An undo or redo dispatched from the textarea, and any change of the node's source from outside the block (an undo from the toolbar, a canvas edit, a collaborator), ends the burst: the next change is a new history entry, never merged into the entry Lexical restored. Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl+Y inside the textarea are prevented and dispatched as Lexical `UNDO_COMMAND`/`REDO_COMMAND`. When the node's source changes and differs from the last value this block committed, the draft is replaced and the caret placed at the end; a change equal to the last commit is ignored.

### 9.3 Insert

`INSERT_DIAGRAM_COMMAND` payload gains `kind?: string`, default `flowchart`. A kind not in the registry makes the handler return `false` without inserting. The toolbar contributes one button per registered kind with a `starter`: id `diagram` for the flowchart (legacy id, so existing label overrides keep working) and `diagram-<kind>` for the others, group `diagram`, icon from the kind. The `diagram.` prefix stays reserved for canvas labels. The insert writes the kind's `starter` verbatim. After insertion the block receives focus: for a canvas kind its first `.rmk-diagram-canvas` or `[data-rmk-diagram-focus]` element, for source kinds the textarea with the caret at the end.

### 9.4 Mistake-proofing

- A fence is never lost: parse errors keep the source in the node, the document and the rendered figure.
- A canvas edit never destroys what it cannot draw: retained lines are re-emitted, and lossy features block editing until acknowledged.
- Parsers are tolerant: keywords case-insensitive where Mermaid is, trailing `;` accepted, both `graph` and `flowchart`, arrows with or without spaces, directives and unknown front-matter keys retained, unknown statements retained and reported.
- A case slip in the keyword is named as such, with the expected spelling.
- Source mode never blocks a keystroke and never rewrites text; it signals. `invalid` problems appear while typing and reach hosts as `DIAGRAM_SYNTAX_INVALID` after save. The claim that written output is accepted by Mermaid.js applies to kinds with `write`.
- Problems surface where the mistake is: in the source editor with line numbers, and in compile diagnostics with a narrowed range.

### 9.5 The sequence canvas

`SequenceCanvas` (`canvas/sequence/sequence-canvas.tsx`) edits a sequence diagram on its rendered picture. Every gesture is one pure operation of `core/sequence/operations.ts` on `SequenceModel`; items are addressed by flat index, activations are carried across by item identity (a rebuilt frame is followed to its replacement) and re-sorted in parser order, and an operation that changes nothing returns the same model so nothing is committed. Every operation keeps the suffixes as the spelling of `activations`: a `+` stays only where a span of the receiver starts and a `-` only where a span of the sender that started above ends; any other suffix is cleared, so `parse(write(m)).model` equals `m` for every model an operation produces. The result is written with `sequenceDiagram.write(model, { retained: parse.retained })` and handed to the block's `commit` (9.2); the canvas remembers the serialisation of `parse(written).model` as its echo and adopts that reparsed model as the one it shows, so the picture always equals the document. An outside change of the node (an undo, a text edit, a collaborator) replaces the model and drops the selection. The picture is the kind's own `render` of the section 8.3 layout drawn through `hast-util-to-jsx-runtime`, token-coloured and without the dark filter, so what is edited is exactly what the reader sees; the `style` option does not apply to it. An absolutely positioned SVG interaction layer with the same viewBox sits on top, reads pointer positions through `getScreenCTM().inverse()` (the bounding rect when there is none) and hit-tests against the geometry `core/sequence/layout.ts` exposes for every column, message, note, frame, section, tab and bottom edge; the renderer carries no data attributes. A message's hit geometry is its line strip and its text box, not their union, so the lifeline gap beside a text stays free for the note affordance. Until the canvas has focus the layer uses `touch-action: pan-y pinch-zoom`, like the flowchart surface.

Selection: one participant, message, note or frame at a time, shown with an outline. Click selects, Escape clears, Delete and Backspace remove the selection (a participant takes its messages and notes with it; a frame unwraps its items). Deleting a message or note takes the bar that started on it (the `-` that ended that bar is cleared) and lets a bar that ended on it run to the last row, as clearing its `-` would. A frame is selected by its label tab, a section divider strip or its bottom edge, never by a click inside its body, where the lifelines and messages are. A click on empty picture clears the selection. Enter, or a double click, edits the selected label inline through the `label-overlay` field, which follows the `text-edit-overlay` pattern: the field commits every change, merged under the 300 ms rule after the first, closes on blur or Enter, and on Escape takes the burst back as the Commits paragraph says. A key pressed on one of the canvas's own controls (a tool, a property-bar button, a select or a field) is that control's: Enter activates it and Backspace edits it; the canvas handles Delete, Backspace, Enter and Escape only when the key reaches the root from the root or the picture (`isControlKey` of `drawing-canvas.tsx`, which the flowchart canvas applies too).

Participants: the tool row has "Add participant" and "Add actor", which append a participant whose id and label are the first free of `Participant1`, `Participant2`, … or `Actor1`, `Actor2`, … and select it; the bare `Participant` and `Actor` are never used, since Mermaid.js lexes them as keywords where a message or note names them. Dragging a participant box horizontally reorders the columns; the drop position follows the pointer's column, and a box moves as one unit (its members stay contiguous, a participant dropped between two members lands beside the box), since the writer opens a box where its first member sits; the boxes are reordered by their first member, the order the parser reads them back in. A participant's label is edited inline; its id is kept unless the label was the id, in which case the id follows the new label sanitised to letters, digits and `_` when that is non-empty, free and not a sequence keyword, so hand-written diagrams keep their ids. Whether the id follows the label is decided once, when the field opens, and passed with every keystroke together with the id at edit start (`RenameParticipantOptions`); the id is recomputed from the whole current label on every change and falls back to the id at edit start, never to an intermediate one, when the sanitised label is empty, taken or a keyword, so the final id does not depend on the typing path. The property bar for a participant toggles between participant and actor. A participant whose id holds `@` cannot be declared (4.3), so a label, an actor kind or a box given to it has no spelling and the reparsed picture shows it without; the canvas does not guard against those edits.

Messages: dragging from a lifeline to another lifeline, or to the same lifeline for a self message, adds a message with the default arrow `->>` and an empty text that opens for editing at once, at the row under the pointer, or, when the pointer is under every row of the frame section it is in (an empty section included), last in that section, so an empty or middle section can be drawn into (`insertionAt` of the layout resolves the pointer to a flat row or a section insertion, fixed at pointer-down); the drop line for a section insertion sits between that section's last row and its bottom, or in the middle of an empty section. A plain click on a lifeline (no travel beyond the click tolerance) adds nothing, and a drop away from every column adds nothing. Dragging a message vertically reorders it among the items of its section; the drop row follows the pointer. The property bar picks the line (solid, dotted), the head (arrow, open, cross, none), two-way, the activation suffix (`+`, `-`, none), and lets the ends be swapped. Two-way is coupled with the arrow head: choosing another head switches two-way off. The activation suffix edits `activations` and the spelling together, as the same edit in text would: `+` starts a bar on the receiver to its next reply, or the last row (the first reply the bar can reach without crossing another bar of the receiver: it stays inside a bar covering the message and either contains or ends before a later bar, since Mermaid's stack cannot spell crossing bars); `-` ends the sender's covering bar at this message, or starts one from the last message to the sender when none covers the row; clearing a `+` drops the bar it started, clearing a `-` lets its bar run to the last row. When a bar is dropped or its end moves, the `+` or `-` on the message that spelled its other end is cleared. `-` is disabled where it would deactivate nothing, since Mermaid.js rejects that. A `-` towards a participant whose id starts with `x` or `X` is offered and stored, but the writer spells it as a `deactivate` statement (4.3), so the reparsed picture shows the bar without the suffix. Swapping the ends drops the message's suffix, and the bars it spelled are written as `activate`/`deactivate` statements. The label edits inline. Reordering a `+` message below its `-` reply keeps the bar between the two rows; neither suffix spells it any more, so both are cleared and the bar is written as `activate`/`deactivate` statements, an exact round trip.

Notes: a "+" affordance appears when hovering the gap between two rows on a lifeline; clicking it adds a note over that participant at that row, or last in the frame section when the pointer is under every row of it (the same `insertionAt` as a drawn message), and opens its text; inside an empty section the affordance sits in the middle of the section. The property bar moves a note between `left of`, `right of` and `over`, and for `over` adds or removes a second participant through a select. Dragging a note vertically reorders it.

Frames: with a message or note selected, the property bar offers "Wrap in" loop, alt, opt, par, critical, break and rect, which wraps the selected item and, with Shift+click on further items, a contiguous range of siblings; the label opens for editing at once. A frame's label and each section label edit inline from a double click on the tab or the divider strip. The property bar adds a section (`else`, `and`, `option`; alt, par and critical only) after the section whose strip was clicked, or after the last one, and opens its label; "Unwrap" and Delete unwrap the frame. Dragging a frame's bottom edge extends it over following siblings or shrinks it, releasing the items of its last section; an empty last section takes them too. A bar anchored on a frame's own row (an `activate` written right after the opener) moves to the first unwrapped item on Unwrap or Delete; only an empty frame loses it. Every edit inside or on a frame keeps the bars anchored on it and its ancestors.

Autonumber: a tool-row toggle sets or clears `numbering` at start 1, step 1. "Copy as Mermaid" in the tool row writes the current model with the same retained lines, so the clipboard holds exactly what a commit would put in the document.

Commits: every structural change is one history entry. For an inline edit the first change is a plain commit, so it never folds into the structural entry that opened the field (a drawn message, a wrap, a section), and the rest of the burst commits with `merge: true` under the block's 300 ms rule, so a burst of typing undoes as one step. Escape takes the burst back: the canvas counts the history entries the burst made by the block's rule (one, or more when a pause over 300 ms split it, on the same clock, so a keystroke within the sub-millisecond gap at the 300 ms boundary can miscount by one), undoes each through `UNDO_COMMAND` in a discrete update, restores the model it showed when the field opened and commits nothing, so a cancelled edit leaves no history entry and the selection survives; with nothing typed Escape only closes the field. The inline field stops `keyup`, `keypress`, `beforeinput`, `paste`, `cut`, `copy`, `drop` and the composition events from reaching Lexical's root (`STOPPED_FIELD_EVENTS`, the list the source textarea stops); `input` bubbles, since it is React's `onChange` and Lexical ignores it for a decorator field. The field's scale comes from the stage's untransformed width (`offsetWidth`, observed with a `ResizeObserver`), never from a client rect, so a host zoom transform around the editor is not applied twice; the flowchart canvas measures the same way, capped at its logical width. The canvas never blocks a gesture; an operation that would make Mermaid.js reject the fence is not offered.

Under the lossy lock of 9.2 the canvas renders the picture only: no tool row, no interaction layer; the root still carries `rmk-diagram-canvas` and `rmk-sequence-canvas`, so the property-bar host and the insert focus of 9.3 follow the flowchart's rules. A read-only editor never mounts the canvas: the block renders the kind's `render` output, with no canvas root. Labels for every control come from the `diagram.` label map so hosts can translate them.

## 10. Tests

### 10.1 Unit

- `detect.test.ts`: every keyword in `MERMAID_KEYWORDS`, with and without front matter, directives and comments; `flowchart-elk`; `graphTD`; malformed front matter; `unknown`; case hints.
- `mermaid-parse.test.ts` gains: every arrow spelling in Mermaid's flowchart docs table with and without spaces parses to the same model; unknown statements become problems and retained lines; `:::cls` becomes a retained `class` line; ids with hyphens survive `write`; entities and `|labels|` holding `;`; Unicode, dotted and colon ids; labels Mermaid rejects unquoted; empty labels; reserved ids; trailing comments; stray `end`; top-level `direction`; multi-line quoted labels and markdown strings; a trailing `%% rmk-layout` comment; an unclosed `@{` stopping at the annotation; `style` before its node and for a missing node; the wrong-case direction error.
- `mermaid.test.ts` gains: write order with retained front-matter and body lines; the fixed-point rule; exactly one annotation line.
- `sequence-parse.test.ts`: every construct in 8.2, `;` splitting, retained lines, every problem code with its line, activation balance, nested frames, model snapshots for the corpus.
- `sequence-render.test.ts`: hast for the corpus, no `script` or `foreignObject`, every colour attribute matches `/^var\(--rmk-diagram-[a-z-]+, #[0-9a-f]{6}\)$/`, one `svg[role=img]` with a `title`.
- `theme.test.ts`: every fallback is six-digit hex.
- `extension.test.tsx`: the test "leaves other Mermaid diagram types as ordinary code blocks" is replaced by "renders a class diagram as a source figure with DIAGRAM_KIND_UNSUPPORTED"; a sequence fence renders static; a parse error keeps source; `data-rmk-diagram-kind` and `-support` on the figure; the four exact `<figure data-rmk-diagram="…">` strings become attribute regexes; `DIAGRAM_KIND_UNKNOWN` with hint for `SequenceDiagram`.
- `editor-bridge.test.tsx`: untouched flowchart, sequence and class fences round-trip byte for byte; legacy fences still round-trip and still convert on first edit; a canvas edit re-emits retained lines; a source edit writes the text; version 1 node JSON imports; `meta` survives an edit.
- `editor-source.test.tsx`: source mode renders a preview, lists problems with `invalid` first, stops key propagation, keeps its component while focused and switches on blur, coalesces three quick keystrokes into one undo step, routes Ctrl+Z to Lexical, `sourceEditor: false` hides the textarea.
- `editor-canvas.test.tsx` gains: a lossy flowchart mounts read-only behind the notice, which sits outside `.rmk-diagram-canvas`, until acknowledged. It and `editor-source.test.tsx` register a write-less sequence kind where they describe source mode.
- `editor-block.test.tsx`: the `DiagramKindEditorProps` contract, the Text/Canvas toggle, the render-time `write` rule, `editors` adding and replacing a component, discrete commits with one entry each, the merge and burst rules, the lossy lock, re-lock on a new loss and "Edit as text", read-only, insert focus, and the sequence kind taking the slot once it writes.
- `sequence-write.test.ts`: the write order, escaping, retained lines after the participants, activation statements, the fixed-point rule for every corpus file, `create-destroy` in `lossy`; the conformance test covers the writer's output.
- `sequence-operations.test.ts`: every operation of 9.5, its round trip through `write` and `parse`, and that no input is mutated. `sequence-operations.dom.test.ts` hands the written output of the operations the second review named (a fresh participant with a message and a note, activation edits, a reorder across a bar) to Mermaid.js.
- `editor-sequence.test.tsx`: every gesture of 9.5 through pointer and keyboard events in jsdom, each asserting the written Mermaid, one history entry per structural change, merged inline typing, byte-exact write-back while untouched, the lossy lock for `create-destroy`, read-only rendering, `mermaid({ editors })` replacing a built-in canvas, and `diagram.*` labels on the controls.

### 10.2 Conformance

`plugins/mermaid/tests/corpus/<kind>/*.mmd` holds the examples from the syntax documentation of the installed Mermaid version, verbatim. An example that `mermaid.parse` rejects at that version is left out and listed in `corpus/README.md` with the version that adds it; so is an example whose retained lines `write` drops by design (the `create`/`destroy` example), which `conformance.dom.test.ts` checks on its own. For each file: the kind's `parse` returns a model with no `invalid` problem, and for kinds with `write`, `write(parse(x))` parses to an equal model and contains every retained line.

`mermaid` (11.x, the version already in `pnpm-lock.yaml`) is added to the root `package.json` `devDependencies` only, never to a package's `dependencies` or `peerDependencies`. `plugins/mermaid/tests/conformance.dom.test.ts` runs under jsdom by its name, imports Mermaid.js unconditionally, and asserts `mermaid.parse(text, { suppressErrors: false })` resolves for every corpus file and every `write` output. The test never skips. `tests/packaging.test.ts` checks `dependencies` and `peerDependencies` only, so the root devDependency does not touch the headless gate.

`plugins/mermaid/tests/flowchart-kind.dom.test.ts` and `plugins/mermaid/tests/sequence-conformance.dom.test.ts` hold the review's inputs that are not documentation examples and check the severity contract against `mermaid.parse`: every input Mermaid accepts yields no `invalid` problem and, for kinds with `write`, a written output Mermaid accepts that is a fixed point; every input Mermaid rejects yields the named `invalid` code, and where the statement is still modelled the written output is accepted.

Five sequence regression inputs accepted by Mermaid.js (`#` inside actors, `@{` in an alias, an alias after a config, upper-case cross arrows, `@` in message ids) live in the corpus; the rejected inputs of the second review (`-` before an x id, `@` in declarations, `-x`, `--` and a trailing `-` in ids, `#` at an actor start, `;` residues) and the writer outputs for the corresponding canvas models are checked against Mermaid.js in `tests/conformance.dom.test.ts`.

### 10.3 Existing guards

`tests/packaging.test.ts` keeps the root entry headless and its forbidden-name list. `scripts/pack-check.mjs`'s diagram journey matches `/<figure data-rmk-diagram="diagram"[^>]*>/` and gains the `dist/client.js` banner check. `check-css-scope` passes. `published-figures` passes with no new numbers. `tests/mermaid-share.test.ts` is unchanged.

## 11. Demo

`public-sites/mermaid-demo`:

- The preset is `mermaid({ style: 'ink', sourceEditor: false, kinds })`, exported with `KINDS` from `src/preset.ts` so the demo test mounts the same block the page shows. The left code pane stays the source editor. The sequence canvas ignores `style`.
- Status chip reads the lifted node: "Flowchart · auto layout", "Flowchart · rmk-layout v1", "Sequence diagram · canvas" (the registered kind has `write`), "<label> · static" for a registered kind that only parses, "Class diagram · source only", "Not Mermaid" for `unknown` with the hint as its message. The "Not a flowchart" state is removed. `invalid` problems show as "Mermaid rejects line N".
- Samples are grouped: Flowcharts (the existing eight) and Sequence diagrams (sign-in with alt/else, API call with activation and notes, parallel work, loop with autonumber). Every sample compiles with no diagnostic. No sample contains a raw `;` in text.
- Code-pane highlighting takes its keyword set from the detected kind.
- The right pane shows the block: the flowchart canvas for flowcharts, the sequence canvas for sequence diagrams, the unsupported notice over the source `pre` for source-only kinds. The demo CSS generalises its `.rmk-diagram*` selectors so every mode fills the pane: the flowchart stage stretches as a flex column, the sequence viewport (`.rmk-sequence-viewport`) fills the pane and scrolls, and the sequence stage is centred like mermaid.live. `public-sites/shared/kit.css` maps `--rmk-diagram-surface` on `.rmk-sequence-viewport` in dark mode to the preview's surface, since the sequence picture uses the real dark tokens rather than the flowchart's invert filter.
- Export works for every static kind.
- Landing copy, meta description, FAQ, `index.html` and `public-sites/shared/llms/llms.txt` say flowcharts and sequence diagrams; every measured figure stays verbatim; the SEO surface test stays green.
- `tests/mermaid-demo.dom.test.tsx` is committed with the change: "has nothing to export for a diagram type the canvas does not open" becomes "exports an SVG for the sequence sample"; the sample loop asserts no diagnostics for every sample.

## 12. Docs and package

- `public-sites/docs/docs/mermaid.mdx`: the kinds table, support levels, the fallback entry, the theme tokens, the sequence subset, the problem codes, the sequence writer, the sequence canvas gestures, the `editors` option with the `DiagramKindEditor` contract. The docs' example canvas marks its root with `data-rmk-diagram-focus`.
- `plugins/mermaid/README.md`: replaces "Flowcharts only" with the kinds table. `README.md` at the repo root and `llms.txt` follow.
- `plugins/mermaid/CHANGELOG.md`: an `Unreleased` section. `version` stays `0.1.0`.
- `plugins/mermaid/package.json`: exports gain `./client`; `dependencies` gain `hast-util-to-jsx-runtime` at the renderer's range; `build` becomes the slides form.
- `plugins/mermaid/LAYOUT_ANNOTATION.md` section 8: id rewriting now applies only to ids that are not valid Mermaid ids.

## 13. Out of scope for this revision

- A scene layer shared by the flowchart and sequence renderers.
- `stateDiagram`, `gantt`, `erDiagram` kinds. `stateDiagram` maps onto the flowchart model and canvas and is the cheapest next kind.
- Theming the flowchart canvas through the section 7 tokens. It keeps its white surface and dark filter; the sequence canvas already draws the token-coloured render.
- Honouring `config.theme` and `themeVariables`.
- A `dialect` write option for hosts whose Mermaid is older (Azure DevOps `graph` header).
- A line-number gutter on the source textarea and auto-collapsing the source editor behind the preview.
