# React Markdown Kit — V1 product, API, engineering, and adoption specification

> Status: Proposed specification. Public APIs in this document are contracts to build, not existing package exports.
> Prepared: September 19, 2026.
> Public packages: `@react-markdown-kit/renderer`, `@react-markdown-kit/editor`, and the plugin packages `@react-markdown-kit/template`, `@react-markdown-kit/mermaid`, `@react-markdown-kit/slides`.
>
> **Amendment (2026-09-20).** Templates and diagrams are separate, installable packages whose only public surface is the plugin. `@react-markdown-kit/template` exports `template({ data })` (a `syntax.transform` that resolves placeholders while the renderer parses) and `templateVariables()`; `@react-markdown-kit/mermaid` exports `mermaid()`. Each has an `/editor` entry adding the editing half. There is no `defineTemplate`, `resolve()`, `<Template>`, `toMarkdown` or `parseDiagram`: resolution is `<Markdown extensions={[template({ data })]}>` or `compileMarkdown(source, { extensions: [template({ data })] })`, and text output is the renderer's `documentToMarkdown`. The renderer and the editor carry no template or diagram code, so they stay light, and there is one parser, one `gfm()` and one preset shape for the whole kit. Where section 8 below describes the template object API, read it as behaviour of the `template()` extension: every guarantee (structural interpolation, schema validation, never a half-filled document, no React needed to resolve) holds; authored-source locale maps and `inspect()` are gone, the application picks the source per locale and inspects by compiling with `templateVariables()`. The public sites live in `public-sites/`: the documentation site (`docs/`) and, as their own single-page sites rather than pages of it, the renderer demo, the editor demo (the flagship of 13.4), the Mermaid live editor and the slides demo.
>
> **Amendment (2026-09-20, slides).** `@react-markdown-kit/slides` is the third plugin package. `slides()` reads a deck from plain CommonMark (slides split on `---`, notes after `???`, fragments after `--`, `<!-- key: value -->` directives, front matter) and renders it as a static `<article>` of `<section>`s; it has no standalone API. Its `/present` entry adds a client `article` component (present mode, keyboard and pointer navigation, presenter view, hash routing, cross-window sync) and its `/editor` entry the authoring nodes and toolbar commands. The dialect is specified in `plugins/slides/DIALECT.md`.
> Product identity: React Markdown Kit by ZUI.
> Primary goal: Become a credible default choice for React Markdown rendering, then win broader application adoption by making editing and data-driven Markdown part of the same system.

Companion documents in this folder:

- `STYLING.md` — the styling-independence contract (no ZUI, no Tailwind, no design system). Binding on all three packages.
- `MERMAID_PLATFORM.md` — the diagram-kind platform of `@react-markdown-kit/mermaid`: detection, kinds, the `sequenceDiagram` kind, uniform editing, the host fallback and theme tokens.
- `AUDIT.md` — CORE-01, the audit of the prior ZUI editor whose gaps this specification exists to fix.
- `COMPATIBILITY.md` — the generated react-markdown compatibility matrix.

---

## 1. Product decision

Build three independently useful packages that share one Markdown mental model:

```text
renderer = display Markdown
editor   = create and modify Markdown
template = personalize Markdown
```

The product promise is:

> **Render Markdown. Add editing. Personalize the same document.**

The renderer is the broadest adoption product and must be excellent on its own. The editor must never be required merely to display Markdown. The template package must remain useful without React so it can run in servers, workers, CLIs, email pipelines, PDF pipelines, and build tools.

The three packages must agree on what a Markdown document means. They share the same syntax model, diagnostics model, extension conventions, and document representation. They do not share unnecessary runtime dependencies.

### 1.1 Competitive position

react-markdown already provides a strong baseline: safe rendering by default, component overrides, CommonMark behavior, GFM through plugins, and remark/rehype extensibility. React Markdown Kit must match the incumbent where migration compatibility is claimed rather than pretending those capabilities are absent. [S1]

The differentiation is the integrated workflow:

```text
Markdown source
   ↓
render it
   ↓
edit it without changing storage formats
   ↓
personalize it with typed runtime data
   ↓
render the resolved document through the same rendering system
```

The strongest adoption story is not "another renderer." It is:

> A developer can start with one `<Markdown>` component and later add rich editing and personalized templates without changing document formats or replacing the rendering stack.

### 1.2 Initial exclusions

V1 does not include hosted storage, PDF/DOCX export, comments, multiplayer collaboration, approvals, billing, AI-provider SDKs, arbitrary JavaScript expressions in templates, or a fourth public core package.

A future ZUI Cloud may provide hosted operational capabilities. None are prerequisites for local rendering, editing, or templating.

---

## 2. Developer-experience principles

The public API must follow these rules.

### 2.1 Progressive disclosure

The beginner experience is tiny:

```tsx
<Markdown>{source}</Markdown>
```

```tsx
<MarkdownEditor value={source} onChange={setSource} />
```

```ts
const template = defineTemplate(`# Hello {{user.name}}`);
```

Advanced concepts such as compiled documents, headless editors, diagnostics, presets, schemas, ASTs, custom extensions, and remark/rehype escape hatches appear only when the application needs them.

### 2.2 Familiar React conventions

Use conventional names where possible:

```text
value / onChange
defaultValue
mode / onModeChange
defaultMode
components
extensions
```

Avoid framework-specific vocabulary when ordinary React vocabulary is clearer.

### 2.3 One document format

Persist Markdown. Do not require applications to store Lexical JSON or a proprietary React Markdown Kit format.

Rich editing is an editing representation. `MarkdownDocument` is a compiled/runtime representation. Markdown source remains the interoperable application storage format.

### 2.4 One meaning of Markdown per application

Applications must be able to define their Markdown dialect once and reuse it across rendering, editing, and templating.

That is the role of a Markdown preset.

### 2.5 Extensions, not giant prop surfaces

Do not turn `<MarkdownEditor>` or `<Markdown>` into 70-prop frameworks.

Cross-cutting optional behavior belongs in extensions:

```tsx
extensions={[
  gfm(),
  templateVariables(...),
  slashCommands(...),
]}
```

The main components remain small and stable.

### 2.6 Underlying frameworks are implementation details

Lexical, remark, rehype, micromark, and mdast may power the implementation, but React Markdown Kit must not make its long-term public identity depend on one implementation library.

Expose compatibility escape hatches where useful. Do not leak Lexical types or remark internals through every API.

---

## 3. Public packages and dependency boundaries

```text
@react-markdown-kit/renderer            (+ /gfm)
@react-markdown-kit/editor              (+ /lexical)
@react-markdown-kit/template            (+ /editor)   plugin package
@react-markdown-kit/mermaid            (+ /editor)   plugin package
@react-markdown-kit/slides             (+ /present, /editor)   plugin package
```

### 3.1 Responsibilities

| Package / entry point | Responsibility | Dependency rule |
| --- | --- | --- |
| `renderer` | Markdown → React, compilation, components, rendering policies | Must not depend on editor or template |
| `renderer/gfm` | Convenient GFM preset/rendering entry | Optional convenience |
| `renderer/styles.css` | Optional typography | No global reset |
| `editor` | Rich/source/preview authoring | May depend on renderer and Lexical |
| `editor/styles.css` | Editor chrome/theme defaults | No required Tailwind/ZUI provider |
| `editor/lexical` | Extension-author entry: block and inline adapters, plugins, commands | The only public Lexical types |
| `template` | `template({ data })` and `templateVariables()`, extensions only | Must not require React, renderer, editor or Lexical |
| `template/editor` | `templateVariables()` with chips | Peers on the editor |
| `mermaid` | `mermaid()`, an extension only: ```mermaid flowcharts as static SVG, legacy ```diagram / ```drawing JSON read | Must not require React, renderer, editor or Lexical |
| `mermaid/editor` | `mermaid()` with the drawing canvas; edits are written as Mermaid plus one `%% rmk-layout v1 {…}` annotation (specified in `plugins/mermaid/LAYOUT_ANNOTATION.md`) | Peers on the editor |
| `slides` | `slides()`, an extension only: a deck read from plain Markdown (`plugins/slides/DIALECT.md`), rendered as a static `<article>` of `<section>`s | Must not require React, renderer, editor or Lexical |
| `slides/present` | `slides()` with the interactive deck: present mode, keyboard and pointer navigation, fragments, presenter view, hash routing, `BroadcastChannel` sync | Peers on React |
| `slides/editor` | `slides()` with the slide break, marker and directive nodes, the insert commands and the toolbar buttons | Peers on the editor |

