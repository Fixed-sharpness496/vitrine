"""Analytics data — 6 BigQuery views queried in parallel with TTL cache."""
from __future__ import annotations
from concurrent.futures import ThreadPoolExecutor, as_completed
from google.cloud import bigquery
from config import PROJECT, DATASET
from services.cache import ttl_cache

_ds = f"{PROJECT}.{DATASET}"

_QUERIES = {
    "cluster_distribution": f"""
        SELECT cluster_label, product_count, avg_price
        FROM `{_ds}.looker_cluster_distribution`
        ORDER BY product_count DESC LIMIT 40""",
    "pricing": f"""
        SELECT cluster_label, avg_price, price_min, price_max, product_count
        FROM `{_ds}.looker_pricing_per_cluster`
        ORDER BY avg_price DESC LIMIT 20""",
    "heatmap": f"""
        SELECT category, department, product_count, avg_price
        FROM `{_ds}.looker_heatmap_cat_dept`
        ORDER BY product_count DESC""",
    "quality": f"""
        SELECT completeness_pct, total_records, valid_records,
               field_name_completeness, field_brand_completeness,
               field_cat_completeness, field_price_completeness,
               price_mean, price_min, price_max
        FROM `{_ds}.looker_data_quality` LIMIT 1""",
    "timeline": f"""
        SELECT sale_date, cluster_label, sales_count, sales_revenue
        FROM `{_ds}.looker_sales_timeline`
        ORDER BY sale_date ASC""",
    "brands": f"""
        SELECT cluster_label, brand, product_count
        FROM `{_ds}.looker_brands_per_cluster`
        ORDER BY cluster_label, product_count DESC LIMIT 100""",
}


def _row(r) -> dict:
    return {
        k: (float(v) if hasattr(v, "__float__") and not isinstance(v, (int, str, bool)) else v)
        for k, v in dict(r).items()
    }


def _run(bq: bigquery.Client, key: str) -> tuple[str, list]:
    rows = list(bq.query(_QUERIES[key]).result())
    return key, rows


@ttl_cache(seconds=600)  # 10-minute cache — data only changes after pipeline run
def get_analytics(bq: bigquery.Client) -> dict:
    results: dict[str, list] = {}

    # Fire all 6 queries in parallel
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(_run, bq, key): key for key in _QUERIES}
        for future in as_completed(futures):
            key, rows = future.result()
            results[key] = rows

    timeline_rows = results["timeline"]
    quality_rows = results["quality"]

    return {
        "cluster_distribution": [_row(r) for r in results["cluster_distribution"]],
        "pricing": [_row(r) for r in results["pricing"]],
        "heatmap": [_row(r) for r in results["heatmap"]],
        "quality": _row(quality_rows[0]) if quality_rows else {},
        "timeline": [
            {**{k: v for k, v in dict(r).items() if k != "sale_date"},
             "sale_date": str(r.sale_date)}
            for r in timeline_rows
        ],
        "brands": [_row(r) for r in results["brands"]],
    }
