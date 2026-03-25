# Vitrine — Design Document
**Date:** 2026-03-25
**Deadline:** 2026-03-30 (Davidson interview with Arnaud)
**GCP Project:** `vitrine-wamba-2026`

---

## 1. System Architecture

```mermaid
graph TD
    subgraph Sources
        BQ_PUB["bigquery-public-data\nthelook_ecommerce"]
        OPENAI["OpenAI API\ntext-embedding-3-small\ngpt-4o-mini"]
    end

    subgraph GCP["GCP Project: vitrine-wamba-2026 · eu-west1"]
        subgraph BQ["BigQuery · vitrine_dataset"]
            T1["products_raw"]
            T2["products_clean"]
            T3["products_embedded\n+ SCANN vector index"]
            T4["products_clustered"]
            T5["products_enriched"]
            T6["quality_report"]
            T7["pipeline_runs (audit)"]
            VIEWS["6× Looker views"]
        end

        subgraph PIPELINE["Cloud Run Job (daily @ 02:00 UTC)"]
            E["embeddings.py\nbatch=250, retry×5"]
            C["clustering.py\nHDBSCAN min_size=15"]
            EN["enrichment.py\nGPT-4o-mini, 50 words"]
            MAIN["main.py\norchestrator + idempotency"]
        end

        subgraph API["Cloud Run Service · vitrine-api"]
            SEARCH["POST /search"]
            CLUSTERS["GET /clusters"]
            CLUSTER_ID["GET /clusters/{id}/products"]
            ENRICH["POST /enrich"]
            QUALITY["GET /quality"]
        end

        SM["Secret Manager\nOPENAI_API_KEY\nLANGSMITH_API_KEY"]
        AR["Artifact Registry\nvitrine-docker"]
        CS["Cloud Scheduler\n0 2 * * *"]
        LS["Looker Studio\n(public link)"]
    end

    subgraph Frontend["Vercel · vitrine.stephanewamba.com"]
        P1["/ · Semantic Search"]
        P2["/clusters · Cluster Grid"]
        P3["/clusters/[id] · Detail"]
        P4["/quality · Dashboard"]
    end

    subgraph CICD["GitHub Actions"]
        GHA["push to main\n→ build Docker\n→ push AR\n→ deploy Cloud Run"]
    end

    BQ_PUB -->|SQL COPY| T1
    T1 -->|01_staging.sql| T2
    T2 -->|embeddings.py| T3
    T3 -->|clustering.py| T4
    T4 -->|enrichment.py| T5
    T2 -->|03_quality_checks.sql| T6

    MAIN --> E --> C --> EN
    E --> T3
    C --> T4
    EN --> T5
    CS --> PIPELINE

    T3 -->|VECTOR_SEARCH| SEARCH
    T5 -->|JOIN| CLUSTERS
    T5 -->|JOIN| CLUSTER_ID
    T5 -->|UPDATE| ENRICH
    T6 -->|SELECT| QUALITY

    API --> Frontend
    VIEWS --> LS
    LS -->|iframe| P4

    OPENAI --> E
    OPENAI --> C
    OPENAI --> EN
    OPENAI --> SEARCH

    SM --> API
    SM --> PIPELINE
    GHA --> AR
    AR --> API
    AR --> PIPELINE
```

---

## 2. Data Flow

