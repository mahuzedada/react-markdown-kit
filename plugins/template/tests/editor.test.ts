/**
 * Spec 8.18 / 8.19 — `templateVariables()` in the editor: placeholders are
 * chips, chips write back the authored placeholder byte for byte, typing a
 * placeholder closes it into a chip, and preview data never reaches the
 * saved source.
 */
import { describe, expect, it } from 'vitest'
import { $createParagraphNode, $createTextNode, $getRoot, $isElementNode, type LexicalEditor, type LexicalNode } from 'lexical'

import { createMarkdownBridge, type MarkdownBridge } from '@react-markdown-kit/editor'
import {
  $isTemplateVariableNode,
  INSERT_TEMPLATE_VARIABLE_COMMAND,
  templateVariables,
  type TemplateVariableNode,
} from '../src/editor.js'

const SOURCE = 'Hello {{customer.name}}, revenue {{revenue | currency:"USD"}}.\n'

const VARIABLES = {
  'customer.name': { label: 'Customer name', group: 'Customer' },
  revenue: { label: 'Revenue', group: 'Financials' },
}

function open(source: string, extension = templateVariables({ variables: VARIABLES })): {
  editor: LexicalEditor
  bridge: MarkdownBridge
  off: () => void
} {
  const bridge = createMarkdownBridge({ extensions: [extension], headless: true })
  const off = bridge.registerPlugins()
  bridge.load(source)
  return { editor: bridge.getNativeEditor() as LexicalEditor, bridge, off }
}

function chips(editor: LexicalEditor): TemplateVariableNode[] {
  return editor.getEditorState().read(() => {
    const out: TemplateVariableNode[] = []
    const walk = (node: LexicalNode): void => {
      if ($isTemplateVariableNode(node)) out.push(node)
      if ($isElementNode(node)) for (const child of node.getChildren()) walk(child)
    }
    for (const child of $getRoot().getChildren()) walk(child)
    return out
  })
}

describe('the extension is well formed (spec 5.3, 8.18)', () => {
  const extension = templateVariables({ variables: VARIABLES })

  it('is the renderer extension plus an editor capability, under the same name', () => {
    expect(extension.name).toBe('template-variables')
    expect(extension.contractVersion).toBe(1)
    expect(extension.capabilities?.syntax?.nodeTypes).toEqual(['templateVariable'])
    expect(extension.capabilities?.template?.literalNodeTypes).toEqual(['templateVariable'])
    expect(extension.capabilities?.renderer?.handlers).toHaveProperty('templateVariable')
    expect(extension.capabilities?.editor?.nodes).toHaveLength(1)
    expect(extension.capabilities?.editor?.inlines).toHaveLength(1)
    expect(extension.capabilities?.editor?.commands).toHaveLength(1)
  })

  it('works with no options at all', () => {
    expect(templateVariables().capabilities?.editor?.nodes).toHaveLength(1)
  })
})

describe('chips (spec 8.19)', () => {
  it('imports every placeholder as a chip and writes the source back byte for byte', () => {
    const { editor, bridge, off } = open(SOURCE)
    const nodes = chips(editor)
    expect(nodes).toHaveLength(2)
    expect(editor.getEditorState().read(() => nodes.map((node) => node.getValue()))).toEqual([
      { path: 'customer.name', value: '{{customer.name}}' },
      { path: 'revenue', formatter: 'currency', argument: 'USD', value: '{{revenue | currency:"USD"}}' },
    ])
    expect(bridge.getMarkdown()).toBe(SOURCE)
    off()
  })

  it('leaves a placeholder inside code alone, matching resolution (spec 8.11)', () => {
    const source = 'Use `{{customer.name}}` here.\n\n```\n{{customer.name}}\n```\n'
    const { editor, bridge, off } = open(source)
    expect(chips(editor)).toHaveLength(0)
    expect(bridge.getMarkdown()).toBe(source)
    off()
  })

  it('serializes an edited paragraph from the chips, not from preview data', () => {
    const extension = templateVariables({
      variables: VARIABLES,
      previewData: { customer: { name: 'Globex' }, revenue: 1 },
    })
    const { editor, bridge, off } = open(SOURCE, extension)
    editor.update(
      () => {
        const paragraph = $getRoot().getFirstChild()
        if (!$isElementNode(paragraph)) throw new Error('expected a paragraph')
        paragraph.append($createTextNode(' Edited.'))
      },
      { discrete: true },
    )
    const out = bridge.getMarkdown()
    expect(out).toBe('Hello {{customer.name}}, revenue {{revenue | currency:"USD"}}. Edited.\n')
    expect(out).not.toContain('Globex')
    off()
  })

  it('closes a placeholder typed into prose into a chip', () => {
    const { editor, bridge, off } = open('Start.\n')
    editor.update(
      () => {
        const paragraph = $createParagraphNode()
        paragraph.append($createTextNode('Dear {{customer.name}}, welcome.'))
        $getRoot().append(paragraph)
      },
      { discrete: true },
    )
    const [chip] = chips(editor)
    expect(chip).toBeDefined()
    expect(editor.getEditorState().read(() => chip?.getValue().path)).toBe('customer.name')
    expect(bridge.getMarkdown()).toBe('Start.\n\nDear {{customer.name}}, welcome.\n')
    off()
  })

  it('inserts a chip through the command and writes the canonical placeholder', () => {
    const { editor, bridge, off } = open('')
    editor.update(
      () => {
        $getRoot().selectEnd()
        editor.dispatchCommand(INSERT_TEMPLATE_VARIABLE_COMMAND, { path: 'revenue', formatter: 'percent' })
      },
      { discrete: true },
    )
    expect(bridge.getMarkdown()).toBe('{{revenue | percent}}\n')
    off()
  })
})

describe('refreshing preview data (spec 8.19)', () => {
  it('re-registers the extension plugins in place, without rebuilding the editor', () => {
    const { editor, bridge, off } = open(SOURCE, templateVariables({ variables: VARIABLES }))
    off()
    bridge.refreshExtensions({
      extensions: [templateVariables({ variables: VARIABLES, previewData: { customer: { name: 'Acme' } } })],
    })
    const offAgain = bridge.registerPlugins()
    expect(editor.getEditorState().read(() => chips(editor).map((chip) => chip.getValue().path))).toEqual([
      'customer.name',
      'revenue',
    ])
    // The saved source is untouched by new preview data.
    expect(bridge.getMarkdown()).toBe(SOURCE)
    offAgain()
  })
})