These are five npm packages: two cores and three plugins. A plugin package has no standalone API; it is used only through `extensions` or a preset.

### 3.2 Installation journeys

```bash
# Rendering only
npm install @react-markdown-kit/renderer

# Editor with built-in preview
npm install @react-markdown-kit/editor

# Personalized rendering
npm install @react-markdown-kit/renderer @react-markdown-kit/template

# Full kit
npm install @react-markdown-kit/renderer @react-markdown-kit/editor @react-markdown-kit/template @react-markdown-kit/mermaid @react-markdown-kit/slides
```

### 3.3 Repository layout

```text
packages/
  renderer/
  editor/
plugins/
  template/          plugin package: extensions only
  mermaid/           plugin package: extensions only
  slides/            plugin package: extensions only
internal/
  document-contracts/
  markdown-syntax/
  extension-contracts/
  diagnostics/
fixtures/
  commonmark/
  gfm/
  compatibility/
  editor-roundtrip/
  template-security/
examples/
  renderer-basic/
  next-server-rendering/
  markdown-editor/
  custom-editor-ui/
  typed-template/
  localized-customer-report/
benchmarks/
docs/
```

The `internal/` modules are build-time shared source, not a fourth public package. Public structural types must be emitted into the three packages so a headless template user does not need to install the renderer merely to satisfy a type import.

---

## 4. Shared Markdown model

### 4.1 MarkdownDocument

Introduce a first-class compiled document representation.

Conceptually:

```ts
export interface MarkdownDocument {
  readonly contractVersion: 1;
  readonly profile: "commonmark" | "gfm" | string;
  readonly source?: string;
  readonly tree: MdastRoot;
  readonly diagnostics: readonly MarkdownDiagnostic[];
}
```

The exact public type may evolve before v1 freeze, but the semantics are fixed:

- JSON-serializable tree and metadata where practical.
- No React elements.
- No Lexical instances.
- No application service references.
- No customer-specific closures.
- Source positions are retained where available.
- `source` may be retained when useful for preservation/debugging, but the tree is authoritative for compiled processing.

### 4.2 Why it exists

Simple users pass strings:

```tsx
<Markdown>{source}</Markdown>
```

Advanced users can compile once:

```ts
const document = compileMarkdown(source);
```

and render repeatedly:

```tsx
<Markdown document={document} />
```

The template engine can resolve directly to a document:

```ts
const result = report.resolve(data);

if (result.ok) {
  return <Markdown document={result.document} />;
}
```

This avoids unnecessary stringify/reparse cycles and creates one shared unit for diagnostics, templating, rendering, caching, and future tooling.

### 4.3 Input union

`Markdown` must make string/document inputs mutually exclusive in TypeScript.

Conceptually:

```ts
type MarkdownInput =
  | { children: string; document?: never }
  | { children?: never; document: MarkdownDocument };
```

Do not accept ambiguous combinations and guess which wins.

### 4.4 Persisted value

`MarkdownDocument` is not the required storage format. Applications remain free to persist the Markdown source string.

The editor should output Markdown. The template object should retain authored Markdown. The document object is an optimized/intermediate representation.

---

## 5. Shared presets and extension architecture

### 5.1 defineMarkdownPreset

Applications should define Markdown behavior once:

```ts
import {
  defineMarkdownPreset,
  gfm,
  syntaxHighlight,
} from "@react-markdown-kit/renderer";

export const appMarkdown = defineMarkdownPreset({
  extensions: [
    gfm(),
    syntaxHighlight(),
  ],

  components: {
    a: AppLink,
    img: AppImage,
  },
});
```

Then reuse it:

```tsx
<Markdown preset={appMarkdown}>{source}</Markdown>
```

```tsx
<MarkdownEditor
  preset={appMarkdown}
  value={source}
  onChange={setSource}
/>
```

```ts
const report = defineTemplate({
  source,
  preset: appMarkdown,
});
```

This represents one answer to:

> **What does Markdown mean in this application?**

### 5.2 Headless template users

A template-only application must not need the renderer package just to construct the same preset shape.

Therefore the preset contract is structural. The template package also exposes a lightweight `defineMarkdownPreset` helper generated from the same internal source:

```ts
import {
  defineMarkdownPreset,
  defineTemplate,
} from "@react-markdown-kit/template";
```

A preset created by either package must be accepted by the other because it uses the same versioned structural contract.

This duplication is intentional to preserve the three-package boundary without creating `@react-markdown-kit/core`.

### 5.3 Extension contract

Extensions are the long-term composition mechanism.

Conceptually:

```ts
interface MarkdownExtension {
  readonly name: string;
  readonly version?: string;
  readonly capabilities?: {
    syntax?: unknown;
    renderer?: unknown;
    editor?: unknown;
    template?: unknown;
  };
}
```

The exact internal adapter types should be strongly typed before public extension authoring is frozen.

Built-in examples:

```ts
gfm()
syntaxHighlight()
math()
callouts()
```

Editor-oriented extensions:

```ts
templateVariables(...)
slashCommands(...)
```

The system must support an extension exposing only the capabilities it has. The renderer ignores editor-only adapters. The editor can use both syntax and editor adapters. The template engine uses syntax/template adapters but never imports editor code.

### 5.4 Third-party ecosystem goal

A future third-party package should be able to provide:

```ts
import { mermaid } from "react-markdown-mermaid";

const docs = defineMarkdownPreset({
  extensions: [gfm(), mermaid()],
});
```

If the extension supplies the appropriate adapters:

```text
renderer → renders the block
editor   → provides an editing representation
template → safely preserves/resolves it
```

V1 does not need to freeze every third-party authoring API. It does need a versioned internal contract and built-in extensions implemented through the same mechanism wherever practical.

### 5.5 Remark and rehype compatibility

Keep these as compatibility escape hatches:

```tsx
<Markdown
  remarkPlugins={[remarkPlugin]}
  rehypePlugins={[rehypePlugin]}
>
  {source}
</Markdown>
```

The documentation should lead with React Markdown Kit extensions, then document remark/rehype interoperability for the existing ecosystem.

Do not remove the incumbent ecosystem merely to make the new abstraction look cleaner.

---

## 6. Renderer specification

### 6.1 Primary API

The first-use experience must remain extremely small:

```tsx
import Markdown from "@react-markdown-kit/renderer";

export function Article({ content }: { content: string }) {
  return <Markdown>{content}</Markdown>;
}
```

Also expose a named export:

```tsx
import { Markdown } from "@react-markdown-kit/renderer";
```

The default and named exports point to the same component.

No provider, account, stylesheet, cloud request, template configuration, editor package, or ZUI runtime is required.

### 6.2 Main props

The target public surface is conceptually:

```ts
interface MarkdownBaseProps {
  preset?: MarkdownPreset;
  extensions?: readonly MarkdownExtension[];
  components?: MarkdownComponents;

  // Compatibility / ecosystem escape hatches
  remarkPlugins?: PluggableList;
  rehypePlugins?: PluggableList;
  remarkRehypeOptions?: RemarkRehypeOptions;

  // Content policy
  allowedElements?: readonly string[];
  disallowedElements?: readonly string[];
  allowElement?: AllowElement;
  skipHtml?: boolean;
  unwrapDisallowed?: boolean;
  urlTransform?: UrlTransform;
}

type MarkdownProps = MarkdownBaseProps & MarkdownInput;
```

