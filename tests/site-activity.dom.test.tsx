/**
 * The public sites' analytics seam (public-sites/shared/Activity.tsx) reaches
 * the primitives: a click on a tracked Button and a Tabs change arrive at the
 * adapter tagged with their feature and the site. @zuilib/primitives 0.3.0
 * shipped one telemetry context per entry file, so a provider never reached a
 * component; this fails if a zuilib upgrade brings that back.
 */
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ActivityProvider, ActivityScope } from '@zuilib/primitives/activity'
import { memoryAdapter, type MemoryAdapter } from '@zuilib/primitives/activity/testing'
import Tabs from '@zuilib/primitives/tabs'
import { Shell } from '../public-sites/shared/Shell'

let container: HTMLDivElement
let root: Root
let adapter: MemoryAdapter

// jsdom cannot follow a link; cancel it once capture has seen the click.
const stayOnPage = (event: MouseEvent): void => event.preventDefault()

function render(children: ReactNode): void {
  act(() => {
    root.render(
      <ActivityProvider adapters={[adapter]} properties={{ site: 'renderer' }} capture={{ pageView: false, engagement: false }} untagged="ignore">
        {children}
      </ActivityProvider>,
    )
  })
}

function click(element: Element | null): void {
  if (element === null) throw new Error('element not rendered')
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
}

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  adapter = memoryAdapter()
  window.addEventListener('click', stayOnPage)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  window.removeEventListener('click', stayOnPage)
})

describe('site activity', () => {
  it('reports a footer link click with its feature, action and site', () => {
    render(
      <Shell site="renderer">
        <main />
      </Shell>,
    )
    click(container.querySelector('a[data-zui-tag="github"]'))

    const event = adapter.events.find((candidate) => candidate.tag === 'footer:github')
    expect(event).toMatchObject({ feature: 'footer', action: 'github', label: 'GitHub', properties: { site: 'renderer' } })
  })

  it('reports a tab change from the component', () => {
    render(
      <ActivityScope feature="playground">
        <Tabs track="output" defaultSelectedIndex={0}>
          <Tabs.List>
            <Tabs.Tab>Rendered</Tabs.Tab>
            <Tabs.Tab>HTML</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panels>
            <Tabs.Panel>rendered</Tabs.Panel>
            <Tabs.Panel>html</Tabs.Panel>
          </Tabs.Panels>
        </Tabs>
      </ActivityScope>,
    )
    click(container.querySelectorAll('[role="tab"]')[1] ?? null)

    expect(adapter.named('tabs.change')).toEqual([
      expect.objectContaining({ feature: 'playground', label: 'HTML', properties: expect.objectContaining({ site: 'renderer' }) }),
    ])
  })
})
