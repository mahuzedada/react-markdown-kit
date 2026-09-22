/*
 * The sample diagrams the left column offers, all flowcharts because that is
 * what the canvas opens. Each one stays inside the subset the plugin parses
 * (docs.reactmarkdownkit.com/docs/mermaid): every shape bracket, every edge
 * style, `subgraph`, `style` lines and comments.
 */

export interface Sample {
  readonly id: string
  readonly label: string
  readonly code: string
}

export const DEFAULT_CODE = `flowchart LR
    web["CLIENT<br/>Web App<br/>React"] -->|REST| api["SERVICE<br/>API<br/>Kotlin"]
    api --> db[(Postgres)]
    api -->|publish| q[[Events]]
    style web fill:#a5d8ff,stroke:#1971c2
    style api fill:#b2f2bb,stroke:#2f9e44
    style db fill:#d0bfff,stroke:#7048e8
    style q fill:#ffec99,stroke:#f08c00`

export const SAMPLES: readonly Sample[] = [
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
