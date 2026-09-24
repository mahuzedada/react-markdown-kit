/*
 * The sample diagrams the left column offers, in two groups: flowcharts,
 * which open on the drawing canvas, and sequence diagrams, which open on
 * the sequence canvas and render as static SVG. Three of each, drawn from
 * the systems an enterprise team documents: a service architecture, an
 * approval process and a data platform on the flowchart side; single
 * sign-on, a checkout and a nightly reconciliation on the sequence side.
 * Each one stays inside the subset the plugin parses
 * (docs.reactmarkdownkit.com/docs/mermaid) and compiles with no
 * diagnostic, and none uses a feature the canvas flattens (subgraphs,
 * invisible or extra-long links, the hexagon and circle brackets), so
 * every sample opens editable at once. No
 * sample carries a raw `;` in text, since Mermaid ends a statement there,
 * and no flowchart has a cycle, whose back edge the auto layout would
 * draw over the forward one. A rank is about 250px in the auto layout, so
 * a flowchart keeps to four ranks top-down or three left-to-right and
 * sits whole on the canvas at 100% on a laptop screen.
 */

export interface Sample {
  readonly id: string
  readonly label: string
  readonly code: string
}

export interface SampleGroup {
  /** The heading over the chips: "Flowcharts", "Sequence diagrams". */
  readonly label: string
  readonly samples: readonly Sample[]
}

export const DEFAULT_CODE = `flowchart TD
    web["Storefront<br/>React"] -->|HTTPS| gw["API gateway"]
    mobile["Mobile app<br/>iOS and Android"] -->|HTTPS| gw
    gw --> orders["Orders service<br/>Kotlin"]
    gw --> pay["Payments service<br/>Go"]
    orders --> odb[(Orders DB)]
    orders -->|order placed| bus[[Event bus]]
    pay -->|payment captured| bus
    pay --> ledger[(Ledger)]
    style web fill:#a5d8ff,stroke:#1971c2
    style mobile fill:#a5d8ff,stroke:#1971c2
    style gw fill:#b2f2bb,stroke:#2f9e44
    style odb fill:#d0bfff,stroke:#7048e8
    style ledger fill:#d0bfff,stroke:#7048e8
    style bus fill:#ffec99,stroke:#f08c00`

const FLOWCHARTS: readonly Sample[] = [
  { id: 'platform', label: 'Order platform', code: DEFAULT_CODE },
  {
    id: 'approval',
    label: 'Purchase approval',
    code: `flowchart TD
    request([Purchase request]) --> amount{Over 10k USD?}
    amount -->|no| manager[Manager approves]
    amount -->|yes| finance[Finance reviews]
    manager --> po[[Purchase order sent]]
    finance --> po
    finance --> audit[(Audit log)]
    style request fill:#a5d8ff,stroke:#1971c2
    style amount fill:#ffec99,stroke:#f08c00
    style po fill:#b2f2bb,stroke:#2f9e44
    style audit fill:#d0bfff,stroke:#7048e8`,
  },
  {
    id: 'data',
    label: 'Data platform',
    code: `flowchart LR
    crm[(CRM)] -->|CDC| lake[(Lakehouse)]
    erp[(ERP)] -->|nightly batch| lake
    web[Web events] -->|Kafka stream| lake
    lake -->|dbt models| bi[BI dashboards]
    lake --> ml([ML features])
    lake -->|reverse ETL| ops[Ops tools]
    style crm fill:#d0bfff,stroke:#7048e8
    style erp fill:#d0bfff,stroke:#7048e8
    style lake fill:#b2f2bb,stroke:#2f9e44
    style bi fill:#a5d8ff,stroke:#1971c2
    style ml fill:#ffec99,stroke:#f08c00`,
  },
]

const SEQUENCE_DIAGRAMS: readonly Sample[] = [
  {
    id: 'sso',
    label: 'Single sign-on',
    code: `sequenceDiagram
    actor Employee
    participant App as Intranet app
    participant IdP as Identity provider
    participant Dir as Directory API
    Employee->>App: Open the intranet
    App->>IdP: Redirect to sign-in
    Employee->>IdP: Enter credentials
    alt MFA required
        IdP-->>Employee: Push notification
        Employee->>IdP: Approve on phone
    else trusted device
        Note right of IdP: Prompt skipped
    end
    IdP-->>App: Signed assertion
    App->>Dir: Fetch groups and roles
    Dir-->>App: Roles
    App-->>Employee: Dashboard for the role`,
  },
  {
    id: 'checkout',
    label: 'Checkout',
    code: `sequenceDiagram
    autonumber
    participant Client as Checkout page
    participant Orders as Orders service
    participant Pay as Payments
    participant Stock as Inventory
    participant Bus as Event bus
    Client->>+Orders: POST /orders
    Orders->>+Pay: Authorize 149.00 USD
    Pay-->>-Orders: Authorized
    par reserve stock
        Orders->>Stock: Reserve 2 items
        Stock-->>Orders: Reserved
    and publish
        Orders-)Bus: order.created
    end
    Orders-->>-Client: 201 order confirmed
    Note over Client,Orders: Same idempotency key on every retry`,
  },
  {
    id: 'reconciliation',
    label: 'Reconciliation',
    code: `sequenceDiagram
    autonumber
    participant Job as Reconciliation job
    participant Ledger
    participant Bank as Bank API
    participant Ops as On-call channel
    Job->>Ledger: Load yesterday's settlements
    Ledger-->>Job: 1,240 entries
    loop each settlement
        Job->>Bank: GET transaction by reference
        Bank-->>Job: Amount and status
        alt amounts match
            Job->>Ledger: Mark reconciled
        else mismatch
            Job->>Ops: Post a discrepancy alert
        end
    end
    Note over Job,Ledger: Report emailed to finance at 06:00`,
  },
]

export const SAMPLE_GROUPS: readonly SampleGroup[] = [
  { label: 'Flowcharts', samples: FLOWCHARTS },
  { label: 'Sequence diagrams', samples: SEQUENCE_DIAGRAMS },
]

/** Every sample in display order; the first one is the default diagram. */
export const SAMPLES: readonly Sample[] = SAMPLE_GROUPS.flatMap((group) => group.samples)
