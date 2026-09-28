# @react-markdown-kit/slides

Markdown slides for React, as a plugin. Slides are separated by `---`, speaker
notes follow `???`, fragments follow `--`, a second column follows
`::right::`, and `<!-- key: value -->` comments set per-slide properties
(layout, class, background, transition, footer and a few more). The file
stays plain CommonMark: GitHub shows it as a document with rules, the
renderer shows it as a deck of `<section>`s, `/present` turns that deck into
a keyboard-driven presentation, `/editor` adds the authoring commands and
`/pptx` writes a PowerPoint file.

```bash
npm install @react-markdown-kit/renderer @react-markdown-kit/slides
```

```tsx
import Markdown, { defineMarkdownPreset } from '@react-markdown-kit/renderer'
import { slides } from '@react-markdown-kit/slides'
import '@react-markdown-kit/slides/styles.css'

const preset = defineMarkdownPreset({ extensions: [slides()] })

export function Deck({ deck }: { deck: string }) {
  return (
    <div className="rmk-document">
      <Markdown preset={preset}>{deck}</Markdown>
    </div>
  )
}
```

```md
---
title: Q3 review
---

# Welcome

---

<!-- class: center, middle -->

## Numbers

Revenue is up.

--

So are costs.

???

Pause before the second line.
```

## Links

