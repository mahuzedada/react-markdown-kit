import { defineMarkdownPreset } from '@react-markdown-kit/renderer'
import { flowchart, mermaid, sequenceDiagram } from '@react-markdown-kit/mermaid/editor'

/*
 * The one preset the demo runs on, apart from the components so the tests
 * can mount the same block the page shows. The editor entry's `mermaid()`
 * carries the block editor; the same preset also renders, because the
 * renderer reads only the capabilities it understands. The kinds are the
 * plugin's defaults, listed here so the status chip can name them and see
 * which ones write Mermaid back. `ink` draws hand-drawn strokes on the
 * flowchart canvas (index.html loads Recursive, the face the ink style
 * uses); the static SVG the exports, the preview and the renderer draw is
 * the clean style, and the sequence canvas draws that same picture. The
 * block's own textarea is off: the code pane on the left is the source
 * editor for every kind.
 */
export const KINDS = [flowchart(), sequenceDiagram()]

export const preset = defineMarkdownPreset({ extensions: [mermaid({ style: 'ink', sourceEditor: false, kinds: KINDS })] })