The final type should preserve familiar react-markdown migration patterns where compatibility is explicitly supported. [S1]

### 6.3 Preset merging rules

When both a preset and local options are supplied, use explicit deterministic rules:

1. preset supplies the baseline.
2. Local extensions append after preset extensions unless a named extension explicitly replaces an earlier instance.
3. Local components shallowly override matching preset components.
4. Local security/policy props override preset policy only when explicitly provided.
5. Duplicate extension behavior must be deterministic and documented.

Provide a helper for deliberate composition:

```ts
const docs = defineMarkdownPreset({
  extends: [baseMarkdown],
  extensions: [callouts()],
  components: {
    a: DocsLink,
  },
});
```

Avoid magical deep-merging of arbitrary plugin options.

### 6.4 Compilation API

Expose:

```ts
const document = compileMarkdown(source, {
  preset: appMarkdown,
});
```

Conceptual signature:

```ts
function compileMarkdown(
  source: string,
  options?: MarkdownCompileOptions,
): MarkdownDocument;
```

Compilation is deterministic for the same source/configuration and has no network side effects.

If parsing can produce nonfatal diagnostics, return them on the document. Fatal configuration errors throw a typed configuration error rather than producing an invalid document.

Future asynchronous compilation may use a distinct name such as `compileMarkdownAsync`; do not make one function unpredictably return a promise depending on plugin choice.

### 6.5 GFM convenience

Keep the standard plugin route:

```tsx
import remarkGfm from "remark-gfm";

<Markdown remarkPlugins={[remarkGfm]}>{source}</Markdown>
```

Also provide a convenient native preset/entry:

```tsx
import { GfmMarkdown } from "@react-markdown-kit/renderer/gfm";

<GfmMarkdown>{source}</GfmMarkdown>
```

or:

```ts
const docs = defineMarkdownPreset({
  extensions: [gfm()],
});
```

The native GFM extension and documented `remark-gfm` path should agree on supported semantics for common fixtures.

### 6.6 Custom components

Maintain the familiar model:

```tsx
<Markdown
  components={{
    a: AppLink,
    img: AppImage,
    code: CodeBlock,
  }}
>
  {source}
</Markdown>
```

Component overrides must receive enough semantic metadata to build accessible application components without depending on private parser structures.

Where compatibility requires upstream node metadata, expose it intentionally and document its stability level.

### 6.7 Styling

By default, output semantic elements without app-wide styles.

Optional typography:

```tsx
import "@react-markdown-kit/renderer/styles.css";

<div className="rmk-document">
  <Markdown>{source}</Markdown>
</div>
```

Prefer CSS custom properties and a scoped class. Do not ship a global reset.

See `STYLING.md` for the binding contract, which additionally requires that the
kit never depend on ZUI, Tailwind, or any design system, and that it work with
plain CSS, utility classes, CSS modules, and consumer component libraries
equally well.

### 6.8 Server compatibility

The base renderer must work with:

- ordinary browser React applications;
- server-side rendering;
- React Server Components hosts where supported;
- static server rendering without browser globals.

Do not put a root-level `"use client"` directive on the normal renderer entry.

React treats `"use client"` as a module dependency boundary, so test actual built dependency graphs to ensure editor code does not leak into renderer-only server usage. [S6]

### 6.9 Security

Default rendering must not execute raw HTML.

Keep safe URL behavior and document explicit raw-HTML recipes with sanitization. Test protocol obfuscation, event attributes, malicious HTML generated by plugins, unsafe image URLs, DOM clobbering, and custom plugin order. [S7]

Third-party plugins and React components are trusted application code. Do not describe them as sandboxed.

### 6.10 Compatibility target

Pin a concrete react-markdown release in fixtures. **The pinned baseline is `react-markdown@10.1.0`.**

Target supported migration for the documented v10-style API, including where practical:

```text
children
components
remarkPlugins
rehypePlugins
remarkRehypeOptions
allowedElements
disallowedElements
allowElement
skipHtml
unwrapDisallowed
urlTransform
```

Also evaluate documented asynchronous renderer variants before claiming complete parity. [S1]

A migration guide must classify each feature:

```text
compatible
compatible with documented change
not supported yet
intentionally different
```

Do not use "drop-in replacement" as a blanket claim until the compatibility matrix proves it for the stated baseline.

### 6.11 Renderer acceptance gate

Before stable v1:

- selected CommonMark fixtures pass;
- selected GFM fixtures pass;
- migration fixtures pass for claimed compatibility;
- server examples build;
- TypeScript examples compile;
- renderer-only tarball does not contain Lexical/editor/template runtime dependencies;
- security corpus passes;
- optional CSS is scoped;
- `compileMarkdown` and direct string rendering produce semantically equivalent output.

---

## 7. Editor specification

### 7.1 Primary API

Change the existing editor API to conventional React naming:

```tsx
"use client";

import { useState } from "react";
import { MarkdownEditor } from "@react-markdown-kit/editor";
import "@react-markdown-kit/editor/styles.css";

export function Notes() {
  const [value, setValue] = useState("# Notes\n\nStart writing.");

  return (
    <MarkdownEditor
      value={value}
      onChange={setValue}
    />
  );
}
```

Use `onChange`, not `onValueChange`, in the new public API.

Provide a migration alias for existing ZUI consumers if necessary, but do not freeze the legacy name into the new major API solely for backward compatibility.

### 7.2 Controlled and uncontrolled use

Support both:

```tsx
<MarkdownEditor
  value={value}
  onChange={setValue}
/>
```

and:

```tsx
<MarkdownEditor
  defaultValue="# Hello"
  onChange={handleChange}
/>
```

If neither is provided:

```tsx
<MarkdownEditor />
```

starts with an empty document.

Follow normal React controlled/uncontrolled rules. Warn in development when switching unpredictably between controlled and uncontrolled modes.

### 7.3 Modes

Use:

```ts
type MarkdownEditorMode = "rich" | "source" | "preview";
```

Controlled:

```tsx
<MarkdownEditor
  mode={mode}
  onModeChange={setMode}
/>
```

Uncontrolled:

```tsx
<MarkdownEditor defaultMode="rich" />
```

Replace the older public names:

```text
edit-rich → rich
edit-raw  → source
view      → preview
```

The new names are shorter and describe the user-visible state rather than the implementation.

### 7.4 Preset reuse

```tsx
<MarkdownEditor
  preset={appMarkdown}
  value={source}
  onChange={setSource}
/>
```

The editor must use the same syntax/profile/components where relevant for preview.

Preview must delegate to `@react-markdown-kit/renderer`; do not maintain a second read-only renderer inside the editor.

The rich editor DOM does not need to equal the renderer DOM. Saved semantics and preview output do.

### 7.5 Simple editor vs headless editor

Provide two levels of API.

**Batteries-included**

```tsx
<MarkdownEditor
  value={source}
  onChange={setSource}
/>
```

This includes the default content surface, toolbar, shortcuts, source mode, and preview mode.

**Headless/composable**

```tsx
const editor = useMarkdownEditor({
  value: source,
  onChange: setSource,
  preset: appMarkdown,
});

return (
  <MarkdownEditorProvider editor={editor}>
    <MyToolbar />
    <MarkdownEditorContent />
    <MyStatusBar />
  </MarkdownEditorProvider>
);
```

Public exports:

```ts
MarkdownEditor
useMarkdownEditor
MarkdownEditorProvider
MarkdownEditorContent
useMarkdownEditorContext
```

This allows custom CMSs, report builders, chat composers, admin tools, Notion-like layouts, and embedded editors without forcing users to fork the default UI.

Tiptap's current React API demonstrates the value of supporting both an editor-instance approach and composable React context for complex editor UIs. React Markdown Kit should use the pattern, not copy Tiptap's API verbatim. [S14][S15]

