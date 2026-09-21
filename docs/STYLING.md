# Styling contract

React Markdown Kit ships **no styling dependency**. Not ZUI, not Tailwind, not a
CSS-in-JS runtime, not a design system. A consumer styles the output with
whatever they already use.

This is a hard constraint, enforced by the packaging tests in `tests/packaging`.

## Rules

1. **No styling runtime dependency.** `dependencies` and `peerDependencies` of
   no package may contain `@zuilib/*`, `tailwindcss`,
   `styled-components`, `emotion`, or any theme provider. The only peers are
   `react` and `react-dom` (editor and renderer).
2. **Unstyled by default.** With no CSS imported, the renderer emits plain
   semantic HTML and the editor emits semantic HTML plus the minimum inline
   style required for *function*, never for appearance. Nothing has a colour, a
   font, a radius or a shadow unless the consumer opts in.
3. **Clean DOM by default, opt-in class hooks.** With no `classNames` prop the
   output is plain semantic HTML with no kit-specific classes, matching what
   `react-markdown` emits. Styling hooks come from the scope class plus the
   element (`.rmk-document h1`), so there is no class soup to fight. When a
   consumer wants a class on a part they ask for it through `classNames`, and
   `rmk-` prefixed defaults appear only for parts that have no semantic element
   of their own (a variable chip, a task-list item).
4. **No global selectors, no reset.** Optional CSS only ever matches inside a
   scope class (`.rmk-document`, `.rmk-editor`). No bare element selectors, no
   `*`, no `:root` outside a theme block, no `!important`.
5. **Low specificity.** Optional CSS uses single-class selectors so a consumer
   overrides it with one class of their own and no cascade fight.
6. **Themeable through CSS custom properties.** Every colour, space, radius and
   font in the optional CSS reads a `--rmk-*` custom property with a fallback.
   Overriding the property on any ancestor retints the whole thing.
7. **Class names are replaceable.** `classNames` on the renderer and editor maps
   a part to the consumer's own class string, so Tailwind, CSS Modules and
   BEM users never have to fight `rmk-` defaults.
8. **Components are replaceable.** `components` maps any element to a consumer
   component. That is the escape hatch of last resort and must always work.

## Four supported styling approaches

Every one of these must work without patching the library.

### 1. Bring your own CSS (no import)

```tsx
<Markdown>{source}</Markdown>
```

```css
.rmk-document h1 { font-size: 2rem; }
```

### 2. Opt into the shipped theme, then retint it

```tsx
import '@react-markdown-kit/renderer/styles.css'

<div className="rmk-document">
  <Markdown>{source}</Markdown>
</div>
```

```css
.rmk-document {
  --rmk-text: #111;
  --rmk-link: rebeccapurple;
  --rmk-font-body: 'Inter', system-ui, sans-serif;
}
```

### 3. Utility classes (Tailwind and friends)

Pass your own classes per part. The `rmk-` defaults are replaced, not merged,
so there is nothing to `!important` away.

```tsx
<Markdown
  classNames={{
    root: 'prose prose-slate max-w-none',
    code: 'rounded bg-slate-100 px-1 py-0.5 font-mono text-sm',
  }}
>
  {source}
</Markdown>
```

```tsx
<MarkdownEditor
  classNames={{
    root: 'rounded-lg border border-slate-200',
    toolbar: 'flex gap-1 border-b p-2',
    content: 'min-h-64 p-4 focus:outline-none',
  }}
  value={value}
  onChange={setValue}
/>
```

### 4. Your own components / design system

Including ZUI, shadcn/ui, MUI, or anything else. This is how a design system is
adopted — by choice, from the application, never by the library.

```tsx
<Markdown components={{ a: AppLink, img: AppImage, code: AppCode }}>
  {source}
</Markdown>
```

```tsx
const editor = useMarkdownEditor({ value, onChange })

<MarkdownEditorProvider editor={editor}>
  <MyOwnToolbar />          {/* any component library */}
  <MarkdownEditorContent />
</MarkdownEditorProvider>
```

## Editor chrome

The default editor ships a toolbar so `<MarkdownEditor value onChange />` is
useful on its own. That toolbar:

- uses semantic `<button type="button">` with accessible names;
- carries `rmk-` classes and accepts `classNames` overrides;
- renders no icon font and no icon package — icons are inline SVG in the
  package, replaced through the `toolbar` render prop or the headless API
  (`components` maps Markdown elements for rendering, not editor chrome);
- can be removed entirely with `toolbar={false}` or replaced with a render prop.

Nothing about the editor's behaviour depends on its own CSS being loaded. With
`@react-markdown-kit/editor/styles.css` absent the editor is unstyled but fully
functional, and the packaging test asserts exactly that.

## What the optional CSS may contain

`renderer/styles.css` is opt-in typography only: readable measure, heading
scale, list indentation, code and table defaults, all inside `.rmk-document`.

`editor/styles.css` is opt-in chrome only: the content box, toolbar layout,
focus ring, placeholder, and the editing affordances that have no semantic HTML
equivalent (for example the selected-node outline). All inside `.rmk-editor`.

Both files must pass `scripts/check-css-scope.mjs`, which fails the build on a
global selector, an `!important`, or a hard-coded colour that is not behind a
`--rmk-*` custom property.