```mermaid
flowchart LR
    subgraph Day1["Day 1 — SQL + BQ Setup"]
        RAW["thelook\n.products\n~29k rows"] -->|01_staging.sql\ndedup + cast| CLEAN["products_clean\n~20k rows\nvalid + normalized"]
        CLEAN -->|03_quality_checks.sql\n12 assertions| QREPORT["quality_report"]
    end

    subgraph Day2["Day 2 — Pipeline + API"]
        CLEAN -->|embeddings.py\nbatch 250 × 80\n~30min| EMBEDDED["products_embedded\n20k × ARRAY FLOAT64 1536\n+ SCANN index"]
        EMBEDDED -->|clustering.py\nHDBSCAN\nmin_cluster_size=15| CLUSTERED["products_clustered\n~1000–1500 clusters\n+ noise cluster_id=-1"]
        CLUSTERED -->|enrichment.py\nGPT-4o-mini\n50w luxury| ENRICHED["products_enriched\n20k descriptions"]
        ENRICHED -->|FastAPI\nCloud Run| API_SVC["vitrine-api\n:8080"]
    end

    subgraph Day3["Day 3 — Frontend + Looker"]
        API_SVC -->|NEXT_PUBLIC_API_URL| NEXT["Next.js 14\nVercel"]
        ENRICHED -->|6 views| LOOKER["Looker Studio\npublic link"]
        LOOKER -->|iframe| NEXT
    end
```

---

## 3. BigQuery Schema

```mermaid
erDiagram
    products_raw {
        INT64 product_id PK
        STRING name
        STRING brand
        STRING category
        STRING department
        FLOAT64 retail_price
        FLOAT64 cost
        TIMESTAMP created_at
        DATE ingestion_date
    }

    products_clean {
        INT64 product_id PK
        STRING name
        STRING brand
        STRING category
        STRING department
        FLOAT64 retail_price
        FLOAT64 cost
        FLOAT64 margin_pct
        BOOL is_valid
        STRING validation_errors
        TIMESTAMP cleaned_at
    }

    products_embedded {
        INT64 product_id PK
        ARRAY_FLOAT64 embedding
        STRING embedding_text
        STRING embedding_model
        INT64 embedding_tokens
        TIMESTAMP embedding_created_at
    }

    products_clustered {
        INT64 product_id PK
        INT64 cluster_id
        STRING cluster_label
        FLOAT64 cluster_probability
        BOOL is_noise
        TIMESTAMP clustering_created_at
    }

    products_enriched {
        INT64 product_id PK
        STRING description_enriched
        STRING description_model
        INT64 cluster_id
        STRING cluster_label
        TIMESTAMP description_created_at
    }

    quality_report {
        TIMESTAMP report_timestamp
        INT64 total_records
        INT64 valid_records
        FLOAT64 completeness_pct
    }

    products_raw ||--|| products_clean : "cleaned →"
    products_clean ||--|| products_embedded : "embedded →"
    products_embedded ||--|| products_clustered : "clustered →"
    products_clustered ||--|| products_enriched : "enriched →"
```

---

## 4. API Contract

```mermaid
sequenceDiagram
    participant User as Browser / Next.js
    participant API as FastAPI (Cloud Run)
    participant OAI as OpenAI
    participant BQ as BigQuery

    User->>API: POST /search {"query": "chaussure running légère"}
    API->>OAI: embeddings.create(text)
    OAI-->>API: [0.001, ..., -0.003] (1536 dims)
    API->>BQ: VECTOR_SEARCH(products_embedded, query_vec, top_k=10)
    BQ-->>API: [{product_id, name, distance}, ...]
    API->>BQ: JOIN products_enriched ON product_id
    BQ-->>API: + enriched_description, cluster_label
    API-->>User: {results: [...], pagination: {...}}

    User->>API: GET /clusters
    API->>BQ: SELECT cluster_id, COUNT(*), AVG(price) ... GROUP BY
    BQ-->>API: [{cluster_id, label, count, avg_price, brands}, ...]
    API-->>User: {clusters: [...]}

    User->>API: GET /clusters/7/products
    API->>BQ: SELECT * FROM products_enriched WHERE cluster_id=7
    BQ-->>API: products + inventory + sales stats
    API-->>User: {cluster: {...}, products: [...]}

    User->>API: POST /enrich {"product_id": 12345}
    API->>BQ: SELECT product from products_clean WHERE id=12345
    BQ-->>API: {name, brand, category, ...}
    API->>OAI: chat.completions.create(prompt, gpt-4o-mini)
    OAI-->>API: "Découvrez notre collection..."
    API->>BQ: UPDATE products_enriched SET description=...
    API-->>User: {enriched_description: "..."}
```

