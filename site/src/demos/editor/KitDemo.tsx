import { useMemo, useState, type ReactNode } from 'react'
import Markdown, { defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'
import { MarkdownEditor } from '@react-markdown-kit/editor'
import { mermaid } from '@react-markdown-kit/mermaid/editor'
import { variableChips } from '@react-markdown-kit/variables/editor'
import { variables } from '@react-markdown-kit/variables'
import { useCopy } from '../../lib/use-copy'
import { useShareLink } from '../../lib/use-share-link'
import INITIAL from '../../content/editor.md?raw'
import '@react-markdown-kit/editor/styles.css'
import '@react-markdown-kit/mermaid/styles.css'
import '@react-markdown-kit/variables/styles.css'
import './editor-demo.css'

const preset = defineMarkdownPreset({ extensions: [gfm(), mermaid()] })
const DATA = { team: { name: 'the Markdown Kit team' }, launch: { date: '2026-11-03' } }

/** The editable guide is the whole page. Its saved output is an optional panel. */
export default function KitDemo(): ReactNode {
  const [source, setSource] = useState(INITIAL)
  const [showOutput, setShowOutput] = useState(false)
  const [output, setOutput] = useState('markdown')
  const { copy, copied, blocked } = useCopy()
  const { link, unreadable } = useShareLink({ source, setSource, pristine: source === INITIAL })
  const extensions = useMemo(() => [variableChips({ previewData: DATA, previewLocale: 'en-US' })], [])
  const actions = <>
    <span className="rmk-toolbar-divider" aria-hidden="true"/>
    <span className="document-actions" role="group" aria-label="Document controls">
      <button aria-pressed={showOutput} onClick={() => setShowOutput(!showOutput)}>Output</button>
      {source !== INITIAL && <button onClick={() => setSource(INITIAL)}>Reset</button>}
      <button disabled={!link} onClick={() => link && void copy('link', link)}>{copied === 'link' ? 'Copied' : 'Copy link'}</button>
    </span>
  </>
  return <main className="document-workbench document-editor" data-panel={showOutput ? 'output' : 'closed'}>
    {(blocked === 'link' || unreadable) && <p className="document-notice" role="status">{unreadable ? 'This link could not be read. The original link is still in the address bar.' : 'Clipboard access was blocked. You can copy this document’s link from the address bar.'}</p>}
    <div className="document-layout">
      <div className="document-editor-main">
        <MarkdownEditor preset={preset} extensions={extensions} value={source} onChange={setSource} toolbarEnd={actions} />
      </div>
      {showOutput && <aside className="document-source document-editor-output" aria-label="Saved output">
        <div className="document-source-header">
          <select aria-label="Output format" value={output} onChange={event => setOutput(event.target.value)}>
            <option value="markdown">Saved Markdown</option><option value="rendered">Rendered</option>
          </select>
          <button onClick={() => void copy('markdown', source)}>{copied === 'markdown' ? 'Copied' : 'Copy'}</button>
          <button aria-label="Close output" onClick={() => setShowOutput(false)}>×</button>
        </div>
        {output === 'markdown' ? <textarea aria-label="Saved Markdown" value={source} readOnly spellCheck={false} /> :
          <div className="rmk-document document-output-preview"><Markdown preset={preset} extensions={[variables({ data: DATA, locale: 'en-US' })]}>{source}</Markdown></div>}
      </aside>}
    </div>
  </main>
}
