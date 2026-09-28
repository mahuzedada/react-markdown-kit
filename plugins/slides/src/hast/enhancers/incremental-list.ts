/** With `incremental: true`, each item of a root-level list is its own reveal step: `<li data-rmk-fragment="n">`. */
import type { BlockEnhancer } from './block-enhancer.js'

export const incrementalList: BlockEnhancer = (block, { slide, counter }) => {
  if (slide.incremental !== true || block.type !== 'element' || (block.tagName !== 'ul' && block.tagName !== 'ol')) return
  for (const item of block.children) {
    if (item.type === 'element' && item.tagName === 'li') item.properties = { ...item.properties, dataRmkFragment: String(counter.next()) }
  }
}