---

## 5. Pipeline Orchestration

```mermaid
stateDiagram-v2
    [*] --> CheckIdempotency
    CheckIdempotency --> AlreadyDone : today's run exists\n+ status=COMPLETE
    CheckIdempotency --> LoadProductsClean : first run today
    AlreadyDone --> [*] : skip (unless force)

    LoadProductsClean --> CheckEmbeddings
    CheckEmbeddings --> GenerateEmbeddings : new products found
    CheckEmbeddings --> LoadExistingEmbeddings : all already embedded
    GenerateEmbeddings --> WriteEmbeddingsBQ
    WriteEmbeddingsBQ --> RunHDBSCAN
    LoadExistingEmbeddings --> RunHDBSCAN

    RunHDBSCAN --> GenerateClusterLabels
    GenerateClusterLabels --> WriteClustersBQ

    WriteClustersBQ --> GenerateDescriptions
    GenerateDescriptions --> WriteEnrichmentBQ

    WriteEnrichmentBQ --> RunQualityChecks
    RunQualityChecks --> QualityFailed : assertions fail
    RunQualityChecks --> MarkRunComplete : all pass

    QualityFailed --> LogQualityErrors
    LogQualityErrors --> MarkRunFailed

    MarkRunComplete --> [*]
    MarkRunFailed --> [*]
```

---

## 6. Infrastructure & CI/CD

```mermaid
graph LR
    subgraph GitHub
        CODE["push to main\n(api/** or docker/**)"]
        GHA["GitHub Actions\n.github/workflows/deploy.yml"]
    end

    subgraph GCP_INFRA["GCP Infrastructure"]
        WIF["Workload Identity\nFederation\n(keyless auth)"]
        AR["Artifact Registry\neu-west1-docker.pkg.dev\nvitrine-wamba-2026/vitrine-docker"]
        CR_API["Cloud Run Service\nvitrine-api\n0–10 instances\n2 CPU / 2 GB"]
        CR_JOB["Cloud Run Job\nvitrine-pipeline\n4 CPU / 8 GB"]
        SM["Secret Manager\nOPENAI_API_KEY\nLANGSMITH_API_KEY"]
        CS["Cloud Scheduler\n0 2 * * * UTC"]
        BQ["BigQuery\nvitrine_dataset"]
    end

    CODE -->|triggers| GHA
    GHA -->|WIF keyless| WIF
    WIF -->|auth| AR
    GHA -->|docker build| AR
    GHA -->|gcloud run deploy| CR_API
    SM -->|secrets injection| CR_API
    SM -->|secrets injection| CR_JOB
    CS -->|HTTP POST /run| CR_JOB
    CR_JOB -->|read/write| BQ
    CR_API -->|read| BQ
```

---

## 7. Frontend Architecture

```mermaid
graph TD
    subgraph Vercel["Vercel · vitrine.stephanewamba.com"]
        LAYOUT["layout.tsx\nHeader + Footer"]

        subgraph Pages
            P1["page.tsx\n/ · Search\n(Client Component)"]
            P2["clusters/page.tsx\n/clusters\n(Server Component)"]
            P3["clusters/[id]/page.tsx\n/clusters/:id\n(Server Component)"]
            P4["quality/page.tsx\n/quality\n(Server Component)"]
        end

        subgraph Components
            SB["SearchBar.tsx\n'use client'\ndebounce 300ms"]
            PC["ProductCard.tsx\ngrid | list variant"]
            CG["ClusterGrid.tsx\n4 cols desktop"]
            SK["Skeleton.tsx\nloading states"]
        end

        subgraph Lib
            API_LIB["lib/api.ts\napiClient.search()\napiClient.getClusters()\napiClient.getCluster(id)\napiClient.getQuality()"]
            TYPES["types/index.ts\nProduct, Cluster\nSearchResult\nQualityMetrics"]
        end
    end

    P1 --> SB
    P1 --> PC
    P2 --> CG
    P2 --> SK
    P3 --> PC
    P3 --> SK
    P4 -->|iframe| LOOKER["Looker Studio\npublic embed"]

    SB -->|POST /search| API_LIB
    CG -->|GET /clusters| API_LIB
    P3 -->|GET /clusters/id/products| API_LIB
    P4 -->|GET /quality| API_LIB

    API_LIB -->|NEXT_PUBLIC_API_URL| FASTAPI["FastAPI\nCloud Run"]
```

