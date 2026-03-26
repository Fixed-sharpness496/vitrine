# Vitrine - Intelligent Product Catalogue

A full-stack data + GenAI platform that turns a raw 29k-product retail dataset into an intelligent catalogue: semantic search with price filtering, unsupervised clustering, AI-generated buyer briefs, and a live analytics dashboard.

**Live:** [vitrine-ten.vercel.app](https://vitrine-ten.vercel.app)

![Analytics dashboard](dashboard.png)

---

## The Problem

Traditional e-commerce search is keyword-based. A buyer who types *"slim jeans under $80"* expects price-aware results ranked by relevance, not a list of products that literally contain those words. Merchandising teams also lack automated tools to understand their assortment structure, price positioning, or category coverage.

Three concrete gaps:

1. **Discovery** - keyword search misses semantically close products ("slim fit denim" vs "slim jeans").
2. **Assortment intelligence** - no automated grouping of 29k products into coherent segments.
3. **Buyer briefing** - no tool to map a buyer profile to the right product families.

---

## The Solution

```
Raw catalogue  →  Embeddings  →  Clusters  →  Enrichment  →  API  →  UI
    (BQ)           (OpenAI)      (HDBSCAN)    (GPT-4o-mini)  (FastAPI) (Next.js)
```

| Feature | How it works |
|---|---|
| Semantic search | `text-embedding-3-small` vectors + BigQuery `VECTOR_SEARCH` (cosine), with SQL price filter |
| Product families | HDBSCAN over 1536-dim embeddings → 603 clusters, labelled by GPT-4o-mini |
| Buyer brief | RAG: embed intent → top-K clusters → GPT-4o-mini brief per family |
| Analytics dashboard | 6 parallel BigQuery views, Recharts, 10-min TTL cache |
| Data quality | Automated completeness report after each pipeline run |

---

## Architecture

### System overview

```mermaid
graph TD
    DS[(TheLook dataset\nBigQuery public)] -->|SQL transform| CLEAN[products_clean]
    CLEAN -->|batch embed| EMB[products_embedded\n1536-dim vectors]
    EMB -->|HDBSCAN| CLUST[products_clustered\n603 families]
    CLUST -->|GPT-4o-mini| ENR[products_enriched\ndescriptions + labels]
    ENR -->|looker views| BQ_VIEWS[(6 BQ views)]

    subgraph Pipeline [Cloud Run Job]
        CLEAN
        EMB
        CLUST
        ENR
    end

    BQ_VIEWS --> API
    EMB --> API

    subgraph API [FastAPI - Cloud Run]
        SEARCH[POST /search\nVECTOR_SEARCH + price filter]
        CLUSTERS[GET /clusters]
        INTENT[POST /intent\nRAG pipeline]
        ANALYTICS[GET /analytics\n6 parallel queries]
        QUALITY[GET /quality]
    end

    API --> FE

    subgraph FE [Next.js - Vercel]
        PG_SEARCH[Catalogue Intelligent]
        PG_CLUSTERS[Collections]
        PG_INTENT[Conseil d'Achat]
        PG_ANALYTICS[Tableau de bord]
        PG_QUALITY[Qualité]
    end
```

### Data pipeline

```mermaid
flowchart LR
    A[00_create_tables\nBQ schema] --> B[01_staging\nraw ingest from TheLook]
    B --> C[02_transform\nclean + normalise]
    C --> D[embeddings.py\nOpenAI batch embed]
    D --> E[04_vector_index\nBQ vector index]
    D --> F[clustering.py\nHDBSCAN min_cluster=10]
    F --> G[enrichment.py\nGPT-4o-mini labels\n+ descriptions]
    G --> H[03_quality_checks\ncompleteness report]
    G --> I[05_looker_views\n6 materialised views]
```

### Search request flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant OpenAI
    participant BigQuery

    User->>Frontend: "jean slim moins de 80$"
    Frontend->>Frontend: parse price → max_price=80
    Frontend->>API: POST /search {query, top_k=20, max_price=80}
    API->>OpenAI: embed query → 1536-dim vector
    OpenAI-->>API: vector
    API->>BigQuery: VECTOR_SEARCH top_k=100 + WHERE price≤80 LIMIT 20
    BigQuery-->>API: ranked results
    API-->>Frontend: [{name, brand, price, description, cluster}]
    Frontend-->>User: results table with price badge
```

### Buyer intent (RAG) flow

```mermaid
sequenceDiagram
    participant User
    participant API
    participant OpenAI
    participant BigQuery

    User->>API: POST /intent {intent: "mode femme haut de gamme casual"}
    API->>OpenAI: embed intent
    API->>BigQuery: VECTOR_SEARCH on cluster centroids → top 5 families
    BigQuery-->>API: matching clusters + sample products
    API->>OpenAI: GPT-4o-mini - generate buyer brief per cluster
    OpenAI-->>API: {positioning, price_range, buyer_action}
    API-->>User: 5 cluster briefs
```

---

## Stack

| Layer | Technology |
|---|---|
| Data warehouse | BigQuery (Google Cloud) |
| Embeddings | OpenAI `text-embedding-3-small` |
| Clustering | HDBSCAN (`hdbscan` 0.8) |
| LLM | GPT-4o-mini |
| API | FastAPI + Pydantic, Cloud Run (min 1 instance) |
| Container registry | Artifact Registry |
| Frontend | Next.js 15, Tailwind v4, Recharts |
| Hosting | Vercel |
| CI/CD | GitHub Actions + Workload Identity Federation |
| Secrets | Google Secret Manager |

---

## Repository structure

```
vitrine/
├── pipeline/          # Batch data pipeline (Cloud Run Job)
│   ├── main.py        # Orchestrator
│   ├── embeddings.py  # OpenAI batch embedding
│   ├── clustering.py  # HDBSCAN + cluster labelling
│   └── enrichment.py  # GPT-4o-mini descriptions
├── api/               # FastAPI service (Cloud Run)
│   ├── routers/       # One file per endpoint
│   └── services/      # Business logic + BQ queries
├── frontend/          # Next.js app (Vercel)
│   └── src/app/       # One folder per page
├── sql/               # BigQuery DDL and transforms
├── docker/            # Dockerfiles for pipeline and API
├── infra/             # Setup scripts (GCP, IAM, BQ tables)
└── .github/workflows/ # CI/CD - build, push, deploy
```

Full file-level documentation in [`docs/`](docs/).
