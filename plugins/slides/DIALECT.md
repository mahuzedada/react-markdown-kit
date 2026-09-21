# The slides dialect

What `@react-markdown-kit/slides` reads and writes. A deck is CommonMark (or
GFM) that the plugin reads a second way after parsing. The tree stays flat:
no construct here changes how the file looks on GitHub, in a diff, or in an
editor that does not know the plugin. This file is shipped with the package
and is the reference for the reader, the serializer, and the editor commands.

## Constructs

| Construct | Source | Recognised as | Result |
| --- | --- | --- | --- |
| Slide break | `---` on its own line between blank lines, at the root | a `thematicBreak` whose spelling has only `-` and spaces | Ends the current slide and opens the next |
| Rule | `***` or `___` at the root | a `thematicBreak` whose spelling has no `-` | An `<hr>` inside the slide |
| Front matter | `---` / blank or `key: value` lines / `---` at byte 0 | found in the source; the nodes those bytes parsed as become one `yaml` node | Deck properties (below) |
| Directive | `<!-- key: value -->` alone on its lines, at the root, anywhere in the slide | an `html` node matching `<!-- key: value -->` and nothing else | Re-typed to `slideDirective` |
| Speaker notes | a paragraph that is exactly `???` | `slideMarker` of kind `notes` | Every block after it, up to the next break, is notes |
| Pause | a paragraph that is exactly `--` | `slideMarker` of kind `pause` | Blocks after the k-th pause form fragment group k |
| Slide title | the slide's first heading | plain text of its `text` and `inlineCode` descendants | The slide's accessible name and `data-rmk-slide-title` |

A `---` inside a fence, a block quote or a list item is not at the root and
never splits. A comment followed by text on the same line (`<!-- k: v --> x`)
is one HTML block and not a directive. A break at the very start of the
document opens no slide; every other break does, even when the slide it
opens stays empty (an author who just typed the break must see it).

## Front matter

Read as flat `key: value` lines with no YAML parser. Surrounding quotes on a
value are removed. Unknown keys are ignored.

| Key | Value | Effect |
| --- | --- | --- |
| `title` | text | `data-rmk-deck-title`; the fallback is the first slide's title |
| `aspect` | `16:9` (default) or `4:3` | `data-rmk-deck-aspect`, overriding the `aspect` option |
| `class` | class tokens | Prepended to every slide's `data-rmk-slide-class` |
| `background` | a URL | The background of every slide that sets none |

The parser knows no front matter construct: the deck is parsed as plain
CommonMark, and the transform looks at byte 0 of `context.source` for an
opening `---` line, then only blank or `key: value` lines, then a closing
`---` line (trailing spaces allowed on a fence). The root nodes inside those
bytes (a break and a setext heading, usually) are replaced by one `yaml`
node spanning both fences, and the rest of the tree is untouched. So a deck
that opens with `---` followed by content is a leading break that opens no
slide, and it parses, serializes and edits exactly as CommonMark: lists and
quotes keep their shape, and a `---` inside a fence, an html block or under
a line of text is what CommonMark says it is. Front matter that opens with
`key: value` right under the `---` but is never closed by a `---` line, or
holds a line that is neither blank nor `key: value`, is content and reports
`SLIDES_FRONT_MATTER_INVALID`. A transform called without `context.source`
reads no front matter at all. `slides({ frontMatter: false })` does the same.

## Directives

One comment holds one directive. The key is case-insensitive; the argument is
trimmed, and so is whitespace around the comment (trailing spaces, or up to
three of indentation, which CommonMark keeps in the html block). A known key with an argument it does not accept, or an unknown key,
leaves the comment as it is (visible escaped text, as any comment renders)
and reports a diagnostic.

| Key | Argument | Emitted as |
| --- | --- | --- |
| `class` | tokens of `[A-Za-z0-9_-]`, separated by spaces or commas; may repeat and accumulates | `data-rmk-slide-class="a b"` (never `class`) |
| `background` | one URL with no spaces | `<img data-rmk-slide-background src alt="">` as the section's first child, so the URL policy sanitises it |
| `name` | `[A-Za-z0-9_-]+` | `id="slide-<name>"` and `data-rmk-slide-name`; a duplicate gets neither |

Built-in classes the stylesheet knows: `left`, `center`, `right` (text
alignment), `top`, `middle`, `bottom` (vertical placement), `inverse` (dark
surface). Any other token is the consumer's to style.

## Markers

`???` starts the notes; a second one is ignored and reported. `--` after the
notes started is ignored and reported. A `???` written on the line right
after a paragraph is part of that paragraph (lazy continuation), also when
that paragraph closes a list item or a block quote, and is reported as
attached. A `--` right under text is different: CommonMark makes it a setext
heading rather than a pause, and that is reported as `SLIDES_SETEXT_HEADING`.
A blank line before the marker avoids both.

## Serialization

`documentToMarkdown` writes every construct back to its spelling: a
`slideMarker` as `???` or `--` (a plain paragraph would escape it to `\--`,
which is why the marker is its own node), a `slideDirective` as
`<!-- key: argument -->`, front matter through `mdast-util-frontmatter`, a
slide break as `---`, and a rule annotated as such as `***`. Consecutive
directives are written on consecutive lines. The editor bridge copies the
original bytes of every untouched block, so a deck loaded and saved without
edits is unchanged. A break the editor itself creates (the New slide button,
the Enter shortcut) is exported as the `/editor` entry's own `slideBreak`
mdast node, keyed by its spelling, so a fresh `---` is never written with
the bytes of a `***` rule beside it; the next load reads it back as an
ordinary `thematicBreak`.

## Diagnostics

All reported from the syntax transform with the node's source range.

| Code | Severity | When |
| --- | --- | --- |
| `SLIDES_SETEXT_HEADING` | info | A depth-2 heading made by dashes right under text |
| `SLIDES_SLIDE_EMPTY` | info | A slide with no content blocks; still rendered |
| `SLIDES_FRONT_MATTER_INVALID` | warning | `---` then `key: value` lines at the top with no closing `---` line, or a non-key line before it |
| `SLIDES_DIRECTIVE_INVALID` | warning | A known directive or front matter key with a rejected value |
| `SLIDES_DIRECTIVE_UNKNOWN` | warning | `<!-- key: value -->` with a key that is not a directive |
| `SLIDES_NAME_DUPLICATE` | warning | Two slides with the same `name`; reported at the later `name` directive |
| `SLIDES_MARKER_MISPLACED` | warning | A second `???`, or a `--` after `???` |
| `SLIDES_MARKER_ATTACHED` | warning | A `--` or `???` glued to the paragraph above |
| `SLIDES_PROPERTY_BARE` | info | A slide opening with bare `key: value` lines (remark's syntax) |

## Not in the dialect

remark's bare `class: center` property lines, `.class[...]` content classes,
`![:macro]`, `layout:` / `template:` inheritance, `count:` / `exclude:`,
`<!-- break -->`, overlay fences, and any inline style.
