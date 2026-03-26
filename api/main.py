"""
Vitrine API — FastAPI application.

Endpoints:
  POST /search                      Semantic product search (VECTOR_SEARCH)
  GET  /clusters                    List all HDBSCAN clusters
  GET  /clusters/{id}/products      Products in a specific cluster
  POST /enrich                      On-demand GPT-4o-mini enrichment
  GET  /quality                     Latest data quality report
  POST /intent                      Buyer intent analysis (GenAI RAG)
  GET  /healthz                     Health check
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import search, clusters, enrich, quality, intent, analytics

app = FastAPI(
    title="Vitrine API",
    description="Retail catalog intelligence — semantic search, clustering, and AI enrichment.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tightened per-env via Cloud Run env var if needed
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search.router)
app.include_router(clusters.router)
app.include_router(enrich.router)
app.include_router(quality.router)
app.include_router(intent.router)
app.include_router(analytics.router)


@app.get("/healthz", tags=["health"])
def healthz() -> dict:
    return {"status": "ok"}
