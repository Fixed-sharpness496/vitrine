# Vitrine — Intelligence de catalogue produit retail

> Projet portfolio · Davidson interview prep · Mars 2026

---

## Concept

Plateforme d'intelligence de catalogue produit retail construite entièrement sur GCP.
Elle ingère les données produits depuis BigQuery, génère des embeddings sémantiques,
clusterise automatiquement les gammes, enrichit les descriptions via GenAI, et expose
le tout via une API FastAPI et un dashboard Looker Studio public.

Contexte réel adressé : un retailer avec 20 000+ références mal catégorisées, des
descriptions incomplètes et zéro exploitation IA de son catalogue.

---

## Données source

**Dataset : TheLook Ecommerce** — hébergé nativement dans BigQuery, accès gratuit.

```
bigquery-public-data.thelook_ecommerce
```

Tables utilisées :

| Table | Contenu | Utilisation |
|---|---|---|
| `products` | id, name, brand, category, department, retail_price, cost | Source principale embeddings + clustering |
| `inventory_items` | product_id, cost, created_at, sold_at | Calcul rotation stocks par cluster |
| `order_items` | product_id, status, created_at | Performance commerciale par gamme |
| `orders` | order_id, user_id, status, created_at | Volume ventes agrégé |

Lien officiel : https://console.cloud.google.com/marketplace/product/bigquery-public-data/thelook-ecommerce

---

## Architecture

```
[BigQuery public]
bigquery-public-data.thelook_ecommerce.products
        |
        v
[Couche staging — SQL]
vitrine_dataset.products_raw
  -> nettoyage : suppression doublons, normalisation noms de marques
  -> validation : completude des champs obligatoires (name, category, brand)
  -> table : vitrine_dataset.products_clean

        |
        v
[Pipeline Python — Cloud Run Job]
  1. Lecture products_clean depuis BigQuery
  2. Génération embeddings OpenAI text-embedding-3-small
     sur (product_name + " " + category + " " + brand + " " + department)
  3. Écriture embeddings dans BigQuery (ARRAY<FLOAT64>)
     -> table : vitrine_dataset.products_embedded
  4. Clustering HDBSCAN sur les embeddings (min_cluster_size=15)
     -> chaque produit reçoit un cluster_id + cluster_label généré par GPT-4o-mini
     -> table : vitrine_dataset.products_clustered
  5. Enrichissement descriptions :
     GPT-4o-mini génère une description enrichie par cluster
     (50 mots max, ton retail luxe)
     -> table : vitrine_dataset.products_enriched

        |
        v
[FastAPI — GCP Cloud Run]
  POST /search
    body: { "query": "chaussure de running légère" }
    -> embedding requête + BigQuery VECTOR_SEARCH
    -> retourne top 10 produits les plus proches

  GET /clusters
    -> liste des clusters avec nombre de produits, marques dominantes, prix moyen

  GET /clusters/{cluster_id}/products
    -> produits d'un cluster avec descriptions enrichies

  POST /enrich
    body: { "product_id": 12345 }
    -> génère description enrichie à la volée via GPT-4o-mini

  GET /quality
    -> métriques qualité données :
       taux de completude par champ, nombre de doublons détectés,
       distribution des prix aberrants, couverture embeddings

        |
        v
[Next.js — Vercel]
  /                 -> barre de recherche sémantique + résultats
  /clusters         -> visualisation des gammes détectées
  /clusters/[id]    -> fiche cluster avec produits et description enrichie
  /quality          -> dashboard qualité données (embedded iframe Looker Studio)

        |
        v
[Looker Studio — lien public partageable]
  Dashboard branché directement sur vitrine_dataset :
  - Répartition des clusters (treemap)
  - Top 10 marques par cluster (bar chart)
  - Prix moyen par gamme (bar chart)
  - Taux de completude des données (gauge)
  - Volume de ventes par cluster (time series)
  - Carte de chaleur : category x department
```

---

## Stack technique complète

| Couche | Technologie |
|---|---|
| Data warehouse | BigQuery (GCP) |
| Transformations SQL | BigQuery SQL (3 couches : raw, clean, enriched) |
| Embeddings | OpenAI text-embedding-3-small |
| Vector search | BigQuery VECTOR_SEARCH (natif GCP) |
| Clustering | HDBSCAN (scikit-learn-extra) |
| GenAI enrichissement | GPT-4o-mini (OpenAI) |
| Pipeline orchestration | Cloud Run Job (cron GCP Cloud Scheduler) |
| API backend | FastAPI + Uvicorn |
| Déploiement backend | GCP Cloud Run (conteneur Docker) |
| Frontend | Next.js 14 + Tailwind CSS |
| Déploiement frontend | Vercel |
| Dashboard | Looker Studio (connecté BigQuery) |
| CI/CD | GitHub Actions -> Cloud Run deploy |
| Conteneurisation | Docker (multi-stage build) |
| Monitoring | Cloud Run metrics + LangSmith pour les appels LLM |