---

## 8. Implementation Plan

### Day 1 — Wednesday 26/03: GCP Setup + SQL + BigQuery

| # | Task | File | Notes |
|---|------|------|-------|
| 1.1 | Enable GCP APIs | `infra/setup.sh` | bigquery, run, artifactregistry, secretmanager, cloudscheduler |
| 1.2 | Create service accounts + IAM | `infra/iam.sh` | vitrine-cloud-run SA with minimal roles |
| 1.3 | Create BigQuery dataset + tables | `sql/00_create_tables.sql` | vitrine_dataset, EU region |
| 1.4 | Staging SQL | `sql/01_staging.sql` | Copy + dedup from thelook_ecommerce |
| 1.5 | Transform SQL | `sql/02_transform.sql` | Normalize, impute, validate, margin_pct |
| 1.6 | Quality checks SQL | `sql/03_quality_checks.sql` | 12 assertions + quality_report table |
| 1.7 | Create VECTOR_SEARCH index | `sql/04_vector_index.sql` | SCANN index on products_embedded.embedding |
| 1.8 | Create Looker Studio views | `sql/05_looker_views.sql` | 6 views for dashboard |
| 1.9 | Run SQL + validate in BQ console | — | Verify row counts + quality metrics |

### Day 2 — Thursday 27/03: Pipeline + API + Docker + Cloud Run

| # | Task | File | Notes |
|---|------|------|-------|
| 2.1 | `embeddings.py` | `pipeline/embeddings.py` | Batch 250, retry×5, write ARRAY<FLOAT64> to BQ |
| 2.2 | `clustering.py` | `pipeline/clustering.py` | HDBSCAN min_size=15, GPT-4o-mini labels |
| 2.3 | `enrichment.py` | `pipeline/enrichment.py` | 50-word luxury descriptions per cluster |
| 2.4 | `main.py` orchestrator | `pipeline/main.py` | Idempotency via pipeline_runs table |
| 2.5 | FastAPI routes | `api/main.py` + `api/routers/*.py` | /search /clusters /enrich /quality |
| 2.6 | BigQuery service | `api/services/bigquery.py` | VECTOR_SEARCH + cluster queries |
| 2.7 | OpenAI service | `api/services/openai.py` | Embedding + enrichment calls |
| 2.8 | Pydantic models | `api/models/*.py` | SearchRequest, ProductResult, Cluster, QualityMetrics |
| 2.9 | Dockerfile | `docker/Dockerfile` | Multi-stage, non-root user, port 8080 |
| 2.10 | Store secrets | — | `gcloud secrets create openai-api-key` |
| 2.11 | Push image + deploy API | — | `gcloud run deploy vitrine-api` |
| 2.12 | Deploy pipeline job | — | `gcloud run jobs create vitrine-pipeline-job` |
| 2.13 | Create Cloud Scheduler | — | `0 2 * * *` cron trigger |

### Day 3 — Friday 28/03: Frontend + Vercel + Looker + README

