# Diagram corpus

Verbatim examples from the syntax documentation of the installed Mermaid
version (11.17.2, the version in `pnpm-lock.yaml`), one file per example,
grouped by kind. `tests/conformance.dom.test.ts` checks every file against
Mermaid.js; each kind's own tests check that its `parse` returns a model with
no `invalid` problem and, for kinds with `write`, that `write(parse(x))`
parses to an equal model and contains every retained line.

## flowchart

Source: `packages/mermaid/src/docs/syntax/flowchart.md` at tag
`mermaid@11.17.2` (rendered at https://mermaid.js.org/syntax/flowchart.html).
`directive.mmd` comes from `config/directives.md` at the same tag ("Changing
flowchart config via directive"), because the flowchart page has no
`%%{init}%%` example of its own.

Included: node text and shapes (every bracket pair), the front-matter title,
both directions, every link spelling in the links table (arrow, open, dotted,
thick, invisible, circle and cross heads, multi-directional, minimum length),
labels in both spellings, chains and `&` groups, edge ids and edge configs,
subgraphs with directions and links to subgraphs, `click`, comments, `style`,
`classDef` with `:::` and `class`, entity codes, special characters, Font
Awesome text, one `@{ shape }` config, and the directive.

Left out, with the reason:

- "Markdown formatting" and "Markdown Strings": backtick labels that span
  several lines. The parser reads one statement per line; a quoted label
  cannot continue on the next line.
- "Example Flowchart with New Shapes", the "Complete List of New Shapes"
  catalogue, "Icon Shape" and "Image Shape": `@{ shape: … }`, `@{ icon }`
  and `@{ img }` configs are kept as written and reported as ignored, and
  every shape outside the bracket set is drawn as a rectangle, so one
  representative (`node-config.mmd`, "Process") stands for the group. The
  image example also carries a URL the static SVG never emits.
- "Collapsible subgraphs (v11.17.0+)": `one@{ view: collapsed }` names a
  subgraph, and subgraphs are not modelled (they are the `subgraph` lossy
  feature); the written output would attach the config to a node.
- "Turning an Animation On" is included (`edge-animate.mmd`); "Selecting
  Type of Animation" and "Using classDef Statements for Animations" are the
  same construct, and the latter is included as `edge-id-classdef.mmd`
  because its `classDef` line ends with a `;`.
- "Custom icons": the same as the Font Awesome example with a different
  prefix.
- "Styling line curves", "Styling and classes" `linkStyle` examples,
  "Default class", "Basic support for fontawesome" beyond the first example,
  "Configuration" and "Renderer" sections: `linkStyle`, `classDef default`,
  `%%{init}%%` config keys and renderer settings are configuration, not
  diagram syntax; `linkStyle` is the `linkStyle` lossy feature.

## sequenceDiagram

Source: `packages/mermaid/src/docs/syntax/sequenceDiagram.md` at tag
`mermaid@11.17.2` (rendered at https://mermaid.js.org/syntax/sequenceDiagram.html);
`directive.mmd` comes from `config/directives.md` ("Changing Sequence
diagram config via directive").

Four files are regression inputs rather than documentation examples. Each
is accepted by Mermaid.js and was once read wrongly by the sequence parser
(review findings C2, C10, C19 and C27):

- `directive-multi-line.mmd`: a `%%{ … }%%` directive spread over three
  lines before the header; every physical line is retained.
- `header-comment.mmd`: a `%%` comment after the header on the same line.
- `header-inline.mmd`: the header and the first statement on one line.
- `actor-parens.mmd`: `(` and `)` inside actor names in messages.

Inputs Mermaid.js rejects, which the parser must report as `invalid`, live
in `tests/sequence-conformance.dom.test.ts`, since every corpus file must
parse without an invalid problem.

### Added after the platform review

- "Markdown Strings" (`markdown-strings.mmd`): the parser now joins a quoted
  label that runs onto the next line into one statement and reads a
  backtick markdown string without its markers (lossy `markdown-string`), so
  the example the "Left out" list above excluded for that reason is in. The
  "Markdown formatting" example stays out: it is the same construct.
- Inputs the review compared against Mermaid.js that are not documentation
  examples (entities with `;`, Unicode and dotted ids, labels Mermaid rejects
  unquoted, keywords as ids, trailing comments, top-level `direction`) live in
  `tests/flowchart-kind.dom.test.ts`, which asserts both what Mermaid accepts
  and what it rejects, not in this corpus.
