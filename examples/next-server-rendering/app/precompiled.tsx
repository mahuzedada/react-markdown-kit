/**
 * The same content, compiled once at module scope and rendered from the
 * document on every request.
 *
 * `compileMarkdown` does about 80% of the total work, so hoisting it out of the
 * request path is the single biggest win available. The document is plain JSON,
 * so it is safe to cache, to memoize, or to send from a build step.
 */
import Markdown, { compileMarkdown, defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'

const preset = defineMarkdownPreset({ extensions: [gfm()] })

// Parsed once per process, not once per request.
const CHANGELOG = compileMarkdown(
  `## 1.4.0

- Streaming exports
- Smaller bundle
`,
  { preset },
)

export function Changelog() {
  return <Markdown document={CHANGELOG} />
}
