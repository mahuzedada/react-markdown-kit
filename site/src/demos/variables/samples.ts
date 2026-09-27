/** The document and the data sets the variables demo opens with. */

export const SOURCE = `![{{brand.logoAlt}}]({{brand.logoUrl}})

# Account review for {{customer.name}}

Hello {{contact.firstName}}, your plan renews on {{renewsAt | date:"long"}}.

| Line item | Amount |
| --- | ---: |
| Subscription | {{amounts.subscription \\| currency:"USD"}} |
| Overage | {{amounts.overage \\| currency:"USD"}} |

Usage is at {{usage.ratio | percent}} of the included allowance.

[Open your account]({{links.account}})
`

export interface Dataset {
  readonly label: string
  readonly locale: string
  readonly data: Readonly<Record<string, unknown>>
}

const ACME = {
  brand: { logoAlt: 'Acme Industrial', logoUrl: 'https://placehold.co/160x40/0f6f6b/fff?text=ACME' },
  customer: { name: 'Acme Industrial' },
  contact: { firstName: 'Dana' },
  renewsAt: '2026-11-01',
  amounts: { subscription: 4800, overage: 312.5 },
  usage: { ratio: 0.78 },
  links: { account: 'https://example.com/accounts/acme' },
}

export const DATASETS: readonly Dataset[] = [
  { label: 'Acme Industrial', locale: 'en-US', data: ACME },
  {
    label: 'Cedarline Mutual',
    locale: 'en-US',
    data: {
      brand: { logoAlt: 'Cedarline Mutual', logoUrl: 'https://placehold.co/160x40/1c2127/fff?text=CEDARLINE' },
      customer: { name: 'Cedarline Mutual' },
      contact: { firstName: 'Priya' },
      renewsAt: '2027-02-15',
      amounts: { subscription: 19200, overage: 0 },
      usage: { ratio: 0.41 },
      links: { account: 'https://example.com/accounts/cedarline' },
    },
  },
  { label: 'Acme in French', locale: 'fr-FR', data: ACME },
  {
    label: 'Hostile values',
    locale: 'en-US',
    data: {
      ...ACME,
      customer: { name: '**Administrator**\n# Pwned' },
      contact: { firstName: '<script>alert(1)</script>' },
    },
  },
  {
    label: 'Unsafe link',
    locale: 'en-US',
    data: { ...ACME, links: { account: 'javascript:alert(1)' } },
  },
  {
    label: 'Missing value',
    locale: 'en-US',
    data: { ...ACME, amounts: { subscription: 4800 } },
  },
]

export const LOCALES: readonly string[] = ['en-US', 'en-GB', 'fr-FR', 'de-DE', 'ja-JP', 'pt-BR']
