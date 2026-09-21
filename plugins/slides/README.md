# @react-markdown-kit/slides

Markdown slides for React, as a plugin. Slides are separated by `---`, speaker
notes follow `???`, fragments follow `--`, and `<!-- class | background |
name: … -->` comments set per-slide properties. The file stays plain
CommonMark: GitHub shows it as a document with rules, the renderer shows it
as a deck of `<section>`s, `/present` turns that deck into a keyboard-driven
presentation, and `/editor` adds the authoring commands.

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

- Docs: [Slides from Markdown](https://docs.reactmarkdownkit.com/docs/slides)
- Demo: [slides.reactmarkdownkit.com](https://slides.reactmarkdownkit.com),
  with `/present` and `/editor`
- Source: [github.com/mahuzedada/react-markdown-kit](https://github.com/mahuzedada/react-markdown-kit)

## The dialect

[`DIALECT.md`](./DIALECT.md), shipped with the package, is the reference.
In short:

| Construct | Spelling | Notes |
| --- | --- | --- |
| Slide break | `---` between blank lines | Only dashes split; `***` and `___` are rules inside a slide. A `---` in a fence, quote or list never splits |
| Front matter | `---` / `key: value` / `---` at the top | `title`, `aspect` (`16:9` or `4:3`), `class`, `background` |
| Directive | `<!-- key: value -->` alone on its lines | `class` (tokens, accumulates), `background` (a URL), `name` (`[A-Za-z0-9_-]+`) |
| Speaker notes | a paragraph that is exactly `???` | Everything after it, up to the next break |
| Pause | a paragraph that is exactly `--` | Blocks after the k-th pause form fragment k |
| Slide title | the slide's first heading | Accessible name; the fallback is `Slide n` |

Front matter is found in the source, not by the parser, so a deck that
opens with `---` followed by content is plain CommonMark: a leading break
that opens no slide, with every list and quote after it parsed as usual.
The editor entry writes a break it created as its own `slideBreak` mdast
node until the next load, so a new `---` is never confused with a `***`
rule nearby.

## The plugin is the API

`slides()` is a plain `MarkdownExtension` and the package's only way in. The
renderer, the editor and the template plugin each read the capability they
understand.

| Capability | What it does |
| --- | --- |
| `syntax` | Parses front matter as `yaml`; after parsing, re-types directives to `slideDirective` and markers to `slideMarker`, annotates rules, reports diagnostics; serializes every construct back to its spelling |
| `renderer` | A root handler groups the flat tree into one `<article data-rmk-deck>` of `<section data-rmk-slide>`s. Static, no script, no classes, no inline style |
| `template` | Markers and directives are literal: `{{…}}` inside a directive argument is never data. Placeholders in slide prose resolve as usual |
| `editor` | Absent on this entry. `@react-markdown-kit/slides/editor` adds it |

### Options

| Option | Default | Effect |
| --- | --- | --- |
| `aspect` | `'16:9'` | `data-rmk-deck-aspect` when the front matter sets none |
| `notes` | `true` | Emit speaker notes as `<aside data-rmk-slide-notes hidden>`; `false` omits them |
| `frontMatter` | `true` | Parse `---` front matter at the top of the deck |
| `slideLabel` | `'Slide'` | Accessible name for a slide without a heading: "Slide 3" |

### Exports

`slides`, `SLIDE_MARKER_NODE`, `SLIDE_DIRECTIVE_NODE`, `isSlideMarkerNode`,
`isSlideDirectiveNode`, `SLIDES_DIAGNOSTIC_CODES`; types `SlidesOptions`,
`SlideAspect`, `SlideMarkerNode`, `SlideDirectiveNode`, `DeckModel`,
`SlideModel`. This entry loads no React and no Lexical.
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

Class hooks styled by the sheet: `left`, `center`, `right`, `top`, `middle`,
`bottom`, `inverse`. In print every section gets `break-after: page`; the
page size is yours to set, for example `@page { size: 16in 9in; margin: 0 }`.

## Diagnostics

Every code is exported as `SLIDES_DIAGNOSTIC_CODES` and reported on the
compiled document with the node's source range: `SLIDES_SETEXT_HEADING`,
`SLIDES_SLIDE_EMPTY`, `SLIDES_FRONT_MATTER_INVALID`,
`SLIDES_DIRECTIVE_INVALID`, `SLIDES_DIRECTIVE_UNKNOWN`,
`SLIDES_NAME_DUPLICATE`, `SLIDES_MARKER_MISPLACED`, `SLIDES_MARKER_ATTACHED`,
`SLIDES_PROPERTY_BARE`. `DIALECT.md` lists when each fires. Content problems
never throw.

## The three entries

| Entry | Loads | Adds |
| --- | --- | --- |
| `@react-markdown-kit/slides` | nothing beyond the parser | the headless extension above |
| `@react-markdown-kit/slides/present` | React | `slides()` with a client `article` component: present mode, keyboard and pointer navigation, fragments, presenter view, hash routing, cross-window sync |
| `@react-markdown-kit/slides/editor` | React and Lexical | the present entry plus editor nodes and toolbar commands (new slide, speaker notes, pause, background) |

All three return an extension named `slides`, so a later entry replaces an
earlier one in a preset. The `/present` and `/editor` entries bind a React
component per `slides()` call, so build the preset once (at module level,
or in `useMemo`) rather than calling `slides()` inside render, which would
remount the deck on every render.

## Templates

With `@react-markdown-kit/template`, `{{placeholders}}` in slide prose
resolve; markers and directives are literal. List `slides()` before
`template()`.

## License

MIT
