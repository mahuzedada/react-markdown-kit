import { useRef, useState, type ReactNode, type RefObject } from 'react'
import { Dialog, DialogBody, DialogDescription, DialogHeader, DialogPanel, DialogTitle } from '@zuilib/primitives/dialog'
import Button from '@zuilib/primitives/button'
import Heading from '@zuilib/primitives/heading'
import Input from '@zuilib/primitives/input'
import Text from '@zuilib/primitives/text'
import Textarea from '@zuilib/primitives/textarea'
import { badgeMarkdown, embedHtml } from './share'
import { CheckIcon, CopyIcon, ExternalIcon } from './icons'

/** One block of the dialog; a rule above every block but the first. */
const SECTION = 'flex flex-col gap-2 border-t border-border pt-4 first:border-t-0 first:pt-0'
/** A field with its Copy button beside it. */
const ROW = 'grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2'
/** The copied snippets: links and HTML read better in the code face. */
const MONO = 'font-mono text-xs'
/** The explanation under each block: body copy, full size. */
const NOTE = 'm-0 [&_a]:text-primary-text'
const SIZE_LABEL = 'flex flex-col gap-1 text-sm font-medium text-foreground'

export interface ShareDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  /** The link to this diagram, once the hash exists. */
  readonly link: string | undefined
  /** The same diagram on mermaid.live. */
  readonly liveUrl: string | undefined
  readonly copied: string | undefined
  readonly copy: (key: string, text: string, field?: HTMLInputElement | HTMLTextAreaElement | null) => void
}

/**
 * Shareable links, as mermaid.live lays them out: the link to this editor,
 * the README badge, and an embed whose size you pick. Everything is derived
 * from the hash, so nothing is uploaded.
 */
export default function ShareDialog({ open, onOpenChange, link, liveUrl, copied, copy }: ShareDialogProps): ReactNode {
  const [width, setWidth] = useState('100%')
  const [height, setHeight] = useState('520')
  const linkField = useRef<HTMLInputElement>(null)
  const badgeField = useRef<HTMLTextAreaElement>(null)
  const embedField = useRef<HTMLTextAreaElement>(null)

  const badge = link === undefined ? '' : badgeMarkdown(link)
  const iframe = link === undefined ? '' : embedHtml(link, width.trim() || '100%', height.trim() || '520')

  // The field is read at click time: on the dialog's first render its ref is still empty.
  const copyButton = (key: string, text: string, field: RefObject<HTMLInputElement | HTMLTextAreaElement | null>): ReactNode => (
    <Button variant="outline" tone="primary" size="sm" track={`copy-${key}`} disabled={text === ''} onClick={() => copy(key, text, field.current)}>
      {copied === key ? <CheckIcon /> : <CopyIcon />}
      {copied === key ? 'Copied' : 'Copy'}
    </Button>
  )

  return (
    <Dialog track="share" open={open} onOpenChange={onOpenChange} size="lg">
      <DialogPanel className="rounded-[16px]">
      <DialogHeader>
        <DialogTitle>Shareable links</DialogTitle>
        <DialogDescription>The diagram is stored in the link itself, so nothing gets uploaded.</DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <section className={SECTION}>
          <Heading as="h3" size="md" className="m-0">Mermaid Visual Editor</Heading>
          <div className={ROW}>
            <Input ref={linkField} track="share-link-field" size="sm" fullWidth inputClassName={MONO} readOnly value={link ?? ''} aria-label="Link to this diagram" onFocus={(event) => event.target.select()} />
            {copyButton('link', link ?? '', linkField)}
          </div>
          <Text className={NOTE}>The source (layout comment included) is compressed into the URL hash. Opening the link puts the same drawing back on the canvas.</Text>
        </section>

        <section className={SECTION}>
          <Heading as="h3" size="md" className="m-0">README badge</Heading>
          <div className={ROW}>
            <Textarea ref={badgeField} track="share-badge-field" resize="none" fullWidth textareaClassName={MONO} readOnly rows={2} value={badge} aria-label="Badge Markdown for a README" onFocus={(event) => event.target.select()} />
            {copyButton('badge', badge, badgeField)}
          </div>
          <Text className={NOTE}>
            Paste it in a README: the <a href="/badge.svg">badge</a> opens this diagram on the canvas.
          </Text>
        </section>

        <section className={SECTION}>
          <Heading as="h3" size="md" className="m-0">Embed</Heading>
          <Text className={NOTE}>Puts the live editor on your own site or blog, with the site chrome hidden.</Text>
          <div className="grid grid-cols-2 gap-3">
            <label className={SIZE_LABEL}>
              <span>Width</span>
              <Input track="embed-width" size="sm" fullWidth value={width} onChange={(event) => setWidth(event.target.value)} />
            </label>
            <label className={SIZE_LABEL}>
              <span>Height</span>
              <Input track="embed-height" size="sm" fullWidth value={height} onChange={(event) => setHeight(event.target.value)} />
            </label>
          </div>
          <div className={ROW}>
            <Textarea ref={embedField} track="share-embed-field" resize="none" fullWidth textareaClassName={MONO} readOnly rows={3} value={iframe} aria-label="Embed HTML for a page" onFocus={(event) => event.target.select()} />
            {copyButton('embed', iframe, embedField)}
          </div>
        </section>

        <section className={SECTION}>
          <Heading as="h3" size="md" className="m-0">Elsewhere</Heading>
          <div className={ROW}>
            <Button as="a" href={liveUrl ?? '#'} target="_blank" rel="noopener" variant="outline" size="sm" track="open-mermaid-live" disabled={liveUrl === undefined}>
              <ExternalIcon />
              Open in mermaid.live
            </Button>
          </div>
          <Text className={NOTE}>Opens the same source in the Mermaid project&rsquo;s editor. A flowchart&rsquo;s layout comment goes along with it, and mermaid.live ignores it.</Text>
        </section>
      </DialogBody>
      </DialogPanel>
    </Dialog>
  )
}