- Docs: [Slides from Markdown](https://reactmarkdownkit.com/docs/slides)
- Demo: [reactmarkdownkit.com/markdown-slides](https://reactmarkdownkit.com/markdown-slides),
  with `/present` and `/editor`
- Source: [github.com/mahuzedada/react-markdown-kit](https://github.com/mahuzedada/react-markdown-kit)

## The dialect

[`DIALECT.md`](./DIALECT.md), shipped with the package, is the reference.
In short:

| Construct | Spelling | Notes |
| --- | --- | --- |
| Slide break | `---` between blank lines | Only dashes split; `***` and `___` are rules inside a slide. A `---` in a fence, quote or list never splits |
| Front matter | `---` / `key: value` / `---` at the top | `title`, `aspect` (`16:9` or `4:3`), and deck-wide directive defaults |
| Directive | `<!-- key: value -->` alone on its lines | One key per comment; the keys are listed under the table |
| Speaker notes | a paragraph that is exactly `???` | Everything after it, up to the next break |
| Pause | a paragraph that is exactly `--` | Blocks after the k-th pause form fragment k |
| Column | a paragraph that is exactly `::right::` | Blocks after it go in the second column |
| Code steps | ` ```ts {1\|3-4\|all} ` | Highlights lines one step at a time; GitHub ignores the braces |
| Slide title | the slide's first heading | Accessible name; the fallback is `Slide n` |

Directive keys: `class`, `background`, `name`, `layout` (`cover`, `section`,
`center`, `two-cols`, `image-left`, `image-right`, `quote`, `fact`), `image`,
`transition` (`fade`, `slide`, `zoom`), `footer`, `paginate`, `incremental`
and `src`. Every key except `name`, `image` and `src` can also go in the front
matter, where it sets the default for every slide.

Front matter is found in the source, not by the parser, so a deck that
opens with `---` followed by content is plain CommonMark: a leading break
that opens no slide, with every list and quote after it parsed as usual.
The editor entry writes a break it created as its own `slideBreak` mdast
node until the next load, so a new `---` is never confused with a `***`
rule nearby.

## The plugin is the API

`slides()` is a plain `MarkdownExtension` and the package's only way in. The
renderer, the editor and the variables plugin each read the capability they
understand.

| Capability | What it does |
| --- | --- |
| `syntax` | Parses front matter as `yaml`; after parsing, re-types directives to `slideDirective` and markers to `slideMarker`, annotates rules, reports diagnostics; serializes every construct back to its spelling |
| `renderer` | A root handler groups the flat tree into one `<article data-rmk-deck>` of `<section data-rmk-slide>`s. Static, no script, no classes, no inline style |
| `variables` | Markers and directives are literal: `{{…}}` inside a directive argument is never data. Placeholders in slide prose resolve as usual |
| `editor` | Absent on this entry. `@react-markdown-kit/slides/editor` adds it |

### Options

| Option | Default | Effect |
| --- | --- | --- |
| `aspect` | `'16:9'` | `data-rmk-deck-aspect` when the front matter sets none |
| `notes` | `true` | Emit speaker notes as `<aside data-rmk-slide-notes hidden>`; `false` omits them |
| `frontMatter` | `true` | Parse `---` front matter at the top of the deck |
| `slideLabel` | `'Slide'` | Accessible name for a slide without a heading: "Slide 3" |

### Exports

`slides`, `includeDeckFiles`, `SLIDE_MARKER_NODE`, `SLIDE_DIRECTIVE_NODE`,
`isSlideMarkerNode`, `isSlideDirectiveNode`, `SLIDES_DIAGNOSTIC_CODES`,
`SLIDE_LAYOUTS`, `SLIDE_TRANSITIONS`; types `SlidesOptions`, `SlideAspect`,
`SlideLayout`, `SlideTransition`, `SlideMarkerNode`, `SlideDirectiveNode`,
`DeckModel`, `SlideModel`, `SlideProperties`, `SlideBlock`, `ReadDeckFile`.
This entry loads no React and no Lexical.

### Decks in several files

`includeDeckFiles(source, read)` replaces each `<!-- src: path -->` line
(outside code fences) with the file `read(path, from)` returns, drops that
file's front matter, and follows nested includes with a cycle guard. It runs
on the source before compiling, since the renderer never reads files.
[`scripts/pack-check.mjs`](https://github.com/mahuzedada/react-markdown-kit/blob/main/scripts/pack-check.mjs)
renders a static deck from the packed tarball with no Lexical installed.

## What the renderer emits

```html
<article data-rmk-deck="" data-rmk-deck-slides="3" data-rmk-deck-aspect="16:9" data-rmk-deck-title="Q3 review">
  <section data-rmk-slide="2" data-rmk-slide-title="Numbers" aria-roledescription="slide" aria-label="Numbers"
           id="slide-numbers" data-rmk-slide-name="numbers" data-rmk-slide-class="center middle" data-rmk-slide-fragments="1">
    <img data-rmk-slide-background="" src="https://example.com/bg.jpg" alt="">
    <div data-rmk-slide-body="">
      <h2>Numbers</h2>
      <p>Revenue is up.</p>
      <div data-rmk-fragment="1"><p>So are costs.</p></div>
    </div>
    <aside data-rmk-slide-notes="" hidden=""><p>Pause before the second line.</p></aside>
  </section>
</article>
```

Optional attributes appear only when set. The background is an `<img>` so
the renderer's URL policy sanitises it like any other image (`javascript:`
loses its `src`). Notes carry the HTML `hidden` attribute, so they are
hidden with no stylesheet at all. GFM footnotes land after the article.
Class hooks: `classNames={{ deck, slide, slideNotes }}` on `<Markdown>`.

## Styling

`styles.css` is optional and scoped to `.rmk-document`. Scaling needs no
script: each slide is a size container with a fixed aspect ratio and the
body's font size is in `cqw`, so the renderer's `em`-based headings, lists
and code follow the slide's width. Browsers without container units get a
fixed size.

| Token | Default |
| --- | --- |
| `--rmk-slide-surface` / `--rmk-slide-text` | `#fff` / `#1e1e1e` |
| `--rmk-slide-inverse-surface` / `--rmk-slide-inverse-text` | `#1e1e1e` / `#fff` |
| `--rmk-slide-font-size` | `1.72cqw` (22px on a 1280px slide) |
| `--rmk-slide-padding` | `3.75cqw` |
| `--rmk-slide-radius` / `--rmk-slide-shadow` / `--rmk-slide-gap` | `var(--rmk-radius)` / `none` / `var(--rmk-space)` |
| `--rmk-deck-backdrop` / `--rmk-deck-chrome` / `--rmk-deck-chrome-text` | `#111` / `#222` / `#fff` (present mode) |
| `--rmk-deck-accent` | `#4f8cff` (progress bar, pressed buttons, the overview's current tile) |
| `--rmk-deck-ink` | `#e5484d` (drawing and the laser dot) |
| `--rmk-deck-blackout` / `--rmk-deck-scrim` | `#000` / `rgba(0, 0, 0, 0.72)` |
| `--rmk-deck-transition-duration` | `0.35s` |

Class hooks styled by the sheet: `left`, `center`, `right`, `top`, `middle`,
`bottom`, `inverse`, plus every `data-rmk-slide-layout`. In print every
section gets `break-after: page` on a named page of its aspect (16 by 9 or
12 by 9 inches, no margin); an `@page` rule of your own overrides it.

The shipped `styles.css` is built from `src/styles/`, one file per concern
(stack, layouts, code steps, present mode, transitions, controls, presenter,
overlays, tools, editor, print), joined in name order.

## Diagnostics

Every code is exported as `SLIDES_DIAGNOSTIC_CODES` and reported on the
compiled document with the node's source range: `SLIDES_SETEXT_HEADING`,
`SLIDES_SLIDE_EMPTY`, `SLIDES_FRONT_MATTER_INVALID`,
`SLIDES_DIRECTIVE_INVALID`, `SLIDES_DIRECTIVE_UNKNOWN`,
`SLIDES_NAME_DUPLICATE`, `SLIDES_MARKER_MISPLACED`, `SLIDES_MARKER_ATTACHED`,
`SLIDES_PROPERTY_BARE`, `SLIDES_INCLUDE_UNRESOLVED`,
`SLIDES_CODE_STEPS_INVALID`. `DIALECT.md` lists when each fires. Content problems
never throw.

## The entries

| Entry | Loads | Adds |
| --- | --- | --- |
| `@react-markdown-kit/slides` | nothing beyond the parser | the headless extension above |
| `@react-markdown-kit/slides/present` | React | `slides()` with a client `article` component: present mode, keyboard and pointer navigation, fragments, presenter view, overview, drawing, hash routing, sync |
| `@react-markdown-kit/slides/editor` | React and Lexical | the present entry plus editor nodes and toolbar commands (new slide, speaker notes, pause, background) |
| `@react-markdown-kit/slides/pptx` | `pptxgenjs` (optional peer, loaded on first call) | `deckToPptx(compiledDocument)`: a .pptx with one slide per deck slide |

The first three return an extension named `slides`, so a later entry replaces an
earlier one in a preset. The `/present` and `/editor` entries bind a React
component per `slides()` call, so build the preset once (at module level,
or in `useMemo`) rather than calling `slides()` inside render, which would
remount the deck on every render.

## Present mode

While presenting, the deck takes these keys (and shows them with `?`):
arrows, Space, Page Up/Down, `j`/`k`, Home and End to move; a number then
Enter to jump; `o` the overview; `p` the presenter view (next step, notes at
a size set with `+`/`-`, an elapsed timer reset with `t`, and the clock);
`f` full screen; `b` or `.` a black screen; `d` draw on the slide, `l` a
laser pointer, `x` clear the drawing; `c` another synced window when the
deck syncs; Escape closes whatever is open, then leaves.

| Option | Default | Effect |
| --- | --- | --- |
| `hashRouting` | `false` | Read and write `#3`, `#3.2` (two steps revealed) or `#name` |
| `initialMode` | `'stack'` | Open in `present` or `presenter` mode on mount |
| `controls` | `true` | `false` for none, or your own component (it gets `DeckControlsProps`) |
| `sync` | `false` | A `BroadcastChannel` name, or any `SyncTransport` (`post` and `subscribe`); `broadcastTransport(name)` builds one you close yourself |
| `controller` | its own | `createDeckController()`: drive the deck and read it from outside, with `useDeck(controller)` |
| `follow` | `false` | While presenting the last slide, jump to the newest slide when more are appended (a streaming deck) |
| `printSteps` | `false` | Print every reveal step of a slide as its own page |
| `cloneUrl` | the page URL | Where `c` opens the synced window |
| `labels` | English | Every UI string, including the announcement screen readers hear on each move |
| `onSlideChange` | none | Called with the zero-based index when the slide changes |

Keys, the control bar and the help list all read one command registry
(`DECK_COMMANDS`), so a custom control bar can run any command by id.

## PowerPoint

```ts
import { compileMarkdown } from '@react-markdown-kit/renderer'
import { deckToPptx } from '@react-markdown-kit/slides/pptx'

const file = await deckToPptx(compileMarkdown(deck, { preset }))
```

Each slide's first heading becomes its title; paragraphs, lists, code,
quotes, tables and pictures go in the body (per column for `::right::`, beside
the picture for the image layouts); the footer, slide number and background
carry over; notes become PowerPoint notes. Fragments and code steps are shown
whole. Pass `output: 'nodebuffer'` outside a browser, and `theme` for fonts
and colours.

Pictures are downloaded before the file is written (10 seconds each by
default, `pictureTimeoutMs`), and one that doesn't arrive is left out
rather than failing the export. URLs go through `resolveUrl`: the default
allows web and `data:image` pictures and web and mail links, and refuses
everything else, since a file path would otherwise be read from the disk of
the server doing the export.

## Variables

With `@react-markdown-kit/variables`, `{{placeholders}}` in slide prose
resolve; markers and directives are literal. List `slides()` before
`variables()`.

## License

MIT
