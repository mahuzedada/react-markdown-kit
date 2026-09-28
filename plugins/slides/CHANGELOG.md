# Changelog

## 0.2.0 (2026-09-27)

Dialect:

- `layout` directive: `cover`, `section`, `center`, `two-cols`, `image-left`, `image-right`, `quote`, `fact`; `image` directive for the image layouts.
- `::right::` marker starts a second column; fragment groups carry across it.
- `transition` (`fade`, `slide`, `zoom`, `none`), `footer`, `paginate` and `incremental` directives.
- Front matter sets the default of any deck-wide directive, not only `class` and `background`.
- Code fences with line ranges (` ```ts {1|3-4|all} `) highlight one step per keypress.
- `includeDeckFiles` expands `<!-- src: path -->` includes before compiling.
- New diagnostics `SLIDES_INCLUDE_UNRESOLVED` and `SLIDES_CODE_STEPS_INVALID`.
- A comment or front matter still being written at the end of the source renders as nothing and counts as no slide, so a streamed deck never flashes half-written syntax. Front matter that never closes is still reported.
- Class hooks (`left`, `top`, …) win over a layout's alignment.
- `includeDeckFiles` accepts `{ id, source }` from `read`, so nested relative includes and cycle checks use resolved ids.

Present mode:

- Overview (`o`), keyboard shortcut list (`?`, `h`), black screen (`b`, `.`), jump by typing a number then Enter, drawing (`d`, `x` clears), laser pointer (`l`), synced clone window (`c`).
- Presenter view shows the next step (not only the next slide), an elapsed timer (`t` resets), and notes with an adjustable size (`+`, `-`) and an empty state.
- Icon control bar floating over the slide, a progress bar and a screen-reader announcement on each move.
- `#3.2` deep links to a step; a slide named with digits past the last slide number links by name. `controller` / `createDeckController()` / `useDeck()`, a custom `controls` component, a `SyncTransport` for `sync` (`broadcastTransport(name)` builds one), `follow` for streamed decks, `printSteps` and `cloneUrl` options.
- The timer and notes-size keys work only in the presenter view. The shortcut list takes the focus and gives it back; the screen-reader announcer is in the DOM from mount.
- `/editor` re-exports everything `/present` does.
- A command that is not on offer (full screen without the API, clone without sync) now leaves its key to the browser.

Other:

- `/pptx` entry: `deckToPptx` writes a .pptx with pptxgenjs (optional peer dependency). Pictures are fetched first with a time limit and left out when they fail; URLs pass a `resolveUrl` policy (web and `data:image` pictures, web and mail links by default). The resolved type follows `output`.
- Print uses a named page per aspect, so a slide fills a 16 by 9 or 12 by 9 inch page without a host `@page` rule.
- `styles.css` is built from `src/styles/`, one file per concern.

## 0.1.0 (2026-09-20)

First release. `slides()` renders a Markdown deck (slides split on `---`, notes after `???`, fragments after `--`, `<!-- key: value -->` directives, front matter) as an `<article data-rmk-deck>` of `<section>`s; `/present` adds present mode, a presenter view, deep links and cross-window sync; `/editor` adds the authoring commands. The dialect is specified in `DIALECT.md`.
