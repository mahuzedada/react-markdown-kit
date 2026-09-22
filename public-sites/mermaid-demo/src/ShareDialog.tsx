import { useRef, useState, type ReactNode } from 'react'
import { Dialog, DialogBody, DialogDescription, DialogHeader, DialogPanel, DialogTitle } from '@zuilib/primitives/dialog'
import Button from '@zuilib/primitives/button'
import Input from '@zuilib/primitives/input'
import Textarea from '@zuilib/primitives/textarea'
import { cn } from '@zuilib/primitives/lib/cn'
import { badgeMarkdown, embedHtml } from './share'
import { CheckIcon, CopyIcon, ExternalIcon } from './icons'
import styles from './ShareDialog.module.css'

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

  const copyButton = (key: string, text: string, field?: HTMLInputElement | HTMLTextAreaElement | null): ReactNode => (
    <Button variant="outline" tone="primary" size="sm" track={`copy-${key}`} disabled={text === ''} onClick={() => copy(key, text, field)}>
      {copied === key ? <CheckIcon /> : <CopyIcon />}
      {copied === key ? 'Copied' : 'Copy'}
    </Button>
  )

  return (
    <Dialog track="share" open={open} onOpenChange={onOpenChange} size="lg">
      <DialogPanel className={cn(styles.dialog)}>
      <DialogHeader>
        <DialogTitle>Shareable links</DialogTitle>
        <DialogDescription>Share your diagram with others. The diagram lives in the link itself; nothing is uploaded.</DialogDescription>
      </DialogHeader>
      <DialogBody className={cn(styles.body)}>
        <section className={styles.section}>
          <h3 className={styles.heading}>Mermaid Visual Editor</h3>
          <div className={styles.row}>
            <Input ref={linkField} track="share-link-field" size="sm" fullWidth inputClassName={cn(styles.mono)} readOnly value={link ?? ''} aria-label="Link to this diagram" onFocus={(event) => event.target.select()} />
            {copyButton('link', link ?? '', linkField.current)}
          </div>
          <p className={styles.note}>The source, layout comment included, is compressed into the URL hash. Opening the link restores the drawing on the canvas.</p>
        </section>

        <section className={styles.section}>
          <h3 className={styles.heading}>README badge</h3>
          <div className={styles.row}>
            <Textarea ref={badgeField} track="share-badge-field" resize="none" fullWidth textareaClassName={cn(styles.mono)} readOnly rows={2} value={badge} aria-label="Badge Markdown for a README" onFocus={(event) => event.target.select()} />
            {copyButton('badge', badge, badgeField.current)}
          </div>
          <p className={styles.note}>
            Paste it in a README: the <a href="/badge.svg">badge</a> opens this diagram on the canvas.
          </p>
        </section>

        <section className={styles.section}>
          <h3 className={styles.heading}>Embed</h3>
          <p className={styles.note}>Embed the live editor in your own website or blog. The site chrome is hidden.</p>
          <div className={styles.sizes}>
            <label className={styles.size}>
              <span>Width</span>
              <Input track="embed-width" size="sm" fullWidth value={width} onChange={(event) => setWidth(event.target.value)} />
            </label>
            <label className={styles.size}>
              <span>Height</span>
              <Input track="embed-height" size="sm" fullWidth value={height} onChange={(event) => setHeight(event.target.value)} />
            </label>
          </div>
          <div className={styles.row}>
            <Textarea ref={embedField} track="share-embed-field" resize="none" fullWidth textareaClassName={cn(styles.mono)} readOnly rows={3} value={iframe} aria-label="Embed HTML for a page" onFocus={(event) => event.target.select()} />
            {copyButton('embed', iframe, embedField.current)}
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.heading}>Elsewhere</h3>
          <div className={styles.row}>
            <Button as="a" href={liveUrl ?? '#'} target="_blank" rel="noopener" variant="outline" size="sm" track="open-mermaid-live" disabled={liveUrl === undefined}>
              <ExternalIcon />
              Open in mermaid.live
            </Button>
          </div>
          <p className={styles.note}>The same source in the Mermaid project&rsquo;s editor. The layout comment travels along and is ignored there.</p>
        </section>
      </DialogBody>
      </DialogPanel>
    </Dialog>
  )
}