| # | Task | File | Notes |
|---|------|------|-------|
| 3.1 | Init Next.js 14 app | `frontend/` | `npx create-next-app@latest` + Tailwind |
| 3.2 | TypeScript types | `frontend/types/index.ts` | Product, Cluster, SearchResult, QualityMetrics |
| 3.3 | API client | `frontend/lib/api.ts` | apiClient with all 4 endpoints |
| 3.4 | SearchBar component | `frontend/components/SearchBar.tsx` | Debounce 300ms, loading state |
| 3.5 | ProductCard component | `frontend/components/ProductCard.tsx` | grid/list variants |
| 3.6 | ClusterGrid component | `frontend/components/ClusterGrid.tsx` | Responsive 4→2→1 cols |
| 3.7 | Page `/` | `frontend/app/page.tsx` | Search bar + results |
| 3.8 | Page `/clusters` | `frontend/app/clusters/page.tsx` | Server component + Suspense |
| 3.9 | Page `/clusters/[id]` | `frontend/app/clusters/[id]/page.tsx` | Cluster detail + products |
| 3.10 | Page `/quality` | `frontend/app/quality/page.tsx` | KPIs + Looker iframe |
| 3.11 | Deploy to Vercel | — | `vercel --prod` + env vars |
| 3.12 | Create Looker Studio dashboard | — | 6 charts, share public link |
| 3.13 | GitHub Actions workflow | `.github/workflows/deploy.yml` | Workload Identity + Cloud Run |
| 3.14 | Write README | `README.md` | Architecture diagram + 3 links |

### Day 4 — Sunday 29/03: Buffer + Polish + Send

| # | Task |
|---|------|
| 4.1 | End-to-end test: search → results → cluster detail |
| 4.2 | Check Looker Studio data freshness |
| 4.3 | Polish README with final links |
| 4.4 | Send 3 links to Arnaud: app live + Looker Studio + GitHub |

---

## 9. Deliverables

| Deliverable | URL |
|---|---|
| App live | `https://vitrine.stephanewamba.com` |
| Looker Studio | `https://lookerstudio.google.com/reporting/[ID]` |
| GitHub repo | `https://github.com/StephaneWamba/vitrine` |

---

## 10. Tech Stack Summary

| Layer | Technology |
|---|---|
| Data warehouse | BigQuery (GCP, EU region) |
| Vector search | BigQuery VECTOR_SEARCH (SCANN index) |
| Embeddings | OpenAI text-embedding-3-small (1536 dims) |
| Clustering | HDBSCAN (min_cluster_size=15, metric=cosine) |
| GenAI enrichment | GPT-4o-mini (cluster labels + 50-word descriptions) |
| LLM monitoring | LangSmith |
| Pipeline | Cloud Run Job (Python 3.11) |
| API | FastAPI + Uvicorn (Cloud Run Service) |
| Containerization | Docker multi-stage (non-root, port 8080) |
| Frontend | Next.js 14 + Tailwind CSS (App Router) |
| Frontend deploy | Vercel |
| Dashboard | Looker Studio (public, BigQuery-connected) |
| CI/CD | GitHub Actions + Workload Identity Federation |
| Secrets | GCP Secret Manager |
| Python deps | uv (package manager) |

---

## 11. Cost Estimate

| Service | Monthly cost |
|---|---|
| BigQuery (storage + queries) | ~$5.75 |
| Cloud Run (API + Job) | ~$2.71 |
| Cloud Scheduler | ~$0.10 |
| Secret Manager | ~$0.15 |
| Artifact Registry | ~$0.10 |
| OpenAI (one-time pipeline run) | ~$4.03 |
| Monitoring / Logging | ~$0.50 |
| **Total** | **~$13.34/month** |

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| HDBSCAN finds too few clusters (<10) | Assertion in 03_quality_checks + fallback to KMeans |
| OpenAI rate limit during batch embed | Exponential backoff + batch size 250 |
| Cloud Run cold start >15s | min-instances=1 for API |
| BigQuery VECTOR_SEARCH index not ready | Assert index exists before first /search |
| Looker Studio iframe CSP blocked | Fallback link in /quality page |
| 3-day deadline miss | Day 3 tasks are optional polish; MVP = SQL + Pipeline + API |
