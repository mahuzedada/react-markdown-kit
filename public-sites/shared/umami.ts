import type { ActivityAdapter, ActivityEvent } from '@zuilib/primitives/activity'
import type { ActivitySite } from './Activity'

/** The self-hosted Umami instance (Shipiru app `umami`). */
const UMAMI_SCRIPT = 'https://stats.reactmarkdownkit.com/s.js'
/**
 * Session replay and heatmaps. Sampling, masking and the on/off switch are
 * per-website settings in the Umami dashboard, read by the recorder at start.
 */
const UMAMI_RECORDER = 'https://stats.reactmarkdownkit.com/recorder.js'

/** One Umami website per public site, created in the Umami dashboard. */
const UMAMI_WEBSITE_IDS: Record<ActivitySite, string> = {
  home: '66f4e4a3-5d29-4d4f-bc0f-66d108b75919',
  docs: '08b11cd9-b165-4a46-8ec9-848fa4e8fcad',
  renderer: '653aa964-df7b-4d25-bdd1-6a0960d10c1a',
  editor: '9bde38fc-d0b8-4fcf-bf8d-9fca52da0dce',
  mermaid: '6bb93db7-97d8-427d-a75f-96ccfd91b184',
  slides: '297095b3-3074-4c7d-b4df-160d5c3aa8b8',
}

type UmamiData = Record<string, string | number | boolean>

interface UmamiPayload {
  url?: string
  title?: string
  referrer?: string
  name?: string
  data?: UmamiData
  [field: string]: unknown
}

interface UmamiApi {
  track: (payload: (defaults: UmamiPayload) => UmamiPayload) => void
}

function umami(): UmamiApi | undefined {
  return (globalThis as { umami?: UmamiApi }).umami
}

/**
 * Calls made before the tracker loaded, replayed from its `load` event. The
 * provider's own `ready` buffer only retries on the next event, which would
 * hold the landing page view until the visitor's first click.
 */
const pending: ((api: UmamiApi) => void)[] = []

function send(call: (api: UmamiApi) => void): void {
  const api = umami()
  if (api === undefined) pending.push(call)
  else call(api)
}

function flushPending(): void {
  const api = umami()
  if (api === undefined) return
  for (const call of pending.splice(0)) call(api)
}

function appendScript(src: string, data: Record<string, string>, onLoad?: () => void): void {
  const script = document.createElement('script')
  script.defer = true
  script.src = src
  Object.assign(script.dataset, data)
  if (onLoad !== undefined) script.addEventListener('load', onLoad)
  document.head.append(script)
}

/**
 * Adds the tracker and the session recorder once. Umami's own page tracking
 * is off (`data-auto-track="false"`): page views come from the provider, which
 * only counts a new path, so Slides' `?view=` switches are not extra pages.
 */
export function loadUmami(site: ActivitySite): void {
  if (document.querySelector(`script[src="${UMAMI_SCRIPT}"]`) !== null) return
  const websiteId = UMAMI_WEBSITE_IDS[site]
  appendScript(UMAMI_SCRIPT, { websiteId, autoTrack: 'false', excludeSearch: 'true', excludeHash: 'true' }, flushPending)
  appendScript(UMAMI_RECORDER, { websiteId })
}

function eventData(event: ActivityEvent): UmamiData {
  const data: UmamiData = { event: event.name }
  if (event.component !== undefined) data.component = event.component
  if (event.label !== undefined) data.label = event.label
  if (event.value !== undefined) data.value = event.value
  return data
}

/**
 * With auto-track off the tracker never updates its URL after a client-side
 * navigation, so every call names the page it happened on. Read when the
 * event fires, not when a queued call is flushed.
 */
function currentPage(): UmamiPayload {
  return { url: location.origin + location.pathname, title: document.title }
}

/**
 * Reports to Umami through `window.umami`, queueing until the script has
 * loaded. Named events use the control's `feature:action` tag, so the Umami
 * events list reads like the UI.
 */
export function umamiAdapter(): ActivityAdapter {
  // The first page view keeps the tracker's `document.referrer` (Google, a
  // backlink); later ones came from the previous page, which Umami leaves out
  // of referrer reports because it is the same host.
  let previousUrl: string | undefined
  return {
    name: 'umami',
    page: () => {
      const page = currentPage()
      const referrer = previousUrl
      previousUrl = page.url
      send((api) =>
        api.track((defaults) => ({ ...defaults, ...page, ...(referrer === undefined ? {} : { referrer }) })),
      )
    },
    track: (event) => {
      if (event.name === 'page.leave') return
      const page = currentPage()
      const name = event.tag ?? event.name
      const data = eventData(event)
      send((api) => api.track((defaults) => ({ ...defaults, ...page, name, data })))
    },
  }
}
