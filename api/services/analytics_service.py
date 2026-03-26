"""Analytics data — queries the 6 looker_* BigQuery views."""
from __future__ import annotations
from google.cloud import bigquery
from config import PROJECT, DATASET


def get_analytics(bq: bigquery.Client) -> dict:
    ds = f"{PROJECT}.{DATASET}"

    cluster_dist = list(bq.query(f"""
        SELECT cluster_label, product_count, avg_price
        FROM `{ds}.looker_cluster_distribution`
        ORDER BY product_count DESC
        LIMIT 40
    """).result())

    pricing = list(bq.query(f"""
        SELECT cluster_label, avg_price, price_min, price_max, product_count
        FROM `{ds}.looker_pricing_per_cluster`
        ORDER BY avg_price DESC
        LIMIT 20
    """).result())

    heatmap = list(bq.query(f"""
        SELECT category, department, product_count, avg_price
        FROM `{ds}.looker_heatmap_cat_dept`
        ORDER BY product_count DESC
    """).result())

    quality = list(bq.query(f"""
        SELECT completeness_pct, total_records, valid_records,
               field_name_completeness, field_brand_completeness,
               field_cat_completeness, field_price_completeness,
               price_mean, price_min, price_max
        FROM `{ds}.looker_data_quality`
        LIMIT 1
    """).result())

    timeline = list(bq.query(f"""
        SELECT sale_date, cluster_label, sales_count, sales_revenue
        FROM `{ds}.looker_sales_timeline`
        ORDER BY sale_date ASC
    """).result())

    brands = list(bq.query(f"""
        SELECT cluster_label, brand, product_count
        FROM `{ds}.looker_brands_per_cluster`
        ORDER BY cluster_label, product_count DESC
        LIMIT 100
    """).result())

    def row(r):
        return {k: (float(v) if hasattr(v, '__float__') and not isinstance(v, (int, str, bool)) else v)
                for k, v in dict(r).items()}

    return {
        "cluster_distribution": [row(r) for r in cluster_dist],
        "pricing": [row(r) for r in pricing],
        "heatmap": [row(r) for r in heatmap],
        "quality": row(quality[0]) if quality else {},
        "timeline": [
            {**{k: v for k, v in dict(r).items() if k != "sale_date"},
             "sale_date": str(r.sale_date)}
            for r in timeline
        ],
        "brands": [row(r) for r in brands],
    }
