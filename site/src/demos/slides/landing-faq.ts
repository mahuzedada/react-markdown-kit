/** The slides landing page's questions. They also feed the page's FAQ JSON-LD, so keep the question and answer shape. */
import { docsUrl } from '../../sites'
import type { FaqItem } from '../../components/landing/Seo'

export const FAQ: readonly FaqItem[] = [
  {
    question: 'Can I make slides from Markdown?',
    answer:
      'Yes. Separate slides with --- between blank lines and the file becomes a deck. It’s still a normal document on GitHub, in a diff and in any editor that doesn’t know about the plugin.',
    more: { href: docsUrl('/docs/slides'), label: 'The dialect.' },
  },
  {
    question: 'How do I add speaker notes to Markdown slides?',
    answer:
      'Put ??? on its own line. Everything after it in that slide is a note. Notes are hidden in the deck and shown in the presenter window, next to the upcoming step, a timer and a clock.',
  },
  {
    question: 'Can I present Markdown slides in the browser?',
    answer:
      'Yes. Present goes full screen with keyboard navigation. You can also open a presenter window that stays in sync, and share a link that opens the deck in present mode.',
  },
  {
    question: 'How do I reveal points one at a time?',
    answer:
      'Put -- on its own line between them. Each -- starts a fragment that shows up on the next keypress. A slide with <!-- incremental: true --> reveals list items one at a time, and a code fence like ```ts {1|3-4} moves its highlight one line range per keypress.',
  },
  {
    question: 'Can I set a class or a background on one slide?',
    answer:
      'Yes. Use a comment on a line by itself to set class, background, layout, transition, footer and a few more. Front matter at the top of the file sets the title, the aspect ratio and the defaults for every slide.',
  },
  {
    question: 'Can I embed a Markdown deck in a blog post?',
    answer:
      'Yes. Add embed=1 to a share link and put it in an iframe. The frame shows only the deck, in present mode. Keys work inside it, and there’s a link that opens the full editor.',
  },
  {
    question: 'Is it a Marp or Slidev alternative?',
    answer:
      'For decks inside a React app, yes. It renders sections from Markdown your app already stores, prints one page per slide and writes PPTX. If you need PDF or PNG from a command line, Marp and Slidev are built for that.',
    more: { href: docsUrl('/docs/slides'), label: 'What the plugin renders.' },
  },
]
