# CORE-01 — Audit of the existing ZUI Markdown editor

Audited `@zuilib/text-editor` 0.13.3 (Lexical 0.35). Findings are evidence for
the design decisions below, not a criticism of a package that solved a narrower
problem well.

## Root cause

The editor has **no Markdown parser**. All import and export go through
`@lexical/markdown`'s transformer protocol, which matches Markdown **line by
line with regular expressions**. Every gap below follows from that one choice.

React Markdown Kit parses with micromark/mdast instead, and keeps mdast as the
document representation. That is the single most important difference.

## Gaps that became requirements

| Audit finding | Requirement here |
|---|---|
| G1: images are not in the default preset; `![alt](src)` renders as a literal `!` plus a link | Images work out of the box (EDIT-08) |
| G2: reference links `[t][ref]` and definitions are never parsed, only survive as dead literal text | `definition` and `linkReference` are first-class mdast nodes (EDIT-09) |
| G3: unsupported Markdown degrades into literal paragraph text shown to the user | Unsupported constructs are preserved as **opaque nodes** that keep their source and render as themselves, never as raw source in prose (EDIT-10) |
| G4: seven reproducible corruptions on save | Every one is a regression fixture in `fixtures/editor-roundtrip/corruption.json`. See [Two layers of round-trip](#two-layers-of-round-trip) for what is asserted where |
| G5: a CommonMark soft break becomes a hard `LineBreakNode` | `break` and soft line endings are distinct nodes, per CommonMark |
| G6: table width, code-fence meta and cell alignment are stored in inline CSS `style` attributes | Node data lives on typed mdast fields, never in a style attribute |
| G7: table cells re-parse with stock transformers, so custom syntax dies inside a cell | One parser for the whole document; a cell is just a subtree |
| G8: `edit-raw` unmounts the document entirely, so switching modes loses anything not representable | All three modes project the same document |
| G9: `nodes` / `transformers` are mount-only and can never change | Extensions resolve per render |
| G11: explicit ordered-list numbering is discarded and regenerated | `start` and per-item numbering are preserved |

## Worth keeping

Three designs from the ZUI editor are good and carry over in spirit: the
footnote model (a derived-numbering section pinned last), the drawing JSON
fence, and the idea of a table settings marker. None are v1 scope here, but the
extension contract is what they would plug into.

## Two layers of round-trip

"Round-trips" means different things at two layers, and conflating them is how
the prior editor's bugs went unnoticed.

**Serializer layer** (`documentToMarkdown(compileMarkdown(source))`). The
serializer canonicalizes, so byte identity is neither expected nor wanted:
`~~~js` becomes ``` ```js ```, a setext heading becomes ATX, `__strong__`
becomes `**strong**`. What must hold is **semantic stability** and
**idempotence**. Measured on the 22-case corpus: 22/22 semantically stable,
22/22 idempotent, 14/22 byte-identical. Idempotence is the property G4 was
really about, because the prior editor compounded damage on every save.

**Editor layer** (open, switch modes, close, with no edit). Here byte identity
**is** required, per spec 7.9: "must not change the source string merely
because the editor imported and exported it." The editor achieves that by
retaining the original source and writing unchanged regions back verbatim
rather than re-serializing them. That is why the editor keeps source spans and
opaque nodes, and it is the gate the editor package is held to.

So: 14/22 byte-identical at the serializer, 22/22 required at the editor.

## The seven corruptions (G4)

Each corrupts once on save and then sticks. All seven are now fixtures.

| Input | ZUI output | Correct |
|---|---|---|
| `> a\n>\n> b` | `> a\n> >\n> b` | unchanged |
| `> a\n>\n> > b` | `> a\n> >\n> > b` | unchanged |
| `a\\\nb` | `a\\\\\nb` | unchanged |
| `C:\path\to` | `C:\\path\\to` | unchanged |
| `~~~js\nx\n~~~` | `\~\~\~js\nx\n\~\~\~` | unchanged or ``` fence |
| `` `` a ` b `` `` | `` \`\` a \` b \`\` `` | unchanged |
| `- a\n\n  second\n- b` | extra blank line before `- b` | unchanged |

## Test coverage gap

The ZUI suite has no CommonMark or GFM conformance run and no property test.
It asserts a fixed set of hand-written examples. React Markdown Kit runs the
full CommonMark spec suite and a GFM suite as release gates (spec 12.1).
