# @react-markdown-kit/template

Markdown template variables for React Markdown Kit, as plugins. Typed
placeholders, runtime schemas, formatting and localization. Values are placed
into the parsed tree, never into the source text, so data cannot inject
Markdown or HTML.

```bash
npm install @react-markdown-kit/renderer @react-markdown-kit/template
```

```tsx
import Markdown from '@react-markdown-kit/renderer'
import { template } from '@react-markdown-kit/template'

const source = '# Hello {{user.name}}\n\nYour balance is {{balance | currency:"USD"}}.'

export function Greeting({ user, balance }: { user: { name: string }; balance: number }) {
  const extensions = [template({ data: { user, balance }, locale: 'en-US' })]
  return <Markdown extensions={extensions}>{source}</Markdown>
}
```

There is no engine to call. `template({ data })` is a `MarkdownExtension`;
the renderer parses the source with your preset and the plugin fills the tree
in. Outside React, `compileMarkdown` runs the same extension:

```ts
import { compileMarkdown, documentToMarkdown } from '@react-markdown-kit/renderer'

const document = compileMarkdown(source, { extensions: [template({ data })] })
const markdown = await documentToMarkdown(document)
```

The root entry imports no React and no Lexical, so this runs in a service, a
worker, a CLI, an email job or a PDF pipeline.
[`scripts/pack-check.mjs`](https://github.com/mahuzedada/react-markdown-kit/blob/main/scripts/pack-check.mjs)
resolves a template from the packed tarball with no Lexical installed.

## Links

- Docs: [Markdown template engine](https://docs.reactmarkdownkit.com/markdown-template-engine)
- Editor demo with placeholder chips: [editor.reactmarkdownkit.com](https://editor.reactmarkdownkit.com)
- Source: [github.com/mahuzedada/react-markdown-kit](https://github.com/mahuzedada/react-markdown-kit)

## Data cannot inject Markdown structure

Values are placed **structurally** into the parsed tree. They are never
substituted into source text and re-parsed, so a value of `**Administrator**`
renders those literal asterisks and no value can create a heading, a table
row, a link destination, an HTML tag or a code fence. Placeholders inside code
are literal, and so is an escaped `\{{delimiter}}`. Paths that reach for the
prototype chain (`__proto__`, `constructor`, `prototype`) never resolve.

Each of those sentences is a test:
[`plugins/template/tests/injection.test.ts`](https://github.com/mahuzedada/react-markdown-kit/blob/main/plugins/template/tests/injection.test.ts)
and
[`tests/template-security-independent.test.ts`](https://github.com/mahuzedada/react-markdown-kit/blob/main/tests/template-security-independent.test.ts).

## Failure renders nothing

A missing required value, a rejected schema or an unsafe path is an error. On
any error the document becomes `fallback` (nothing by default), never a report
with a blank where a number should be. Diagnostics carry a stable code and a
path, never your runtime values, and reach you through `onDiagnostics` and
the compiled document.

## Options

| Option | Purpose |
| --- | --- |
| `data` | The values placeholders resolve to |
| `schema` | Any [Standard Schema](https://standardschema.dev) validator (Zod, Valibot, ArkType); this package depends on none |
| `locale`, `timeZone` | Formatting locale (`en-US`) and zone (`UTC`) |
| `formatters` | On top of `number`, `currency`, `percent`, `date`, `time`, `datetime`, and those other extensions contribute |
| `variables` | Per-path `required`, `default`, `label`, `group` |
| `fallback` | Markdown shown when resolution fails |
| `onDiagnostics` | Every diagnostic, on success and on failure |

Currency always carries an explicit ISO 4217 code, never inferred from a locale.

## Authoring in the editor

```tsx
import { templateVariables } from '@react-markdown-kit/template/editor'

<MarkdownEditor
  value={source}
  onChange={setSource}
  extensions={[templateVariables({ variables, previewData: sample })]}
/>
```

Every placeholder is a chip with its label and a sample-data preview; typing
one closes it into a chip; the toolbar gains an insert-variable button.
Preview data changes what the author sees and never what is saved. The root
entry's `templateVariables()` is the same extension without the editor half:
it shows unresolved placeholders as `<span data-rmk-variable>` in the renderer.

`styles.css` is optional and styles the chip in both surfaces.

## Exports

| Entry | Export | Purpose |
| --- | --- | --- |
| `.` | `template(options)` | The resolving extension |
| `.` | `templateVariables(options?)` | Placeholders as nodes and chips |
| `.` | `TEMPLATE_DIAGNOSTIC_CODES`, `builtinFormatters`, types | Reference |
| `./editor` | `templateVariables(options?)` | The same extension with editable chips |

## License

MIT
