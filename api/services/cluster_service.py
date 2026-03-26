"""Cluster data service."""
from __future__ import annotations

from google.cloud import bigquery
from config import TABLE_CLUSTERED, TABLE_CLEAN, TABLE_ENRICHED
from models.schemas import ClusterSummary, ClustersResponse, ClusterProduct, ClusterProductsResponse
from services.cache import ttl_cache


@ttl_cache(seconds=600)
def get_clusters(bq: bigquery.Client) -> ClustersResponse:
    sql = f"""
    SELECT
      cl.cluster_id,
      cl.cluster_label,
      COUNT(DISTINCT cl.product_id)       AS product_count,
      ROUND(AVG(c.retail_price), 2)       AS avg_price
    FROM `{TABLE_CLUSTERED}` cl
    JOIN `{TABLE_CLEAN}`     c  USING (product_id)
    WHERE cl.cluster_id != -1
    GROUP BY cl.cluster_id, cl.cluster_label
    ORDER BY product_count DESC
    """
    rows = list(bq.query(sql).result())
    clusters = [
        ClusterSummary(
            cluster_id=r.cluster_id,
            cluster_label=r.cluster_label or f"Cluster {r.cluster_id}",
            product_count=r.product_count,
            avg_price=float(r.avg_price),
        )
        for r in rows
    ]
    return ClustersResponse(clusters=clusters)


@ttl_cache(seconds=600)
def get_cluster_products(bq: bigquery.Client, cluster_id: int) -> ClusterProductsResponse:
    sql = f"""
    SELECT
      c.product_id,
      c.name,
      c.brand,
      c.retail_price,
      en.description_enriched,
      cl.cluster_label
    FROM `{TABLE_CLUSTERED}` cl
    JOIN `{TABLE_CLEAN}`     c  USING (product_id)
    LEFT JOIN `{TABLE_ENRICHED}` en ON c.product_id = en.product_id
    WHERE cl.cluster_id = {cluster_id}
    ORDER BY c.retail_price DESC
    LIMIT 200
    """
    rows = list(bq.query(sql).result())
    if not rows:
        return ClusterProductsResponse(cluster_id=cluster_id, cluster_label="", products=[])

    cluster_label = rows[0].cluster_label or f"Cluster {cluster_id}"
    products = [
        ClusterProduct(
            product_id=r.product_id,
            name=r.name,
            brand=r.brand,
            retail_price=float(r.retail_price),
            description_enriched=r.description_enriched,
        )
        for r in rows
    ]
    return ClusterProductsResponse(
        cluster_id=cluster_id,
        cluster_label=cluster_label,
        products=products,
    )