### 7.6 Editor instance

Conceptually expose a stable wrapper:

```ts
interface MarkdownEditorInstance {
  getMarkdown(): string;
  getDocument(): MarkdownDocument;
  focus(): void;
  blur(): void;
  undo(): void;
  redo(): void;
  setMode(mode: MarkdownEditorMode): void;
  readonly mode: MarkdownEditorMode;
  readonly commands: MarkdownEditorCommands;
}
```

Do not expose a Lexical editor instance as the primary contract.

If an escape hatch is necessary:

```ts
editor.getNativeEditor()
```

mark it explicitly as an advanced, implementation-coupled API with weaker stability guarantees.

Lexical is modular and plugin-oriented, making it a strong implementation base, but React Markdown Kit should remain free to change internal editor architecture in a future major version. [S16]

### 7.7 Essential editing features

V1 must correctly handle:

- paragraphs;
- headings;
- bold/italic/strike where profile supports it;
- ordered/unordered/task lists;
- blockquotes;
- links;
- images;
- code and fenced code;
- tables where profile supports them;
- undo/redo;
- clipboard;
- keyboard navigation;
- source editing;
- preview.

Fix the current ZUI image and reference-link limitations before broad replacement positioning. [S2] See `AUDIT.md`.

### 7.8 Images

Support URL insertion and application-controlled upload:

```tsx
<MarkdownEditor
  onUploadImage={async (file, context) => {
    const asset = await upload(file, context.signal);
    return {
      src: asset.url,
      alt: asset.alt ?? "",
    };
  }}
/>
```

The application chooses storage. The library manages UI state, cancellation, errors, and final Markdown serialization.

Never persist blob URLs as permanent document content.

### 7.9 Round-trip preservation contract

This is a release-critical differentiator.

**No edit**

Opening a document, moving between rich/source/preview, and closing it must not change the source string merely because the editor imported and exported it.

**Supported edit**

When a supported construct is edited, preserve document meaning and document any normalization behavior.

**Unsupported syntax**

Unsupported syntax must be preserved in a recoverable opaque representation or force a source-mode fallback. Editing adjacent supported content must not delete unsupported source.

**No silent loss**

If the editor cannot safely preserve a construct, it must not silently flatten or discard it.

Source spans, raw-source retention, and dirty-region tracking may be required. A generic parse/export round trip alone is not sufficient.

### 7.10 Controlled-state behavior

For controlled mode:

- `onChange` emits the newest Markdown string;
- the parent synchronously echoes the value;
- persistence may be debounced outside the editor;
- ordinary echoed values should not reset selection or undo history;
- true external replacement/reset must be detected explicitly;
- IME composition must not be interrupted by parent echoes.

Provide an explicit reset/document identity mechanism:

```tsx
<MarkdownEditor
  documentKey={note.id}
  value={note.markdown}
  onChange={setMarkdown}
/>
```

Changing `documentKey` signals a deliberate document replacement.

### 7.11 Editor extensions

Editor-specific capabilities should use extensions:

```tsx
<MarkdownEditor
  extensions={[
    slashCommands(),
    templateVariables(...),
  ]}
/>
```

Do not add top-level props for every future feature.

The default editor may internally enable a documented starter set.

### 7.12 Accessibility and internationalization

Require:

- keyboard-operable controls;
- visible focus;
- screen-reader labels;
- announced mode changes;
- accessible dialogs/toolbars;
- IME testing;
- RTL document testing;
- touch interaction testing;
- localized editor UI strings independent of document locale.

### 7.13 Editor acceptance gate

Before stable v1:

- no-op source preservation passes;
- image/reference behavior passes;
- unsupported syntax survives adjacent edits;
- preview equals standalone renderer semantics;
- controlled/uncontrolled usage passes;
- IME/clipboard/undo/redo passes;
- headless/composable example works without default toolbar;
- default editor can be used without template package;
- Lexical types are not required for ordinary consumers.

---

## 8. Template specification

### 8.1 Package role

`@react-markdown-kit/template` is a separate plugin package (see the amendment at the top: its API is the `template()` extension).

Its responsibility is:

> Given authored Markdown + application data + optional locale/formatting settings, safely resolve a validated Markdown document.

It does not render React. Rendering belongs to the renderer package.

It does not require React, Lexical, a browser, or a cloud account.

This separation keeps the renderer focused and lets the template engine work in:

```text
React applications
Node services
workers
CLI tools
email generation
PDF generation
static-site generation
AI/document pipelines
CMS systems
```

### 8.2 Primary mental model

A template is an object with behavior.

Simple:

```ts
import { defineTemplate } from "@react-markdown-kit/template";

const greeting = defineTemplate(`
# Hello {{user.name}}

Welcome to {{company.name}}.
`);
```

Resolve it:

```ts
const result = greeting.resolve({
  user: { name: "Chatis" },
  company: { name: "ZUI" },
});
```

The terminology is deliberate:

```text
template.resolve(data) → MarkdownDocument
renderer renders the MarkdownDocument
```

Do not call the headless operation `renderTemplate`; "render" is reserved for output/UI concerns.

### 8.3 Minimal API

These must work with no schema and no config ceremony:

```ts
const greeting = defineTemplate(`# Hello {{user.name}}`);

const result = greeting.resolve({
  user: { name: "Chatis" },
});
```

Schemas, localization, metadata, custom formatters, and presets are progressive enhancements.

Never require this onboarding sequence:

```text
define schema
create compiler
register variables
compile template
configure renderer
finally display text
```

The first useful result should take a few lines.

### 8.4 Typed templates

Support generic TypeScript data typing:

```ts
type ReportData = {
  customer: {
    name: string;
  };
  revenue: number;
};

const report = defineTemplate<ReportData>(`
# {{customer.name}}

Revenue: {{revenue}}
`);
```

Then:

```ts
report.resolve({
  customer: { name: "Acme" },
  revenue: 50_000,
});
```

TypeScript should reject missing/incorrect fields when the caller has supplied a type parameter or inferable runtime schema.

Generic typing is compile-time help, not runtime validation.

### 8.5 Runtime schemas through Standard Schema

Do not invent a validation ecosystem or require Zod specifically.

Accept Standard Schema-compatible validators:

```ts
import { z } from "zod";
import { defineTemplate } from "@react-markdown-kit/template";

const ReportSchema = z.object({
  customer: z.object({
    name: z.string(),
  }),
  revenue: z.number(),
});

const report = defineTemplate({
  source: `
# {{customer.name}}

Revenue: {{revenue | currency:"USD"}}
`,
  schema: ReportSchema,
});
```

Standard Schema defines a common interface for runtime validation and static type inference so ecosystem tools can accept multiple validation libraries without library-specific adapters. It is designed by contributors from Zod, Valibot, and ArkType and is implemented by multiple schema libraries. [S17]

The package must not require `@standard-schema/spec` at runtime if the interface can be consumed structurally.

Schemas remain optional:

```ts
const template = defineTemplate(`Hello {{user.name}}`);
```

must continue to work.

### 8.6 Template object

Conceptual public contract:

```ts
interface MarkdownTemplate<TData = unknown> {
  readonly id?: string;
  readonly version?: string | number;
  readonly defaultLocale?: string;

  resolve(
    data: TData,
    options?: TemplateResolveOptions,
  ): TemplateResult;

  inspect(): TemplateInspection;

  source(options?: { locale?: string }): string;
}
```

Potential future async work should use a distinct `resolveAsync` method rather than making `resolve` conditionally return a Promise.

### 8.7 Resolution result

Use a discriminated result:

```ts
type TemplateResult =
  | {
      ok: true;
      document: MarkdownDocument;
      resolvedLocale?: string;
      diagnostics: readonly TemplateDiagnostic[];
    }
  | {
      ok: false;
      diagnostics: readonly TemplateDiagnostic[];
    };
