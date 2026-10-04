# Markdown variables

A document can keep its structure while its values change. This guide is using **{{customer.name}}** as its example account. Open **Data** or choose another account to see the same document resolve again.

## Write a placeholder

Use `{{customer.name}}` in ordinary Markdown. Values are resolved in the parsed document, so a value remains text rather than becoming new Markdown structure.

> Hello {{contact.firstName}}. Your next renewal is {{renewsAt | date:"long"}}.

## Format the value

Dates, currencies, and percentages can use formatters and a locale. Change the locale in **Data** and watch the example below.

| Item | Value |
| --- | ---: |
| Subscription | {{amounts.subscription \| currency:"USD"}} |
| Overage | {{amounts.overage \| currency:"USD"}} |
| Usage | {{usage.ratio \| percent}} |

Inside a Markdown table, escape a formatter's pipe as `\|` so it stays in the cell.

## Resolve in React

```sh
npm install @react-markdown-kit/renderer @react-markdown-kit/variables
```

```tsx
import Markdown from '@react-markdown-kit/renderer'
import { variables } from '@react-markdown-kit/variables'

<Markdown extensions={[variables({ data: account, locale: 'en-US' })]}>
  {source}
</Markdown>
```

Placeholders inside code stay literal. For example, `{{customer.name}}` describes the syntax instead of resolving it.

## Keep data and writing separate

The **Source** panel contains the authored Markdown. The **Data** panel contains the values passed to the plugin. Editing one does not rewrite the other.

Try a missing field to see a diagnostic, or a value containing Markdown to see it stay text. Restore the example with **Reset**.

## Keep going

Explore [schemas](/docs/variables/schemas), [formatting](/docs/variables/formatting), and [authoring placeholders](/docs/variables/authoring). The [editor](/markdown-editor) can display the same placeholders as editable chips.
