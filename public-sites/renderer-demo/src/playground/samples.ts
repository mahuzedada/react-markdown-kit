/**
 * The one document the demo shows: every construct the renderer handles,
 * once, so the reader can edit any of them and watch the output follow.
 */
const TOUR = `# The whole syntax, on one page

Everything below is **CommonMark** plus the *GFM* extensions, rendered by the
same \`<Markdown>\` component you would ship. Edit anything on the left.

## Inline

Links to [the docs](https://docs.reactmarkdownkit.com/docs/getting-started), autolinks like
https://docs.reactmarkdownkit.com, \`inline code\`, ~~strikethrough~~, and a
footnote[^1]. Line breaks with two trailing spaces  
become \`<br>\`.

## Blocks

> A blockquote, with **strong** text inside it.
>
> > And one nested inside that.

> [!TIP]
> A blockquote that opens with a marker like this one is plain CommonMark. A
> custom component reads the first line and makes it a callout.

1. An ordered list
2. With a nested bullet list
   - like this
   - and this
3. Back to the outer level

- [x] Task lists come from GFM
- [ ] This one is still open

\`\`\`ts title="add.ts"
export function add(a: number, b: number): number {
  return a + b
}
\`\`\`

| Feature | CommonMark | GFM |
| --- | :---: | :---: |
| Tables | | ✓ |
| Task lists | | ✓ |
| Footnotes | | ✓ |
| Fenced code | ✓ | ✓ |

![A placeholder image](https://placehold.co/320x120/0f6f6b/fff?text=image "Images render as plain img elements")

---

[^1]: Footnotes render at the end of the document with a back link.
`

export const SAMPLE = { source: TOUR, gfm: true } as const
