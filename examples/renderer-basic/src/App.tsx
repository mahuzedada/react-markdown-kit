/**
 * The smallest useful thing: one import, one component.
 * No provider, no stylesheet, no configuration.
 */
import Markdown from '@react-markdown-kit/renderer'

const CONTENT = `# Release notes

We shipped **streaming exports** today.

- Exports start in under a second
- Large reports no longer time out
- \`GET /exports/:id\` returns progress

Read the [migration guide](https://example.com/guide).
`

export default function App() {
  return <Markdown>{CONTENT}</Markdown>
}