---

## Structure du repo

```
vitrine/
├── README.md
├── docker/
│   └── Dockerfile
├── sql/
│   ├── 01_staging.sql          # nettoyage et validation products_raw
│   ├── 02_transform.sql        # création products_clean
│   └── 03_quality_checks.sql   # assertions qualité données
├── pipeline/
│   ├── embeddings.py           # génération embeddings OpenAI
│   ├── clustering.py           # HDBSCAN + labeling GPT-4o-mini
│   ├── enrichment.py           # génération descriptions enrichies
│   └── main.py                 # orchestration du pipeline complet
├── api/
│   ├── main.py                 # FastAPI app
│   ├── routers/
│   │   ├── search.py           # POST /search
│   │   ├── clusters.py         # GET /clusters
│   │   ├── enrich.py           # POST /enrich
│   │   └── quality.py          # GET /quality
│   └── services/
│       ├── bigquery.py         # client BigQuery
│       └── openai.py           # client OpenAI
├── frontend/
│   ├── app/
│   │   ├── page.tsx            # recherche sémantique
│   │   ├── clusters/
│   │   │   ├── page.tsx        # liste des clusters
│   │   │   └── [id]/page.tsx   # détail cluster
│   │   └── quality/page.tsx    # qualité données
│   └── components/
│       ├── SearchBar.tsx
│       ├── ProductCard.tsx
│       └── ClusterGrid.tsx
├── looker/
│   └── dashboard_schema.json   # config exportée du dashboard Looker Studio
├── .github/
│   └── workflows/
│       └── deploy.yml          # CI/CD GitHub Actions -> Cloud Run
└── infra/
    └── cloud_run.yaml          # config déploiement Cloud Run
```

---

## Accès outils (tout gratuit pour ce projet)

| Outil | Acces | Lien |
|---|---|---|
| BigQuery sandbox | 10 GB stockage + 1 TB requetes/mois gratuits | https://cloud.google.com/bigquery/docs/sandbox |
| GCP Cloud Run | 2M requetes/mois + 360K GB-secondes gratuits | https://cloud.google.com/run/pricing |
| Looker Studio | 100% gratuit, dashboards partageables publiquement | https://lookerstudio.google.com |
| OpenAI embeddings | text-embedding-3-small : $0.02 / 1M tokens (moins de $0.50 pour le projet entier) | https://platform.openai.com/docs/models |
| GPT-4o-mini | $0.15 / 1M input tokens (negligeable) | https://platform.openai.com/docs/models |
| Vercel | Gratuit pour Next.js | https://vercel.com |
| GitHub Actions | Gratuit | https://github.com |

---

## Ce que Davidson voit (livrable entretien)

Trois liens envoyés à Arnaud la veille du 30/03 :

1. **Application live** : `vitrine.stephanewamba.com`
   Recherche sémantique fonctionnelle, vue clusters, fiches produits enrichies

2. **Dashboard Looker Studio** : lien public partageable
   Branché sur BigQuery réel, mis à jour automatiquement

3. **GitHub repo** : `github.com/StephaneWamba/vitrine`
   README propre, architecture documentée, schémas SQL commentés

---

## Couverture des besoins Davidson

| Exigence fiche Davidson | Couvert par Vitrine |
|---|---|
| Sourcing données depuis Datalake BigQuery | TheLook public dataset nativement dans BQ |
| SQL sur BigQuery | 3 fichiers SQL (staging, transform, quality) |
| Automatisation processus IA : embedding + clustering | Pipeline Python complet sur Cloud Run |
| Transformer données brutes en tables optimisées | 4 couches BigQuery (raw, clean, embedded, clustered) |
| Optimiser déploiement backend GCP | Cloud Run + Docker multi-stage |
| Looker branché sur données réelles | Dashboard Looker Studio + BigQuery natif |
| GenAI (embedding, enrichissement) | OpenAI embeddings + GPT-4o-mini descriptions |
| Qualité données + documentation schémas | Quality endpoint + SQL assertions + README |
| CI/CD | GitHub Actions -> Cloud Run auto-deploy |
| FastAPI Python | API complète avec 4 endpoints |

---

## Ordre de réalisation (3 jours)

**Jour 1 (mer 26/03)**
- Créer le projet GCP, activer BigQuery sandbox
- Ecrire les 3 fichiers SQL (staging, transform, quality)
- Valider les tables dans BigQuery console
- Commencer pipeline embeddings.py

**Jour 2 (jeu 27/03)**
- Finir pipeline complet (embeddings + clustering + enrichissement)
- Construire l'API FastAPI (4 endpoints)
- Dockeriser et déployer sur Cloud Run

**Jour 3 (ven 28/03)**
- Construire le frontend Next.js (3 pages)
- Déployer sur Vercel
- Créer le dashboard Looker Studio + partager le lien
- Ecrire le README avec architecture

**Dim 29/03**
- Buffer pour corrections et polish
- Envoyer les 3 liens à Arnaud
