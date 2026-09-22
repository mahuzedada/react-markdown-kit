/*
 * The sample diagrams the left column offers, in two groups: flowcharts,
 * which open on the drawing canvas, and sequence diagrams, which open on
 * the sequence canvas and render as static SVG. Each one stays inside
 * the subset the plugin parses (docs.reactmarkdownkit.com/docs/mermaid) and
 * compiles with no diagnostic: every shape bracket, every edge style,
 * `subgraph`, `style` lines and comments on the flowchart side; alt/else,
 * activation, notes, par/and, loop and autonumber on the sequence side. No
 * sample carries a raw `;` in text, since Mermaid ends a statement there.
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

export const DEFAULT_CODE = `flowchart LR
    web["CLIENT<br/>Web App<br/>React"] -->|REST| api["SERVICE<br/>API<br/>Kotlin"]
    api --> db[(Postgres)]
    api -->|publish| q[[Events]]
    style web fill:#a5d8ff,stroke:#1971c2
    style api fill:#b2f2bb,stroke:#2f9e44
    style db fill:#d0bfff,stroke:#7048e8
    style q fill:#ffec99,stroke:#f08c00`

const FLOWCHARTS: readonly Sample[] = [
  { id: 'basic', label: 'Basic', code: DEFAULT_CODE },
  {
    id: 'decision',
    label: 'Decision',
    code: `flowchart TD
    start([Request]) --> parse[Parse body]
    parse --> valid{Valid?}
    valid -->|yes| work[Process]
    valid -->|no| reject[Return 400]
    work --> done([Respond 200])
    reject --> done
    style valid fill:#ffec99,stroke:#f08c00
    style reject fill:#ffc9c9,stroke:#e03131`,
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    code: `flowchart LR
    src[(Source DB)] --> extract[Extract]
    extract --> transform{{Transform}}
    transform --> load[[Warehouse]]
    load --> report(Report)
    transform -.->|rejects| dlq[[Dead letter]]
    style src fill:#d0bfff,stroke:#7048e8
    style load fill:#a5d8ff,stroke:#1971c2`,
  },
  {
    id: 'services',
    label: 'Services',
    code: `flowchart LR
    client[Browser] --> gw[API gateway]
    gw --> auth[Auth]
    gw --> orders[Orders]
    gw --> pay[Payments]
    orders --> odb[(Orders DB)]
    pay --> pdb[(Ledger)]
    orders -->|order placed| bus[[Event bus]]
    bus --> mail[Notifications]
    style gw fill:#b2f2bb,stroke:#2f9e44
    style bus fill:#ffec99,stroke:#f08c00`,
  },
  {
    id: 'shapes',
    label: 'Shapes',
    code: `flowchart LR
    a[Rectangle] --> b(Rounded)
    b --> c([Stadium])
    c --> d[[Subroutine]]
    d --> e[(Cylinder)]
    e --> f((Circle))
    f --> g>Note]
    g --> h{Diamond}
    h --> i{{Hexagon}}`,
  },
  {
    id: 'subgraphs',
    label: 'Subgraphs',
    code: `flowchart LR
    subgraph frontend [Frontend]
        ui[React app] --> bff[BFF]
    end
    subgraph backend [Backend]
        bff --> svc[Service]
        svc --> db[(Postgres)]
        svc --> cache[(Redis)]
    end
    style ui fill:#a5d8ff,stroke:#1971c2
    style svc fill:#b2f2bb,stroke:#2f9e44`,
  },
  {
    id: 'edges',
    label: 'Edges',
    code: `flowchart LR
    a[Arrow] --> b[Line]
    b --- c[Dotted]
    c -.-> d[Thick]
    d ==> e[Both ways]
    e <--> f[Labelled]
    f -- via text --> g[Circle end]
    g --o h[Cross end]
    h --x i[End]`,
  },
  {
    id: 'release',
    label: 'Release',
    code: `flowchart TD
    dev[Feature branch] --> pr[Pull request]
    pr --> ci{CI green?}
    ci -->|no| dev
    ci -->|yes| review[Review]
    review --> merge[Merge to main]
    merge --> build[[Build image]]
    build --> canary[Canary]
    canary -->|healthy| prod[Production]
    canary -->|rollback| merge
    style ci fill:#ffec99,stroke:#f08c00
    style prod fill:#b2f2bb,stroke:#2f9e44`,
  },
]

const SEQUENCE_DIAGRAMS: readonly Sample[] = [
  {
    id: 'signin',
    label: 'Sign-in',
    code: `sequenceDiagram
    actor User
    participant App
    participant Auth as Auth service
    User->>App: Enter email and password
    App->>Auth: POST /sign-in
    alt credentials valid
        Auth-->>App: 200 session token
        App-->>User: Show the dashboard
    else credentials rejected
        Auth-->>App: 401 unauthorized
        App-->>User: Show the error, keep the form
    end`,
  },
  {
    id: 'apicall',
    label: 'API call',
    code: `sequenceDiagram
    participant Client
    participant API
    participant DB as Postgres
    Client->>+API: GET /orders/42
    Note right of API: Validate the token
    API->>+DB: SELECT order 42
    DB-->>-API: One row
    API-->>-Client: 200 order JSON
    Note over Client,API: Cached for 60 seconds`,
  },
  {
    id: 'parallel',
    label: 'Parallel work',
    code: `sequenceDiagram
    participant Catalog
    participant Images
    participant Search
    participant Mail
    Catalog->>Catalog: Product saved
    par resize images
        Catalog->>Images: Generate thumbnails
        Images-->>Catalog: 4 sizes ready
    and update the index
        Catalog->>Search: Index product
        Search-->>Catalog: Indexed
    and notify followers
        Catalog->>Mail: Queue announcement
        Mail-->>Catalog: 120 emails queued
    end`,
  },
  {
    id: 'loop',
    label: 'Loop',
    code: `sequenceDiagram
    autonumber
    participant Worker
    participant Queue
    participant Store as Object store
    loop every 30 seconds
        Worker->>Queue: Poll for jobs
        Queue-->>Worker: Job batch
        Worker->>Store: Upload results
        Store-->>Worker: Stored
    end
    Worker-)Queue: Acknowledge the batch`,
  },
]

export const SAMPLE_GROUPS: readonly SampleGroup[] = [
  { label: 'Flowcharts', samples: FLOWCHARTS },
  { label: 'Sequence diagrams', samples: SEQUENCE_DIAGRAMS },
]

/** Every sample in display order; the first one is the default diagram. */
export const SAMPLES: readonly Sample[] = SAMPLE_GROUPS.flatMap((group) => group.samples)