```

A missing required value should not silently produce a publishable-looking report.

Diagnostics include:

```ts
interface TemplateDiagnostic {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  path?: string;
  range?: SourceRange;
}
```

Diagnostics should not include full private runtime values by default.

### 8.8 defineTemplate overloads

Support progressively richer forms.

**String**

```ts
const greeting = defineTemplate(`# Hello {{user.name}}`);
```

**Typed string**

```ts
const greeting = defineTemplate<GreetingData>(`
# Hello {{user.name}}
`);
```

**Config object**

```ts
const report = defineTemplate({
  id: "monthly-report",
  version: 1,
  source: `# {{customer.name}}`,
  schema: ReportSchema,
  preset: appMarkdown,
});
```

**Localized config**

```ts
const report = defineTemplate({
  id: "monthly-report",
  version: 1,

  source: {
    "en-US": `
# Report for {{customer.name}}

Revenue: {{revenue | currency:"USD"}}
`,
    "fr-FR": `
# Rapport pour {{customer.name}}

Chiffre d'affaires : {{revenue | currency:"USD"}}
`,
  },

  defaultLocale: "en-US",
  schema: ReportSchema,
  preset: appMarkdown,
});
```

Use `source`, not `sources`, so the conceptual field remains the same whether the value is one string or a locale map.

### 8.9 Variable metadata

Runtime validation and editor UX are different concerns. Keep presentation metadata separate from the schema:

```ts
const report = defineTemplate({
  source,
  schema: ReportSchema,

  variables: {
    "customer.name": {
      label: "Customer name",
      description: "Customer display name",
      group: "Customer",
    },
    revenue: {
      label: "Revenue",
      group: "Financials",
    },
  },
});
```

This metadata powers variable pickers, documentation, autocomplete, and future UI without requiring every schema library to support custom React Markdown Kit annotations.

### 8.10 Syntax

V1 supports path bindings:

```text
{{customer.name}}
{{revenue}}
{{brand.logoUrl}}
```

and a deliberately small formatter grammar:

```text
{{revenue | currency:"USD"}}
{{completion | percent}}
{{createdAt | date:"medium"}}
```

No arbitrary JavaScript, JSX, method calls, function calls, prototype traversal, eval, `new Function`, or application-service access.

Unknown variable paths and formatters produce diagnostics.

### 8.11 Safe structural interpolation

Do not implement templating as global regex/string replacement followed by Markdown parsing.

Parse the Markdown/template syntax first and represent template placeholders structurally.

Example runtime value:

```text
**Administrator**
```

Inserted into:

```markdown
# Hello {{user.name}}
```

must resolve as literal text equivalent to:

```markdown
# Hello \*\*Administrator\*\*
```

semantically, rather than unexpectedly introducing bold Markdown.

Likewise, data must not be able to create a new heading, table row, link destination, HTML tag, or code fence merely because it contains Markdown punctuation.

Variables inside inline code and fenced code are literal by default:

````markdown
`{{user.name}}`

```txt
{{user.name}}
```
````

Escaped delimiters remain literal:

```markdown
\{{user.name}}
```

### 8.12 Links and images

Support complete destination bindings:

```markdown
[Open account]({{links.accountUrl}})

![{{brand.logoAlt}}]({{brand.logoUrl}})
```

For v1, avoid arbitrary partial URL interpolation such as:

```markdown
https://example.com/users/{{user.id}}/reports/{{report.id}}
```

unless the parser can guarantee correct encoding and policy semantics.

Prefer application-constructed complete URLs:

```ts
{
  links: {
    accountUrl: buildAccountUrl(customer),
  }
}
```

After resolution, destinations still pass through renderer/template URL policy validation.

### 8.13 Localization

Separate three concepts:

| Concern | Responsibility |
| --- | --- |
| Document language | Pick the correct authored localized Markdown source |
| Runtime formatting | Format dates/numbers/currency with explicit locale/time-zone inputs |
| Localized/customer assets | Bind application-provided URLs/alt text for the selected context |

Do not imply automatic translation.

Resolve:

```ts
report.resolve(data, {
  locale: "fr-FR",
  timeZone: "America/New_York",
});
```

Locale fallback must be explicit and observable in the result.

Example policy:

```text
requested fr-CA
→ exact fr-CA if available
→ configured parent/fallback if enabled
→ defaultLocale
→ error when policy says fallback is forbidden
```

Do not silently pretend a fallback source is the requested language.

### 8.14 Formatting

Built-in formatters should cover common application needs:

```text
number
currency
percent
date
time
datetime
```

Currency must be explicit rather than inferred from locale.

Formatting behavior uses platform internationalization APIs where appropriate and requires explicit or well-documented locale/time-zone behavior. [S10]

Custom formatters can be registered through template configuration/extensions:

```ts
const template = defineTemplate({
  source,
  formatters: {
    accountStatus(value) {
      return formatAccountStatus(value);
    },
  },
});
```

Custom formatter outputs are treated as typed/literal values according to their formatter contract, not reparsed as arbitrary Markdown unless an explicitly trusted future type is introduced.

### 8.15 Conditions and loops

Do not put arbitrary conditions/loops in the initial release unless real pilot use requires them.

A later safe grammar can add standalone structural blocks:

```markdown
{{#if customer.hasRenewal}}
Your account is ready for renewal.
{{/if}}

{{#each items as item}}
- {{item.name}}
{{/each}}
```

Requirements before shipping:

- parsed structural grammar;
- no arbitrary JS expressions;
- iteration/resource limits;
- nesting/depth limits;
- source-preservation tests;
- predictable table/list behavior;
- cycle protection for future partials.

V1 variables + schemas + formatting + localization + asset binding are useful without becoming a programming language.

### 8.16 Headless source output

Provide an intentional method/helper for callers that need resolved Markdown text:

```ts
const result = report.resolve(data);

if (result.ok) {
  const markdown = result.document.toMarkdown();
}
```

If methods on `MarkdownDocument` would make the document less serializable/stable, expose a utility instead:

```ts
import { toMarkdown } from "@react-markdown-kit/template";

const markdown = toMarkdown(result.document);
```

Choose one before API freeze; do not expose both as competing canonical patterns.

> **Decision for v1: the utility form.** `MarkdownDocument` must stay a plain
> JSON-serializable object (spec 4.1), so it carries no methods.

The preferred architectural output remains `MarkdownDocument`.

### 8.17 React adapter

Convenience API:

```tsx
import { Template } from "@react-markdown-kit/template";

<Template
  template={report}
  data={reportData}
  locale="fr-FR"
/>;
```

Internally:

```text
template.resolve(data)
        ↓
MarkdownDocument
        ↓
<Markdown document={...} />
```

The component should accept renderer-oriented props that make sense, such as `components`, `extensions`, or `preset` overrides, without duplicating the full renderer implementation.

Do not add template props directly to `<Markdown>`:

```tsx
// Avoid this API
<Markdown
  template={report}
  data={customer}
  locale="fr-FR"
/>
```

Keep `<Markdown>` pure and `<Template>` semantically explicit.

### 8.18 Template-aware editor integration

Import:

```ts
import {
  templateVariables,
} from "@react-markdown-kit/template/editor";
```

Use:

```tsx
<MarkdownEditor
  value={source}
  onChange={setSource}
  extensions={[
    templateVariables({
      template: report,
      previewData: sampleCustomer,
    }),
  ]}
/>
```

Do not create a giant editor API such as:

```tsx
<MarkdownEditor
  template={report}
  templateData={data}
  templateLocale="fr-FR"
  enableTemplateVariables
  templateValidation
/>
```

The extension model scales much better.

### 8.19 Template editor UX

The extension should support:

- `{{` autocomplete;
- variable picker grouped by metadata;
- visually distinct variable nodes/chips in rich mode;
- source-mode syntax preservation;
- missing-variable diagnostics;
- formatter suggestions;
- sample-data preview;
- locale selection for preview;
- no mutation of authored placeholders when preview data changes.

Example authored source:

```markdown
Hello {{customer.name}}
```

Rich mode might visually show:

```text
Hello [ Customer name ]
```

Preview for Acme:

```text
Hello Acme
```

Saved source remains:

```markdown
Hello {{customer.name}}
```

### 8.20 Template acceptance gate

Before stable v1:

- template root has no React/editor/Lexical requirement;
- simple no-schema API works;
- generic typing works;
- at least two Standard Schema-compatible validators pass integration tests;
- malformed/missing values yield structured diagnostics;
- runtime text cannot inject Markdown structure;
- code contexts and escaped placeholders remain literal;
- complete URL bindings are validated;
- localized source selection and fallback are explicit;
- formatters honor locale/time-zone configuration;
- React adapter delegates to renderer;
- editor preview never replaces saved placeholders;
- customer-specific resolved outputs cannot leak through incorrectly keyed caches.

---

## 9. Public API summary to freeze for v1

The following is the intended ergonomic hierarchy.

### 9.1 Renderer

```ts
import {
  Markdown,
  compileMarkdown,
  defineMarkdownPreset,
  gfm,
} from "@react-markdown-kit/renderer";
```

**Beginner**

```tsx
<Markdown>{source}</Markdown>
```

**Customized**

```tsx
<Markdown
  preset={appMarkdown}
  components={{ a: Link }}
>
  {source}
</Markdown>
```

**Compiled**

```tsx
const document = compileMarkdown(source, {
  preset: appMarkdown,
});

<Markdown document={document} />
```

### 9.2 Editor

```ts
import {
  MarkdownEditor,
  useMarkdownEditor,
  MarkdownEditorProvider,
  MarkdownEditorContent,
} from "@react-markdown-kit/editor";
```

**Beginner controlled**

```tsx
<MarkdownEditor
  value={source}
  onChange={setSource}
/>
```

**Beginner uncontrolled**

```tsx
<MarkdownEditor defaultValue="# Hello" />
```

**Shared preset**

```tsx
<MarkdownEditor
  preset={appMarkdown}
  value={source}
  onChange={setSource}
/>
```

**Headless/composable**

```tsx
const editor = useMarkdownEditor({
  preset: appMarkdown,
  value: source,
  onChange: setSource,
});

<MarkdownEditorProvider editor={editor}>
  <MyToolbar />
  <MarkdownEditorContent />
</MarkdownEditorProvider>
```

### 9.3 Template

```ts
import {
  defineTemplate,
} from "@react-markdown-kit/template";
```

**Beginner**

```ts
const greeting = defineTemplate(`# Hello {{user.name}}`);

const result = greeting.resolve({
  user: { name: "Chatis" },
});
```

**Typed**

```ts
const greeting = defineTemplate<GreetingData>(`
# Hello {{user.name}}
`);
```

**Runtime validated**

```ts
const report = defineTemplate({
  source,
  schema: ReportSchema,
});
```

**Localized**

```ts
const report = defineTemplate({
  source: {
    "en-US": english,
    "fr-FR": french,
  },
  defaultLocale: "en-US",
  schema: ReportSchema,
});
```

**React**

```tsx
import { Template } from "@react-markdown-kit/template";

<Template
  template={report}
  data={data}
  locale="fr-FR"
/>
```

**Template-aware editing**

```tsx
import { templateVariables } from "@react-markdown-kit/template/editor";

<MarkdownEditor
  extensions={[
    templateVariables({
      template: report,
      previewData: data,
    }),
  ]}
/>
```

---

## 10. Processing and interoperability contract

### 10.1 Canonical pipeline

Conceptually:

```text
Markdown string
   ↓
parser + syntax extensions
   ↓
MarkdownDocument / mdast
   ↓
optional template resolution
   ↓
remark transforms
   ↓
mdast → hast
   ↓
rehype transforms
   ↓
URL / HTML / element policies
   ↓
React component mapping
   ↓
React elements
```

The exact ordering of user-supplied plugins must be documented and fixture-tested.

A precompiled `MarkdownDocument` enters after parsing, but must still pass through applicable transforms and security policies. Passing a document object is not a security bypass.

### 10.2 Template interaction

The template package may add typed variable nodes to its own compiled form. After successful resolution, those nodes lower into ordinary Markdown document nodes.

The base renderer should not need to know how template evaluation works.

This is an important package boundary:

```text
template understands renderer's document contract
renderer does not understand template semantics
```

### 10.3 Editor interaction

The editor uses an adapter between the shared Markdown model and Lexical editing state.

Do not require rich-editor DOM structure to mirror renderer output. Require:

- equivalent supported meaning;
- reliable source preservation;
- renderer-based preview;
- consistent preset/extension semantics.

### 10.4 Parser ownership

Do not build three parsers.

Use one shared syntax implementation internally for renderer/template concerns where possible and one documented adapter boundary for the editor.

Lexical currently exposes Markdown utilities and an mdast integration, with the latter documented as experimental. Evaluate it against the preservation corpus but keep it behind a private adapter so experimental upstream types do not become the public React Markdown Kit contract. [S8][S9]

---

## 11. Security specification

Security is part of the product contract, especially because templates combine authored documents and runtime application data.

### 11.1 Renderer threats

Test:

- raw HTML;
- unsafe protocols;
- encoded protocol bypasses;
- event-handler attributes;
- plugin-generated HTML;
- DOM clobbering;
- malicious custom URLs;
- unsafe image destinations;
- resource-exhaustion inputs.

### 11.2 Template threats

Runtime data must not gain template-language privileges.

Disallow:

- prototype traversal (`__proto__`, `constructor`, `prototype`);
- arbitrary property execution;
- arbitrary method calls;
- JS expression evaluation;
- functions embedded in untrusted template source;
- unbounded recursion;
- unbounded iteration when loops are added;
- cache keys that omit tenant/customer/locale data where resolved output is cached.

### 11.3 Cache rules

Safe to cache by template identity/configuration:

```text
parsed template
compiled template grammar
static source AST
```

Resolved personalized output must be keyed by all relevant data/version/locale identity or kept request-local.

Never globally cache:

```text
report template ID → resolved Acme document
```

when the next request may be for another customer.

### 11.4 Diagnostics and privacy

Error objects should contain paths and source positions, not secrets.

Good:

```text
TEMPLATE_REQUIRED_VALUE
Missing required variable: customer.accountNumber
```

Avoid:

```text
Invalid account number value: 1234-5678-...
```

unless the application explicitly asks for verbose development diagnostics.

---

## 12. Testing, benchmarks, and release quality

### 12.1 Fixture suites

| Suite | Required coverage |
| --- | --- |
| CommonMark | Standard syntax corpus and edge cases |
| GFM | Tables, tasks, strike, autolinks, footnotes as supported |
| Migration | `react-markdown` props/plugins/component patterns claimed compatible |
| Renderer security | HTML, protocols, plugin ordering, malicious URLs |
| Document | Compile/string equivalence, contract versioning, serialization |
| Editor | No-op preservation, edits, images, references, opaque nodes, IME, undo, clipboard |
| Templates | Variables, schemas, formatting, locale, images/links, injection attempts |
| Runtime | Browser, SSR, RSC host examples, TypeScript |
| Packaging | Each installation combination from published tarballs |
| Extensions | Preset reuse and extension ordering/collision behavior |

### 12.2 Packaged-consumer tests

Do not rely on monorepo imports.

CI should pack the actual npm tarballs and install them into clean consumer fixtures with npm, pnpm, and Yarn for the supported matrix.

This catches:

- undeclared dependencies;
- broken exports;
- private workspace path leakage;
- missing type files;
- peer-dependency mistakes;
- CSS export mistakes;
- server/client boundary mistakes.

### 12.3 Bundle/dependency gates

Renderer-only installation:

```text
must not contain Lexical runtime
must not contain editor runtime
must not contain template runtime
must not require ZUI UI framework
```

Headless template-only installation:

```text
must not require React
must not require Lexical
must not require browser globals
```

Editor may depend on renderer and Lexical.

### 12.4 Performance targets

Targets are engineering gates, not marketing claims until measured publicly.

For equivalent renderer functionality, target compressed bundle size and median/p95 rendering time within 10% of the pinned react-markdown baseline initially.

Benchmark:

```text
1 KB
10 KB
100 KB
pathological/adversarial fixtures
```

Measure cold and repeated renders separately.

For editor interaction, begin with a target of p95 input-to-paint below 50 ms on a published reference desktop for a representative 10,000-character mixed document. Adjust based on measured behavior and publish limits honestly.

### 12.5 API type tests

Compile examples that prove:

- `children` and `document` are mutually exclusive;
- controlled editor props infer correctly;
- uncontrolled editor works;
- mode values are restricted;
- generic template data is enforced;
- Standard Schema inference is preserved where the schema implementation exposes it;
- result narrowing on `result.ok` works;
- preset objects cross package boundaries structurally.

---

## 13. Documentation and adoption strategy

The product can only displace an entrenched renderer if adoption is lower-friction than staying with the incumbent and the broader kit creates new value.

### 13.1 Lead with the renderer

The renderer landing page starts with:

```tsx
import Markdown from "@react-markdown-kit/renderer";

<Markdown>{content}</Markdown>
```

Then show:

1. components;
2. GFM;
3. presets/extensions;
4. compatibility evidence;
5. migration;
6. server behavior;
7. editor/template as optional next steps.

Do not open with schemas, cloud products, or an architectural diagram.

### 13.2 Three search/discovery funnels

Create distinct, substantive pages:

| Search intent | Package / page |
| --- | --- |
| React markdown renderer | `@react-markdown-kit/renderer` |
| React markdown editor | `@react-markdown-kit/editor` |
| Markdown template engine / React markdown variables | `@react-markdown-kit/template` |

Recommended docs paths:

```text
/react-markdown-renderer
/react-markdown-editor
/markdown-template-engine
/react-markdown-variables
/localized-markdown
/migrate-from-react-markdown
/nextjs-markdown
/examples/customer-report
```

Google recommends descriptive, useful, distinct page titles/content rather than relying on a naming trick. [S12][S13]

Example titles:

```text
React Markdown Renderer | React Markdown Kit
React Markdown Editor | React Markdown Kit
Markdown Template Engine | React Markdown Kit
```

### 13.3 Migration product

Treat migration as a product feature.

**Codemod**

A local CLI should:

- detect supported react-markdown versions;
- rewrite safe imports;
- preserve aliases;
- flag unsupported props/plugins;
- default to dry-run;
- never remove security behavior silently.

Target supported simple migration:

```diff
-import Markdown from "react-markdown";
+import Markdown from "@react-markdown-kit/renderer";
```

**Comparison runner**

Allow a project to render a local sample corpus through both implementations and compare normalized output.

It should report:

```text
matching documents
differences
unsupported configuration
warnings
bundle impact
```

Do not upload private documents to a service merely to compare them.

### 13.4 Flagship demo

Build one demo that shows why the three-package kit is greater than a renderer alone.

Flow:

```text
1. Start with Markdown
2. Render it
3. Switch to rich editing
4. Insert {{customer.name}}
5. Add a typed/schema-backed variable
6. Choose sample customer data
7. Switch locale
8. Resolve a different customer logo
9. Preview
10. Inspect the exact persisted Markdown
```

The demo must make this visually obvious:

```text
preview changes
source does not
```

Also keep a separate tiny renderer demo so the library never looks like a mandatory framework.

### 13.5 New-project advantage

Do not spend all energy convincing satisfied react-markdown users to migrate.

Target new applications that need at least two of:

```text
rendering
editing
typed variables
localized content
customer-specific branding
admin-authored documents
```

For them, React Markdown Kit can remove glue code from day one.

### 13.6 Integration distribution

Prioritize integrations with:

- React starters;
- Next.js examples;
- admin frameworks;
- CMSs;
- AI/document starters;
- analytics/reporting apps;
- developer portals.

Contribute working integrations and maintenance commitments rather than asking maintainers for links.

---

## 14. Metrics and definition of success

Do not claim success by summing downloads across packages.

### 14.1 Renderer adoption ratio

Track on identical time windows:

```text
renderer adoption ratio =
  downloads(@react-markdown-kit/renderer)
  / downloads(react-markdown)
```

Interpret carefully because editor installations may also pull the renderer.

Track alongside:

- direct dependents;
- public integrations;
- confirmed production usage;
- migration success rate;
- issue/retention patterns;
- search impressions;
- docs conversion proxies.

### 14.2 Proposed validation targets

These are targets, not predictions:

| Gate | Evidence |
| --- | --- |
| Migration fit | 10 real migration pilots |
| Renderer adoption | 25 confirmed production applications |
| Distribution | 5 independently maintained integrations/examples |
| Editor quality | No unresolved supported-syntax data-loss bug in release corpus |
| Template value | Pilot examples showing meaningful reduction in interpolation/validation/editor glue |

### 14.3 Claims policy

Do not claim:

```text
fastest
smallest
most secure
drop-in replacement
100% compatible
```

without a published methodology and evidence.

Credibility is a competitive advantage for infrastructure libraries.

---

## 15. Implementation sequence

| Phase | Deliverable | Exit gate |
| --- | --- | --- |
| A — Audit | Existing ZUI behavior, dependency audit, comparison baseline | Corpus + current gaps documented |
| B — Shared contracts | `MarkdownDocument`, diagnostics, preset/extension contracts | Type + structural compatibility tests |
| C — Renderer | `<Markdown>`, compile API, GFM, policies, migration compatibility | Renderer acceptance gates pass |
| D — Editor | New API, renderer preview, source preservation, images/references | Editor acceptance gates pass |
| E — Template core | `defineTemplate`, `.resolve()`, schemas, diagnostics, safe interpolation | Headless + security gates pass |
| F — Template integrations | `<Template>`, `templateVariables()` editor extension | Preview/source-preservation gates pass |
| G — Migration tooling | Codemod, comparison runner, compatibility docs | Pilot migrations validate claims |
| H — Launch/distribution | Flagship demo, SEO pages, integration PRs | Initial production adoption recorded |

Renderer release does not need to wait for template loops, collaboration, export, or future cloud services.

Editor and template development can proceed in parallel once shared contracts stabilize.

---

## 16. Initial implementation backlog

| ID | Task | Acceptance evidence |
| --- | --- | --- |
| CORE-01 | Inventory existing ZUI Markdown import/export behavior | Baseline corpus committed |
| CORE-02 | Define `MarkdownDocument` v1 | Public type tests + serialization fixtures |
| CORE-03 | Define diagnostics contracts | Stable codes/ranges tested |
| CORE-04 | Define structural `MarkdownPreset` | Cross-package fixture proves compatibility |
| CORE-05 | Define extension version/capability contract | Built-in extension implemented through contract |
| PKG-01 | Establish three packages/subpath exports | Clean tarball install matrix passes |
| RENDER-01 | Implement `<Markdown>` string path | Basic fixtures pass |
| RENDER-02 | Add named/default exports | Type/runtime identity test |
| RENDER-03 | Implement `compileMarkdown` and document path | String/document semantic equivalence |
| RENDER-04 | Implement `defineMarkdownPreset` | Preset/local merge tests |
| RENDER-05 | Add GFM native extension/entry | GFM corpus passes |
| RENDER-06 | Implement components API | Custom component migration tests |
| RENDER-07 | Implement remark/rehype compatibility | Claimed plugin fixtures pass |
| RENDER-08 | Implement HTML/URL policy | Security corpus passes |
| RENDER-09 | Verify SSR/RSC boundaries | Clean host builds; no editor leakage |
| EDIT-01 | Expose `value/onChange/defaultValue` API | Controlled/uncontrolled tests |
| EDIT-02 | Rename modes to rich/source/preview | Mode tests + migration docs |
| EDIT-03 | Use renderer for preview | Shared output fixtures |
| EDIT-04 | Implement preset reuse | Dialect agreement tests |
| EDIT-05 | Add `useMarkdownEditor` | Headless editor example |
| EDIT-06 | Add provider/content primitives | Custom toolbar fixture |
| EDIT-07 | Create stable editor-instance wrapper | No Lexical type required by consumer |
| EDIT-08 | Fix image support | Upload/cancel/error/serialization tests |
| EDIT-09 | Fix reference links | Round-trip fixtures |
| EDIT-10 | Preserve unknown syntax | Neighbor-edit/no-op corpus passes |
| EDIT-11 | Controlled echo/reset/IME work | Interaction corpus passes |
| TEMPLATE-01 | Implement `defineTemplate(string)` | Minimal example passes |
| TEMPLATE-02 | Implement generic data typing | Type tests |
| TEMPLATE-03 | Add Standard Schema support | Zod + another compatible validator fixtures |
| TEMPLATE-04 | Implement template object + `.resolve()` | Result contract tests |
| TEMPLATE-05 | Implement structural placeholder parsing | No Markdown injection tests |
| TEMPLATE-06 | Implement formatter registry | Locale/time-zone fixtures |
| TEMPLATE-07 | Implement localized `source` map | Fallback diagnostics tests |
| TEMPLATE-08 | Implement complete link/image bindings | URL policy tests |
| TEMPLATE-09 | Implement variable metadata | Inspection/editor picker fixture |
| TEMPLATE-10 | Add `template/react` | Delegates to renderer; SSR example |
| TEMPLATE-11 | Add `template/editor` | Placeholder editor + preview fixture |
| DX-01 | Build compatibility matrix | Versioned docs page |
| DX-02 | Build migration codemod | Dry-run/write fixtures |
| DX-03 | Build local comparison runner | Corpus comparison fixture |
| DOCS-01 | Renderer docs | Examples compile in CI |
| DOCS-02 | Editor docs | Controlled/headless examples compile |
| DOCS-03 | Template docs | Simple/typed/schema/localized examples compile |
| DEMO-01 | Build customer-report flagship | Full three-package flow works |
| RELEASE-01 | Trusted publishing/security policy | Reproducible release workflow |

---

## 17. API decisions explicitly rejected for v1

These decisions are important because they prevent future API drift.

### 17.1 Do not roll template into renderer

Rejected:

```tsx
<Markdown
  data={customer}
  locale="fr"
  variables={schema}
>
  {templateSource}
</Markdown>
```

Reason: rendering and data resolution are separate concerns; this bloats the renderer and makes headless templating awkward.

Use:

```ts
const result = template.resolve(customer);
```

then:

```tsx
<Markdown document={result.document} />
```

or:

```tsx
<Template template={template} data={customer} />
```

### 17.2 Do not make Lexical the public editor contract

Rejected as primary API:

```ts
editor: LexicalEditor
nodes: LexicalNode[]
```

Reason: locks React Markdown Kit to an implementation framework and leaks complexity to users.

### 17.3 Do not make remark/rehype the only extension system

Keep compatibility, but lead with a React Markdown Kit extension API so renderer/editor/template can compose around one concept.

### 17.4 Do not make schema mandatory

This must remain valid:

```ts
const template = defineTemplate(`Hello {{user.name}}`);
```

### 17.5 Do not make editor template support a giant prop set

Rejected:

```tsx
<MarkdownEditor
  template={template}
  templateData={data}
  templateLocale="fr"
  enableTemplateVariables
  templateValidation
/>
```

Use:

```tsx
extensions={[
  templateVariables({ template, previewData: data }),
]}
```

### 17.6 Do not make async behavior conditional

Avoid functions that sometimes return a value and sometimes a Promise depending on plugins.

Prefer distinct APIs such as:

```text
compileMarkdown / compileMarkdownAsync
resolve / resolveAsync
```

if asynchronous capabilities are introduced.

### 17.7 Do not depend on a design system

Added during implementation, binding at the same level as the rejections above.

Rejected:

```json
{ "peerDependencies": { "tailwindcss": "*" } }
{ "dependencies": { "@zuilib/tokens": "*" } }
```

Reason: a rendering and editing library that requires a styling system cannot be
a default choice. The prior ZUI editor took a hard dependency on `@zuilib/tokens`
and peered on `tailwindcss`, which alone disqualifies it from the adoption goal
in section 1. See `STYLING.md` for the full contract and the four styling
approaches that must all work.

---

## 18. Commercial boundary

Everything required for local use remains open and account-free:

```text
rendering
editing
source preservation
basic presets/extensions
headless templating
schemas
validation
localization selection
formatting
runtime variables
image/link bindings
```

Potential ZUI Cloud products can later include:

```text
hosted template storage
version history
asset management
approvals
collaboration
document generation infrastructure
scheduled delivery
analytics
organization governance
```

The open-source packages should become useful enough that the cloud product sells operational convenience, not unlocks artificially withheld core functionality.

---

## 19. Final product test

A new developer should be able to move through this progression without switching systems.

**Day 1 — rendering**

```tsx
<Markdown>{content}</Markdown>
```

**Later — editing**

```tsx
<MarkdownEditor
  value={content}
  onChange={setContent}
/>
```

**Later — application-wide Markdown behavior**

```ts
const appMarkdown = defineMarkdownPreset({
  extensions: [gfm()],
});
```

```tsx
<Markdown preset={appMarkdown}>{content}</Markdown>

<MarkdownEditor
  preset={appMarkdown}
  value={content}
  onChange={setContent}
/>
```

**Later — personalization**

```ts
const report = defineTemplate({
  source: `# {{customer.name}}`,
  schema: ReportSchema,
  preset: appMarkdown,
});

const result = report.resolve(customer);
```

**Later — template authoring**

```tsx
<MarkdownEditor
  extensions={[
    templateVariables({
      template: report,
      previewData: customer,
    }),
  ]}
/>
```

The developer never has to migrate from "renderer content" to "editor content" to "template content."

It remains Markdown throughout.

That continuity is the core product advantage React Markdown Kit should protect.

---

## 20. Sources checked

The references below support observations about existing libraries, platform behavior, and interoperable standards. Product requirements, APIs, package boundaries, targets, and adoption strategy in this specification are recommendations for React Markdown Kit.

- [S1] react-markdown official repository/readme/API. https://github.com/remarkjs/react-markdown
- [S2] ZUI text editor documentation. https://zuilib.com/docs/text-editor/
- [S3] npm package.json documentation. https://docs.npmjs.com/cli/v11/configuring-npm/package-json/
- [S4] micromark official repository. https://github.com/micromark/micromark
- [S5] CommonMark specification. https://spec.commonmark.org/
- [S6] React use client documentation. https://react.dev/reference/rsc/use-client
- [S7] rehype-sanitize official repository. https://github.com/rehypejs/rehype-sanitize
- [S8] Lexical Markdown package documentation. https://lexical.dev/docs/packages/lexical-markdown
- [S9] Lexical mdast documentation. https://lexical.dev/docs/packages/lexical-mdast
- [S10] MDN Intl.DateTimeFormat. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat
- [S11] npm trusted publishing. https://docs.npmjs.com/trusted-publishers/
- [S12] Google title-link guidance. https://developers.google.com/search/docs/appearance/title-link
- [S13] Google SEO Starter Guide. https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- [S14] Tiptap React integration documentation. https://tiptap.dev/docs/editor/getting-started/install/react
- [S15] Tiptap React composable API documentation. https://tiptap.dev/docs/guides/react-composable-api
- [S16] Lexical overview and modular/plugin architecture. https://lexical.dev/
- [S17] Standard Schema specification. https://standardschema.dev/schema
